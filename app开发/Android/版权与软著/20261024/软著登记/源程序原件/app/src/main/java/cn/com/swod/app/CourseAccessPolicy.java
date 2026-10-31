package cn.com.swod.app;

import java.util.Set;

/** Only canonical backend series IDs from an authenticated entitlement response enter this policy. */
public final class CourseAccessPolicy {
    public enum State { GUEST, UNKNOWN, LOCKED, UNLOCKED }
    public static State evaluate(boolean signedIn, boolean known, int seriesId, Set<Integer> backendSeries) {
        if (!signedIn) return State.GUEST;
        if (!known || seriesId <= 0 || backendSeries == null) return State.UNKNOWN;
        return backendSeries.contains(seriesId) ? State.UNLOCKED : State.LOCKED;
    }
    public static int canonicalId(Object value) {
        long number;
        if (value instanceof Number) {
            double raw = ((Number) value).doubleValue();
            number = ((Number) value).longValue();
            if (!Double.isFinite(raw) || raw != number) throw new IllegalArgumentException("Invalid series ID");
        } else if (value instanceof String && ((String) value).matches("[1-9][0-9]{0,9}")) {
            number = Long.parseLong((String) value);
        } else throw new IllegalArgumentException("Missing canonical series ID");
        if (number <= 0 || number > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid series ID");
        return (int) number;
    }
    private CourseAccessPolicy() {}
}
