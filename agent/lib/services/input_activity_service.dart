import 'dart:io';
import 'input_activity_service_stub.dart';
import 'input_activity_service_windows.dart';

typedef InputCounts = ({int keyCount, int mouseClickCount});

/// Per-OS keyboard/mouse activity counting. Windows is fully implemented via
/// low-level win32 hooks; macOS/Linux use a stub pending native
/// implementations, mirroring TrackingService's per-OS split.
abstract class InputActivityService {
  void start();
  void stop();

  /// Returns counts accumulated since the last call, then resets them.
  InputCounts takeCounts();

  static InputActivityService create() {
    if (Platform.isWindows) return WindowsInputActivityService();
    return StubInputActivityService();
  }
}
