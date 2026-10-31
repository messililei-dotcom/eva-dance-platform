import SwiftUI
import EvaCore

/// Resolves the course in place, so Back returns to the course card, not a directory.
struct CourseStudyEntryView: View {
    @EnvironmentObject var session: Session
    let id: Int
    let title: String
    @State private var lessons: [Lesson] = []
    @State private var lessonID: Int?
    @State private var loadedSession: String?
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        AuthGate {
            Group {
                if loadedSession == session.credentials?.sessionId,
                   let lessonID, let lesson = lessons.first(where: { $0.id == lessonID }) {
                    PlayerView(lessonID: lessonID, title: lesson.name, playlist: lessons,
                               courseTitle: title, seriesID: id)
                        .id((loadedSession ?? "") + ":" + String(lessonID))
                } else {
                    VStack(spacing: 16) {
                        if loading { ProgressView("正在打开课程…") }
                        else {
                            Text(error ?? "暂无可学习课节").multilineTextAlignment(.center)
                            Button("重新加载") { Task { await load() } }.frame(minHeight: 44)
                        }
                    }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
                        .evaPageChrome()
                }
            }.task(id: session.credentials?.sessionId) { await load() }
        }
    }

    @MainActor private func load() async {
        lessons = []; lessonID = nil; loadedSession = nil; error = nil; loading = true
        guard id > 0, let token = session.token, let binding = session.credentials?.sessionId else { loading = false; return }
        do {
            let units: JSONValue = try await session.api.request("/public/series/\(id)/courses")
            try Task.checkCancellation()
            guard binding == session.credentials?.sessionId else { return }
            let progress: JSONValue = try await session.api.request("/public/series/\(id)/progress", token: token)
            try Task.checkCancellation()
            guard binding == session.credentials?.sessionId else { return }
            let catalog = CoursePresentation.catalog(units, progress: progress)
            lessons = catalog.compactMap { row in
                guard let id = Int(row["id"].text), id > 0 else { return nil }
                return Lesson(id: id, name: row["name"].text, duration: row["duration"].number,
                              subtitle: row["subtitle"].text, percent: row["percent"] == .null ? nil : row["percent"].number)
            }
            lessonID = CoursePresentation.startingLessonID(catalog, progress: progress)
            loadedSession = binding; loading = false
        } catch is CancellationError { return }
        catch {
            guard binding == session.credentials?.sessionId, !Task.isCancelled else { return }
            self.error = "课程暂时无法打开，请重试。\n" + error.localizedDescription
            loading = false; session.handle(error)
        }
    }
}
