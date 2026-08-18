import Cocoa
import Darwin
import MediaPlayer
import WebKit

/// 顶部标题栏命中层：拖拽移动；双击缩放（与系统 App 一致）
/// 左右留空给红绿灯 / LOGO，避免挡住交互
final class TitlebarDragOverlay: NSView {
    var bandHeight: CGFloat = 52
    var passthroughLeading: CGFloat = 88
    var passthroughTrailing: CGFloat = 420

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

final class RyanWebView: WKWebView {
    /// 桌面壳不需要系统安全区，避免舞台底边被 inset 裁出一条空带
    override var safeAreaInsets: NSEdgeInsets { NSEdgeInsetsZero }
}

/// 铺满窗口，避免系统把底部安全区留成白边
final class FullBleedView: NSView {
    override var safeAreaInsets: NSEdgeInsets { NSEdgeInsetsZero }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler, WKDownloadDelegate {
    var window: NSWindow!
    var webView: RyanWebView!
    private var titlebarDragOverlay: TitlebarDragOverlay?
    var phpProcess: Process?
    var port: Int = 18765
    private var healthTimer: Timer?
    private var activeDownloads: [ObjectIdentifier: URL] = [:]
    private var chromeObservers: [NSObjectProtocol] = []

    /// 禁用系统/VPN HTTP 代理的会话（健康检查、另存为下载）
    private lazy var directSession: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.connectionProxyDictionary = [:]
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 600
        return URLSession(configuration: config)
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 纯代码启动的 NSApp 默认无 Edit 菜单；缺少 paste: 时 Cmd+V 无法进入 WKWebView
        installMainMenu()

        let webRoot = Self.webRoot()
        guard FileManager.default.fileExists(atPath: webRoot) else {
            Self.alert("找不到站点目录：\n\(webRoot)")
            NSApp.terminate(nil)
            return
        }

        do {
            port = try Self.pickPort(startingAt: 18765)
            let node = Self.findNode()
            let serverJs = Self.serverJs()
            if let node, let serverJs {
                try startNode(nodePath: node, serverJs: serverJs, webRoot: webRoot, port: port)
            } else if serverJs == nil {
                Self.alert("安装包缺少 server.mjs。\n请重新下载完整安装包，或从源码重新打包。")
                NSApp.terminate(nil)
                return
            } else {
                Self.alert("未找到 Node.js。\n请安装 Node 22+，或使用已内嵌 Node 的安装包（推荐从 GitHub Releases 下载）。")
                NSApp.terminate(nil)
                return
            }
        } catch {
            Self.alert("启动服务失败：\(error.localizedDescription)")
            NSApp.terminate(nil)
            return
        }

        // 清掉可能残留的原生 Now Playing，统一交给网页 Media Session（避免控制中心两条）
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState = .stopped

        setupWindow()
        loadHomeWhenReady()
    }

    private func installMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        let copyLanItem = NSMenuItem(
            title: "复制手机访问地址",
            action: #selector(copyLanUrl),
            keyEquivalent: ""
        )
        copyLanItem.target = self
        appMenu.addItem(copyLanItem)
        let updateItem = NSMenuItem(
            title: "检查更新…",
            action: #selector(menuCheckUpdate),
            keyEquivalent: ""
        )
        updateItem.target = self
        appMenu.addItem(updateItem)
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(NSMenuItem(
            title: "退出 RyanMusic",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        ))
        appMenuItem.submenu = appMenu

        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(NSMenuItem(title: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(NSMenuItem(title: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        editMenuItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
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
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState = .stopped
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
        window.setFrameAutosaveName("RyanMusicMainWindow_v1828")

        let config = WKWebViewConfiguration()
        if #available(macOS 12.3, *) {
            config.preferences.isElementFullscreenEnabled = true
        }
        config.userContentController.add(self, name: "ryanSave")
        config.userContentController.add(self, name: "ryanUpdate")
        config.userContentController.add(self, name: "ryanWindowDrag")
        config.userContentController.add(self, name: "ryanWindowZoom")
        config.userContentController.add(self, name: "ryanChrome")
        // 标记桌面壳 + 空白处拖拽 / 双击缩放
        // 媒体控制走网页 Media Session，避免与原生 Now Playing 叠成两条
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
        webView = RyanWebView(frame: .zero, configuration: config)
        webView.customUserAgent = desktopUA
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false

        let container = FullBleedView(frame: rect)
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(srgbRed: 0.02, green: 0.02, blue: 0.027, alpha: 1).cgColor
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])

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

    private func applyThemeChrome(daylight: Bool) {
        guard let window else { return }
        let color = daylight
            ? NSColor(srgbRed: 0.961, green: 0.961, blue: 0.957, alpha: 1) // #f5f5f4
            : NSColor(srgbRed: 0.035, green: 0.035, blue: 0.043, alpha: 1)
        window.backgroundColor = color
        if #available(macOS 12.0, *) {
            webView?.underPageBackgroundColor = color
        }
        if let container = window.contentView {
            container.wantsLayer = true
            container.layer?.backgroundColor = color.cgColor
        }
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
        window.isOpaque = true
        // 与网页主题底色接近，避免舞台未铺满时露原生边；网页会按日夜主题再同步
        window.backgroundColor = NSColor(srgbRed: 0.035, green: 0.035, blue: 0.043, alpha: 1)
        if #available(macOS 11.0, *) {
            window.titlebarSeparatorStyle = .none
        }
        webView?.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) {
            webView?.underPageBackgroundColor = window.backgroundColor
        }
        // 关掉可能残留的内容 inset，避免底边被垫高一截
        if let scrollView = webView?.enclosingScrollView {
            scrollView.automaticallyAdjustsContentInsets = false
            scrollView.contentInsets = NSEdgeInsetsZero
            scrollView.scrollerInsets = NSEdgeInsetsZero
        }
        if let container = window.contentView {
            container.wantsLayer = true
            container.layer?.backgroundColor = window.backgroundColor?.cgColor
            container.layer?.masksToBounds = true
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
            let task = self.directSession.dataTask(with: request) { _, response, _ in
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
        if message.name == "ryanChrome" {
            let daylight = (message.body as? [String: Any])?["daylight"] as? Bool ?? false
            DispatchQueue.main.async { [weak self] in
                self?.applyThemeChrome(daylight: daylight)
            }
            return
        }

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

        if message.name == "ryanUpdate" {
            let action = (message.body as? [String: Any])?["action"] as? String ?? "check"
            if action == "install" {
                installLatest(replyToWeb: true)
            } else {
                checkLatest { info in
                    self.replyUpdate(info.json)
                }
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
        let task = directSession.downloadTask(with: url) { tempURL, response, error in
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
        args.append(contentsOf: ["-S", "0.0.0.0:\(port)", "-t", webRoot])
        process.arguments = args

        // 保证内嵌 PHP 能找到同目录 dylib（部分环境仍需要）
        var env = ProcessInfo.processInfo.environment
        // 剥离 Clash/Surge 等注入的代理环境，避免 PHP/curl 出站被 VPN 劫持
        let proxyEnvKeys = [
            "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
            "all_proxy", "ALL_PROXY", "socks_proxy", "SOCKS_PROXY",
            "socks5_proxy", "SOCKS5_PROXY", "ftp_proxy", "FTP_PROXY"
        ]
        for key in proxyEnvKeys {
            env.removeValue(forKey: key)
        }
        env["NO_PROXY"] = "*"
        env["no_proxy"] = "*"

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

    private func startNode(nodePath: String, serverJs: String, webRoot: String, port: Int) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        let cacheDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("RyanMusic/cache").path
            ?? (NSTemporaryDirectory() + "RyanMusicCache")
        try FileManager.default.createDirectory(atPath: cacheDir, withIntermediateDirectories: true)
        process.arguments = [
            serverJs,
            "--listen", "0.0.0.0",
            "--port", String(port),
            "--web-root", webRoot,
            "--cache-dir", cacheDir,
        ]
        var env = ProcessInfo.processInfo.environment
        for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"] {
            env.removeValue(forKey: key)
        }
        env["NO_PROXY"] = "*"
        env["no_proxy"] = "*"
        env["RYANMUSIC_CACHE_DIR"] = cacheDir
        process.environment = env
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
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

    @objc private func copyLanUrl() {
        guard let ip = Self.lanIPv4() else {
            Self.alert("未检测到局域网地址。请确认电脑已连 Wi‑Fi。")
            return
        }
        let url = "http://\(ip):\(port)/"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(url, forType: .string)
        Self.alert("已复制手机访问地址：\n\(url)")
    }

    static func lanIPv4() -> String? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(first) }

        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let current = ptr {
            let flags = Int32(current.pointee.ifa_flags)
            if (flags & IFF_UP) != 0,
               (flags & IFF_LOOPBACK) == 0,
               let addr = current.pointee.ifa_addr,
               addr.pointee.sa_family == sa_family_t(AF_INET) {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                let nameLen = socklen_t(addr.pointee.sa_len)
                if getnameinfo(addr, nameLen, &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                    let ip = String(cString: host)
                    if !ip.hasPrefix("127.") && !ip.hasPrefix("169.254.") {
                        return ip
                    }
                }
            }
            ptr = current.pointee.ifa_next
        }
        return nil
    }

    static func webRoot() -> String {
        let bundle = Bundle.main.bundlePath
        return (bundle as NSString).appendingPathComponent("Contents/Resources/maicong-music")
    }

    static func serverJs() -> String? {
        let bundle = Bundle.main.bundlePath as NSString
        let candidates = [
            bundle.appendingPathComponent("Contents/Resources/server.mjs"),
            bundle.appendingPathComponent("Contents/Resources/server/dist/server.mjs"),
        ]
        return candidates.first { FileManager.default.isReadableFile(atPath: $0) }
    }

    static func findNode() -> String? {
        let home = NSHomeDirectory() as NSString
        let bundle = Bundle.main.bundlePath as NSString
        let candidates = [
            bundle.appendingPathComponent("Contents/Resources/node/bin/node"),
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            home.appendingPathComponent(".local/share/fnm/aliases/default/bin/node"),
            home.appendingPathComponent(".fnm/aliases/default/bin/node"),
            home.appendingPathComponent(".nvm/current/bin/node"),
            home.appendingPathComponent(".volta/bin/node"),
        ]
        for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        process.arguments = ["node"]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()
        do {
            try process.run()
            process.waitUntilExit()
            let path = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !path.isEmpty, FileManager.default.isExecutableFile(atPath: path) {
                return path
            }
        } catch {
            return nil
        }
        return nil
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

    private struct UpdateInfo {
        var ok: Bool
        var hasUpdate: Bool
        var current: String
        var latest: String
        var notes: String
        var url: String
        var downloadURL: URL?
        var error: String

        var json: [String: Any] {
            [
                "ok": ok,
                "hasUpdate": hasUpdate,
                "current": current,
                "latest": latest,
                "notes": notes,
                "url": url,
                "error": error,
            ]
        }
    }

    private func currentVersion() -> String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
    }

    private func compareVersions(_ lhs: String, _ rhs: String) -> ComparisonResult {
        let left = lhs.split(separator: ".").compactMap { Int($0) }
        let right = rhs.split(separator: ".").compactMap { Int($0) }
        let count = max(left.count, right.count)
        for index in 0..<count {
            let a = index < left.count ? left[index] : 0
            let b = index < right.count ? right[index] : 0
            if a < b { return .orderedAscending }
            if a > b { return .orderedDescending }
        }
        return .orderedSame
    }

    private func archAssetNeedle() -> String {
        #if arch(arm64)
        return "mac-arm64"
        #else
        return "mac-x64"
        #endif
    }

    private func replyUpdate(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView.evaluateJavaScript(
                "window.__ryanUpdateResolve && window.__ryanUpdateResolve(\(json));",
                completionHandler: nil
            )
        }
    }

    @objc private func menuCheckUpdate() {
        checkLatest { info in
            DispatchQueue.main.async {
                if info.hasUpdate {
                    let alert = NSAlert()
                    alert.messageText = "发现新版本 \(info.latest)"
                    alert.informativeText = "当前版本 \(info.current)。下载 GitHub 安装包并替换本机应用？"
                    alert.addButton(withTitle: "更新")
                    alert.addButton(withTitle: "取消")
                    if alert.runModal() == .alertFirstButtonReturn {
                        self.installLatest(replyToWeb: false)
                    }
                } else if !info.error.isEmpty {
                    Self.alert(info.error)
                } else {
                    Self.alert("已是最新版本 \(info.current)")
                }
            }
        }
    }

    private func checkLatest(completion: @escaping (UpdateInfo) -> Void) {
        let current = currentVersion()
        guard let endpoint = URL(string: "https://api.github.com/repos/Ryancheese/RyanMusic/releases/latest") else {
            completion(UpdateInfo(ok: false, hasUpdate: false, current: current, latest: "", notes: "", url: "", downloadURL: nil, error: "更新地址无效"))
            return
        }
        var request = URLRequest(url: endpoint, timeoutInterval: 20)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("RyanMusic/\(current)", forHTTPHeaderField: "User-Agent")
        directSession.dataTask(with: request) { data, _, error in
            if let error {
                completion(UpdateInfo(ok: false, hasUpdate: false, current: current, latest: "", notes: "", url: "https://github.com/Ryancheese/RyanMusic/releases/latest", downloadURL: nil, error: error.localizedDescription))
                return
            }
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(UpdateInfo(ok: false, hasUpdate: false, current: current, latest: "", notes: "", url: "https://github.com/Ryancheese/RyanMusic/releases/latest", downloadURL: nil, error: "无法解析 GitHub 版本信息"))
                return
            }
            let latest = String(json["tag_name"] as? String ?? "").replacingOccurrences(of: #"^v"#, with: "", options: .regularExpression)
            let notes = String(json["body"] as? String ?? "")
            let page = String(json["html_url"] as? String ?? "https://github.com/Ryancheese/RyanMusic/releases/latest")
            let assets = json["assets"] as? [[String: Any]] ?? []
            let needle = self.archAssetNeedle()
            let asset = assets.first { asset in
                let name = (asset["name"] as? String ?? "").lowercased()
                return name.contains(needle) && name.hasSuffix(".dmg")
            }
            let download = URL(string: asset?["browser_download_url"] as? String ?? "")
            let newer = !latest.isEmpty && self.compareVersions(current, latest) == .orderedAscending
            completion(UpdateInfo(
                ok: true,
                hasUpdate: newer,
                current: current,
                latest: latest,
                notes: notes,
                url: page,
                downloadURL: download,
                error: newer && download == nil ? "Release 里没有 \(needle) 安装包" : ""
            ))
        }.resume()
    }

    private func installLatest(replyToWeb: Bool) {
        checkLatest { info in
            guard info.hasUpdate, let download = info.downloadURL else {
                let payload = info.json.merging(["error": info.error.isEmpty ? "没有可安装的更新" : info.error]) { _, new in new }
                if replyToWeb { self.replyUpdate(payload) }
                else { DispatchQueue.main.async { Self.alert(payload["error"] as? String ?? "没有可安装的更新") } }
                return
            }
            self.directSession.downloadTask(with: download) { tempURL, _, error in
                if let error {
                    let payload: [String: Any] = ["ok": false, "hasUpdate": true, "current": info.current, "latest": info.latest, "error": error.localizedDescription]
                    if replyToWeb { self.replyUpdate(payload) }
                    else { DispatchQueue.main.async { Self.alert("下载失败：\(error.localizedDescription)") } }
                    return
                }
                guard let tempURL else {
                    let payload: [String: Any] = ["ok": false, "hasUpdate": true, "error": "下载失败"]
                    if replyToWeb { self.replyUpdate(payload) }
                    return
                }
                do {
                    let local = FileManager.default.temporaryDirectory.appendingPathComponent("RyanMusic-update.dmg")
                    if FileManager.default.fileExists(atPath: local.path) {
                        try FileManager.default.removeItem(at: local)
                    }
                    try FileManager.default.moveItem(at: tempURL, to: local)
                    try self.replaceRunningApp(withDmg: local)
                    if replyToWeb {
                        self.replyUpdate(["ok": true, "hasUpdate": true, "installing": true, "latest": info.latest, "current": info.current])
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        NSApp.terminate(nil)
                    }
                } catch {
                    let payload: [String: Any] = ["ok": false, "hasUpdate": true, "error": error.localizedDescription]
                    if replyToWeb { self.replyUpdate(payload) }
                    else { DispatchQueue.main.async { Self.alert("安装失败：\(error.localizedDescription)") } }
                }
            }.resume()
        }
    }

    private func replaceRunningApp(withDmg dmgURL: URL) throws {
        let mount = try self.attachDmg(dmgURL)
        defer { _ = try? self.runTool("/usr/bin/hdiutil", ["detach", mount.path, "-force"]) }
        let kids = try FileManager.default.contentsOfDirectory(
            at: mount,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )
        guard let bundled = kids.first(where: { $0.pathExtension == "app" }) else {
            throw NSError(domain: "RyanMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: "安装包里找不到 RyanMusic.app"])
        }
        let staged = FileManager.default.temporaryDirectory.appendingPathComponent("RyanMusic-update.app")
        if FileManager.default.fileExists(atPath: staged.path) {
            try FileManager.default.removeItem(at: staged)
        }
        try FileManager.default.copyItem(at: bundled, to: staged)
        let dest = Bundle.main.bundleURL
        let script = FileManager.default.temporaryDirectory.appendingPathComponent("ryanmusic-replace.sh")
        let body = """
        #!/bin/bash
        DEST=\(shellQuote(dest.path))
        NEW=\(shellQuote(staged.path))
        while pgrep -x RyanMusic >/dev/null; do sleep 0.3; done
        rm -rf "$DEST"
        /usr/bin/ditto "$NEW" "$DEST"
        xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1 || true
        open "$DEST"
        rm -rf "$NEW"
        """
        try body.write(to: script, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: script.path)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [script.path]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
    }

    private func attachDmg(_ url: URL) throws -> URL {
        let output = try runTool("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", url.path])
        guard let line = output.split(separator: "\n").reversed().first(where: { $0.contains("/Volumes/") }),
              let range = line.range(of: "/Volumes/") else {
            throw NSError(domain: "RyanMusic", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法挂载安装包"])
        }
        let path = String(line[range.lowerBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        return URL(fileURLWithPath: path)
    }

    @discardableResult
    private func runTool(_ path: String, _ arguments: [String]) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = arguments
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        try process.run()
        process.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let text = String(data: data, encoding: .utf8) ?? ""
        if process.terminationStatus != 0 {
            throw NSError(domain: "RyanMusic", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: text.isEmpty ? "命令失败" : text])
        }
        return text
    }

    private func shellQuote(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
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
