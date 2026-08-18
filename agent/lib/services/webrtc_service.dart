import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'socket_service.dart';

const _iceServers = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
  ],
};

/// Streams this machine's screen to an admin viewer on demand via WebRTC,
/// signaling relayed through [SocketService]. One local screen-capture
/// stream is shared across however many viewers are currently connected.
class WebrtcStreamer {
  final SocketService socket;
  final Map<String, RTCPeerConnection> _connections = {};
  MediaStream? _localStream;

  WebrtcStreamer(this.socket);

  // Desktop getDisplayMedia requires an explicit source id from
  // desktopCapturer (unlike web/mobile, where {'video': true} is enough) —
  // there is no interactive picker since the agent runs headless, so we
  // always take the primary screen.
  Future<MediaStream> _captureScreenStream() async {
    final sources = await desktopCapturer.getSources(types: [SourceType.Screen]);
    if (sources.isEmpty) {
      throw StateError('No desktop screen sources available for capture');
    }
    // Deliberately no minWidth/minHeight/maxWidth/maxHeight here: desktop
    // capture already returns the real screen resolution on its own, and
    // forcing explicit width/height constraints on it caused the native
    // capturer to scale/crop into the wrong aspect ratio instead of
    // grabbing the screen as-is (the squished/cropped live view bug).
    // Quality comes from the bitrate bump in startViewer() below, not from
    // constraining resolution here.
    return navigator.mediaDevices.getDisplayMedia({
      'video': {
        'deviceId': {'exact': sources.first.id},
        'mandatory': {'maxFrameRate': 12.0},
      },
      'audio': false,
    });
  }

  Future<void> startViewer(String viewerSocketId) async {
    _localStream ??= await _captureScreenStream();

    final pc = await createPeerConnection(_iceServers);
    for (final track in _localStream!.getTracks()) {
      final sender = await pc.addTrack(track, _localStream!);
      if (track.kind == 'video') {
        // Screen-share content (text, UI) needs a much higher bitrate than
        // the ~500kbps default to stay legible; low frame rate is fine since
        // desktop content is mostly static between screenshots. Without
        // degradationPreference, WebRTC's default adaptation quartered the
        // resolution (1920x1080 -> 480x270) to hit its target bitrate/CPU
        // budget instead of dropping frame rate — MAINTAIN_RESOLUTION tells
        // it to do the opposite, which is what we actually want here.
        final params = sender.parameters;
        params.encodings = [RTCRtpEncoding(active: true, maxBitrate: 4000000, minBitrate: 1000000)];
        params.degradationPreference = RTCDegradationPreference.MAINTAIN_RESOLUTION;
        await sender.setParameters(params);
      }
    }

    pc.onIceCandidate = (candidate) {
      socket.sendIceCandidate(viewerSocketId, candidate.toMap());
    };

    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.sendOffer(viewerSocketId, offer.toMap());

    _connections[viewerSocketId] = pc;
  }

  Future<void> handleAnswer(String from, Map<String, dynamic> sdp) async {
    final pc = _connections[from];
    if (pc == null) return;
    await pc.setRemoteDescription(RTCSessionDescription(sdp['sdp'] as String, sdp['type'] as String));
  }

  Future<void> handleIceCandidate(String from, Map<String, dynamic> candidate) async {
    final pc = _connections[from];
    if (pc == null) return;
    await pc.addCandidate(RTCIceCandidate(
      candidate['candidate'] as String?,
      candidate['sdpMid'] as String?,
      candidate['sdpMLineIndex'] as int?,
    ));
  }

  Future<void> stopViewer(String viewerSocketId) async {
    final pc = _connections.remove(viewerSocketId);
    await pc?.close();
    if (_connections.isEmpty) {
      for (final track in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
        await track.stop();
      }
      await _localStream?.dispose();
      _localStream = null;
    }
  }
}
