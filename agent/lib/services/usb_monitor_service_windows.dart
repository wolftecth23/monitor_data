import 'dart:io';
import 'usb_monitor_service.dart';

class WindowsUsbMonitorService implements UsbMonitorService {
  Set<String> _knownInstanceIds = {};
  final Map<String, String> _nameByInstanceId = {};
  bool _initialized = false;

  @override
  Future<List<UsbDeviceEvent>> poll() async {
    final current = await _listDevices();

    // First poll just seeds the baseline — otherwise every USB device
    // already plugged in at agent startup would be reported as "connected".
    if (!_initialized) {
      _knownInstanceIds = current.keys.toSet();
      _nameByInstanceId.addAll(current);
      _initialized = true;
      return const [];
    }

    final currentIds = current.keys.toSet();
    final events = <UsbDeviceEvent>[
      for (final id in currentIds.difference(_knownInstanceIds)) _toEvent(id, current[id], 'connected'),
      for (final id in _knownInstanceIds.difference(currentIds)) _toEvent(id, _nameByInstanceId[id], 'disconnected'),
    ];

    _knownInstanceIds = currentIds;
    _nameByInstanceId
      ..clear()
      ..addAll(current);

    return events;
  }

  UsbDeviceEvent _toEvent(String instanceId, String? name, String eventType) {
    final match = RegExp(r'VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})').firstMatch(instanceId);
    return UsbDeviceEvent(
      deviceName: (name != null && name.trim().isNotEmpty) ? name.trim() : 'Unknown USB Device',
      vendorId: match?.group(1),
      productId: match?.group(2),
      eventType: eventType,
    );
  }

  Future<Map<String, String>> _listDevices() async {
    try {
      final result = await Process.run('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        r'Get-PnpDevice -Class USB -PresentOnly | ForEach-Object { "$($_.InstanceId)|$($_.FriendlyName)" }',
      ]);
      if (result.exitCode != 0) return {};
      final devices = <String, String>{};
      for (final line in (result.stdout as String).split('\n')) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) continue;
        final parts = trimmed.split('|');
        final id = parts.first.trim();
        final name = parts.length > 1 ? parts.sublist(1).join('|').trim() : '';
        if (id.isNotEmpty) devices[id] = name;
      }
      return devices;
    } catch (_) {
      return {};
    }
  }
}
