package cn.com.swod.app;

import android.content.Context;
import android.graphics.Bitmap;
import java.util.Map;
import java.util.HashMap;

/** Exact public-cover lookup only; never includes user images or authentication. */
final class BundledArtwork {
    private static final Map<String,String> files = new HashMap<>();
    private static final android.util.LruCache<String, Bitmap> decoded = new android.util.LruCache<String, Bitmap>(8192) {
        @Override protected int sizeOf(String key, Bitmap value) { return Math.max(1, value.getByteCount()/1024); }
    };
    static {
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E5%85%A8%E5%8A%9B%E5%87%BA%E8%82%8C%C2%B7%E8%88%9E%E8%B9%88%E6%A0%B8%E5%BF%83%E9%A3%8E%E6%9A%B4-1792289355493.jpg","cover_99413ffeb0f8cb7c78ae.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E9%BB%84%E9%87%91%E9%99%80%E8%9E%BA%C2%B7%E6%97%8B%E8%BD%AC%E8%AE%AD%E7%BB%83-1792289353555.jpg","cover_3922c8385abf8c75099f.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E8%88%9E%E8%B9%88%E8%BF%90%E5%8A%A8%E5%91%BC%E5%90%B8%E5%AD%A6-1792289363320.jpg","cover_787d89aae29dc8cf3cef.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/_7%2B1_%E5%9B%BD%E9%99%85%E6%8A%80%E5%B7%A7%E7%8F%AD-1792289349543.jpg","cover_9b9cb8ed6a8b9a413152.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/S%E6%9B%B2%E7%BA%BF%C2%B7%E8%83%B8%E8%85%B0%E8%88%9E%E6%84%9F-official.jpg","cover_ab056aa07778837b0176.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E4%B8%9C%E6%96%B9%E8%88%9E%E6%8A%80%E5%B7%A7%E5%A4%A7%E5%85%A8%C2%B7%E9%80%89%E9%85%8D128%E8%8A%82-1792289359988.jpg","cover_b370e10412b8dc6a69f7.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E4%BA%91%C2%B7%E5%BC%9F%E5%AD%90%E7%8F%AD-1792289357514.jpg","cover_b3430de1b2eae24e81a8.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E4%B8%9C%E6%96%B9%E8%88%9E%E9%9B%B6%E5%9F%BA%E7%A1%80%E5%85%A5%E9%97%A8%E8%AF%BE%E7%A8%8B%C2%B7%E5%85%A8%E9%98%B6%E6%AE%B5-official.jpg","cover_e5da0f041a67f9986c77.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/14%E7%A7%8D%E5%A4%B4%E9%83%A8%E6%8A%80%E5%B7%A7%20%2B%20%E5%85%A8%E7%B1%BB%E7%94%A9%E5%8F%91%E6%8A%80%E5%B7%A7-1792289347431.jpg","cover_6325e9a36ecc73467438.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E7%96%AF%E7%8B%82%E8%A5%BF%E7%B1%B3-1792289351402.jpg","cover_1f348321b6ca3bc36c31.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E7%BC%96%E8%88%9E%E5%B8%88%C2%B7%E7%AC%AC1%E9%98%B6-1792289345374.jpg","cover_c5f797a0a9a0d45aa0ff.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E7%BC%96%E8%88%9E%E5%B8%88%C2%B7%E7%AC%AC2%E9%98%B6-1792289342673.jpg","cover_eb7739c62ea63dd9da3d.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E8%88%9E%E8%80%85%E8%8B%B1%E8%AF%AD%C2%B7%E5%9B%BD%E9%99%85%E8%AF%BE%E5%A0%82%E5%85%A5%E9%97%A8-1792289339838.jpg","cover_aeebee832d4b219b0028.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E6%89%8B%E8%87%82%E5%85%A8%E7%BB%B4%E5%BA%A6%E7%B2%BE%E9%9B%95%E7%B3%BB%E7%BB%9F%E8%AF%BE-1792289338014.jpg","cover_6ca5ce831af431ea7456.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E9%9B%B6%E5%9F%BA%E7%A1%80%C2%B7%E4%BA%B2%E4%BC%A0%E6%95%99%E7%BB%83%E7%B3%BB%E7%BB%9F%E8%AF%BE-official.jpg","cover_0206ecda1799ec8510ac.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E6%88%90%E5%93%81%E8%88%9E%EF%BD%9C18%E6%94%AF%E5%85%A8%E9%A3%8E%E6%A0%BC%E8%88%9E%E8%B9%88-1792289463301.jpg","cover_1bcc11b7e4d60460d7a0.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E6%88%90%E5%93%81%E8%88%9E%EF%BD%9CLiberTango-1792289335977.jpg","cover_ab00ae49066f22e4f384.jpg");
        files.put("https://admin.swod.com.cn/api/course/series/cover/%E6%88%90%E5%93%81%E8%88%9E%EF%BD%9CKhaleegy%E6%B3%A2%E6%96%AF%E6%B9%BE%E7%94%A9%E5%8F%91%E8%88%9E-1780806083484.jpg","cover_d6bd42d0aa300a0ff8d8.jpg");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/tito-seif-masterclass.png","cover_9ea1b07472498a7496ea.png");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/ai-theme-holiday-intensive-20260813.webp","cover_1e055702b85dc7d0a784.webp");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/ai-theme-musicality-20260813.webp","cover_4865652446af8bb38414.webp");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/international-technique-masterclass.png","cover_451aaf79edf340e5520a.png");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/international-disciple-program.jpg","cover_42b313fa0830695d0e48.jpg");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/swod-summer-dance-workshop.png","cover_9f81dae7b77a412ab306.png");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/alida-lin-masterclass.png","cover_91a09e658cda76e25574.png");
        files.put("https://www.swod.com.cn/api/platform-offline-courses/cover/national-day-folklore-dance.png","cover_55015befd96dd72378fb.png");
    }
    static Bitmap read(Context context, String url) throws Exception {
        String file=files.get(url); if(file==null)return null;
        Bitmap image=decoded.get(url); if(image!=null)return image;
        try(var stream=context.getAssets().open("bundled-artwork/"+file)) {
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[8192];int length;while((length=stream.read(chunk))!=-1){if(bytes.size()+length>2*1024*1024)throw new java.io.IOException("Bundled image exceeds limit");bytes.write(chunk,0,length);}image=Images.decode(bytes.toByteArray());
            if(image!=null)decoded.put(url,image); return image;
        }
    }
    private BundledArtwork() {}
}
