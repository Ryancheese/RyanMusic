import Cocoa
import WebKit

/// 顶部标题栏命中层：拖拽移动；双击缩放（与系统 App 一致）
/// 左右留空给红绿灯 / LOGO，避免挡住交互
final class TitlebarDragOverlay: NSView {
    var bandHeight: CGFloat = 52
    var passthroughLeading: CGFloat = 88
    var passthroughTrailing: CGFloat = 280

    override var isOpaque: Bool { false }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func layout() {
        super.layout()
        guard let superview else { return }
        frame = NSRect(
            x: 0,
            y: superview.bounds.height - bandHeight,
            width: superview.bounds.width,
            height: bandHeight
        )
        autoresizingMask = [.width, .minYMargin]
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        guard let superview else { return nil }
        let local = convert(point, from: superview)
        guard bounds.contains(local) else { return nil }
        if local.x <= passthroughLeading { return nil }
        if local.x >= bounds.width - passthroughTrailing { return nil }
        return self
    }

    override func mouseDown(with event: NSEvent) {
        guard let window else { return }
        if event.clickCount >= 2 {
            window.performZoom(nil)
            return
        }
        window.performDrag(with: event)
    }
}

final class RyanWebView: WKWebView {}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler, WKDownloadDelegate {
    var window: NSWindow!
    var webView: RyanWebView!
    private var titlebarDragOverlay: TitlebarDragOverlay?
    var phpProcess: Process?
    var port: Int = 18765
    private var healthTimer: Timer?
    private var activeDownloads: [ObjectIdentifier: URL] = [:]
    private var chromeObservers: [NSObjectProtocol] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let php = Self.findPHP() else {
            Self.alert("未找到 PHP。\n请使用官方 DMG（已内嵌 PHP），或执行：brew install php")
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
        for token in chromeObservers {
            NotificationCenter.default.removeObserver(token)
        }
        chromeObservers.removeAll()
        stopPHP()
    }

    private func setupWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1280, height: 860)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "RyanMusic"
        window.appearance = NSAppearance(named: .darkAqua)
        window.isMovableByWindowBackground = true
        window.center()
        window.minSize = NSSize(width: 980, height: 700)
        window.setFrameAutosaveName("RyanMusicMainWindow_v1827")

        let config = WKWebViewConfiguration()
        config.preferences.isElementFullscreenEnabled = true
        config.userContentController.add(self, name: "ryanSave")
        config.userContentController.add(self, name: "ryanWindowDrag")
        config.userContentController.add(self, name: "ryanWindowZoom")
        // 标记桌面壳 + 空白处拖拽 / 双击缩放
        let platformJS = """
        document.documentElement.classList.add('platform-macos-app');
        (function () {
          function isNoDrag(el) {
            return !!(el && el.closest && el.closest(
              'a,button,input,textarea,select,label,option,audio,video,' +
              '.aplayer,.search-bar,.local-library,.site-chrome,.site-footer,' +
              '.am-form,.result-player,.ambient-controls,.music-main,' +
              '[role="button"],[role="tablist"],[contenteditable="true"]'
            ));
          }
          document.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (isNoDrag(e.target)) return;
            try {
              if (e.detail >= 2) {
                window.webkit.messageHandlers.ryanWindowZoom.postMessage({});
              } else {
                window.webkit.messageHandlers.ryanWindowDrag.postMessage({});
              }
            } catch (err) {}
          }, true);
        })();
        """
        config.userContentController.addUserScript(
            WKUserScript(source: platformJS, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        let desktopUA =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
        webView = RyanWebView(frame: rect, configuration: config)
        webView.customUserAgent = desktopUA
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]

        // 底层容器保证标题栏区域始终有深色底，避免全屏退出后露黑条
        let container = NSView(frame: rect)
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(srgbRed: 0.02, green: 0.02, blue: 0.027, alpha: 1).cgColor
        webView.frame = container.bounds
        container.addSubview(webView)

        let overlay = TitlebarDragOverlay(frame: .zero)
        titlebarDragOverlay = overlay
        container.addSubview(overlay)
        overlay.layout()

        window.contentView = container

        applyWindowChrome()
        observeWindowChrome()

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func applyWindowChrome() {
        guard let window else { return }
        if !window.styleMask.contains(.fullSizeContentView) {
            window.styleMask.insert(.fullSizeContentView)
        }
        // 全屏退出后系统有时会复位，先关再开强制刷新
        window.titlebarAppearsTransparent = false
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isOpaque = false
        window.backgroundColor = NSColor(srgbRed: 0.02, green: 0.02, blue: 0.027, alpha: 1)
        if #available(macOS 11.0, *) {
            window.titlebarSeparatorStyle = .none
        }
        webView?.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) {
            webView?.underPageBackgroundColor = .clear
        }
        if let container = window.contentView {
            container.wantsLayer = true
            container.layer?.backgroundColor = NSColor(srgbRed: 0.02, green: 0.02, blue: 0.027, alpha: 1).cgColor
        }
    }

    private func observeWindowChrome() {
        let center = NotificationCenter.default
        let names: [Notification.Name] = [
            NSWindow.didExitFullScreenNotification,
            NSWindow.didEnterFullScreenNotification,
            NSWindow.didBecomeKeyNotification
        ]
        for name in names {
            let token = center.addObserver(forName: name, object: window, queue: .main) { [weak self] note in
                // 全屏退出后等一帧再刷，避免系统样式覆盖
                let delay = (note.name == NSWindow.didExitFullScreenNotification) ? 0.05 : 0.0
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    self?.applyWindowChrome()
                }
            }
            chromeObservers.append(token)
        }
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
        if message.name == "ryanWindowZoom" {
            DispatchQueue.main.async { [weak self] in
                self?.window?.performZoom(nil)
            }
            return
        }

        if message.name == "ryanWindowDrag" {
            // 必须同步用当前鼠标事件启动拖拽
            if let event = NSApp.currentEvent,
               event.type == .leftMouseDown || event.type == .leftMouseDragged {
                window?.performDrag(with: event)
            }
            return
        }

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

    // MARK: - Navigation

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let scheme = (url.scheme ?? "").lowercased()
        if scheme == "mailto" || scheme == "tel" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        if scheme == "http" || scheme == "https" {
            let host = (url.host ?? "").lowercased()
            if host != "127.0.0.1" && host != "localhost" {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    // MARK: - WKDownload（附件导航兜底）

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        // 仅对显式附件走下载；audio/mpeg 等交给 <audio> 播放，
        // 否则 canShowMIMEType=false 时会误触发下载，导致网易曲目 00:00。
        if let http = navigationResponse.response as? HTTPURLResponse {
            let cd = (http.value(forHTTPHeaderField: "Content-Disposition") ?? "").lowercased()
            if cd.contains("attachment") {
                decisionHandler(.download)
                return
            }
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

        var args = [String]()
        let iniBeside = (phpPath as NSString).deletingLastPathComponent + "/php.ini"
        let iniResource = (Bundle.main.resourcePath ?? "") + "/php/php.ini"
        if FileManager.default.fileExists(atPath: iniBeside) {
            args.append(contentsOf: ["-c", iniBeside])
        } else if FileManager.default.fileExists(atPath: iniResource) {
            args.append(contentsOf: ["-c", iniResource])
        }
        args.append(contentsOf: ["-S", "127.0.0.1:\(port)", "-t", webRoot])
        process.arguments = args

        // 保证内嵌 PHP 能找到同目录 dylib（部分环境仍需要）
        var env = ProcessInfo.processInfo.environment
        let phpDir = (phpPath as NSString).deletingLastPathComponent
        let libDir = (phpDir as NSString).appendingPathComponent("../lib")
        if FileManager.default.fileExists(atPath: libDir) {
            let resolved = (libDir as NSString).standardizingPath
            if let existing = env["DYLD_FALLBACK_LIBRARY_PATH"], !existing.isEmpty {
                env["DYLD_FALLBACK_LIBRARY_PATH"] = "\(resolved):\(existing)"
            } else {
                env["DYLD_FALLBACK_LIBRARY_PATH"] = resolved
            }
        }
        if let resourcePath = Bundle.main.resourcePath {
            let ca = (resourcePath as NSString).appendingPathComponent("php/cacert.pem")
            if FileManager.default.fileExists(atPath: ca) {
                env["SSL_CERT_FILE"] = ca
                env["CURL_CA_BUNDLE"] = ca
            }
        }
        process.environment = env

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
        let bundle = Bundle.main.bundlePath as NSString
        let bundled = [
            bundle.appendingPathComponent("Contents/Resources/php/bin/php"),
            bundle.appendingPathComponent("Contents/Resources/runtime/php/bin/php"),
            bundle.appendingPathComponent("Contents/Resources/php/php")
        ]
        for path in bundled where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }

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
