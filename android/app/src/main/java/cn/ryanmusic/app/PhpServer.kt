package cn.ryanmusic.app

import android.content.Context
import android.util.Log
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class PhpServer(private val context: Context) {
    companion object {
        private const val TAG = "RyanMusic.PHP"
        private const val DEFAULT_PORT = 18765
    }

    private var process: Process? = null
    private val started = AtomicBoolean(false)
    var port: Int = DEFAULT_PORT
        private set

    fun start(webRoot: File): Int {
        stop()
        val php = File(context.applicationInfo.nativeLibraryDir, "libphp.so")
        if (!php.exists()) {
            throw IllegalStateException("找不到内嵌 PHP：${php.absolutePath}")
        }
        if (!php.canExecute()) {
            php.setExecutable(true)
        }

        port = pickPort(DEFAULT_PORT)
        val ini = File(context.filesDir, "php.ini")
        val args = mutableListOf(
            php.absolutePath,
            "-d", "memory_limit=256M",
            "-d", "display_errors=0",
            "-d", "allow_url_fopen=1",
        )
        if (ini.exists()) {
            args += listOf("-c", ini.absolutePath)
        }
        args += listOf("-S", "127.0.0.1:$port", "-t", webRoot.absolutePath)

        val pb = ProcessBuilder(args)
            .directory(webRoot)
            .redirectErrorStream(true)
        pb.environment()["LD_LIBRARY_PATH"] = context.applicationInfo.nativeLibraryDir
        pb.environment()["TMPDIR"] = context.cacheDir.absolutePath

        Log.i(TAG, "start: ${args.joinToString(" ")}")
        val p = pb.start()
        process = p
        started.set(true)

        thread(name = "php-log", isDaemon = true) {
            try {
                BufferedReader(InputStreamReader(p.inputStream)).use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        Log.d(TAG, line ?: "")
                    }
                }
            } catch (_: Exception) {
            }
        }

        waitUntilReady()
        return port
    }

    fun stop() {
        val p = process ?: return
        try {
            p.destroy()
            if (!p.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)) {
                p.destroyForcibly()
            }
        } catch (_: Exception) {
        } finally {
            process = null
            started.set(false)
        }
    }

    private fun waitUntilReady(timeoutMs: Long = 12_000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        var lastError: Exception? = null
        while (System.currentTimeMillis() < deadline) {
            if (process?.isAlive != true) {
                throw IllegalStateException("PHP 进程已退出")
            }
            try {
                val conn = (URL("http://127.0.0.1:$port/").openConnection() as HttpURLConnection).apply {
                    connectTimeout = 800
                    readTimeout = 800
                    requestMethod = "GET"
                }
                val code = conn.responseCode
                conn.disconnect()
                if (code in 200..399) {
                    Log.i(TAG, "ready on :$port (HTTP $code)")
                    return
                }
            } catch (e: Exception) {
                lastError = e
            }
            Thread.sleep(200)
        }
        throw IllegalStateException("PHP 服务启动超时：${lastError?.message ?: "unknown"}")
    }

    private fun pickPort(start: Int): Int {
        for (p in start until start + 40) {
            try {
                ServerSocket().use { socket ->
                    socket.reuseAddress = true
                    socket.bind(InetSocketAddress("127.0.0.1", p))
                }
                return p
            } catch (_: Exception) {
            }
        }
        return start
    }
}
