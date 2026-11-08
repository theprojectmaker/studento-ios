import ExpoModulesCore
import UIKit

/// Reports whether the screen is being captured (screen recording, AirPlay / cable mirroring,
/// or screen sharing), and sends "onChange" whenever that flips.
public final class CaptureGuardModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("CaptureGuard")
    Events("onChange")

    AsyncFunction("isCaptured") { () -> Bool in
      return UIScreen.main.isCaptured
    }.runOnQueue(.main)

    OnStartObserving {
      if self.observer != nil { return }
      self.observer = NotificationCenter.default.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onChange", ["captured": UIScreen.main.isCaptured])
      }
    }

    OnStopObserving {
      if let o = self.observer { NotificationCenter.default.removeObserver(o) }
      self.observer = nil
    }
  }
}
