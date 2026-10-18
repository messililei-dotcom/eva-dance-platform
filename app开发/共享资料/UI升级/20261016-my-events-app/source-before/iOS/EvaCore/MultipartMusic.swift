import Foundation

public struct MultipartMusic {
    public let body: Data
    public let contentType: String
    public init(fields: [String: String], filename: String, music: Data) throws {
        let allowed: Set<String> = ["groupId", "name", "phone", "organization", "teacher", "performanceTitle", "remark"]
        let extensionName = (filename as NSString).pathExtension.lowercased()
        guard !music.isEmpty, music.count <= 10 * 1024 * 1024,
              ["mp3", "wav", "m4a", "aac", "flac"].contains(extensionName),
              fields.keys.allSatisfy(allowed.contains), fields.values.allSatisfy({ $0.count <= 1000 }) else {
            throw APIError.service("请选择10MB以内的 MP3、WAV、M4A、AAC 或 FLAC 音乐，检查报名资料。")
        }
        let boundary = "EvaMusic-" + UUID().uuidString
        var data = Data()
        func append(_ text: String) { data.append(Data(text.utf8)) }
        for key in fields.keys.sorted() {
            append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(fields[key]!)\r\n")
        }
        let safeName = String(filename.filter { !"\r\n\"\\/".contains($0) }.prefix(120))
        append("--\(boundary)\r\nContent-Disposition: form-data; name=\"musicFile\"; filename=\"\(safeName)\"\r\nContent-Type: application/octet-stream\r\n\r\n")
        data.append(music); append("\r\n--\(boundary)--\r\n")
        body = data; contentType = "multipart/form-data; boundary=" + boundary
    }
}
