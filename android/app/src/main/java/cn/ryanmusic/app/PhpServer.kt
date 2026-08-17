package cn.ryanmusic.app

import android.content.Context
import android.os.Build
import android.util.Log
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URL
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class PhpServer(private val context: Context) {
    companion object {
        private const val TAG = "RyanMusic.PHP"
        private const val DEFAULT_PORT = 18765
    }

    private var process: Process? = null
    private val started = AtomicBoolean(false)
    private val logBuf = StringBuilder()
    var port: Int = DEFAULT_PORT
        private set
    var lastLog: String = ""
        private set

    fun start(webRoot: File): Int {
        stop()
        logBuf.setLength(0)

        val php = resolvePhpBinary()
        val probe = runProbe(php)
        appendLog("probe:\n$probe")
        if (!probe.contains("PHP", ignoreCase = true) && !probe.contains("Copyright", ignoreCase = true)) {
            // 继续尝试启动，部分机型 -v 输出异常但 -S 可用
            appendLog("warn: php -v 未识别到正常输出，仍尝试启动服务")
        }

        port = pickPort(DEFAULT_PORT)
        val ini = File(context.filesDir, "php.ini")
        val serverArgs = buildServerArgs(php, webRoot, ini, port)

        var lastFail: Exception? = null
        for (launcher in buildLaunchers(php, serverArgs)) {
            try {
                appendLog("try: ${launcher.joinToString(" ")}")
                val p = startProcess(launcher, webRoot)
                process = p
                started.set(true)
                startLogPump(p)
                waitUntilReady()
                lastLog = logBuf.toString()
                writeLogFile()
                return port
            } catch (e: Exception) {
                lastFail = e
                appendLog("fail: ${e.message}")
                stop()
            }
        }

        lastLog = logBuf.toString()
        writeLogFile()
        throw IllegalStateException(
            buildString {
                append(lastFail?.message ?: "PHP 启动失败")
                append("\n设备: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
                append(" Android ").append(Build.VERSION.RELEASE)
                append("\n详情见应用内 php-start.log")
                val tail = lastLog.lines().takeLast(8).joinToString("\n")
                if (tail.isNotBlank()) {
                    append("\n---\n").append(tail)
                }
            }
        )
    }

    fun stop() {
        val p = process ?: return
        try {
            p.destroy()
            if (!p.waitFor(2, TimeUnit.SECONDS)) {
                p.destroyForcibly()
            }
        } catch (_: Exception) {
        } finally {
            process = null
            started.set(false)
        }
    }

    private fun resolvePhpBinary(): File {
        val php = File(context.applicationInfo.nativeLibraryDir, "libphp.so")
        if (!php.exists()) {
            throw IllegalStateException("找不到内嵌 PHP：${php.absolutePath}")
        }
        // 部分 ROM 提取后无执行位
        php.setReadable(true, true)
        php.setExecutable(true, true)
        appendLog("php=${php.absolutePath} size=${php.length()} exec=${php.canExecute()}")
        return php
    }

    private fun buildServerArgs(php: File, webRoot: File, ini: File, port: Int): List<String> {
        val args = mutableListOf(
            "-d", "memory_limit=256M",
            "-d", "display_errors=0",
            "-d", "allow_url_fopen=1",
            "-d", "error_log=${File(context.filesDir, "php-error.log").absolutePath}",
        )
        if (ini.exists()) {
            args += listOf("-c", ini.absolutePath)
        }
        args += listOf("-S", "127.0.0.1:$port", "-t", webRoot.absolutePath)
        return args
    }

    private fun buildLaunchers(php: File, serverArgs: List<String>): List<List<String>> {
        val direct = listOf(php.absolutePath) + serverArgs
        val launchers = mutableListOf<List<String>>()
        launchers += direct
        for (linker in listOf("/system/bin/linker64", "/system/bin/linker")) {
            if (File(linker).exists()) {
                launchers += listOf(linker, php.absolutePath) + serverArgs
            }
        }
        // sh 包装（部分华为 ROM 对直接 exec ELF 更严）
        launchers += listOf("/system/bin/sh", "-c", (listOf(php.absolutePath) + serverArgs).joinToString(" ") { shellQuote(it) })
        return launchers.distinct()
    }

    private fun shellQuote(s: String): String {
        if (s.isEmpty()) return "''"
        return "'" + s.replace("'", "'\\''") + "'"
    }

    private fun runProbe(php: File): String {
        val attempts = mutableListOf(
            listOf(php.absolutePath, "-v"),
        )
        for (linker in listOf("/system/bin/linker64", "/system/bin/linker")) {
            if (File(linker).exists()) {
                attempts += listOf(linker, php.absolutePath, "-v")
            }
        }
        val out = StringBuilder()
        for (cmd in attempts) {
            try {
                val pb = ProcessBuilder(cmd).redirectErrorStream(true)
                applyEnv(pb)
                val p = pb.start()
                val text = p.inputStream.bufferedReader().readText()
                val ok = p.waitFor(5, TimeUnit.SECONDS)
                val code = if (ok) p.exitValue() else -1
                if (!ok) p.destroyForcibly()
                out.append("cmd=").append(cmd.joinToString(" "))
                    .append(" exit=").append(code)
                    .append('\n').append(text.trim()).append("\n\n")
                if (code == 0 && text.contains("PHP", ignoreCase = true)) {
                    return out.toString()
                }
            } catch (e: Exception) {
                out.append("cmd=").append(cmd.joinToString(" "))
                    .append(" err=").append(e.message).append("\n\n")
            }
        }
        return out.toString()
    }

    private fun startProcess(cmd: List<String>, webRoot: File): Process {
        val pb = ProcessBuilder(cmd)
            .directory(webRoot)
            .redirectErrorStream(true)
        applyEnv(pb)
        return pb.start()
    }

    private fun applyEnv(pb: ProcessBuilder) {
        val env = pb.environment()
        env["LD_LIBRARY_PATH"] = context.applicationInfo.nativeLibraryDir
        env["TMPDIR"] = context.cacheDir.absolutePath
        env["HOME"] = context.filesDir.absolutePath
        env["TMP"] = context.cacheDir.absolutePath
        env["TEMP"] = context.cacheDir.absolutePath
    }

    private fun startLogPump(p: Process) {
        thread(name = "php-log", isDaemon = true) {
            try {
                BufferedReader(InputStreamReader(p.inputStream)).use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val l = line ?: continue
                        Log.d(TAG, l)
                        appendLog(l)
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    private fun waitUntilReady(timeoutMs: Long = 12_000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        var lastError: Exception? = null
        while (System.currentTimeMillis() < deadline) {
            val p = process
            if (p != null && !p.isAlive) {
                val code = try {
                    p.exitValue()
                } catch (_: Exception) {
                    -1
                }
                throw IllegalStateException("PHP 进程已退出(code=$code)")
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

    @Synchronized
    private fun appendLog(line: String) {
        if (logBuf.length > 32_000) {
            logBuf.delete(0, logBuf.length - 16_000)
        }
        logBuf.append(line).append('\n')
    }

    private fun writeLogFile() {
        try {
            File(context.filesDir, "php-start.log").writeText(logBuf.toString())
        } catch (_: Exception) {
        }
    }
}
