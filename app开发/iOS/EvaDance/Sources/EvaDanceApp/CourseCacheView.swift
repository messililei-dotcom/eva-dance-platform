import SwiftUI

struct CourseCacheActions: View {
    @ObservedObject var cache: CourseCacheStore
    let lessonID: Int
    let title: String
    let course: String
    var body: some View {
        NavigationLink("管理课程缓存") { CourseCacheView(cache: cache) }
        Button(cache.downloading == lessonID ? "正在缓存本节" : "缓存当前课节") { Task { await cache.download(lessonID, title: title, course: course) } }.disabled(cache.downloading != nil)
        if !cache.message.isEmpty { Text(cache.message).font(.subheadline).foregroundStyle(.secondary) }
    }
}

struct CourseCacheView: View {
    @ObservedObject var cache: CourseCacheStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var deleting: Int?
    var body: some View {
        List {
            Section {
                Text("联网时自动验证和续期；断网可在授权有效期内学习，最长 24 小时。重启设备后需要联网验证。退出账号会删除本机课程缓存。").font(.footnote).foregroundStyle(.secondary)
                if !cache.message.isEmpty { Text(cache.message).font(.subheadline).foregroundStyle(EvaBrand.red) }
            }
            Section("本机缓存 · \(cache.visible.count) 节") {
                if cache.visible.isEmpty { Text("暂无缓存。在课程播放设置中选择“缓存当前课节”。").foregroundStyle(.secondary) }
                ForEach(cache.visible) { record in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(record.course).font(.caption).foregroundStyle(.secondary)
                        Text(record.title).font(.headline)
                        if record.state == "downloading" { ProgressView(value: Double(record.percent), total: 100); Text("正在缓存 \(record.percent)%").font(.caption); Button("暂停缓存") { cache.pause(record.id) }.frame(minHeight: 44) }
                        else if cache.usable(record) {
                            NavigationLink("离线观看") { OfflineCoursePlayerView(cache: cache, lessonID: record.id) }
                            Text(ByteCountFormatter.string(fromByteCount: record.bytes, countStyle: .file) + (record.pendingProgress ? " · 学习进度待自动同步" : " · 已缓存")).font(.caption).foregroundStyle(.secondary)
                        } else { Text(record.state == "ready" ? "待联网自动验证" : "缓存已暂停，可重新缓存").font(.subheadline).foregroundStyle(.secondary)
                            if record.state == "paused" { Button("重新缓存") { Task { await cache.download(record.id, title: record.title, course: record.course) } }.frame(minHeight: 44).disabled(cache.downloading != nil) }
                        }
                        Button("删除缓存", role: .destructive) { deleting = record.id }.frame(minHeight: 44)
                    }.padding(.vertical, 6)
                }
            }
        }.evaCompactLayout().evaPageChrome()
            .task { await cache.refresh() }
            .onChange(of: scenePhase) { if $0 == .active { Task { await cache.refresh() } } }
            .confirmationDialog("删除这节课的本机缓存？", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })) {
                Button("删除缓存", role: .destructive) { if let id = deleting { cache.remove(id) }; deleting = nil }
            }
    }
}
