import 'package:flutter/services.dart';
import 'tracking_service.dart';

/// Calls into macos/Runner/NativeMonitor.swift for the two things macOS has
/// no C-callable API for (unlike Windows, where win32 FFI is enough):
/// frontmost-app/window-title via NSWorkspace + the Accessibility API, and
/// system idle time via CGEventSource.
class MacosTrackingService implements TrackingService {
  static const _channel = MethodChannel('monitor_data/native_macos');

  ActiveWindowSnapshot _lastKnown = const ActiveWindowSnapshot();
  Duration _lastKnownIdle = Duration.zero;

  MacosTrackingService() {
    // Both native calls are synchronous from Dart's perspective but the
    // channel itself is async, so callers get the last successfully polled
    // value immediately and a fresher one shortly after — matches this
    // agent's ~15s activity poll cadence closely enough in practice.
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final window = await _channel.invokeMapMethod<String, Object?>('getActiveWindow');
      _lastKnown = ActiveWindowSnapshot(
        appName: window?['appName'] as String?,
        windowTitle: window?['windowTitle'] as String?,
      );
      final idle = await _channel.invokeMethod<double>('getIdleSeconds');
      if (idle != null) {
        _lastKnownIdle = Duration(milliseconds: (idle * 1000).round());
      }
    } catch (_) {
      // Native side unavailable (shouldn't happen once built via Xcode) —
      // keep serving the last known snapshot.
    }
  }

  @override
  ActiveWindowSnapshot getActiveWindow() {
    _refresh();
    return _lastKnown;
  }

  @override
  Duration getIdleDuration() {
    _refresh();
    return _lastKnownIdle;
  }
}
