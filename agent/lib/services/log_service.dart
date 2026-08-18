import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// The agent has no UI to surface errors in, so failures that shouldn't
/// crash the loop (a missed screenshot, a dropped activity report) are
/// appended here instead of being silently swallowed, for support diagnostics.
class LogService {
  static File? _file;

  static Future<void> log(String message) async {
    try {
      _file ??= File('${(await getApplicationSupportDirectory()).path}/agent.log');
      await _file!.writeAsString('${DateTime.now().toIso8601String()} $message\n', mode: FileMode.append);
    } catch (_) {
      // logging is best-effort too
    }
  }
}
