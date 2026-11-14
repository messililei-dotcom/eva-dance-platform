package cn.com.swod.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Public images never receive member credentials; bound both download and decoded size. */
final class Images {
    private static final android.util.LruCache<String, Bitmap> cache = new android.util.LruCache<String, Bitmap>(8192) {
        @Override protected int sizeOf(String key, Bitmap value) { return Math.max(1, value.getByteCount() / 1024); }
    };
    static Bitmap read(String url) throws Exception {
        if (!Policy.secureURL(url)) throw new IllegalArgumentException();
        Bitmap saved = cache.get(url);
        if (saved != null) return saved;
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        try {
            if (connection.getResponseCode() != 200) throw new Exception("Image unavailable");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (var stream = connection.getInputStream()) {
                byte[] chunk = new byte[8192]; int length;
                while ((length = stream.read(chunk)) != -1) {
                    if (bytes.size() + length > 5 * 1024 * 1024) throw new Exception("Image too large");
                    bytes.write(chunk, 0, length);
                }
            }
            byte[] data = bytes.toByteArray();
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, options);
            if (options.outWidth <= 0 || options.outHeight <= 0) return null;
            options.inSampleSize = 1;
            while (options.outWidth / options.inSampleSize > 1024 || options.outHeight / options.inSampleSize > 1024) options.inSampleSize *= 2;
            options.inJustDecodeBounds = false;
            Bitmap bitmap = BitmapFactory.decodeByteArray(data, 0, data.length, options);
            if (bitmap != null) cache.put(url, bitmap);
            return bitmap;
        } finally { connection.disconnect(); }
    }
    private Images() {}
}
