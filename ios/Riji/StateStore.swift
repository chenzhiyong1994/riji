import Foundation

/// A single atomic file, excluded from system backup. The JS data schema stays unchanged.
final class StateStore {
    static let maximumBytes = 16 * 1024 * 1024
    let directory: URL
    var stateURL: URL { directory.appendingPathComponent("training.json") }

    init(directory: URL) {
        self.directory = directory
    }

    static func applicationStore() throws -> StateStore {
        let base = try FileManager.default.url(for: .applicationSupportDirectory,
                                              in: .userDomainMask, appropriateFor: nil, create: true)
        return StateStore(directory: base.appendingPathComponent("Riji", isDirectory: true))
    }

    func load() throws -> String {
        guard FileManager.default.fileExists(atPath: stateURL.path) else { return "" }
        return try Self.readText(stateURL)
    }

    func save(_ text: String) throws {
        let bytes = Data(text.utf8)
        guard bytes.count <= Self.maximumBytes,
              (try? JSONSerialization.jsonObject(with: bytes)) is [String: Any] else {
            throw StoreError.invalidData
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var folder = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        try bytes.write(to: stateURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func readText(_ url: URL) throws -> String {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        let bytes = try file.read(upToCount: maximumBytes + 1) ?? Data()
        guard bytes.count <= maximumBytes, let text = String(data: bytes, encoding: .utf8) else {
            throw StoreError.invalidData
        }
        return text
    }

    enum StoreError: LocalizedError {
        case invalidData
        var errorDescription: String? { "数据无效或超过 16 MB，请检查备份文件" }
    }
}
