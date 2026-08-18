import 'dart:io';
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'package:launch_at_startup/launch_at_startup.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'app_controller.dart';
import 'config.dart';
import 'services/self_install_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Relocate to a permanent install directory before doing anything else —
  // if we're not already running from there, launch the copy and exit,
  // so the startup registration below always points at a stable path.
  final relocatedExePath = await SelfInstallService.ensureInstalled();
  if (relocatedExePath != null) {
    await Process.start(relocatedExePath, [], mode: ProcessStartMode.detached);
    exit(0);
  }

  await AgentConfig.loadRuntimeConfig();
  await windowManager.ensureInitialized();

  final packageInfo = await PackageInfo.fromPlatform();
  launchAtStartup.setup(
    appName: packageInfo.appName,
    appPath: Platform.resolvedExecutable,
  );
  await launchAtStartup.enable();

  await windowManager.waitUntilReadyToShow(
    const WindowOptions(skipTaskbar: true, titleBarStyle: TitleBarStyle.hidden),
    () async {
      await windowManager.setSkipTaskbar(true);
      await windowManager.hide();
    },
  );

  runApp(const MonitorAgentApp());

  // Runs headlessly for the lifetime of the process; there is no visible UI.
  await AppController().start();
}

class MonitorAgentApp extends StatelessWidget {
  const MonitorAgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    // A minimal, always-hidden root widget. The Flutter engine needs a
    // running app for plugin channels (WebRTC, window_manager) to function,
    // but no window is ever shown to the user.
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: SizedBox.shrink(),
    );
  }
}
