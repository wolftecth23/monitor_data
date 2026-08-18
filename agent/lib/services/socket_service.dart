import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import '../config.dart';

typedef ViewerJoinHandler = void Function(String viewerSocketId);
typedef ViewerLeaveHandler = void Function(String viewerSocketId);
typedef AnswerHandler = void Function(String from, Map<String, dynamic> sdp);
typedef IceCandidateHandler = void Function(String from, Map<String, dynamic> candidate);

/// Wraps the Socket.IO connection to the backend's device namespace:
/// presence/heartbeat plus WebRTC signaling relay for the live-view feature.
class SocketService {
  late final socket_io.Socket _socket;

  ViewerJoinHandler? onViewerJoin;
  ViewerLeaveHandler? onViewerLeave;
  AnswerHandler? onAnswer;
  IceCandidateHandler? onIceCandidate;

  Future<void> connect({
    required String installToken,
    required String hostname,
    required String platform,
  }) async {
    _socket = socket_io.io(
      AgentConfig.backendUrl,
      socket_io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({
            'role': 'device',
            'installToken': installToken,
            'hostname': hostname,
            'platform': platform,
          })
          .enableAutoConnect()
          .enableReconnection()
          .build(),
    );

    _socket.on('webrtc:viewer-join', (data) {
      onViewerJoin?.call(data['viewerSocketId'] as String);
    });
    _socket.on('webrtc:viewer-leave', (data) {
      onViewerLeave?.call(data['viewerSocketId'] as String);
    });
    _socket.on('webrtc:answer', (data) {
      onAnswer?.call(data['from'] as String, Map<String, dynamic>.from(data['sdp'] as Map));
    });
    _socket.on('webrtc:ice-candidate', (data) {
      onIceCandidate?.call(data['from'] as String, Map<String, dynamic>.from(data['candidate'] as Map));
    });
  }

  void sendHeartbeat({String? appName, String? windowTitle, bool isIdle = false}) {
    _socket.emit('activity:heartbeat', {
      'appName': appName,
      'windowTitle': windowTitle,
      'isIdle': isIdle,
    });
  }

  void sendOffer(String targetSocketId, Map<String, dynamic> sdp) {
    _socket.emit('webrtc:offer', {'targetSocketId': targetSocketId, 'sdp': sdp});
  }

  void sendIceCandidate(String targetSocketId, Map<String, dynamic> candidate) {
    _socket.emit('webrtc:ice-candidate', {'targetSocketId': targetSocketId, 'candidate': candidate});
  }

  void dispose() {
    _socket.dispose();
  }
}
