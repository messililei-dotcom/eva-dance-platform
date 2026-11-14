import SwiftUI

/// Static blur is decorative and never handles touches or contains member information.
struct EventRegistrationBackdrop: View {
    let url: URL?
    let fallback: Color
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                fallback
                if let url, !reduceTransparency {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                                .frame(width: geometry.size.width, height: geometry.size.height)
                                .blur(radius: 36, opaque: true).scaleEffect(1.15)
                        }
                    }
                    (colorScheme == .dark ? Color.black : Color.white).opacity(colorScheme == .dark ? 0.48 : 0.28)
                }
            }.frame(width: geometry.size.width, height: geometry.size.height).clipped()
        }.ignoresSafeArea().allowsHitTesting(false).accessibilityHidden(true)
    }
}
