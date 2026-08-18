import 'dart:ffi';
import 'package:ffi/ffi.dart';
import 'package:win32/win32.dart';
import 'tracking_service.dart';

class WindowsTrackingService implements TrackingService {
  @override
  ActiveWindowSnapshot getActiveWindow() {
    final hwnd = GetForegroundWindow();
    // A hidden window can briefly still report as foreground (e.g. right after
    // window_manager.hide() before focus settles elsewhere); never attribute
    // activity to the agent's own window.
    if (hwnd == 0 || IsWindowVisible(hwnd) == 0) return const ActiveWindowSnapshot();

    final titlePtr = wsalloc(512);
    String? title;
    try {
      final len = GetWindowText(hwnd, titlePtr, 512);
      title = len > 0 ? titlePtr.toDartString() : null;
    } finally {
      free(titlePtr);
    }

    final pidPtr = calloc<Uint32>();
    String? processName;
    try {
      GetWindowThreadProcessId(hwnd, pidPtr);
      final pid = pidPtr.value;
      if (pid == GetCurrentProcessId()) return const ActiveWindowSnapshot();
      if (pid != 0) {
        final hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if (hProcess != 0) {
          final namePtr = wsalloc(MAX_PATH);
          final sizePtr = calloc<Uint32>()..value = MAX_PATH;
          try {
            final ok = QueryFullProcessImageName(hProcess, 0, namePtr, sizePtr);
            if (ok != 0) {
              final fullPath = namePtr.toDartString();
              processName = fullPath.split(RegExp(r'[\\/]')).last;
            }
          } finally {
            free(namePtr);
            free(sizePtr);
            CloseHandle(hProcess);
          }
        }
      }
    } finally {
      free(pidPtr);
    }

    return ActiveWindowSnapshot(appName: processName, windowTitle: title);
  }

  @override
  Duration getIdleDuration() {
    final info = calloc<LASTINPUTINFO>();
    try {
      info.ref.cbSize = sizeOf<LASTINPUTINFO>();
      if (GetLastInputInfo(info) == 0) return Duration.zero;
      // GetTickCount wraps every ~49.7 days; a wrapped delta would look
      // negative, in which case we just report "not idle" rather than a
      // bogus multi-day idle duration.
      final tickCount = GetTickCount();
      final idleMs = tickCount - info.ref.dwTime;
      return Duration(milliseconds: idleMs < 0 ? 0 : idleMs);
    } finally {
      free(info);
    }
  }
}
