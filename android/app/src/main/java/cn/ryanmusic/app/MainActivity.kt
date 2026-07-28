package cn.ryanmusic.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var loading: LinearLayout
    private lateinit var statusText: TextView
    private var phpServer: PhpServer? = null
    private var baseUrl: String = "http://127.0.0.1:18765/"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        loading = findViewById(R.id.loading)
        statusText = findViewById(R.id.statusText)

        setupWebView()
        bootstrap()
    }

    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(false)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.userAgentString =
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 RyanMusicAndroid/1.7.6"

        webView.addJavascriptInterface(
            NativeBridge(this) { baseUrl },
            "AndroidBridge"
        )
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                injectNativeBridge()
                loading.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }
        }
    }

    private fun injectNativeBridge() {
        val script = """
            (function(){
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ryanSave) return;
              window.webkit = window.webkit || {};
              window.webkit.messageHandlers = window.webkit.messageHandlers || {};
              window.webkit.messageHandlers.ryanSave = {
                postMessage: function(payload) {
                  try {
                    var json = (typeof payload === 'string') ? payload : JSON.stringify(payload);
                    AndroidBridge.save(json);
                  } catch (e) {}
                }
              };
            })();
        """.trimIndent()
        webView.evaluateJavascript(script, null)
    }

    private fun bootstrap() {
        thread(name = "ryan-bootstrap") {
            try {
                runOnUiThread { statusText.setText(R.string.starting) }
                val www = SiteInstaller.ensureInstalled(this)
                val server = PhpServer(this)
                phpServer = server
                val port = server.start(www)
                baseUrl = "http://127.0.0.1:$port/"
                runOnUiThread {
                    webView.loadUrl(baseUrl)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    val msg = getString(R.string.start_failed, e.message ?: "unknown")
                    statusText.text = msg
                    Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onDestroy() {
        try {
            webView.loadUrl("about:blank")
            webView.destroy()
        } catch (_: Exception) {
        }
        phpServer?.stop()
        phpServer = null
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
