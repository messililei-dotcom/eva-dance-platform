import Foundation
import AVFoundation
import CoreVideo
import CoreGraphics

let output = URL(fileURLWithPath: CommandLine.arguments[1])
// Test-only synthetic frames, no course content or user data.
let width = 320, height = 180, fps: Int32 = 30, seconds = 10
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 180_000, AVVideoMaxKeyFrameIntervalKey: 30]]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
    sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
                                 kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
                                 kCVPixelBufferCGImageCompatibilityKey as String: true,
                                 kCVPixelBufferCGBitmapContextCompatibilityKey as String: true])
writer.add(input)
guard writer.startWriting() else { fatalError("Test writer failed") }
writer.startSession(atSourceTime: .zero)
let colors: [(CGFloat, CGFloat, CGFloat)] = [(0.5,0.08,0.17),(0.1,0.45,0.7),(0.1,0.6,0.35),(0.8,0.6,0.15)]
for frame in 0..<(Int(fps) * seconds) {
    let limit = Date().addingTimeInterval(10)
    while !input.isReadyForMoreMediaData {
        guard writer.status == .writing && Date() < limit else { fatalError("Test writer stalled") }
        Thread.sleep(forTimeInterval: 0.002)
    }
    var pixel: CVPixelBuffer?
    guard let pool = adaptor.pixelBufferPool,
          CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixel) == kCVReturnSuccess, let buffer = pixel else { fatalError("No frame buffer") }
    CVPixelBufferLockBaseAddress(buffer, [])
    let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
                           bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                           space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    for column in 0..<4 {
        let c = colors[(column + frame / 30) % 4]
        context.setFillColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
        context.fill(CGRect(x: column * 80, y: 0, width: 80, height: height))
    }
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: frame % width, y: 10, width: 8, height: 15))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(frame), timescale: fps)) else { fatalError("Cannot append frame") }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
guard done.wait(timeout: .now() + 20) == .success, writer.status == .completed else { fatalError("Test movie not completed") }
print("Generated 10-second synthetic H.264 test asset, 320x180, video only.")
