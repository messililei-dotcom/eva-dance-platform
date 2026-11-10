import SwiftUI
import EvaCore

struct AccountCourseRow: View {
    let course: JSONValue
    var cover = ""

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            ArtworkImage(url: AppPolicy.secureMediaURL(course["cover_image"].text.isEmpty ? cover : course["cover_image"].text), symbol: "book.closed", label: "课程主图", ratio: nil)
                .frame(width: 96, height: 96)
            VStack(alignment: .leading, spacing: 8) {
                Text(course.firstText("series_name", "name")).font(.headline).foregroundStyle(.primary).lineLimit(2)
                Text("✓ 已解锁").font(.subheadline).foregroundStyle(.green)
                Label("继续学习", systemImage: "play.circle").font(.subheadline.weight(.medium)).foregroundStyle(EvaBrand.red)
            }.frame(maxWidth: .infinity, alignment: .leading)
        }.padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
}
