import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:screen_capturer/screen_capturer.dart';
import 'screenshot_service_windows.dart';

class ScreenshotService {
  final WindowsScreenshotCapturer _windows = WindowsScreenshotCapturer();

  Future<File?> captureFullScreen() async {
    if (Platform.isWindows) return _windows.captureFullScreen();
    return _captureViaScreenCapturer();
  }

  // macOS (`screencapture` CLI) and Linux (gnome-screenshot/spectacle) both
  // support non-interactive capture, unlike screen_capturer's Windows
  // backend (see screenshot_service_windows.dart for why that's not used here).
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
