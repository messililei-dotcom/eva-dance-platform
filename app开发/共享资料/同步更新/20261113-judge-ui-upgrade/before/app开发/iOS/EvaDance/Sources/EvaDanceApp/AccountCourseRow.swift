import SwiftUI
import EvaCore

struct AccountCourseRow: View {
    let course: JSONValue
    var cover = ""
    var showsLearningAction = false
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(alignment: .center, spacing: 12))
        layout {
            ArtworkImage(url: AppPolicy.secureMediaURL(course["cover_image"].text.isEmpty ? cover : course["cover_image"].text), symbol: "book.closed", label: "课程主图", ratio: nil)
                .frame(width: typeSize.isAccessibilitySize ? nil : 112, height: typeSize.isAccessibilitySize ? 156 : 84)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 8) {
                Text(course.firstText("series_name", "name")).font(.headline).foregroundStyle(.primary).lineLimit(2)
                if let learners = CoursePresentation.learnerText(course) { Text(learners).font(.caption).foregroundStyle(.secondary) }
                if course["learning_percent"] != .null {
                    Text("学习进度 \(course["learning_percent"].text)%").font(.subheadline).foregroundStyle(.secondary)
                    ProgressView(value: course["learning_percent"].number, total: 100).tint(EvaBrand.red)
                } else {
                    Text("进度待同步").font(.subheadline).foregroundStyle(.secondary)
                }
                if showsLearningAction {
                    HStack(spacing: 4) { Text("继续学习"); Image(systemName: "chevron.right").font(.caption) }
                        .font(.subheadline.weight(.medium)).foregroundStyle(EvaBrand.red)
                }
            }.frame(maxWidth: .infinity, alignment: .leading)
        }.padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
}
