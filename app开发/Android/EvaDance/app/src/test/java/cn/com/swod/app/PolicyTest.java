package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class PolicyTest {
    @Test public void rejectMissingAndMultiplyEncodedRoutes() {
        assertFalse(Policy.safePath(null));
        assertFalse(Policy.safePath("/public/%252e%252e/profile"));
        assertFalse(Policy.safePath("/member/profile\nInjected"));
        assertFalse(Policy.publicRead(null, "GET"));
        assertFalse(Policy.secureURL(null));
    }
    @Test public void acceptOnlyCompleteAppSessionTokens() {
        assertTrue(Policy.sessionTokens("eva_a_" + "a".repeat(43), "eva_r_" + "b".repeat(64)));
        assertFalse(Policy.sessionTokens("legacy-member-token", "eva_r_" + "b".repeat(64)));
        assertFalse(Policy.sessionTokens("eva_a_" + "a".repeat(42), "eva_r_" + "b".repeat(64)));
        assertFalse(Policy.sessionTokens(null, null));
    }
    @Test public void neverRouteAccountOrWritesToPublicAPI() {
        assertTrue(Policy.publicRead("/public/series/7/courses", "GET"));
        assertFalse(Policy.publicRead("/events/7/register", "GET"));
        assertFalse(Policy.publicRead("/events/7", "POST"));
        assertFalse(Policy.publicRead("/public/series/7/progress", "GET"));
        assertFalse(Policy.safePath("//evil.example/api")); assertFalse(Policy.safePath("/public/%2e%2e/member/profile"));
    }
    @Test public void rejectUnsafePlaybackAndCertificateLinks() {
        assertFalse(Policy.secureURL("file:///video.mp4")); assertFalse(Policy.secureURL("https://user@vod.swod.com.cn/video.mp4"));
        assertTrue(Policy.secureURL("https://vod.swod.com.cn/video.mp4?signature=x"));
        assertFalse(Policy.certificateURL("https://www.swod.com.cn.evil.example/certification"));
        assertTrue(Policy.certificateURL("https://www.swod.com.cn/certification?no=EVA-1"));
    }
}
