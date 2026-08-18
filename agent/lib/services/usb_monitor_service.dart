import 'dart:io';
import 'usb_monitor_service_stub.dart';
import 'usb_monitor_service_windows.dart';

class UsbDeviceEvent {
  final String deviceName;
  final String? vendorId;
  final String? productId;
  final String eventType; // connected | disconnected
  const UsbDeviceEvent({required this.deviceName, this.vendorId, this.productId, required this.eventType});
}

/// Per-OS USB connect/disconnect detection. Windows polls `Get-PnpDevice`
/// via PowerShell and diffs the device list on a Timer, rather than hooking
/// WM_DEVICECHANGE — this agent has no precedent for native window-message
/// hooks and polling matches the existing Timer-based style used for
/// screenshots/activity elsewhere in this codebase. Detection granularity is
/// bounded by the poll interval, not instant.
abstract class UsbMonitorService {
  /// Returns any connect/disconnect events since the last call.
  Future<List<UsbDeviceEvent>> poll();

  static UsbMonitorService create() {
    if (Platform.isWindows) return WindowsUsbMonitorService();
    return StubUsbMonitorService();
  }
}
