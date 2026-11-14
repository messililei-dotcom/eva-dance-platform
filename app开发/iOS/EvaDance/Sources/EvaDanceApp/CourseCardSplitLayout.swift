import SwiftUI

/// Original thumbnail-and-text proportions, with a modestly larger thumbnail.
/// The text determines row height; oversized accessibility text remains readable.
struct CourseCardSplitLayout: Layout {
    var imageAspectRatio: CGFloat? = nil
    private let gap: CGFloat = 14
    private func imageWidth(_ width: CGFloat) -> CGFloat { min(112, max(0, width * 0.36)) }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = max(0, proposal.width ?? 360)
        let textWidth = max(0, width - imageWidth(width) - gap)
        let text = subviews.last?.sizeThatFits(ProposedViewSize(width: textWidth, height: nil)) ?? .zero
        return CGSize(width: width, height: max(84, text.height))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else { return }
        let image = imageWidth(bounds.width)
        let textWidth = max(0, bounds.width - image - gap)
        let text = subviews[1].sizeThatFits(ProposedViewSize(width: textWidth, height: nil))
        let imageHeight = imageAspectRatio.map { min(bounds.height, image / $0) } ?? min(160, bounds.height)
        subviews[0].place(at: CGPoint(x: bounds.minX, y: bounds.midY - imageHeight / 2),
                         proposal: ProposedViewSize(width: image, height: imageHeight))
        subviews[1].place(at: CGPoint(x: bounds.minX + image + gap, y: bounds.midY - text.height / 2),
                         proposal: ProposedViewSize(width: textWidth, height: text.height))
    }
}
