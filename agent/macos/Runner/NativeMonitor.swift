import Cocoa
import FlutterMacOS
import ApplicationServices
import CoreGraphics

/// Backs `tracking_service_macos.dart` — the macOS side of the same
/// active-window + idle-duration contract `tracking_service_windows.dart`
/// implements via win32 FFI. macOS has no C-callable equivalent of those
/// APIs, so this goes through a Flutter method channel into Swift instead.
///
/// Requires the app to run unsandboxed (see Release.entitlements) and,
/// for window titles specifically, the user to grant this app Accessibility
/// access in System Settings > Privacy & Security > Accessibility — without
/// it, `getActiveWindow` still returns the frontmost app's name (no
/// permission needed for that), just no window title.
enum NativeMonitor {
  static let channelName = "monitor_data/native_macos"

  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "getActiveWindow":
        result(activeWindowPayload())
      case "getIdleSeconds":
        result(idleSeconds())
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private static func activeWindowPayload() -> [String: Any] {
    guard let app = NSWorkspace.shared.frontmostApplication else {
      return ["appName": NSNull(), "windowTitle": NSNull()]
    }
    return [
      "appName": app.localizedName ?? NSNull(),
      "windowTitle": focusedWindowTitle(pid: app.processIdentifier) ?? NSNull(),
    ]
  }

  /// Reads the frontmost app's focused-window title via the Accessibility
  /// API. Silently returns nil if the user hasn't granted Accessibility
  /// permission yet, rather than prompting on every poll — call
  /// `promptForAccessibilityIfNeeded()` once at startup for that instead.
  private static func focusedWindowTitle(pid: pid_t) -> String? {
    guard AXIsProcessTrusted() else { return nil }

    let appElement = AXUIElementCreateApplication(pid)
    var windowRef: CFTypeRef?
    let windowResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &windowRef)
    guard windowResult == .success, let window = windowRef else { return nil }

    var titleRef: CFTypeRef?
    let titleResult = AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &titleRef)
    guard titleResult == .success else { return nil }
    return titleRef as? String
  }

  /// Seconds since the last keyboard/mouse input, system-wide.
  private static func idleSeconds() -> Double {
    CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: CGEventType(rawValue: ~0)!)
  }

  /// Triggers the one-time macOS "MonitorAgent would like to control this
  /// computer" Accessibility prompt. Call once at app launch; without this,
  /// the user would only discover the permission is missing from silently
  /// empty window titles.
  static func promptForAccessibilityIfNeeded() {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    _ = AXIsProcessTrustedWithOptions(options)
  }

  /// Triggers the one-time "MonitorAgent would like to record this
  /// computer's screen" prompt (Screen Recording is what actually gates the
  /// `screencapture` CLI screenshot_service.dart shells out to via the
  /// screen_capturer package — without this granted, every capture attempt
  /// silently returns a black/empty image instead of failing loudly).
  static func promptForScreenRecordingIfNeeded() {
    if #available(macOS 10.15, *) {
      _ = CGRequestScreenCaptureAccess()
    }
  }
}
