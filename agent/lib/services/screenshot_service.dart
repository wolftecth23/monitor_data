import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:screen_capturer/screen_capturer.dart';
import 'screenshot_service_linux.dart';
import 'screenshot_service_windows.dart';

class ScreenshotService {
  final WindowsScreenshotCapturer _windows = WindowsScreenshotCapturer();
  final LinuxScreenshotCapturer _linux = LinuxScreenshotCapturer();

  Future<File?> captureFullScreen() async {
    if (Platform.isWindows) return _windows.captureFullScreen();
    if (Platform.isLinux) return _linux.captureFullScreen();
    return _captureViaScreenCapturer();
  }

  // macOS's `screencapture` CLI supports non-interactive capture and is a
  // built-in system tool (not something that needs installing), unlike
  // screen_capturer's Windows backend (see screenshot_service_windows.dart
  // for why that's not used there) or relying on gnome-screenshot/spectacle
  // being present on Linux (see screenshot_service_linux.dart — native X11
  // capture instead, so nothing beyond the base desktop stack is required).
  Future<File?> _captureViaScreenCapturer() async {
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/monitor_${DateTime.now().millisecondsSinceEpoch}.jpg';

    final captured = await ScreenCapturer.instance.capture(
      mode: CaptureMode.screen,
      imagePath: path,
      silent: true,
      copyToClipboard: false,
    );

    if (captured?.imagePath == null) return null;
    final file = File(captured!.imagePath!);
    return file.existsSync() ? file : null;
  }
}
