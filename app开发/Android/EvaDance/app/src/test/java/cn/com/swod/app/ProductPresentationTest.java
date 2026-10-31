package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class ProductPresentationTest {
 @Test public void handlesRealAmountsAndMissingData(){assertEquals("¥169.00",ProductPresentation.price(16900));assertEquals("¥0.00",ProductPresentation.price(0));for(Object n:new Object[]{null,-1,1.5,Double.NaN,Double.POSITIVE_INFINITY,"16900"})assertEquals("价格待确认",ProductPresentation.price(n));assertEquals("库存 39",ProductPresentation.stock(39));assertEquals("暂时售罄",ProductPresentation.stock(0));assertEquals("库存待确认",ProductPresentation.stock(null));}
 @Test public void distinguishesAudioFromVideo(){assertTrue(CoursePolicy.isAudio("音频-东方舞的历史发展.m4a"));assertTrue(CoursePolicy.isAudio("lesson.MP3"));assertFalse(CoursePolicy.isAudio("动作.mp4"));assertFalse(CoursePolicy.isAudio(null));}
}
