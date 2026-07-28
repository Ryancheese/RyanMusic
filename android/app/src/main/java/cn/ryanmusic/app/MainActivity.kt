package cn.ryanmusic.app

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var loading: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var fallbackPanel: LinearLayout
    private lateinit var remoteUrlInput: EditText
    private lateinit var btnConnect: Button
    private lateinit var btnRetryLocal: Button

    private var phpServer: PhpServer? = null
    private var baseUrl: String = "http://127.0.0.1:18765/"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        loading = findViewById(R.id.loading)
        statusText = findViewById(R.id.statusText)
        fallbackPanel = findViewById(R.id.fallbackPanel)
        remoteUrlInput = findViewById(R.id.remoteUrlInput)
        btnConnect = findViewById(R.id.btnConnect)
        btnRetryLocal = findViewById(R.id.btnRetryLocal)

        remoteUrlInput.setText(prefs().getString(KEY_REMOTE, "") ?: "")
        btnConnect.setOnClickListener { connectRemote(remoteUrlInput.text?.toString().orEmpty()) }
        btnRetryLocal.setOnClickListener {
            fallbackPanel.visibility = View.GONE
            loading.visibility = View.VISIBLE
            bootstrapLocal()
        }

        setupWebView()

        val savedRemote = prefs().getString(KEY_REMOTE, "").orEmpty().trim()
        if (savedRemote.isNotEmpty() && prefs().getBoolean(KEY_USE_REMOTE, false)) {
            connectRemote(savedRemote)
        } else {
            bootstrapLocal()
        }
    }

    private fun prefs() = getSharedPreferences("ryanmusic", Context.MODE_PRIVATE)

    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(false)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.userAgentString =
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 RyanMusicAndroid/1.7.7"

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
                fallbackPanel.visibility = View.GONE
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

    private fun bootstrapLocal() {
        thread(name = "ryan-bootstrap") {
            try {
                runOnUiThread {
                    statusText.setText(R.string.starting)
                    fallbackPanel.visibility = View.GONE
                    loading.visibility = View.VISIBLE
                    webView.visibility = View.GONE
                }
                val www = SiteInstaller.ensureInstalled(this)
                val server = PhpServer(this)
                phpServer = server
                val port = server.start(www)
                baseUrl = "http://127.0.0.1:$port/"
                prefs().edit().putBoolean(KEY_USE_REMOTE, false).apply()
                runOnUiThread { webView.loadUrl(baseUrl) }
            } catch (e: Exception) {
                runOnUiThread { showLocalFailed(e.message ?: "unknown") }
            }
        }
    }

    private fun showLocalFailed(detail: String) {
        loading.visibility = View.GONE
        webView.visibility = View.GONE
        fallbackPanel.visibility = View.VISIBLE
        statusText.text = getString(R.string.local_php_failed, detail.take(240))
        Toast.makeText(this, R.string.toast_use_remote, Toast.LENGTH_LONG).show()
    }

    private fun connectRemote(raw: String) {
        var url = raw.trim()
        if (url.isEmpty()) {
            Toast.makeText(this, R.string.hint_remote_url, Toast.LENGTH_SHORT).show()
            return
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://$url"
        }
        if (!url.endsWith("/")) url += "/"

        loading.visibility = View.VISIBLE
        fallbackPanel.visibility = View.GONE
        webView.visibility = View.GONE
        statusText.setText(R.string.connecting_remote)

        thread(name = "ryan-remote") {
            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                    requestMethod = "GET"
                    instanceFollowRedirects = true
                }
                val code = conn.responseCode
                conn.disconnect()
                if (code !in 200..399) {
                    throw IllegalStateException("HTTP $code")
                }
                baseUrl = url
                prefs().edit()
                    .putString(KEY_REMOTE, url)
                    .putBoolean(KEY_USE_REMOTE, true)
                    .apply()
                // 远程模式不需要本地 PHP
                phpServer?.stop()
                phpServer = null
                runOnUiThread { webView.loadUrl(baseUrl) }
            } catch (e: Exception) {
                runOnUiThread {
                    loading.visibility = View.GONE
                    fallbackPanel.visibility = View.VISIBLE
                    statusText.text = getString(R.string.remote_failed, e.message ?: "unknown")
                    Toast.makeText(this, statusText.text, Toast.LENGTH_LONG).show()
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
        if (this::webView.isInitialized && webView.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
        } else if (fallbackPanel.visibility != View.VISIBLE) {
            AlertDialog.Builder(this)
                .setTitle(R.string.app_name)
                .setItems(arrayOf(getString(R.string.menu_change_server), getString(R.string.menu_exit))) { _, which ->
                    when (which) {
                        0 -> {
                            phpServer?.stop()
                            phpServer = null
                            webView.visibility = View.GONE
                            fallbackPanel.visibility = View.VISIBLE
                            statusText.setText(R.string.hint_remote_url)
                        }
                        1 -> finish()
                    }
                }
                .show()
        } else {
            super.onBackPressed()
        }
    }

    companion object {
        private const val KEY_REMOTE = "remote_url"
        private const val KEY_USE_REMOTE = "use_remote"
    }
}
