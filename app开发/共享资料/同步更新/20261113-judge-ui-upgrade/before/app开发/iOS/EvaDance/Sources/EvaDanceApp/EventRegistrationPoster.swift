import SwiftUI

/// Current event artwork only; missing artwork leaves a quiet, readable fallback.
struct EventRegistrationPoster: View {
    let url: URL
    var body: some View {
        GeometryReader { geometry in
            AsyncImage(url: url) { phase in
                if let image = phase.image { image.resizable().scaledToFill() }
                else { EvaBrand.field.overlay { Image(systemName: "photo").foregroundStyle(.secondary) } }
            }.frame(width: geometry.size.width, height: geometry.size.height).clipped()
        }.aspectRatio(16 / 9, contentMode: .fit)
    }
}
