import 'dart:ffi';
import 'dart:io';
import 'package:ffi/ffi.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:win32/win32.dart';

/// Captures the full (multi-monitor) virtual screen via raw GDI BitBlt.
///
/// We use this instead of the `screen_capturer` package on Windows because
/// its Windows backend shells out to the interactive Snip & Sketch tool
/// (ms-screenclip:), which requires a visible UI and user interaction —
/// unusable for a hidden background agent. GDI capture is fully headless.
class WindowsScreenshotCapturer {
  Future<File?> captureFullScreen() async {
    final x = GetSystemMetrics(SM_XVIRTUALSCREEN);
    final y = GetSystemMetrics(SM_YVIRTUALSCREEN);
    final width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    final height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    if (width <= 0 || height <= 0) return null;

    final screenDC = GetDC(NULL);
    final memDC = CreateCompatibleDC(screenDC);
    final bitmap = CreateCompatibleBitmap(screenDC, width, height);
    final oldBitmap = SelectObject(memDC, bitmap);

    try {
      final ok = BitBlt(memDC, 0, 0, width, height, screenDC, x, y, SRCCOPY | CAPTUREBLT);
      if (ok == 0) return null;

      final bmi = calloc<BITMAPINFO>();
      final pixels = calloc<Uint8>(width * height * 4);
      try {
        bmi.ref.bmiHeader.biSize = sizeOf<BITMAPINFOHEADER>();
        bmi.ref.bmiHeader.biWidth = width;
        bmi.ref.bmiHeader.biHeight = -height; // negative = top-down DIB, no manual flip needed
        bmi.ref.bmiHeader.biPlanes = 1;
        bmi.ref.bmiHeader.biBitCount = 32;
        bmi.ref.bmiHeader.biCompression = BI_RGB;

        final linesCopied = GetDIBits(memDC, bitmap, 0, height, pixels, bmi, DIB_RGB_COLORS);
        if (linesCopied == 0) return null;

        final bytes = pixels.asTypedList(width * height * 4);
        final image = img.Image.fromBytes(
          width: width,
          height: height,
          bytes: bytes.buffer,
          order: img.ChannelOrder.bgra,
        );
        final jpg = img.encodeJpg(image, quality: 70);

        final dir = await getTemporaryDirectory();
        final path = '${dir.path}/monitor_${DateTime.now().millisecondsSinceEpoch}.jpg';
        final file = File(path);
        await file.writeAsBytes(jpg);
        return file;
      } finally {
        free(bmi);
        free(pixels);
      }
    } finally {
      SelectObject(memDC, oldBitmap);
      DeleteObject(bitmap);
      DeleteDC(memDC);
      ReleaseDC(NULL, screenDC);
    }
  }
}
