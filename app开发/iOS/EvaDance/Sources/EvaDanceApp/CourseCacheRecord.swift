import Foundation
import EvaCore

struct CourseCacheRecord: Codable, Identifiable {
    var recordID = UUID().uuidString
    var id: Int { lease.lesson_id }
    var lease: VideoCacheLease
    var title: String
    var course: String
    var relativeFile: String = ""
    var state: String = "waiting"
    var percent: Int = 0
    var bytes: Int64 = 0
    var position: Double = 0
    var duration: Double = 0
    var revision: Int = 0
    var pendingProgress: Bool = false
    var anchor: VideoCacheClockAnchor
}

struct CourseCacheAuthorization: Decodable {
    struct Credential: Decodable { let play_auth: String }
    let lease: VideoCacheLease
    let credential: Credential?
    let maxBytes: Int64
    init(from decoder: Decoder) throws {
        lease = try VideoCacheLease(from: decoder)
        let box = try decoder.container(keyedBy: CodingKeys.self)
        credential = try box.decodeIfPresent(Credential.self, forKey: .credential)
        maxBytes = try box.decode(Int64.self, forKey: .maxBytes)
    }
    enum CodingKeys: String, CodingKey { case credential; case maxBytes = "max_bytes" }
}
