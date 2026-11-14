import Foundation
public enum NoteDanmakuPolicy {
    public static func visible(_ notes: [JSONValue], at position: Double) -> [JSONValue] {
        guard position.isFinite, position >= 0 else { return [] }
        return Array(notes.lazy.filter { note in
            let stamp = note["timestamp_seconds"]
            let time = stamp.number
            return stamp != .null && time.isFinite && time >= 0 && position >= time && position < time + 8 && !note["content"].text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }.prefix(3))
    }
}
