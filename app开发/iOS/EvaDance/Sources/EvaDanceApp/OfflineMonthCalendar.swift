import SwiftUI
import EvaCore

struct OfflineMonthCalendar: View {
    let courses: [JSONValue]
    @State private var month = Date()
    @State private var selected: Int?
    @State private var swipeActive = false
    private var calendar: Calendar { var value = Calendar(identifier: .gregorian); value.timeZone = TimeZone(secondsFromGMT: 0)!; value.firstWeekday = 2; return value }
    private var first: Date { calendar.date(from: calendar.dateComponents([.year, .month], from: month))! }
    private var title: String { "\(calendar.component(.year, from: month))年\(calendar.component(.month, from: month))月" }
    private func parse(_ text: String) -> Date? {
        let text = String(text.prefix(10))
        let formatter = DateFormatter(); formatter.calendar = calendar; formatter.timeZone = calendar.timeZone; formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
        guard let date = formatter.date(from: text), formatter.string(from: date) == text else { return nil }; return date
    }
    private var ranges: [OfflineCalendarRange] {
        courses.enumerated().compactMap { index, course in
            guard let start = parse(course["start_date"].text), let end = parse(course["end_date"].text.isEmpty ? course["start_date"].text : course["end_date"].text), end >= start else { return nil }
            return OfflineCalendarRange(index: index, start: start, end: end)
        }.sorted { $0.start == $1.start ? ($0.end == $1.end ? $0.index < $1.index : $0.end > $1.end) : $0.start < $1.start }
    }
    private var weeks: [OfflineCalendarWeek] {
        let offset = (calendar.component(.weekday, from: first) + 5) % 7
        let gridStart = calendar.date(byAdding: .day, value: -offset, to: first)!
        let days = calendar.range(of: .day, in: .month, for: first)!.count
        return (0..<Int(ceil(Double(offset + days) / 7))).map { week in
            let start = calendar.date(byAdding: .day, value: week * 7, to: gridStart)!
            let end = calendar.date(byAdding: .day, value: 6, to: start)!
            var lanes: [Int] = []
            let segments = ranges.filter { $0.start <= end && $0.end >= start }.map { item in
                let left = max(0, calendar.dateComponents([.day], from: start, to: item.start).day!)
                let right = min(6, calendar.dateComponents([.day], from: start, to: item.end).day!)
                let lane = lanes.firstIndex(where: { $0 < left }) ?? lanes.count
                if lane == lanes.count { lanes.append(right) } else { lanes[lane] = right }
                return OfflineCalendarSegment(index: item.index, left: left, right: right, lane: lane)
            }
            return OfflineCalendarWeek(index: week, days: (0..<7).map { calendar.date(byAdding: .day, value: $0, to: start)! }, segments: segments, height: max(116, 52 + CGFloat(lanes.count) * 36))
        }
    }
    private var count: Int { let next = calendar.date(byAdding: .month, value: 1, to: first)!; return ranges.filter { $0.start < next && $0.end >= first }.count }
    private func move(_ offset: Int) { month = calendar.date(byAdding: .month, value: offset, to: first)! }
    private func tone(_ course: JSONValue) -> (Color, Color) {
        let type = course.firstText("category", "type")
        if type.contains("集训") || type == "bootcamp" { return (Color(red: 0.98, green: 0.87, blue: 0.88), Color(red: 0.52, green: 0.18, blue: 0.22)) }
        if type.contains("传承") || type == "masterclass" { return (Color(red: 0.86, green: 0.93, blue: 0.84), Color(red: 0.19, green: 0.36, blue: 0.21)) }
        if type.contains("认证") || type == "certification" { return (Color(red: 0.86, green: 0.91, blue: 0.96), Color(red: 0.20, green: 0.33, blue: 0.46)) }
        return (Color(red: 0.96, green: 0.91, blue: 0.80), Color(red: 0.45, green: 0.33, blue: 0.16))
    }
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline).monospacedDigit(); Text("\(count) 个课程期次 · 左右滑动切月").font(.caption2).foregroundStyle(.secondary) }
                Spacer(minLength: 0)
                Button { move(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("上个月")
                Button("本月") { month = Date() }.font(.caption).frame(minWidth: 44, minHeight: 44)
                Button { move(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }.accessibilityLabel("下个月")
            }.padding(.horizontal, 8).padding(.vertical, 8)
            VStack(spacing: 0) {
                HStack(spacing: 0) { ForEach(["一", "二", "三", "四", "五", "六", "日"], id: \.self) { Text("周\($0)").font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity) } }.padding(.vertical, 12).background(Color.secondary.opacity(0.06))
                ForEach(weeks) { week in
                    GeometryReader { geometry in
                        ZStack(alignment: .topLeading) {
                            HStack(spacing: 0) {
                                ForEach(week.days, id: \.self) { day in
                                    VStack { Text("\(calendar.component(.day, from: day))").font(.subheadline).monospacedDigit().frame(width: 32, height: 32).foregroundStyle(Calendar.current.isDateInToday(day) ? Color.white : .primary).background(Calendar.current.isDateInToday(day) ? Color.accentColor : .clear, in: Circle()); Spacer(minLength: 0) }
                                        .padding(.top, 8).frame(maxWidth: .infinity).background(calendar.component(.month, from: day) != calendar.component(.month, from: first) ? Color.secondary.opacity(0.07) : .clear).overlay(alignment: .trailing) { Rectangle().fill(Color.secondary.opacity(0.12)).frame(width: 0.5) }
                                }
                            }
                            ForEach(week.segments) { segment in
                                let course = courses[segment.index]
                                let colors = tone(course)
                                Button { if !swipeActive { selected = segment.index } } label: {
                                    Text(course["name"].text).font(.caption).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 5).frame(height: 32).foregroundStyle(colors.1).background(colors.0, in: RoundedRectangle(cornerRadius: 4))
                                }.buttonStyle(.plain).frame(width: max(0, geometry.size.width * CGFloat(segment.right - segment.left + 1) / 7 - 4)).offset(x: geometry.size.width * CGFloat(segment.left) / 7 + 2, y: 44 + CGFloat(segment.lane) * 36).accessibilityLabel("\(course["name"].text)，\(course["start_date"].text)至\(course["end_date"].text)，查看详情")
                            }
                        }
                    }.frame(height: week.height).overlay(alignment: .bottom) { Divider() }
                }
                if count == 0 { Text("本月暂无课程安排，请切换月份查看。").font(.caption).foregroundStyle(.secondary).padding() }
            }.contentShape(Rectangle()).simultaneousGesture(DragGesture(minimumDistance: 10).onChanged { value in
                if abs(value.translation.width) > abs(value.translation.height) * 1.5 { swipeActive = true }
            }.onEnded { value in
                if abs(value.translation.width) >= 48 && abs(value.translation.width) > abs(value.translation.height) * 1.5 { move(value.translation.width < 0 ? 1 : -1) }
                swipeActive = false
            })
        }.background(.background).clipShape(RoundedRectangle(cornerRadius: 12)).overlay { RoundedRectangle(cornerRadius: 12).strokeBorder(.secondary.opacity(0.2)) }
        .navigationDestination(isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } })) {
            if let index = selected, courses.indices.contains(index) { OfflineCourseDetailView(row: courses[index], periods: CoursePresentation.periods(courses, for: courses[index])) }
        }
    }
}
private struct OfflineCalendarRange { let index: Int; let start: Date; let end: Date }
private struct OfflineCalendarSegment: Identifiable { let index: Int; let left: Int; let right: Int; let lane: Int; var id: Int { index } }
private struct OfflineCalendarWeek: Identifiable { let index: Int; let days: [Date]; let segments: [OfflineCalendarSegment]; let height: CGFloat; var id: Int { index } }
