import SwiftUI

struct AccountShortcutView: View {
    let title: String
    let icon: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.title2).foregroundStyle(EvaBrand.red).accessibilityHidden(true)
            Text(title).font(.subheadline).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
        }.padding(.vertical, 12).frame(maxWidth: .infinity, minHeight: 76)
            .contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
}
