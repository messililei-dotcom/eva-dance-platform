import SwiftUI
struct EventRegistrationInput: ViewModifier {
    let border: Color
    func body(content: Content) -> some View { content.font(.body).padding(12).frame(maxWidth: .infinity, minHeight: 48, alignment: .leading).background(EvaBrand.surface).overlay { RoundedRectangle(cornerRadius: 8).stroke(border, lineWidth: 1) } }
}
extension View { func registrationInput(border: Color) -> some View { modifier(EventRegistrationInput(border: border)) } }
struct EventRegistrationCountry { let code: String; let flag: String; let name: String }
enum EventRegistrationCountries {
    static let items: [EventRegistrationCountry] = [
        .init(code: "+86", flag: "🇨🇳", name: "中国大陆"),
        .init(code: "+852", flag: "🇭🇰", name: "中国香港"),
        .init(code: "+853", flag: "🇲🇴", name: "中国澳门"),
        .init(code: "+886", flag: "🇹🇼", name: "中国台湾"),
        .init(code: "+20", flag: "🇪🇬", name: "埃及"),
        .init(code: "+1", flag: "🇺🇸", name: "美国/加拿大"),
        .init(code: "+44", flag: "🇬🇧", name: "英国"),
        .init(code: "+61", flag: "🇦🇺", name: "澳大利亚"),
        .init(code: "+65", flag: "🇸🇬", name: "新加坡"),
        .init(code: "+60", flag: "🇲🇾", name: "马来西亚"),
        .init(code: "+81", flag: "🇯🇵", name: "日本"),
        .init(code: "+82", flag: "🇰🇷", name: "韩国"),
        .init(code: "+66", flag: "🇹🇭", name: "泰国"),
        .init(code: "+33", flag: "🇫🇷", name: "法国"),
        .init(code: "+49", flag: "🇩🇪", name: "德国"),
        .init(code: "+7", flag: "🇷🇺", name: "俄罗斯"),
        .init(code: "+971", flag: "🇦🇪", name: "阿联酋"),
        .init(code: "+91", flag: "🇮🇳", name: "印度")
    ]
}

struct EventRegistrationShape: Shape {
    var top: Bool; var bottom: Bool
    func path(in rect: CGRect) -> Path {
        let t: CGFloat = top ? 14 : 0, b: CGFloat = bottom ? 14 : 0
        var p = Path(); p.move(to: CGPoint(x: rect.minX + t, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - t, y: rect.minY)); p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + t), control: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - b)); p.addQuadCurve(to: CGPoint(x: rect.maxX - b, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX + b, y: rect.maxY)); p.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - b), control: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + t)); p.addQuadCurve(to: CGPoint(x: rect.minX + t, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY)); p.closeSubpath(); return p
    }
}
