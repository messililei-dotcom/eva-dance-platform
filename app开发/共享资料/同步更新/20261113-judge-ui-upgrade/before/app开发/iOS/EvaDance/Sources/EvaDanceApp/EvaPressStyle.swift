import SwiftUI

/// Quiet feedback for flat content rows; native navigation and accessibility stay intact.
struct EvaPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(enabled && configuration.isPressed ? 0.62 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
