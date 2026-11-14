import SwiftUI

struct AccountServiceRow: View {
    let title: String
    let subtitle: String
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            if !icon.isEmpty {
            Image(systemName: icon).font(.title3).foregroundStyle(EvaBrand.red)
                .frame(width: 36, height: 36).background(EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.body.weight(.medium)).foregroundStyle(.primary)
                if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.right").font(.footnote).foregroundStyle(.secondary).accessibilityHidden(true)
        }.padding(.vertical, 12).frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
}
