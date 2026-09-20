import UIKit
import WebKit
import UniformTypeIdentifiers

final class TrainingViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private(set) var webView: WKWebView!
    private let store: Result<StateStore, Error>
    private var exportURL: URL?
    private var importing = false
    private var light = false
    private let assetRoot = Bundle.main.url(forResource: "assets", withExtension: nil)!
    private var pageURL: URL { assetRoot.appendingPathComponent("index.html") }

    init(store: Result<StateStore, Error> = Result { try StateStore.applicationStore() }) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(store:)") }
    override var preferredStatusBarStyle: UIStatusBarStyle { light ? .darkContent : .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        let configuration = WKWebViewConfiguration()
        // No browser database/cookies or cloud-backed web storage.
        configuration.websiteDataStore = .nonPersistent()
        let bridgeURL = Bundle.main.url(forResource: "native-bridge", withExtension: "js")!
        guard let bridge = try? String(contentsOf: bridgeURL, encoding: .utf8) else {
            showFailure("应用资源缺失，请重新安装同签名版本")
            return
        }
        configuration.userContentController.addUserScript(
            WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
        applyTheme(false)
        NotificationCenter.default.addObserver(self, selector: #selector(pauseAnimation),
                                               name: UIApplication.willResignActiveNotification, object: nil)
        // Defence in depth alongside the shared page CSP and navigation allowlist.
        let rules = """
        [{"trigger":{"url-filter":"^https?://|^wss?://|^ftp://"},"action":{"type":"block"}}]
        """
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "RijiOffline", encodedContentRuleList: rules) {
            [weak self] list, error in
            guard let self = self else { return }
            guard let list = list, error == nil else {
                self.showFailure("离线保护加载失败，请重新打开 App")
                return
            }
            configuration.userContentController.add(list)
            self.webView.loadFileURL(self.pageURL, allowingReadAccessTo: self.assetRoot)
        }
    }

    private func showFailure(_ text: String) {
        let label = UILabel()
        label.text = text
        label.numberOfLines = 0
        label.textColor = .white
        label.textAlignment = .center
        label.frame = view.bounds.insetBy(dx: 24, dy: 80)
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.backgroundColor = UIColor(red: 40/255, green: 39/255, blue: 44/255, alpha: 1)
        view.addSubview(label)
    }

    private func isLocalPage(_ url: URL?) -> Bool {
        guard let url = url, url.isFileURL else { return false }
        return url.standardizedFileURL.path == pageURL.standardizedFileURL.path
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.targetFrame?.isMainFrame == true &&
                        isLocalPage(navigationAction.request.url) ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        guard prompt == "__RIJI_NATIVE__", frame.isMainFrame, isLocalPage(frame.request.url),
              let bytes = defaultText?.data(using: .utf8),
              let request = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any],
              let method = request["method"] as? String else {
            completionHandler(nil)
            return
        }
        do {
            let value = try handle(method: method, value: request["value"])
            completionHandler(reply(["ok": true, "value": value ?? NSNull()]))
        } catch {
            completionHandler(reply(["ok": false, "error": "本地文件操作失败：\(error.localizedDescription)"]))
        }
    }

    private func reply(_ value: [String: Any]) -> String {
        String(data: try! JSONSerialization.data(withJSONObject: value), encoding: .utf8)!
    }

    private func handle(method: String, value: Any?) throws -> Any? {
        switch method {
        case "load": return try store.get().load()
        case "save":
            guard let text = value as? String else { throw StateStore.StoreError.invalidData }
            try store.get().save(text)
            return true
        case "setTheme":
            applyTheme(value as? Bool ?? false)
        case "exportBackup":
            guard let text = value as? String, text.utf8.count <= StateStore.maximumBytes else {
                throw StateStore.StoreError.invalidData
            }
            DispatchQueue.main.async { [weak self] in self?.exportBackup(text) }
        case "importBackup":
            DispatchQueue.main.async { [weak self] in self?.importBackup() }
        default: throw StateStore.StoreError.invalidData
        }
        return nil
    }

    private func applyTheme(_ isLight: Bool) {
        light = isLight
        overrideUserInterfaceStyle = isLight ? .light : .dark
        view.backgroundColor = isLight ? UIColor(red: 246/255, green: 246/255, blue: 248/255, alpha: 1)
            : UIColor(red: 40/255, green: 39/255, blue: 44/255, alpha: 1)
        webView?.backgroundColor = view.backgroundColor
        setNeedsStatusBarAppearanceUpdate()
    }

    @objc private func pauseAnimation() {
        webView?.evaluateJavaScript("window.pauseExerciseAnimation && window.pauseExerciseAnimation()", completionHandler: nil)
    }

    private func callback(_ name: String, text: String) {
        webView.callAsyncJavaScript("window[callback](text)", arguments: ["callback": name, "text": text],
                                   in: nil, in: .page, completionHandler: nil)
    }

    private func exportBackup(_ text: String) {
        guard presentedViewController == nil else { return }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.locale = Locale(identifier: "en_US_POSIX")
            let url = folder.appendingPathComponent("日跻备份-\(formatter.string(from: Date())).json")
            exportURL = url
            try Data(text.utf8).write(to: url, options: [.atomic, .completeFileProtection])
            let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            picker.delegate = self
            importing = false
            present(picker, animated: true)
        } catch {
            clearExport()
            callback("nativeMessage", text: "导出失败，请检查可用存储空间")
        }
    }

    private func importBackup() {
        guard presentedViewController == nil else { return }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json, .data], asCopy: true)
        picker.allowsMultipleSelection = false
        picker.delegate = self
        importing = true
        present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        defer { clearExport() }
        guard let url = urls.first else { return }
        if importing {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                callback("receiveImport", text: try StateStore.readText(url))
            } catch {
                callback("nativeMessage", text: "无法读取备份，请选择不超过 16 MB 的 UTF-8 JSON 文件")
            }
        } else {
            callback("nativeMessage", text: "备份已保存")
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { clearExport() }

    private func clearExport() {
        if let url = exportURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        exportURL = nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.loadFileURL(pageURL, allowingReadAccessTo: assetRoot)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        clearExport()
    }
}
