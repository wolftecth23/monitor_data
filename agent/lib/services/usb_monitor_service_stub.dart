import 'usb_monitor_service.dart';

class StubUsbMonitorService implements UsbMonitorService {
  @override
  Future<List<UsbDeviceEvent>> poll() async => const [];
}
