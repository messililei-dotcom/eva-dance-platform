import SwiftUI

/// Fixed viewport, proportional cover scaling, and a single clean clipping boundary.
struct ArtworkImage: View {
    let url: URL?
    var symbol = "photo"
    var label = "图片"
    var ratio: CGFloat? = 4 / 3
    var body: some View {
        Group {
            if let ratio { viewport.aspectRatio(ratio, contentMode: .fit) }
            else { viewport }
        }.clipShape(RoundedRectangle(cornerRadius: 8))
            .accessibilityElement(children: .ignore).accessibilityLabel(label)
    }
    private var viewport: some View {
        GeometryReader { geometry in
            Group {
                if let url {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            Image(systemName: phase.error == nil ? symbol : "photo.badge.exclamationmark")
                                .font(.title2).foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .background(EvaBrand.canvas)
                        }
                    }
                } else {
                    Image(systemName: symbol).font(.title2).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity).background(EvaBrand.canvas)
                }
            }.frame(width: geometry.size.width, height: geometry.size.height)
                .clipped()
        }
    }
}
