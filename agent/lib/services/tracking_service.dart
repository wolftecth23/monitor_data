import 'dart:io';
import 'tracking_service_macos.dart';
import 'tracking_service_stub.dart';
import 'tracking_service_windows.dart';

class ActiveWindowSnapshot {
  final String? appName;
  final String? windowTitle;
  const ActiveWindowSnapshot({this.appName, this.windowTitle});
}

/// Per-OS active-window + idle-time detection. Windows is fully implemented
/// via win32 FFI; macOS goes through a Flutter method channel into
/// macos/Runner/NativeMonitor.swift (NSWorkspace + Accessibility API have no
/// C-callable equivalent); Linux uses a stub pending a native implementation
/// (X11/wmctrl).
abstract class TrackingService {
  ActiveWindowSnapshot getActiveWindow();

  /// How long since the last keyboard/mouse input, used for idle detection.
  Duration getIdleDuration();

  static TrackingService create() {
    if (Platform.isWindows) return WindowsTrackingService();
    if (Platform.isMacOS) return MacosTrackingService();
    return StubTrackingService();
  }
}
