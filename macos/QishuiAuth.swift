import Cocoa
import Foundation
import WebKit

/// Hidden WKWebView Passport QR: same-origin XHR on api.qishui.com so confirm
/// can drop session cookies into the system cookie store.
final class QishuiAuthBridge: NSObject, WKNavigationDelegate {
    weak var uiWebView: WKWebView?

    private var authWebView: WKWebView?
    private var authWindow: NSWindow?
    private var loadWait: CheckedContinuation<Void, Error>?
    private var ready = false
    private var activeToken = ""
    private var confirmAt: Date?
    private let deviceId: String
    private let installId: String

    override init() {
        let defaults = UserDefaults.standard
        var did = defaults.string(forKey: "qishui.deviceId") ?? ""
        var iid = defaults.string(forKey: "qishui.installId") ?? ""
        if did.count != 16 {
            did = Self.randomDigits(16)
            defaults.set(did, forKey: "qishui.deviceId")
        }
        if iid.count != 15 {
            iid = Self.randomDigits(15)
            defaults.set(iid, forKey: "qishui.installId")
        }
        deviceId = did
        installId = iid
        super.init()
    }

    func handle(_ body: Any) {
        guard let payload = body as? [String: Any] else { return }
        let requestId = payload["requestId"] as? String ?? ""
        let action = payload["action"] as? String ?? ""
        Task { @MainActor in
            do {
                let data = try await self.dispatch(action: action, payload: payload)
                self.reply(id: requestId, ok: true, data: data)
            } catch {
                self.reply(id: requestId, ok: false, data: [
                    "error": error.localizedDescription,
                ])
            }
        }
    }

    @MainActor
    private func dispatch(action: String, payload: [String: Any]) async throws -> [String: Any] {
        switch action {
        case "qrKey":
            return try await qrKey()
        case "qrCheck":
            return try await qrCheck(token: string(payload["key"]))
        case "clear", "logout":
            await reset()
            return ["ok": true]
        default:
            throw QishuiAuthError.message("未知操作")
        }
    }

    @MainActor
    private func reset() async {
        ready = false
        activeToken = ""
        confirmAt = nil
        loadWait = nil
        if let view = authWebView {
            view.stopLoading()
            view.navigationDelegate = nil
            let store = view.configuration.websiteDataStore
            await store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast)
        }
        authWebView = nil
        authWindow?.contentView = nil
        authWindow?.orderOut(nil)
        authWindow = nil
    }

    @MainActor
    private func ensureRuntime() async throws {
        if ready, authWebView != nil { return }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.nonPersistent()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 360, height: 280), configuration: config)
        view.customUserAgent = Self.sodaUA
        view.navigationDelegate = self
        authWebView = view

        let window = NSWindow(
            contentRect: NSRect(x: -2000, y: -2000, width: 360, height: 280),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.alphaValue = 0
        window.contentView = view
        window.orderBack(nil)
        authWindow = window

        try await loadPassportPage(view)
        _ = try await callJS(
            """
            await window.__ryanQishuiBoot;
            window.__ryanQishuiDevice = { deviceId: deviceId, installId: installId };
            return { ok: true, bdms: Boolean(window.bdms) };
            """,
            arguments: ["deviceId": deviceId, "installId": installId]
        )
        ready = true
    }

    @MainActor
    private func loadPassportPage(_ view: WKWebView) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.loadWait = cont
            view.loadHTMLString(Self.bootstrapHTML, baseURL: URL(string: "https://api.qishui.com/"))
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadWait?.resume()
        loadWait = nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadWait?.resume(throwing: error)
        loadWait = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadWait?.resume(throwing: error)
        loadWait = nil
    }

    @MainActor
    private func qrKey() async throws -> [String: Any] {
        try await ensureRuntime()
        let raw = try await callJS(
            """
            const res = await window.__ryanQishuiRequest('GET', window.__ryanQishuiQrUrl(), window.__ryanQishuiHeaders(), null);
            return res;
            """,
            arguments: [:]
        )
        let envelope = try Self.parseEnvelope(raw)
        let data = envelope.data
        let token = string(data["token"])
        let indexUrl = string(data["qrcode_index_url"])
        if envelope.message != "success" || int(data["error_code"]) != 0 || token.isEmpty || indexUrl.isEmpty {
            throw QishuiAuthError.message(string(data["description"], fallback: envelope.message.isEmpty ? "无法获取二维码" : envelope.message))
        }
        activeToken = token
        confirmAt = nil
        return [
            "key": token,
            "qrurl": try Self.officialScanUrl(indexUrl: indexUrl),
        ]
    }

    @MainActor
    private func qrCheck(token: String) async throws -> [String: Any] {
        let key = token.isEmpty ? activeToken : token
        if key.isEmpty { throw QishuiAuthError.message("缺少二维码 key") }
        try await ensureRuntime()
        let raw = try await callJS(
            """
            const res = await window.__ryanQishuiRequest(
              'POST',
              window.__ryanQishuiCheckUrl(),
              Object.assign(window.__ryanQishuiHeaders(), { 'Content-Type': 'application/x-www-form-urlencoded' }),
              window.__ryanQishuiCheckBody(token)
            );
            return res;
            """,
            arguments: ["token": key]
        )
        let envelope = try Self.parseEnvelope(raw)
        let data = envelope.data
        let status = string(data["status"]).lowercased()
        let errorCode = int(data["error_code"])
        let description = string(data["description"], fallback: envelope.message)
        var cookie = await collectCookies()
        if let session = data["session_cookie"] as? String {
            cookie = Self.mergeCookies(cookie, session)
        }
        if let redirect = data["redirect_url"] as? String, !redirect.isEmpty {
            _ = try? await callJS(
                """
                try { await fetch(url, { credentials: 'include', redirect: 'follow' }); } catch (e) {}
                return { ok: true };
                """,
                arguments: ["url": redirect]
            )
            cookie = await collectCookies()
            if let session = data["session_cookie"] as? String {
                cookie = Self.mergeCookies(cookie, session)
            }
        }

        let confirmedThisQr = confirmAt != nil
            || status == "confirmed"
            || status == "3"
            || data["session_cookie"] != nil
        if Self.hasLoginCookie(cookie) && confirmedThisQr {
            return ["status": 803, "message": "登录成功", "loggedIn": true, "cookie": cookie]
        }
        if errorCode == 2046 {
            throw QishuiAuthError.message("这次登录需要二次验证，请改用 Cookie")
        }
        if errorCode == 2 || status == "expired" || status == "4" {
            return ["status": 800, "message": "二维码已过期，请关闭后重开"]
        }
        let scanned = errorCode == 2156 || status == "scanned" || status == "2" || status == "confirmed" || status == "3"
        if scanned {
            if confirmAt == nil { confirmAt = Date() }
            if let start = confirmAt, Date().timeIntervalSince(start) > 24 {
                return ["status": 804, "message": "手机已确认，但汽水没有下发电脑登录态。请改用 Cookie"]
            }
            if status == "scanned" || status == "2" || errorCode == 2156 {
                return ["status": 802, "message": errorCode == 2156 ? "手机已确认，正在完成登录…" : "已扫码，请在手机上确认"]
            }
            return ["status": 802, "message": "手机已确认，正在完成登录…"]
        }
        if envelope.message != "success" && errorCode != 0 {
            NSLog("[QishuiAuth] check error=%d %@", errorCode, description)
            return ["status": 801, "message": "等待扫码…"]
        }
        return ["status": 801, "message": "等待扫码…"]
    }

    @MainActor
    private func collectCookies() async -> String {
        guard let store = authWebView?.configuration.websiteDataStore.httpCookieStore else { return "" }
        return await withCheckedContinuation { cont in
            store.getAllCookies { cookies in
                let parts = cookies.compactMap { cookie -> String? in
                    let domain = cookie.domain.lowercased()
                    guard domain.contains("qishui.com") || domain.contains("douyin.com") || domain.contains("snssdk.com") else {
                        return nil
                    }
                    return "\(cookie.name)=\(cookie.value)"
                }
                cont.resume(returning: parts.joined(separator: "; "))
            }
        }
    }

    @MainActor
    private func callJS(_ body: String, arguments: [String: Any]) async throws -> Any {
        guard let authWebView else { throw QishuiAuthError.message("登录页未就绪") }
        return try await withCheckedThrowingContinuation { cont in
            authWebView.callAsyncJavaScript(body, arguments: arguments, in: nil, in: .page) { result in
                switch result {
                case .success(let value):
                    cont.resume(returning: value)
                case .failure(let error):
                    cont.resume(throwing: error)
                }
            }
        }
    }

    private func reply(id: String, ok: Bool, data: [String: Any]) {
        var payload = data
        payload["requestId"] = id
        payload["ok"] = ok
        guard let uiWebView, JSONSerialization.isValidJSONObject(payload),
              let bytes = try? JSONSerialization.data(withJSONObject: payload) else { return }
        let script = "window.__ryanQishuiReply&&window.__ryanQishuiReply(JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(atob('\(bytes.base64EncodedString())'),function(c){return c.charCodeAt(0)}))))"
        uiWebView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func string(_ value: Any?, fallback: String = "") -> String {
        if let text = value as? String { return text }
        if let number = value as? NSNumber { return number.stringValue }
        return fallback
    }

    private func int(_ value: Any?, fallback: Int = 0) -> Int {
        if let number = value as? NSNumber { return number.intValue }
        if let text = value as? String, let parsed = Int(text) { return parsed }
        return fallback
    }

    private static func parseEnvelope(_ raw: Any) throws -> (message: String, data: [String: Any]) {
        var object: [String: Any] = [:]
        if let dict = raw as? [String: Any] {
            object = dict
        } else if let text = raw as? String, let data = text.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            object = parsed
        }
        let bodyText = object["body"] as? String ?? ""
        if !bodyText.isEmpty, let data = bodyText.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            object = parsed
        }
        let data = object["data"] as? [String: Any] ?? [:]
        return (object["message"] as? String ?? "", data)
    }

    private static func officialScanUrl(indexUrl: String) throws -> String {
        guard let source = URL(string: indexUrl),
              let components = URLComponents(url: source, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty
        else {
            throw QishuiAuthError.message("二维码地址无效")
        }
        var target = URLComponents(string: "https://bff-pc.qishui.com/light/invoke/scan_login")!
        target.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "os", value: "Windows"),
            URLQueryItem(name: "computer_name", value: Host.current().localizedName ?? "Windows-PC"),
        ]
        return (target.string ?? "").replacingOccurrences(of: "+", with: "%20")
    }

    private static func hasLoginCookie(_ cookie: String) -> Bool {
        cookie.range(of: #"(?:^|;\s*)(?:sessionid|sessionid_ss|sid_guard|sid_tt)=[^;\s]+"#, options: .regularExpression) != nil
    }

    private static func mergeCookies(_ existing: String, _ incoming: String) -> String {
        var map: [String: String] = [:]
        for part in (existing + ";" + incoming).split(separator: ";") {
            let item = part.trimmingCharacters(in: .whitespaces)
            guard let eq = item.firstIndex(of: "=") else { continue }
            let name = String(item[..<eq])
            let value = String(item[item.index(after: eq)...])
            if !name.isEmpty { map[name] = value }
        }
        return map.map { "\($0.key)=\($0.value)" }.joined(separator: "; ")
    }

    private static func randomDigits(_ length: Int) -> String {
        (0..<length).map { _ in String(Int.random(in: 0...9)) }.joined()
    }

    private static let sodaUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SodaMusic/3.2.1 Chrome/136.0.7103.59 Electron/36.4.0-rs.22.release.main.1 Safari/537.36"

    private static let bootstrapHTML = """
    <!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <script>
    window.__ryanQishuiBoot = (async function () {
      function loadScript(src) {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = src;
          s.onload = resolve;
          s.onerror = function () { resolve(); };
          document.head.appendChild(s);
        });
      }
      try {
        await loadScript('https://lf-headquarters-speed.yhgfb-cn-static.com/obj/rc-client-security/web/stable/1.0.0.41/bdms.js');
        if (window.bdms && window.bdms.init) {
          window.bdms.init({ aid: 386088, pageId: 24554, paths: ['/passport'] });
        }
      } catch (e) {}
      window.__ryanQishuiQuery = function () {
        return new URLSearchParams({
          aid: '386088',
          need_logo: 'false',
          need_short_url: 'false',
          passport_jssdk_version: '2.8.8',
          passport_jssdk_type: 'normal',
          is_from_ttaccountsdk: '1',
          language: 'zh',
          account_sdk_source: 'web',
          is_new_login: '1',
          next: 'https://api.qishui.com',
          device_platform: 'PC',
          version_code: '3.5.2',
          device_id: (window.__ryanQishuiDevice && window.__ryanQishuiDevice.deviceId) || '',
          install_id: (window.__ryanQishuiDevice && window.__ryanQishuiDevice.installId) || '',
          did: (window.__ryanQishuiDevice && window.__ryanQishuiDevice.deviceId) || '',
          iid: (window.__ryanQishuiDevice && window.__ryanQishuiDevice.installId) || ''
        }).toString();
      };
      window.__ryanQishuiQrUrl = function () {
        return 'https://api.qishui.com/passport/web/get_qrcode/?' + window.__ryanQishuiQuery();
      };
      window.__ryanQishuiCheckUrl = function () {
        return 'https://api.qishui.com/passport/web/check_qrconnect/?' + window.__ryanQishuiQuery();
      };
      window.__ryanQishuiHeaders = function () {
        var csrf = (document.cookie.match(/(?:^|; )passport_csrf_token=([^;]*)/) || [])[1] || '';
        var headers = {
          Accept: 'application/json, text/javascript',
          Referer: 'https://www.qishui.com/'
        };
        if (csrf) headers['x-tt-passport-csrf-token'] = decodeURIComponent(csrf);
        return headers;
      };
      window.__ryanQishuiCheckBody = function (token) {
        return new URLSearchParams({
          need_logo: 'false',
          need_short_url: 'false',
          is_frontier: 'true',
          token: String(token || ''),
          is_new_login: '1',
          next: 'https://api.qishui.com'
        }).toString();
      };
      window.__ryanQishuiRequest = function (method, url, headers, body) {
        return new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open(method, url, true);
          xhr.withCredentials = true;
          Object.keys(headers || {}).forEach(function (name) {
            xhr.setRequestHeader(name, String(headers[name]));
          });
          xhr.timeout = 20000;
          xhr.onload = function () {
            resolve({ status: xhr.status, body: xhr.responseText });
          };
          xhr.onerror = function () { reject(new Error('network')); };
          xhr.ontimeout = function () { reject(new Error('timeout')); };
          xhr.send(body == null ? null : body);
        });
      };
      return { ok: true, bdms: Boolean(window.bdms) };
    })();
    </script>
    </body></html>
    """
}

private enum QishuiAuthError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        }
    }
}
