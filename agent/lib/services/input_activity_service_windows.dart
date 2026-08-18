import 'dart:ffi';
import 'package:win32/win32.dart';
import 'input_activity_service.dart';

// WH_KEYBOARD_LL / WH_MOUSE_LL hook procedures must be static/top-level
// (Dart FFI callbacks can't close over instance state), so the running
// counts live here rather than on WindowsInputActivityService itself. The
// hook fires on whichever thread installed it, which must be pumping a
// Win32 message loop for delivery to happen at all — Flutter's Windows
// embedder runs one on the engine's platform thread, so this is called from
// there, not from an arbitrary Dart isolate.
int _keyCount = 0;
int _mouseClickCount = 0;

int _lowLevelKeyboardProc(int nCode, int wParam, int lParam) {
  if (nCode >= 0 && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN)) {
    _keyCount++;
  }
  return CallNextHookEx(0, nCode, wParam, lParam);
}

int _lowLevelMouseProc(int nCode, int wParam, int lParam) {
  if (nCode >= 0 && (wParam == WM_LBUTTONDOWN || wParam == WM_RBUTTONDOWN || wParam == WM_MBUTTONDOWN)) {
    _mouseClickCount++;
  }
  return CallNextHookEx(0, nCode, wParam, lParam);
}

class WindowsInputActivityService implements InputActivityService {
  int _keyboardHook = 0;
  int _mouseHook = 0;

  @override
  void start() {
    if (_keyboardHook != 0 || _mouseHook != 0) return;
    final keyboardProc = Pointer.fromFunction<HOOKPROC>(_lowLevelKeyboardProc, 0);
    final mouseProc = Pointer.fromFunction<HOOKPROC>(_lowLevelMouseProc, 0);
    // hmod/dwThreadId are 0 for low-level hooks — they're always local to
    // the installing thread, no DLL injection involved.
    _keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, keyboardProc, 0, 0);
    _mouseHook = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, 0, 0);
  }

  @override
  void stop() {
    if (_keyboardHook != 0) {
      UnhookWindowsHookEx(_keyboardHook);
      _keyboardHook = 0;
    }
    if (_mouseHook != 0) {
      UnhookWindowsHookEx(_mouseHook);
      _mouseHook = 0;
    }
  }

  @override
  InputCounts takeCounts() {
    final counts = (keyCount: _keyCount, mouseClickCount: _mouseClickCount);
    _keyCount = 0;
    _mouseClickCount = 0;
    return counts;
  }
}
