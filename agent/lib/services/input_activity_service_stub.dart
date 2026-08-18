import 'input_activity_service.dart';

class StubInputActivityService implements InputActivityService {
  @override
  void start() {}

  @override
  void stop() {}

  @override
  InputCounts takeCounts() => (keyCount: 0, mouseClickCount: 0);
}
