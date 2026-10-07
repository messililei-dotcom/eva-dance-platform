// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "EvaDance",
    platforms: [.iOS(.v16), .macOS(.v14)],
    products: [.library(name: "EvaCore", targets: ["EvaCore"]), .executable(name: "EvaDancePreview", targets: ["EvaDanceApp"])],
    targets: [.target(name: "EvaCore"), .executableTarget(name: "EvaDanceApp", dependencies: ["EvaCore"]),
              .executableTarget(name: "EvaCoreChecks", dependencies: ["EvaCore"], path: "Tests/EvaCoreTests")]
)
