package cn.ryanmusic.app

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class NativeBridge(
    private val context: Context,
    private val baseUrlProvider: () -> String,
) {
    private val io = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun save(payloadJson: String) {
        io.execute {
            try {
                val root = JSONObject(payloadJson)
                val filename = sanitize(root.optString("filename", "RyanMusic"))
                when {
                    root.has("text") && !root.isNull("text") -> {
                        val text = root.getString("text")
                        saveBytes(filename, text.toByteArray(Charsets.UTF_8), "text/plain")
                    }
                    root.has("url") && !root.isNull("url") -> {
                        var url = root.getString("url")
                        if (!url.startsWith("http", ignoreCase = true)) {
                            val base = baseUrlProvider().trimEnd('/')
                            url = "$base/${url.trimStart('/')}"
                        }
                        val bytes = download(url)
                        saveBytes(filename, bytes, guessMime(filename))
                    }
                    else -> throw IllegalArgumentException("没有可保存的内容")
                }
                toast(context.getString(R.string.download_ok, filename))
            } catch (e: Exception) {
                toast(context.getString(R.string.download_fail, e.message ?: "unknown"))
            }
        }
    }

    private fun download(url: String): ByteArray {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20_000
            readTimeout = 120_000
            instanceFollowRedirects = true
            requestMethod = "GET"
        }
        conn.inputStream.use { return it.readBytes() }
    }

    private fun saveBytes(filename: String, bytes: ByteArray, mime: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("无法创建下载文件")
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: throw IllegalStateException("无法写入下载文件")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } else {
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!dir.exists()) dir.mkdirs()
            val out = File(dir, filename)
            FileOutputStream(out).use { it.write(bytes) }
        }
    }

    private fun sanitize(name: String): String {
        val cleaned = name.replace(Regex("""[\\/:*?"<>|\x00-\x1F]"""), "_").trim()
        return cleaned.ifBlank { "RyanMusic" }
    }

    private fun guessMime(name: String): String = when {
        name.endsWith(".mp3", true) -> "audio/mpeg"
        name.endsWith(".lrc", true) -> "text/plain"
        name.endsWith(".txt", true) -> "text/plain"
        else -> "application/octet-stream"
    }

    private fun toast(msg: String) {
        android.os.Handler(context.mainLooper).post {
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }
}
