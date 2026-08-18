import 'dart:async';
import 'config.dart';
import 'services/api_client.dart';
import 'services/input_activity_service.dart';
import 'services/log_service.dart';
import 'services/screenshot_service.dart';
import 'services/socket_service.dart';
import 'services/tracking_service.dart';
import 'services/usb_monitor_service.dart';
import 'services/webrtc_service.dart';

/// Orchestrates the agent's lifecycle: connects to the backend, applies the
/// employee's team tracking settings, and runs the screenshot + activity
/// loops. All work is silent by design — there is no UI.
class AppController {
  late final ApiClient _api;
  late final SocketService _socket;
  late final WebrtcStreamer _webrtc;
  final TrackingService _tracking = TrackingService.create();
  final ScreenshotService _screenshots = ScreenshotService();
  final InputActivityService _inputActivity = InputActivityService.create();
  final UsbMonitorService _usbMonitor = UsbMonitorService.create();

  Timer? _screenshotTimer;
  Timer? _activityTimer;
  Timer? _inputActivityTimer;
  Timer? _usbTimer;
  TrackingSettings? _settings;
  String? _lastAppName;
  DateTime _lastActivityStart = DateTime.now();
  DateTime _inputPeriodStart = DateTime.now();
  bool _inputActivityRunning = false;

  Future<void> start() async {
    final installToken = await AgentConfig.installToken();
    final hostname = await AgentConfig.hostname();
    final platform = AgentConfig.platformName();

    _api = await ApiClient.create();
    _socket = SocketService();
    _webrtc = WebrtcStreamer(_socket);

    _socket.onViewerJoin = (viewerSocketId) async {
      try {
        await _webrtc.startViewer(viewerSocketId);
      } catch (e, st) {
        await LogService.log('startViewer failed: $e\n$st');
      }
    };
    _socket.onViewerLeave = (viewerSocketId) => _webrtc.stopViewer(viewerSocketId);
    _socket.onAnswer = (from, sdp) => _webrtc.handleAnswer(from, sdp);
    _socket.onIceCandidate = (from, candidate) => _webrtc.handleIceCandidate(from, candidate);

    await _socket.connect(installToken: installToken, hostname: hostname, platform: platform);

    await _refreshSettings();
    // Re-pull settings periodically so admin changes (frequency, idle timeout,
    // tracking on/off) apply without restarting the agent.
    Timer.periodic(const Duration(minutes: 2), (_) => _refreshSettings());
  }

  Future<void> _refreshSettings() async {
    final previous = _settings;
    try {
      _settings = await _api.fetchSettings();
    } catch (_) {
      return; // keep previous settings; backend may be briefly unreachable
    }
    _applySettings(_settings!, previous);
  }

  // Re-fetched every 2 minutes so admin changes apply without a restart, but
  // most cycles carry unchanged settings — only touch a timer when the value
  // driving it actually changed, otherwise a periodic timer longer than the
  // refresh interval (e.g. a 5-minute screenshot frequency) would get
  // cancelled and rescheduled before it ever fires.
  void _applySettings(TrackingSettings settings, TrackingSettings? previous) {
    if (!settings.trackingEnabled) {
      _screenshotTimer?.cancel();
      _activityTimer?.cancel();
      _inputActivityTimer?.cancel();
      _usbTimer?.cancel();
      _stopInputActivity();
      return;
    }

    if (previous == null || !previous.trackingEnabled) {
      _usbTimer?.cancel();
      _usbTimer = Timer.periodic(const Duration(seconds: 30), (_) => _pollUsbEvents());
    }

    final screenshotSettingsChanged = previous == null ||
        !previous.trackingEnabled ||
        previous.captureScreenshots != settings.captureScreenshots ||
        previous.screenshotFrequencySec != settings.screenshotFrequencySec;
    if (screenshotSettingsChanged) {
      _screenshotTimer?.cancel();
      if (settings.captureScreenshots) {
        LogService.log('screenshot timer scheduled every ${settings.screenshotFrequencySec}s');
        _screenshotTimer = Timer.periodic(
          Duration(seconds: settings.screenshotFrequencySec),
          (_) => _captureScreenshot(),
        );
      }
    }

    final activityTrackingChanged = previous == null ||
        !previous.trackingEnabled ||
        previous.appUrlTracking != settings.appUrlTracking;
    if (activityTrackingChanged) {
      _activityTimer?.cancel();
      if (settings.appUrlTracking) {
        _activityTimer = Timer.periodic(const Duration(seconds: 15), (_) => _pollActivity());
      }
    }

    if (settings.keyboardMouseTracking) {
      _startInputActivity();
      final inputTrackingChanged = previous == null ||
          !previous.trackingEnabled ||
          !previous.keyboardMouseTracking;
      if (inputTrackingChanged) {
        _inputActivityTimer?.cancel();
        _inputActivityTimer = Timer.periodic(const Duration(seconds: 60), (_) => _flushInputActivity());
      }
    } else {
      _inputActivityTimer?.cancel();
      _stopInputActivity();
    }
  }

  void _startInputActivity() {
    if (_inputActivityRunning) return;
    _inputActivity.start();
    _inputActivityRunning = true;
    _inputPeriodStart = DateTime.now();
  }

  void _stopInputActivity() {
    if (!_inputActivityRunning) return;
    _inputActivity.stop();
    _inputActivityRunning = false;
  }

  Future<void> _flushInputActivity() async {
    final counts = _inputActivity.takeCounts();
    final periodEnd = DateTime.now();
    final periodStart = _inputPeriodStart;
    _inputPeriodStart = periodEnd;
    if (counts.keyCount == 0 && counts.mouseClickCount == 0) return;
    try {
      await _api.reportInputActivity(
        hostname: await AgentConfig.hostname(),
        keyCount: counts.keyCount,
        mouseClickCount: counts.mouseClickCount,
        periodStart: periodStart,
        periodEnd: periodEnd,
      );
    } catch (e, st) {
      await LogService.log('input activity report failed: $e\n$st');
    }
  }

  Future<void> _captureScreenshot() async {
    try {
      final snapshot = _tracking.getActiveWindow();
      final file = await _screenshots.captureFullScreen();
      if (file == null) {
        await LogService.log('screenshot capture returned null');
        return;
      }
      await _api.uploadScreenshot(
        file: file,
        hostname: await AgentConfig.hostname(),
        appName: snapshot.appName,
        windowTitle: snapshot.windowTitle,
      );
      await file.delete().catchError((_) => file);
    } catch (e, st) {
      await LogService.log('screenshot capture/upload failed: $e\n$st');
    }
  }

  Future<void> _pollUsbEvents() async {
    try {
      final events = await _usbMonitor.poll();
      if (events.isEmpty) return;
      final hostname = await AgentConfig.hostname();
      for (final event in events) {
        await _api.reportUsbEvent(
          hostname: hostname,
          deviceName: event.deviceName,
          vendorId: event.vendorId,
          productId: event.productId,
          eventType: event.eventType,
        );
      }
    } catch (e, st) {
      await LogService.log('usb event poll/report failed: $e\n$st');
    }
  }

  Future<void> _pollActivity() async {
    final snapshot = _tracking.getActiveWindow();
    final idleDuration = _tracking.getIdleDuration();
    final isIdle = idleDuration.inSeconds >= (_settings?.idleTimeoutSec ?? 300);

    _socket.sendHeartbeat(appName: snapshot.appName, windowTitle: snapshot.windowTitle, isIdle: isIdle);

    if (snapshot.appName != _lastAppName) {
      final now = DateTime.now();
      try {
        await _api.reportActivityEvent(
          hostname: await AgentConfig.hostname(),
          appName: snapshot.appName,
          windowTitle: snapshot.windowTitle,
          isIdle: isIdle,
          startedAt: _lastActivityStart,
          endedAt: now,
        );
      } catch (_) {
        // best-effort
      }
      _lastAppName = snapshot.appName;
      _lastActivityStart = now;
    }
  }
}
