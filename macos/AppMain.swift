import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var phpProcess: Process?
    var port: Int = 18765
    private var healthTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let php = Self.findPHP() else {
            Self.alert("未找到 PHP。请先执行：brew install php")
            NSApp.terminate(nil)
            return
        }

        let webRoot = Self.webRoot()
        guard FileManager.default.fileExists(atPath: webRoot) else {
            Self.alert("找不到站点目录：\n\(webRoot)")
            NSApp.terminate(nil)
            return
        }

        do {
            port = try Self.pickPort(startingAt: 18765)
            try startPHP(phpPath: php, webRoot: webRoot, port: port)
        } catch {
            Self.alert("启动服务失败：\(error.localizedDescription)")
            NSApp.terminate(nil)
            return
        }

        setupWindow()
        loadHomeWhenReady()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        healthTimer?.invalidate()
        stopPHP()
    }

    private func setupWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1100, height: 760)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RyanMusic"
        window.center()
        window.minSize = NSSize(width: 800, height: 560)
        window.setFrameAutosaveName("RyanMusicMainWindow")

        let config = WKWebViewConfiguration()
        config.preferences.isElementFullscreenEnabled = true
        webView = WKWebView(frame: rect, configuration: config)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func loadHomeWhenReady() {
        let url = URL(string: "http://127.0.0.1:\(port)/")!
        var tries = 0
        healthTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] timer in
            guard let self else {
                timer.invalidate()
                return
            }
            tries += 1
            var request = URLRequest(url: url, timeoutInterval: 0.8)
            request.httpMethod = "GET"
            let task = URLSession.shared.dataTask(with: request) { _, response, _ in
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<400).contains(code) {
                    DispatchQueue.main.async {
                        timer.invalidate()
                        self.healthTimer = nil
                        self.webView.load(URLRequest(url: url))
                    }
                } else if tries > 50 {
                    DispatchQueue.main.async {
                        timer.invalidate()
                        self.healthTimer = nil
                        Self.alert("服务启动超时，请重试")
                        NSApp.terminate(nil)
                    }
                }
            }
            task.resume()
        }
    }

    private func startPHP(phpPath: String, webRoot: String, port: Int) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: phpPath)
        process.arguments = ["-S", "127.0.0.1:\(port)", "-t", webRoot]
        let log = FileManager.default.temporaryDirectory.appendingPathComponent("ryanmusic-php.log")
        FileManager.default.createFile(atPath: log.path, contents: nil)
        let handle = try FileHandle(forWritingTo: log)
        process.standardOutput = handle
        process.standardError = handle
        process.terminationHandler = { _ in
            try? handle.close()
        }
        try process.run()
        phpProcess = process
    }

    private func stopPHP() {
        guard let process = phpProcess, process.isRunning else { return }
        process.terminate()
        // give it a moment, then force
        let deadline = Date().addingTimeInterval(1.5)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }
        if process.isRunning {
            process.interrupt()
        }
        phpProcess = nil
    }

    static func webRoot() -> String {
        let bundle = Bundle.main.bundlePath
        return (bundle as NSString).appendingPathComponent("Contents/Resources/maicong-music")
    }

    static func findPHP() -> String? {
        let candidates = [
            "/opt/homebrew/bin/php",
            "/usr/local/bin/php"
        ]
        for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        process.arguments = ["php"]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()
        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !path.isEmpty, FileManager.default.isExecutableFile(atPath: path) {
                return path
            }
        } catch {
            return nil
        }
        return nil
    }

    static func pickPort(startingAt start: Int) throws -> Int {
        for port in start..<(start + 30) {
            if !isPortInUse(port) {
                return port
            }
        }
        throw NSError(domain: "RyanMusic", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "找不到可用端口"
        ])
    }

    static func isPortInUse(_ port: Int) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        process.arguments = ["-nP", "-iTCP:\(port)", "-sTCP:LISTEN"]
        process.standardOutput = Pipe()
        process.standardError = Pipe()
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }

    static func alert(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "RyanMusic"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: "好")
        alert.runModal()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
