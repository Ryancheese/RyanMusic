import AppKit
import Foundation
import iTunesLibrary

/// 本机 Music.app 资料库。MusicKit 的歌单关系在未签名包上会卡住，歌单和封面改走这里。
enum AppleMusicLocalLibrary {
    private static var cached: ITLibrary?
    private static let artLock = NSLock()

    static func library() throws -> ITLibrary {
        if let cached { return cached }
        let loaded = try ITLibrary(apiVersion: "1.1")
        cached = loaded
        return loaded
    }

    static func playlists() throws -> [[String: Any]] {
        try library().allPlaylists.compactMap { playlist in
            guard include(playlist) else { return nil }
            let id = hexID(playlist.persistentID)
            let cover = playlistCover(id: id, items: playlist.items)
            return [
                "id": id,
                "name": playlist.name,
                "cover": cover,
                "trackCount": playlist.items.count,
                "kind": "library",
                "type": "apple",
            ]
        }
    }

    static func tracks(playlistId: String, name: String = "") throws -> (name: String, cover: String, tracks: [[String: Any]])? {
        guard let playlist = findPlaylist(id: playlistId, name: name) else { return nil }
        let rows = playlist.items.compactMap { trackRow($0) }
        let cover = firstTrackCover(in: rows) ?? playlistCover(id: hexID(playlist.persistentID), items: playlist.items)
        return (playlist.name, cover, rows)
    }

    static func recentTracks(limit: Int = 40) -> (name: String, cover: String, tracks: [[String: Any]])? {
        rankedTracks(limit: limit, name: "最近播放") { lhs, rhs in
            (lhs.lastPlayedDate ?? .distantPast) > (rhs.lastPlayedDate ?? .distantPast)
        }
    }

    static func mostPlayedTracks(limit: Int = 40) -> (name: String, cover: String, tracks: [[String: Any]])? {
        rankedTracks(limit: limit, name: "常听歌曲") { lhs, rhs in
            if lhs.playCount == rhs.playCount {
                return (lhs.lastPlayedDate ?? .distantPast) > (rhs.lastPlayedDate ?? .distantPast)
            }
            return lhs.playCount > rhs.playCount
        }
    }

    private static func rankedTracks(
        limit: Int,
        name: String,
        by compare: (ITLibMediaItem, ITLibMediaItem) -> Bool
    ) -> (name: String, cover: String, tracks: [[String: Any]])? {
        guard let library = try? library() else { return nil }
        let songs = library.allMediaItems.filter { item in
            (item.mediaKind == .kindSong || item.mediaKind == .kindUnknown) && !item.title.isEmpty
        }
        let picked = Array(songs.sorted(by: compare).prefix(limit))
        let rows = picked.compactMap { trackRow($0) }
        guard !rows.isEmpty else { return nil }
        let cover = firstTrackCover(in: rows) ?? playlistCover(id: name, items: picked)
        return (name, cover, rows)
    }

    private static func trackRow(_ item: ITLibMediaItem) -> [String: Any]? {
        if item.mediaKind != .kindSong && item.mediaKind != .kindUnknown { return nil }
        let id = hexID(item.persistentID)
        return [
            "type": "apple",
            "songid": id,
            "title": item.title,
            "author": item.artist?.name ?? "",
            "album": item.album.title ?? "",
            "pic": artworkURL(item.artwork, id: id),
            "url": "applemusic://\(id)",
            "link": "",
            "durationMs": item.totalTime,
            "lrc": "",
        ]
    }

    static func trackMeta(id: String) -> (title: String, artist: String, album: String, durationMs: Int, playlistName: String?)? {
        guard let item = mediaItem(id: id) else { return nil }
        return (item.title, item.artist?.name ?? "", item.album.title ?? "", item.totalTime, nil)
    }

    static func fileURL(id: String) -> URL? {
        guard let item = mediaItem(id: id), let url = item.location, url.isFileURL else { return nil }
        return FileManager.default.isReadableFile(atPath: url.path) ? url : nil
    }

    private static func mediaItem(id: String) -> ITLibMediaItem? {
        guard let library = try? library() else { return nil }
        let want = id.lowercased()
        for playlist in library.allPlaylists where include(playlist) {
            if let item = playlist.items.first(where: { hexID($0.persistentID) == want }) {
                return item
            }
        }
        return library.allMediaItems.first(where: { hexID($0.persistentID) == want })
    }

    static func writePlaylistArtwork(id: String, data: Data) -> String {
        guard !id.isEmpty, !data.isEmpty else { return "" }
        let file = artDirectory().appendingPathComponent("\(id)-cover.jpg")
        artLock.lock()
        defer { artLock.unlock() }
        let imageData = data.starts(with: [0xFF, 0xD8]) ? data : (jpegData(from: data) ?? data)
        try? imageData.write(to: file, options: .atomic)
        return FileManager.default.fileExists(atPath: file.path) ? "/apple-art/\(id)-cover.jpg" : ""
    }

    static func playlistCover(id: String, items: [ITLibMediaItem]) -> String {
        let owned = artDirectory().appendingPathComponent("\(id)-cover.jpg")
        if FileManager.default.fileExists(atPath: owned.path) {
            return "/apple-art/\(id)-cover.jpg"
        }
        if let item = items.first(where: { $0.artwork != nil }) {
            let url = artworkURL(item.artwork, id: hexID(item.persistentID))
            if !url.isEmpty { return url }
        }
        return ""
    }

    private static func firstTrackCover(in rows: [[String: Any]]) -> String? {
        for row in rows {
            if let pic = row["pic"] as? String, !pic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return pic
            }
        }
        return nil
    }

    static func artDirectory() -> URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("RyanMusic/cache/apple-art", isDirectory: true)
            ?? URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("RyanMusic-apple-art")
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    private static func include(_ playlist: ITLibPlaylist) -> Bool {
        if playlist.isMaster { return false }
        if playlist.kind == .folder || playlist.kind == .geniusMix { return false }
        switch playlist.distinguishedKind.rawValue {
        case 0, 52:
            return true
        default:
            return false
        }
    }

    private static func findPlaylist(id: String, name: String = "") -> ITLibPlaylist? {
        guard let library = try? library() else { return nil }
        let want = id.lowercased()
        if let match = library.allPlaylists.first(where: { include($0) && hexID($0.persistentID) == want }) {
            return match
        }
        let folded = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !folded.isEmpty else { return nil }
        return library.allPlaylists.first { include($0) && $0.name.lowercased() == folded }
    }

    private static func hexID(_ value: NSNumber) -> String {
        String(value.uint64Value, radix: 16)
    }

    private static func artworkURL(_ artwork: ITLibArtwork?, id: String) -> String {
        guard let artwork, !id.isEmpty else { return "" }
        let file = artDirectory().appendingPathComponent("\(id).jpg")
        artLock.lock()
        defer { artLock.unlock() }
        if !FileManager.default.fileExists(atPath: file.path) {
            guard let data = jpegData(from: artwork), !data.isEmpty else { return "" }
            try? data.write(to: file, options: .atomic)
        }
        return FileManager.default.fileExists(atPath: file.path) ? "/apple-art/\(id).jpg" : ""
    }

    private static func jpegData(from data: Data) -> Data? {
        if let image = NSImage(data: data) {
            return jpeg(from: image) ?? data
        }
        return data
    }

    private static func jpegData(from artwork: ITLibArtwork) -> Data? {
        if artwork.imageDataFormat == .JPEG, let data = artwork.imageData, !data.isEmpty {
            return data
        }
        if let data = artwork.imageData, let image = NSImage(data: data) {
            return jpeg(from: image)
        }
        if let image = artwork.image {
            return jpeg(from: image)
        }
        return artwork.imageData
    }

    private static func jpeg(from image: NSImage) -> Data? {
        guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .jpeg, properties: [.compressionFactor: 0.86])
    }
}
