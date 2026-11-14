package cn.com.swod.app;

import android.graphics.Bitmap;

/** Bounded static blur, computed off the UI thread and supported back to API 26. */
final class RegistrationArtwork {
    static Bitmap blur(Bitmap source) {
        final int size=64, radius=5;
        Bitmap small=Bitmap.createScaledBitmap(source,size,size,true);
        int[] pixels=new int[size*size],output=new int[size*size];
        small.getPixels(pixels,0,size,0,0,size,size);
        for(int pass=0;pass<3;pass++) {
            for(int axis=0;axis<2;axis++) {
                for(int y=0;y<size;y++)for(int x=0;x<size;x++) {
                    int red=0,green=0,blue=0;
                    for(int d=-radius;d<=radius;d++) {
                        int xx=axis==0?Math.max(0,Math.min(size-1,x+d)):x;
                        int yy=axis==1?Math.max(0,Math.min(size-1,y+d)):y;
                        int color=pixels[yy*size+xx];red+=(color>>16)&255;green+=(color>>8)&255;blue+=color&255;
                    }
                    int count=radius*2+1;output[y*size+x]=0xff000000|((red/count)<<16)|((green/count)<<8)|(blue/count);
                }
                int[] swap=pixels;pixels=output;output=swap;
            }
        }
        return Bitmap.createBitmap(pixels,size,size,Bitmap.Config.ARGB_8888);
    }
    private RegistrationArtwork() {}
}
