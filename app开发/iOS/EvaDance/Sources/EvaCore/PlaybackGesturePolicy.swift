import Foundation

public enum PlaybackGesturePolicy {
    public static func isVertical(x: Double, y: Double) -> Bool {
        abs(y) > 12 && abs(y) > abs(x) * 1.2
    }
    public static func level(initial: Double, translation: Double, height: Double, minimum: Double = 0) -> Double {
        guard initial.isFinite, translation.isFinite, height.isFinite, height > 0 else { return minimum }
        return min(1, max(minimum, initial - translation / max(height, 160)))
    }
}
