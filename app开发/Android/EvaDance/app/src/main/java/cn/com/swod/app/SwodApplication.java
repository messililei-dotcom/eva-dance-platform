package cn.com.swod.app;
public final class SwodApplication extends android.app.Application {
    @Override public void onCreate(){super.onCreate();AppPush.initialize(this);}
}
