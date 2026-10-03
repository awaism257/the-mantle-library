package org.mantlelibrary.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://mantlelibrary.app/";
    private static final String BG_COLOR = "#101613";

    private WebView mWebView;

    // Volume-key page turning. All three are reported by the web app through
    // AndroidBridge; the keys only turn pages when a paged reader is open,
    // audio is NOT playing and the user has the setting on. Otherwise the
    // volume keys behave exactly as normal (system media volume).
    private volatile boolean readerOpen = false;
    private volatile boolean audioPlaying = false;
    private volatile boolean volumePagingEnabled = true;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Volume keys always drive the media stream (the narration), never ringer.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        // Edge-to-edge transparent status bar and navigation bar matching Munajaat and JustQuran
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        } else {
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }

        mWebView = new WebView(this);
        mWebView.setBackgroundColor(Color.TRANSPARENT);
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings s = mWebView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        // Bridge to receive theme changes from the web app
        mWebView.addJavascriptInterface(new ThemeBridge(), "AndroidBridge");

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return handleUri(uri);
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUri(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Synchronize system bar icons with web app theme on page load
                view.evaluateJavascript(
                    "(function() { return document.documentElement.classList.contains('light') ? 'light' : 'dark'; })();",
                    value -> {
                        boolean isDark = !"\"light\"".equals(value);
                        setStatusBarAppearance(isDark);
                    }
                );
            }

            private boolean handleUri(Uri uri) {
                if (uri == null) return false;
                String host = uri.getHost();
                String scheme = uri.getScheme();

                // Keep internal app routes and Netlify mirrors inside the WebView
                if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
                    if (host != null && (host.equalsIgnoreCase("mantlelibrary.app")
                            || host.equalsIgnoreCase("the-mantle-library.netlify.app")
                            || host.contains("mantlelibrary"))) {
                        return false;
                    }
                }

                // Open external links (Netlify sponsor, Harvard Loeb, GitHub, etc.) in system browser
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    return false;
                }
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient());

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.TRANSPARENT);
        container.setFitsSystemWindows(false);
        container.addView(mWebView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(container);

        if (savedInstanceState == null) {
            mWebView.loadUrl(APP_URL);
        } else {
            mWebView.restoreState(savedInstanceState);
        }
    }

    public class ThemeBridge {
        @android.webkit.JavascriptInterface
        public void onThemeChanged(boolean isDark) {
            runOnUiThread(() -> setStatusBarAppearance(isDark));
        }

        @android.webkit.JavascriptInterface
        public void onReaderState(boolean open) {
            android.util.Log.d("MantleLibrary", "onReaderState: " + open);
            readerOpen = open;
        }

        @android.webkit.JavascriptInterface
        public void onAudioState(boolean playing) {
            android.util.Log.d("MantleLibrary", "onAudioState: " + playing);
            audioPlaying = playing;
        }

        @android.webkit.JavascriptInterface
        public void onVolumePagingSetting(boolean enabled) {
            android.util.Log.d("MantleLibrary", "onVolumePagingSetting: " + enabled);
            volumePagingEnabled = enabled;
        }
    }

    private boolean volumeKeysTurnPages() {
        return volumePagingEnabled && readerOpen && !audioPlaying;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        if ((keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP)
                && volumeKeysTurnPages()) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                int dir = (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) ? 1 : -1;
                android.util.Log.d("MantleLibrary", "Volume key paging: keyCode=" + keyCode + " dir=" + dir);
                if (mWebView != null) {
                    mWebView.post(() -> mWebView.evaluateJavascript(
                        "window.mantleTurnPage && window.mantleTurnPage(" + dir + ")", null));
                }
            }
            // Consume both ACTION_DOWN and ACTION_UP to prevent system volume slider popup
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void setStatusBarAppearance(boolean isDark) {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.view.WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int appearance = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS |
                                 android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                if (isDark) {
                    controller.setSystemBarsAppearance(0, appearance);
                } else {
                    controller.setSystemBarsAppearance(appearance, appearance);
                }
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decor = window.getDecorView();
            int flags = decor.getSystemUiVisibility();
            if (isDark) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            }
            decor.setSystemUiVisibility(flags);
        }
    }

    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (mWebView != null) {
            mWebView.saveState(outState);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mWebView != null) {
            mWebView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.destroy();
            mWebView = null;
        }
        super.onDestroy();
    }
}
