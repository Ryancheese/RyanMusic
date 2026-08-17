# RyanMusic — keep JS bridge
-keepclassmembers class cn.ryanmusic.app.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
