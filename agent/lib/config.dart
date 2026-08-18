import 'dart:convert';
import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// Compile-time fallbacks, only used for local dev runs
/// (--dart-define=BACKEND_URL=... --dart-define=INSTALL_TOKEN=...). Real
/// installers built by the backend's installer-download endpoint are a
/// single generic build per platform — the backend URL and the
/// per-employee install token are supplied at runtime via a `config.json`
/// file placed next to the executable, not baked in at compile time.
const String _defaultBackendUrl = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: 'https://monitor-data.onrender.com',
);
const String _bakedInstallToken = String.fromEnvironment('INSTALL_TOKEN');

class AgentConfig {
  static const _hostnameKey = 'monitor_hostname_id';

  static String _backendUrl = _defaultBackendUrl;
  static String? _installToken = _bakedInstallToken.isEmpty ? null : _bakedInstallToken;

  static String get backendUrl => _backendUrl;

  /// Reads `config.json` next to the running executable, if present, and
  /// uses it to override the compile-time defaults. Must be called once
  /// before anything reads [backendUrl] or [installToken].
  static Future<void> loadRuntimeConfig() async {
    try {
      final exeDir = File(Platform.resolvedExecutable).parent;
      final configFile = File('${exeDir.path}${Platform.pathSeparator}config.json');
      if (!configFile.existsSync()) return;

      final json = jsonDecode(await configFile.readAsString()) as Map<String, dynamic>;
      final backendUrlValue = json['backendUrl'];
      final installTokenValue = json['installToken'];
      if (backendUrlValue is String && backendUrlValue.isNotEmpty) {
        _backendUrl = backendUrlValue;
      }
      if (installTokenValue is String && installTokenValue.isNotEmpty) {
        _installToken = installTokenValue;
      }
    } catch (_) {
      // malformed/missing config.json — fall back to compile-time defaults
    }
  }

  static Future<String> installToken() async {
    if (_installToken != null && _installToken!.isNotEmpty) return _installToken!;
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('monitor_install_token');
    if (stored != null && stored.isNotEmpty) return stored;
    throw StateError(
      'No install token configured. Ship a config.json next to the exe with '
      '{"installToken": "..."}, build with --dart-define=INSTALL_TOKEN=<token>, '
      'or set one via SharedPreferences during first-run setup.',
    );
  }

  /// A stable per-machine identifier so re-installs re-attach to the same Device row.
  static Future<String> hostname() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_hostnameKey);
    if (existing != null) return existing;
    final generated = '${Platform.localHostname}-${const Uuid().v4().substring(0, 8)}';
    await prefs.setString(_hostnameKey, generated);
    return generated;
  }

  static String platformName() {
    if (Platform.isWindows) return 'windows';
    if (Platform.isMacOS) return 'macos';
    if (Platform.isLinux) return 'linux';
    return 'unknown';
  }
}
