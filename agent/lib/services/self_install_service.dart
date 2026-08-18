import 'dart:io';

/// Ensures the agent runs from a stable, permanent install directory rather
/// than wherever it was first launched from — a Downloads folder, an
/// extracted zip in Temp, a USB stick. That matters because the startup
/// registration (see main.dart / launch_at_startup) just points at a file
/// path; if the original launch location later gets moved, cleaned up, or
/// was never permanent, the registered entry silently points at nothing and
/// the agent stops auto-starting even though the registration still exists.
///
/// Windows: `%LOCALAPPDATA%\MonitorAgent`
/// Linux: `~/.local/share/monitor-agent`
/// macOS: not supported (no build is produced for macOS yet).
class SelfInstallService {
  static final String _sep = Platform.pathSeparator;

  static Directory? get installDir {
    if (Platform.isWindows) {
      return Directory('${Platform.environment['LOCALAPPDATA']}${_sep}MonitorAgent');
    }
    if (Platform.isLinux) {
      final home = Platform.environment['HOME'];
      if (home == null) return null;
      return Directory('$home/.local/share/monitor-agent');
    }
    return null;
  }

  /// If already running from the stable install directory, returns null
  /// (nothing to do). Otherwise copies the whole app folder there and
  /// returns the new exe path — the caller should launch that path and
  /// exit the current process.
  static Future<String?> ensureInstalled() async {
    final target = installDir;
    if (target == null) return null;

    final currentExe = File(Platform.resolvedExecutable);
    final currentDir = currentExe.parent;
    final exeName = _basename(currentExe.path);

    if (_pathsEqual(currentDir.path, target.path)) {
      return null;
    }

    try {
      if (!target.existsSync()) {
        target.createSync(recursive: true);
      }
      _copyDirectory(currentDir, target);
      final newExePath = '${target.path}$_sep$exeName';
      if (Platform.isLinux) {
        // The zip/tar doesn't preserve the executable bit reliably across
        // platforms, and copySync doesn't carry POSIX permissions either.
        await Process.run('chmod', ['+x', newExePath]);
      }
      return newExePath;
    } catch (_) {
      // Target may be locked by an already-running instance, or copy
      // failed for some other reason — fall back to running in place
      // rather than crash-looping on every launch.
      return null;
    }
  }

  static bool _pathsEqual(String a, String b) {
    if (Platform.isWindows) {
      return a.replaceAll('/', '\\').toLowerCase() == b.replaceAll('/', '\\').toLowerCase();
    }
    return a == b;
  }

  static String _basename(String path) => path.split(RegExp(r'[\\/]')).where((s) => s.isNotEmpty).last;

  static void _copyDirectory(Directory source, Directory destination) {
    for (final entity in source.listSync()) {
      final name = _basename(entity.path);
      if (entity is Directory) {
        final newDir = Directory('${destination.path}${Platform.pathSeparator}$name');
        newDir.createSync(recursive: true);
        _copyDirectory(entity, newDir);
      } else if (entity is File) {
        entity.copySync('${destination.path}${Platform.pathSeparator}$name');
      }
    }
  }
}
