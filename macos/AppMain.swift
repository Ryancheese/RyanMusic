import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var phpProcess: Process?
    var port: Int = 18765
    private var healthTimer: Timer?
    private var activeDownloads: [ObjectIdentifier: URL] = [:]

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
        let rect = NSRect(x: 0, y: 0, width: 1280, height: 860)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "RyanMusic"
        window.center()
        window.minSize = NSSize(width: 980, height: 700)
        window.setFrameAutosaveName("RyanMusicMainWindow_v171")

        let config = WKWebViewConfiguration()
        config.preferences.isElementFullscreenEnabled = true
        config.userContentController.add(self, name: "ryanSave")

        let desktopUA =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
        webView = WKWebView(frame: rect, configuration: config)
        webView.customUserAgent = desktopUA
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

    // MARK: - JS → Native 另存为

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "ryanSave",
              let body = message.body as? [String: Any],
              let filename = body["filename"] as? String else {
            return
        }

        let safeName = Self.sanitizeFilename(filename)
        DispatchQueue.main.async {
            let panel = NSSavePanel()
            panel.canCreateDirectories = true
            panel.isExtensionHidden = false
            panel.nameFieldStringValue = safeName

            panel.beginSheetModal(for: self.window) { response in
                guard response == .OK, let dest = panel.url else { return }

                if let text = body["text"] as? String {
                    do {
                        try text.write(to: dest, atomically: true, encoding: .utf8)
                        Self.notify("已保存：\(dest.lastPathComponent)")
                    } catch {
                        Self.alert("保存歌词失败：\(error.localizedDescription)")
                    }
                    return
                }

                if let urlString = body["url"] as? String, let url = URL(string: urlString) {
                    self.downloadFile(from: url, to: dest)
                    return
                }

                Self.alert("没有可保存的内容")
            }
        }
    }

    private func downloadFile(from url: URL, to destination: URL) {
        Self.notify("开始下载…")
        let task = URLSession.shared.downloadTask(with: url) { tempURL, response, error in
            DispatchQueue.main.async {
                if let error {
                    Self.alert("下载失败：\(error.localizedDescription)")
                    return
                }
                guard let tempURL else {
                    Self.alert("下载失败：没有收到文件")
                    return
                }
                do {
                    if FileManager.default.fileExists(atPath: destination.path) {
                        try FileManager.default.removeItem(at: destination)
                    }
                    try FileManager.default.moveItem(at: tempURL, to: destination)
                    Self.notify("已保存：\(destination.lastPathComponent)")
                    NSWorkspace.shared.activateFileViewerSelecting([destination])
                } catch {
                    Self.alert("保存失败：\(error.localizedDescription)")
                }
            }
        }
        task.resume()
    }

    // MARK: - WKDownload（附件导航兜底）

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        if let http = navigationResponse.response as? HTTPURLResponse {
            let cd = (http.value(forHTTPHeaderField: "Content-Disposition") ?? "").lowercased()
            let mime = (http.mimeType ?? "").lowercased()
            let isAttachment = cd.contains("attachment")
            let isAudio = mime.hasPrefix("audio/") || mime.contains("mpeg") || mime.contains("mp4")
            if isAttachment || (isAudio && !navigationResponse.canShowMIMEType) {
                decisionHandler(.download)
                return
            }
        }
        if !navigationResponse.canShowMIMEType {
            decisionHandler(.download)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let panel = NSSavePanel()
        panel.canCreateDirectories = true
        panel.nameFieldStringValue = Self.sanitizeFilename(suggestedFilename)
        panel.beginSheetModal(for: window) { result in
            if result == .OK, let url = panel.url {
                self.activeDownloads[ObjectIdentifier(download)] = url
                completionHandler(url)
            } else {
                completionHandler(nil)
            }
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let url = activeDownloads.removeValue(forKey: ObjectIdentifier(download)) {
            Self.notify("已保存：\(url.lastPathComponent)")
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        activeDownloads.removeValue(forKey: ObjectIdentifier(download))
        Self.alert("下载失败：\(error.localizedDescription)")
    }

    // MARK: - PHP process

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

    static func sanitizeFilename(_ name: String) -> String {
        let invalid = CharacterSet(charactersIn: "/\\:?%*|\"<>")
        let cleaned = name.components(separatedBy: invalid).joined(separator: "_")
        return cleaned.isEmpty ? "RyanMusic" : cleaned
    }

    static func alert(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "RyanMusic"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "好")
        alert.runModal()
    }

    static func notify(_ message: String) {
        // 成功时用 Finder 定位文件即可，这里仅打日志避免依赖旧通知 API
        NSLog("[RyanMusic] %@", message)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
