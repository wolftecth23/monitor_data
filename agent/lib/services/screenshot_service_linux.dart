import 'dart:ffi' as ffi;
import 'dart:io';
import 'package:ffi/ffi.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

// Mirrors only the leading fields of Xlib's XImage we actually read — the
// trailing function-pointer table (struct funcs) is never touched, so it's
// left out. Field order/types/padding must match the real (x86-64) struct
// exactly, verified against a live X server via scratch_x11_test.{dart,c}
// before this went in: matching depth/masks/bytes_per_line confirmed the
// offsets, and a same-connection fill+read round-trip confirmed pixel data
// comes back as BGRx — same channel order screenshot_service_windows.dart
// already assumes.
final class _XImage extends ffi.Struct {
  @ffi.Int32()
  external int width;
  @ffi.Int32()
  external int height;
  @ffi.Int32()
  external int xoffset;
  @ffi.Int32()
  external int format;
  external ffi.Pointer<ffi.Uint8> data;
  @ffi.Int32()
  external int byteOrder;
  @ffi.Int32()
  external int bitmapUnit;
  @ffi.Int32()
  external int bitmapBitOrder;
  @ffi.Int32()
  external int bitmapPad;
  @ffi.Int32()
  external int depth;
  @ffi.Int32()
  external int bytesPerLine;
  @ffi.Int32()
  external int bitsPerPixel;
}

typedef _XOpenDisplayNative = ffi.Pointer<ffi.Void> Function(ffi.Pointer<Utf8>);
typedef _XOpenDisplayDart = ffi.Pointer<ffi.Void> Function(ffi.Pointer<Utf8>);

typedef _XDefaultScreenNative = ffi.Int32 Function(ffi.Pointer<ffi.Void>);
typedef _XDefaultScreenDart = int Function(ffi.Pointer<ffi.Void>);

typedef _XDefaultRootWindowNative = ffi.Uint64 Function(ffi.Pointer<ffi.Void>);
typedef _XDefaultRootWindowDart = int Function(ffi.Pointer<ffi.Void>);

typedef _XDisplayDimNative = ffi.Int32 Function(ffi.Pointer<ffi.Void>, ffi.Int32);
typedef _XDisplayDimDart = int Function(ffi.Pointer<ffi.Void>, int);

typedef _XGetImageNative = ffi.Pointer<_XImage> Function(
    ffi.Pointer<ffi.Void>, ffi.Uint64, ffi.Int32, ffi.Int32, ffi.Uint32, ffi.Uint32, ffi.Uint64, ffi.Int32);
typedef _XGetImageDart = ffi.Pointer<_XImage> Function(
    ffi.Pointer<ffi.Void>, int, int, int, int, int, int, int);

typedef _XDestroyImageNative = ffi.Int32 Function(ffi.Pointer<_XImage>);
typedef _XDestroyImageDart = int Function(ffi.Pointer<_XImage>);

typedef _XCloseDisplayNative = ffi.Int32 Function(ffi.Pointer<ffi.Void>);
typedef _XCloseDisplayDart = int Function(ffi.Pointer<ffi.Void>);

const int _zPixmap = 2;
const int _allPlanes = 0xFFFFFFFFFFFFFFFF;

/// Captures the X11 root window directly via libX11 (Xlib) through FFI —
/// no external screenshot binary required. Every X11 desktop already ships
/// libX11.so.6 as a base dependency of the graphical stack itself, so this
/// needs nothing beyond what a GUI Linux install already has, unlike
/// shelling out to gnome-screenshot (removed by default in newer
/// GNOME/Ubuntu releases) or spectacle.
///
/// Only covers X11 sessions. Wayland compositors don't expose root-window
/// pixels to arbitrary clients this way — capturing there requires an
/// interactive per-session permission dialog via the desktop portal
/// (org.freedesktop.portal.ScreenCast), which is fundamentally incompatible
/// with a silent background agent. On Wayland this returns null, same as
/// any other capture failure.
class LinuxScreenshotCapturer {
  ffi.DynamicLibrary? _lib;

  Future<File?> captureFullScreen() async {
    final lib = _library();
    if (lib == null) return null;

    final xOpenDisplay = lib.lookupFunction<_XOpenDisplayNative, _XOpenDisplayDart>('XOpenDisplay');
    final xDefaultScreen = lib.lookupFunction<_XDefaultScreenNative, _XDefaultScreenDart>('XDefaultScreen');
    final xDefaultRootWindow =
        lib.lookupFunction<_XDefaultRootWindowNative, _XDefaultRootWindowDart>('XDefaultRootWindow');
    final xDisplayWidth = lib.lookupFunction<_XDisplayDimNative, _XDisplayDimDart>('XDisplayWidth');
    final xDisplayHeight = lib.lookupFunction<_XDisplayDimNative, _XDisplayDimDart>('XDisplayHeight');
    final xGetImage = lib.lookupFunction<_XGetImageNative, _XGetImageDart>('XGetImage');
    final xDestroyImage = lib.lookupFunction<_XDestroyImageNative, _XDestroyImageDart>('XDestroyImage');
    final xCloseDisplay = lib.lookupFunction<_XCloseDisplayNative, _XCloseDisplayDart>('XCloseDisplay');

    // No DISPLAY env var means we're not in a graphical session at all
    // (e.g. a bare SSH shell) — XOpenDisplay would just fail below, but
    // checking first avoids the native call entirely in the common case.
    final envDisplay = Platform.environment['DISPLAY'];
    if (envDisplay == null || envDisplay.isEmpty) return null;

    final displayName = envDisplay.toNativeUtf8();
    final display = xOpenDisplay(displayName);
    calloc.free(displayName);
    if (display.address == 0) return null;

    try {
      final screen = xDefaultScreen(display);
      final root = xDefaultRootWindow(display);
      final width = xDisplayWidth(display, screen);
      final height = xDisplayHeight(display, screen);
      if (width <= 0 || height <= 0) return null;

      final image = xGetImage(display, root, 0, 0, width, height, _allPlanes, _zPixmap);
      if (image.address == 0) return null;

      try {
        final xImage = image.ref;
        // Only handle the overwhelmingly common case (32bpp ZPixmap) — the
        // rare legacy 16bpp/8bpp-palette setups aren't worth the complexity.
        if (xImage.bitsPerPixel != 32) return null;

        final bytes = xImage.data.asTypedList(xImage.bytesPerLine * xImage.height);
        final decoded = img.Image.fromBytes(
          width: xImage.width,
          height: xImage.height,
          bytes: bytes.buffer,
          rowStride: xImage.bytesPerLine,
          order: img.ChannelOrder.bgra,
        );
        // The 4th byte per pixel from a 32bpp ZPixmap XImage is unused
        // padding, not real alpha — it comes back as 0, which encodeJpg
        // reads as fully transparent and composites to a blank white JPEG
        // unless forced opaque first (verified against a live X server:
        // scratch_capture_test.dart caught this before it shipped).
        for (final p in decoded) {
          p.a = 255;
        }
        final jpg = img.encodeJpg(decoded, quality: 70);

        final dir = await getTemporaryDirectory();
        final path = '${dir.path}/monitor_${DateTime.now().millisecondsSinceEpoch}.jpg';
        final file = File(path);
        await file.writeAsBytes(jpg);
        return file;
      } finally {
        xDestroyImage(image);
      }
    } finally {
      xCloseDisplay(display);
    }
  }

  ffi.DynamicLibrary? _library() {
    if (_lib != null) return _lib;
    try {
      _lib = ffi.DynamicLibrary.open('libX11.so.6');
    } catch (_) {
      _lib = null;
    }
    return _lib;
  }
}
