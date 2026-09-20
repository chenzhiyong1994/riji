import XCTest
import WebKit
import UIKit
@testable import Riji

@MainActor
final class RijiTests: XCTestCase {
    private var folder: URL!
    private var window: UIWindow!
    private var controller: TrainingViewController!

    override func setUp() async throws {
        folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        window = UIWindow(frame: UIScreen.main.bounds)
        try await reopen()
    }

    override func tearDown() async throws {
        window.isHidden = true
        window.rootViewController = nil
        controller = nil
        window = nil
        try? FileManager.default.removeItem(at: folder)
    }

    private func reopen() async throws {
        controller = TrainingViewController(store: .success(StateStore(directory: folder)))
        window.rootViewController = controller
        window.makeKeyAndVisible()
        for _ in 0..<100 {
            if (try? await js("typeof window.handleBack === 'function'")) as? Bool == true {
                _ = try await js("window.handleBack()")
                return
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Offline app did not load")
        throw StateStore.StoreError.invalidData
    }

    private func js(_ source: String) async throws -> Any? {
        try await withCheckedThrowingContinuation { continuation in
            controller.webView.evaluateJavaScript(source) { value, error in
                if let error = error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: value) }
            }
        }
    }

    private func click(_ selector: String) async throws {
        _ = try await js("document.querySelector('\(selector)').click(); true")
    }

    func testWorkoutSurvivesNativeReopenAndBackupRoundTrip() async throws {
        try await click("[data-action=newWorkout]")
        _ = try await js("document.querySelector('#new-title').value = 'iOS 测试训练'")
        try await click("[data-action=startWorkout]")
        try await click("[data-action=pick][data-id=benchpress]")
        try await click("[data-action=confirmPicker]")
        _ = try await js("""
        for (const [field, value] of [['weight','60'],['reps','10']]) {
          const input = document.querySelector('[data-field='+field+']');
          input.value = value; input.dispatchEvent(new Event('change', {bubbles:true}));
        }
        true
        """)
        try await click("[data-action=toggleSet]")
        try await reopen()
        let weight = try await js("document.querySelector('[data-field=weight]').value") as? String
        XCTAssertEqual(weight, "60")
        try await click("[data-action=finish]")
        try await click("[data-action=confirmFinish]")
        let total = try await js("TrainCore.workoutStats(JSON.parse(NativeStore.load()).sessions[0]).volume") as? Int
        XCTAssertEqual(total, 600)
        let backup = try await js("TrainCore.exportBackup(JSON.parse(NativeStore.load()))") as! String
        let backupURL = folder.appendingPathComponent("roundtrip.json")
        try Data(backup.utf8).write(to: backupURL)
        try await click("[data-tab=me]")
        try await click("[data-action=import]")
        try await Task.sleep(nanoseconds: 500_000_000)
        let picker = try XCTUnwrap(controller.presentedViewController as? UIDocumentPickerViewController)
        // Exercise the production file-reading delegate and native-to-JS callback.
        controller.documentPicker(picker, didPickDocumentsAt: [backupURL])
        controller.dismiss(animated: false)
        for _ in 0..<50 {
            if (try await js("!!document.querySelector('[data-action=applyImport]')")) as? Bool == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let confirm = try await js("document.querySelector('[role=dialog]').textContent.includes('导入备份')") as? Bool
        XCTAssertEqual(confirm, true)
        try await click("[data-action=applyImport]")
        try await reopen()
        let restored = try await js("JSON.parse(NativeStore.load()).sessions[0].title") as? String
        XCTAssertEqual(restored, "iOS 测试训练")
        let privateFolder = try folder.resourceValues(forKeys: [.isExcludedFromBackupKey])
        XCTAssertEqual(privateFolder.isExcludedFromBackup, true)
    }

    func testInvalidImportAndFailedSavePreserveExistingData() async throws {
        try await click("[data-tab=me]")
        try await click("[data-action=theme]")
        let before = try StateStore(directory: folder).load()
        _ = try await js("window.receiveImport('{\"format\":\"jilian-backup\",\"version\":1,\"data\":{}}'); true")
        XCTAssertEqual(try StateStore(directory: folder).load(), before)
        // A file at the directory path makes the next atomic write fail.
        try FileManager.default.removeItem(at: folder)
        try Data("unavailable".utf8).write(to: folder)
        try await click("[data-action=theme]")
        let message = try await js("document.querySelector('#toast').textContent") as? String
        XCTAssertTrue(message?.contains("本地文件操作失败") == true)
        let stillLight = try await js("document.body.classList.contains('light')") as? Bool
        XCTAssertEqual(stillLight, true)
    }

    func testOfflineMediaAndDocumentPickers() async throws {
        try await click("[data-tab=movements]")
        try await click("[data-action=detail][data-id=benchpress]")
        var loaded = false
        for _ in 0..<50 {
            loaded = (try await js("document.querySelector('.detail-image').naturalWidth > 0")) as? Bool == true
            if loaded { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(loaded, "Bundled animated WebP should decode")
        _ = try await js("window.pauseExerciseAnimation(); true")
        let source = try await js("document.querySelector('.detail-image').getAttribute('src')") as? String
        XCTAssertTrue(source?.hasSuffix("/poster.webp") == true)
        try await click("[data-action=close]")
        try await click("[data-tab=me]")
        try await click("[data-action=export]")
        try await Task.sleep(nanoseconds: 500_000_000)
        XCTAssertTrue(controller.presentedViewController is UIDocumentPickerViewController)
        controller.dismiss(animated: false)
        try await click("[data-action=import]")
        try await Task.sleep(nanoseconds: 500_000_000)
        XCTAssertTrue(controller.presentedViewController is UIDocumentPickerViewController)
        controller.dismiss(animated: false)
        let originalURL = controller.webView.url
        _ = try await js("window.location.href = 'https://example.com'; true")
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(controller.webView.url, originalURL)
    }

    func testStorageRejectsOversizeAndCorruptionWithoutOverwrite() throws {
        let store = StateStore(directory: folder)
        try store.save("{\"sessions\":[]}")
        XCTAssertThrowsError(try store.save("[]"))
        XCTAssertThrowsError(try store.save(String(repeating: "x", count: StateStore.maximumBytes + 1)))
        XCTAssertEqual(try store.load(), "{\"sessions\":[]}")
        let other = folder.appendingPathComponent("large.json")
        try Data(repeating: 65, count: StateStore.maximumBytes + 1).write(to: other)
        XCTAssertThrowsError(try StateStore.readText(other))
    }
}
