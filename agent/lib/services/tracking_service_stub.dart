import 'tracking_service.dart';

/// Placeholder for macOS/Linux until native active-window + idle-time
/// detection is implemented (NSWorkspace on macOS, X11/wmctrl on Linux).
class StubTrackingService implements TrackingService {
  @override
  ActiveWindowSnapshot getActiveWindow() => const ActiveWindowSnapshot();

  @override
  Duration getIdleDuration() => Duration.zero;
}
