import SwiftUI
import EvaCore
struct OfflineCourseCard: View {
    let row: JSONValue
    var body: some View {
        CourseCardSplitLayout(imageAspectRatio: 1.18) {
            ArtworkImage(url: AppPolicy.secureMediaURL(row["cover_image"].text), symbol: "calendar", ratio: nil)
                .frame(maxWidth: .infinity, maxHeight: .infinity).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 7) {
                Text(row["name"].text).font(.headline).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                Text(row["teacher"].text.isEmpty ? "伊娃东方舞导师" : row["teacher"].text).font(.subheadline).foregroundStyle(.secondary)
                Text(row["offline_latest_period"].text == "期次待公布" ? "期次安排待公布" : "最新期次：" + row["offline_latest_period"].text).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                Text(row["offline_student_count"].text + " 位已报名学员").font(.subheadline).foregroundStyle(.secondary)
                Divider()
                HStack(alignment: .firstTextBaseline) {
                    Text(row["offline_period_count"].text + " 个期次").foregroundStyle(.secondary)
                    Spacer(minLength: 8)
                    Text(OfflineCatalog.price(row)).foregroundStyle(EvaBrand.red)
                }.font(.subheadline)
            }
        }.padding(.vertical, 10).accessibilityElement(children: .combine)
    }
}
