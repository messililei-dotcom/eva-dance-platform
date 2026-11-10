import SwiftUI

struct AccountShortcutView: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.title2).foregroundStyle(EvaBrand.red).accessibilityHidden(true)
            Text(value).font(.subheadline.bold()).monospacedDigit().foregroundStyle(.primary)
            Text(title).font(.subheadline).foregroundStyle(.secondary)
        }.padding(.vertical, 12).frame(maxWidth: .infinity, minHeight: 88)
            .contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
}
