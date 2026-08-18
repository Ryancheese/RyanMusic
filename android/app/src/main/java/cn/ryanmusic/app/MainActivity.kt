package cn.ryanmusic.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
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
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var overlay: View
    private lateinit var loading: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var fallbackPanel: LinearLayout
    private lateinit var remoteUrlInput: EditText
    private lateinit var btnConnect: Button
    private lateinit var btnUseCloud: Button
    private lateinit var btnRetryLocal: Button

    private var baseUrl: String = "http://127.0.0.1:18765/"
    private var keepAliveStarted = false

    private val notifyPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) startKeepAlive()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        overlay = findViewById(R.id.overlay)
        loading = findViewById(R.id.loading)
        statusText = findViewById(R.id.statusText)
        fallbackPanel = findViewById(R.id.fallbackPanel)
        remoteUrlInput = findViewById(R.id.remoteUrlInput)
        btnConnect = findViewById(R.id.btnConnect)
        btnUseCloud = findViewById(R.id.btnUseCloud)
        btnRetryLocal = findViewById(R.id.btnRetryLocal)

        remoteUrlInput.setText(prefs().getString(KEY_REMOTE, "") ?: "")
        btnConnect.setOnClickListener {
            connectRemote(remoteUrlInput.text?.toString().orEmpty(), PersistMode.CUSTOM)
        }
        btnUseCloud.setOnClickListener { connectCloud(PersistMode.CLOUD) }
        btnRetryLocal.setOnClickListener { connectCloud(PersistMode.CLOUD) }

        setupWebView()
        setupBackPress()
        migrateLegacyPrefs()
        startPreferredServer()
    }

    private fun prefs() = getSharedPreferences("ryanmusic", Context.MODE_PRIVATE)

    private fun migrateLegacyPrefs() {
        if (prefs().contains(KEY_MODE)) return
        val useRemote = prefs().getBoolean(KEY_USE_REMOTE_LEGACY, false)
        val remote = prefs().getString(KEY_REMOTE, "").orEmpty().trim()
        if (useRemote && remote.isNotEmpty()) {
            prefs().edit().putString(KEY_MODE, MODE_CUSTOM).apply()
        }
    }

    private fun startPreferredServer() {
        when (prefs().getString(KEY_MODE, MODE_CLOUD)) {
            MODE_CUSTOM -> {
                val saved = prefs().getString(KEY_REMOTE, "").orEmpty().trim()
                if (saved.isNotEmpty()) {
                    connectRemote(saved, PersistMode.CUSTOM)
                } else {
                    connectCloud(PersistMode.CLOUD)
                }
            }
            else -> connectCloud(PersistMode.CLOUD)
        }
    }

    private fun setupBackPress() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (this@MainActivity::webView.isInitialized &&
                    webView.visibility == View.VISIBLE &&
                    webView.canGoBack()
                ) {
                    webView.goBack()
                    return
                }
                if (fallbackPanel.visibility != View.VISIBLE) {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle(R.string.app_name)
                        .setItems(
                            arrayOf(
                                getString(R.string.menu_use_cloud),
                                getString(R.string.menu_change_server),
                                getString(R.string.menu_exit),
                            ),
                        ) { _, which ->
                            when (which) {
                                0 -> connectCloud(PersistMode.CLOUD)
                                1 -> showServerPicker()
                                2 -> finish()
                            }
                        }
                        .show()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun showServerPicker() {
        stopKeepAlive()
        webView.visibility = View.GONE
        overlay.visibility = View.VISIBLE
        loading.visibility = View.GONE
        fallbackPanel.visibility = View.VISIBLE
        statusText.setText(R.string.fallback_title)
    }

    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(false)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString =
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 RyanMusicAndroid/${BuildConfig.VERSION_NAME}"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = false
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.addJavascriptInterface(
            NativeBridge(this) { baseUrl },
            "AndroidBridge",
        )
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                injectNativeBridge()
                overlay.visibility = View.GONE
                loading.visibility = View.GONE
                fallbackPanel.visibility = View.GONE
                webView.visibility = View.VISIBLE
                ensureKeepAlive()
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

    private fun connectCloud(persist: PersistMode) {
        connectRemote(BuildConfig.CLOUD_ORIGIN, persist, connectingLabel = R.string.connecting_cloud)
    }

    private fun connectRemote(
        raw: String,
        persist: PersistMode,
        connectingLabel: Int = R.string.connecting_remote,
    ) {
        var url = raw.trim()
        if (url.isEmpty()) {
            Toast.makeText(this, R.string.hint_remote_url, Toast.LENGTH_SHORT).show()
            return
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://$url"
        }
        if (!url.endsWith("/")) url += "/"

        overlay.visibility = View.VISIBLE
        loading.visibility = View.VISIBLE
        fallbackPanel.visibility = View.GONE
        webView.visibility = View.GONE
        statusText.setText(connectingLabel)

        val timeoutMs = if (url.startsWith("https://", ignoreCase = true)) 15_000 else 5_000
        thread(name = "ryan-remote") {
            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = timeoutMs
                    readTimeout = timeoutMs
                    requestMethod = "GET"
                    instanceFollowRedirects = true
                }
                val code = conn.responseCode
                conn.disconnect()
                if (code !in 200..399) {
                    throw IllegalStateException("HTTP $code")
                }
                baseUrl = url
                val editor = prefs().edit()
                when (persist) {
                    PersistMode.CLOUD -> editor.putString(KEY_MODE, MODE_CLOUD)
                    PersistMode.CUSTOM -> editor
                        .putString(KEY_MODE, MODE_CUSTOM)
                        .putString(KEY_REMOTE, url)
                    PersistMode.NONE -> { /* 自动回退不改下次启动偏好 */ }
                }
                editor.apply()
                runOnUiThread { webView.loadUrl(baseUrl) }
            } catch (e: Exception) {
                runOnUiThread {
                    overlay.visibility = View.VISIBLE
                    loading.visibility = View.GONE
                    fallbackPanel.visibility = View.VISIBLE
                    statusText.text = getString(R.string.remote_failed, e.message ?: "unknown")
                    Toast.makeText(this, statusText.text, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun ensureKeepAlive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notifyPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        startKeepAlive()
    }

    private fun startKeepAlive() {
        if (keepAliveStarted) return
        val intent = Intent(this, PlaybackKeepAliveService::class.java)
        try {
            ContextCompat.startForegroundService(this, intent)
            keepAliveStarted = true
        } catch (_: Exception) {
        }
    }

    private fun stopKeepAlive() {
        if (!keepAliveStarted) return
        val intent = Intent(this, PlaybackKeepAliveService::class.java).setAction(PlaybackKeepAliveService.ACTION_STOP)
        try {
            startService(intent)
        } catch (_: Exception) {
        }
        keepAliveStarted = false
    }

    override fun onResume() {
        super.onResume()
        if (this::webView.isInitialized) {
            webView.onResume()
        }
    }

    override fun onPause() {
        // 不调用 webView.onPause()，避免切到后台后歌词动画和音频被挂起
        super.onPause()
    }

    override fun onDestroy() {
        stopKeepAlive()
        try {
            CookieManager.getInstance().flush()
            webView.loadUrl("about:blank")
            webView.destroy()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    private enum class PersistMode {
        NONE,
        CLOUD,
        CUSTOM,
    }

    companion object {
        private const val KEY_REMOTE = "remote_url"
        private const val KEY_USE_REMOTE_LEGACY = "use_remote"
        private const val KEY_MODE = "server_mode"
        private const val MODE_CLOUD = "cloud"
        private const val MODE_CUSTOM = "custom"
    }
}
