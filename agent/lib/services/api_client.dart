import 'dart:io';
import 'package:dio/dio.dart';
import '../config.dart';

class TrackingSettings {
  final bool trackingEnabled;
  final bool livestreamEnabled;
  final bool captureScreenshots;
  final int screenshotFrequencySec;
  final bool appUrlTracking;
  final bool keyboardMouseTracking;
  final int idleTimeoutSec;
  final int activeThresholdSec;

  TrackingSettings({
    required this.trackingEnabled,
    required this.livestreamEnabled,
    required this.captureScreenshots,
    required this.screenshotFrequencySec,
    required this.appUrlTracking,
    required this.keyboardMouseTracking,
    required this.idleTimeoutSec,
    required this.activeThresholdSec,
  });

  factory TrackingSettings.fromJson(Map<String, dynamic> json) => TrackingSettings(
        trackingEnabled: json['trackingEnabled'] ?? true,
        livestreamEnabled: json['livestreamEnabled'] ?? true,
        captureScreenshots: json['captureScreenshots'] ?? true,
        screenshotFrequencySec: json['screenshotFrequencySec'] ?? 300,
        appUrlTracking: json['appUrlTracking'] ?? true,
        keyboardMouseTracking: json['keyboardMouseTracking'] ?? true,
        idleTimeoutSec: json['idleTimeoutSec'] ?? 300,
        activeThresholdSec: json['activeThresholdSec'] ?? 30,
      );
}

class ApiClient {
  final Dio _dio;
  final String installToken;

  ApiClient._(this._dio, this.installToken);

  static Future<ApiClient> create() async {
    final token = await AgentConfig.installToken();
    final dio = Dio(BaseOptions(
      baseUrl: '${AgentConfig.backendUrl}/api/agent',
      headers: {'x-install-token': token},
      connectTimeout: const Duration(seconds: 10),
    ));
    return ApiClient._(dio, token);
  }

  Future<TrackingSettings> fetchSettings() async {
    final res = await _dio.get('/settings');
    return TrackingSettings.fromJson(res.data['settings']);
  }

  Future<void> uploadScreenshot({
    required File file,
    required String hostname,
    String? appName,
    String? windowTitle,
  }) async {
    final form = FormData.fromMap({
      'hostname': hostname,
      if (appName != null) 'appName': appName,
      if (windowTitle != null) 'windowTitle': windowTitle,
      'file': await MultipartFile.fromFile(file.path, filename: 'screenshot.jpg'),
    });
    await _dio.post('/screenshots', data: form);
  }

  Future<void> reportUsbEvent({
    required String hostname,
    required String deviceName,
    String? vendorId,
    String? productId,
    required String eventType,
  }) async {
    await _dio.post('/usb-events', data: {
      'hostname': hostname,
      'deviceName': deviceName,
      if (vendorId != null) 'vendorId': vendorId,
      if (productId != null) 'productId': productId,
      'eventType': eventType,
    });
  }

  Future<void> reportInputActivity({
    required String hostname,
    required int keyCount,
    required int mouseClickCount,
    required DateTime periodStart,
    required DateTime periodEnd,
  }) async {
    await _dio.post('/input-activity', data: {
      'hostname': hostname,
      'keyCount': keyCount,
      'mouseClickCount': mouseClickCount,
      'periodStart': periodStart.toUtc().toIso8601String(),
      'periodEnd': periodEnd.toUtc().toIso8601String(),
    });
  }

  Future<void> reportActivityEvent({
    required String hostname,
    String? appName,
    String? windowTitle,
    String? url,
    bool isIdle = false,
    required DateTime startedAt,
    DateTime? endedAt,
  }) async {
    await _dio.post('/activity-events', data: {
      'hostname': hostname,
      if (appName != null) 'appName': appName,
      if (windowTitle != null) 'windowTitle': windowTitle,
      if (url != null) 'url': url,
      'isIdle': isIdle,
      'startedAt': startedAt.toUtc().toIso8601String(),
      if (endedAt != null) 'endedAt': endedAt.toUtc().toIso8601String(),
    });
  }
}
