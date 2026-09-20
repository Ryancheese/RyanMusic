import AVFoundation
import Foundation
import MusicKit
import WebKit

/// WKWebView ↔ MusicKit 桥：授权、目录搜索、资料库、原生播放。
final class AppleMusicBridge: NSObject {
    weak var webView: WKWebView?

    private var stateTimer: Timer?
    private var lastSongId = ""
    private var lastStatus = ""
    private var queuedSongIds: [String] = []
    private var cachedPlaylists: [String: Playlist] = [:]
    private var cachedSongs: [String: Song] = [:]
    private var localIdBySongId: [String: String] = [:]
    private var librarySongsByKey: [String: Song] = [:]
    private var librarySongsReady = false
    private var songMetas: [String: (title: String, artist: String, duration: Double)] = [:]
    private var previewURLs: [String: URL] = [:]
    private var avPlayer: AVPlayer?
    private var usingLocalPlayer = false
    private var playbackEpoch: UInt64 = 0
    private var virtualPlaylists: [String: (name: String, cover: String, tracks: [[String: Any]])] = [:]
    private var cachedCatalogPlaylists: [String: Playlist] = [:]

    func handle(_ body: Any) {
        guard let payload = body as? [String: Any] else { return }
        let requestId = payload["requestId"] as? String ?? payload["id"] as? String ?? ""
        let action = payload["action"] as? String ?? ""
        Task { @MainActor in
            do {
                let data = try await self.dispatch(action: action, payload: payload)
                self.reply(id: requestId, ok: true, data: data)
            } catch {
                self.reply(id: requestId, ok: false, data: [
                    "error": self.friendlyMusicError(error),
                ])
            }
        }
    }

    func stop() {
        stateTimer?.invalidate()
        stateTimer = nil
        avPlayer?.pause()
        avPlayer?.replaceCurrentItem(with: nil)
        avPlayer = nil
        usingLocalPlayer = false
        if #available(macOS 14.0, *) {
            ApplicationMusicPlayer.shared.stop()
        }
    }

    @MainActor
    private func dispatch(action: String, payload: [String: Any]) async throws -> [String: Any] {
        switch action {
        case "status":
            return await currentStatus()
        case "authorize":
            return try await authorize()
        case "search":
            return try await search(
                term: string(payload["term"]),
                category: string(payload["category"], fallback: "all"),
                limit: int(payload["limit"], fallback: 25)
            )
        case "play":
            rememberMetas(payload["tracks"])
            let ids = stringArray(payload["songIds"])
            let index = int(payload["index"], fallback: 0)
            try await play(songIds: ids, index: index)
            return ["ok": true]
        case "pause":
            pause()
            return ["ok": true]
        case "resume":
            try await resume()
            return ["ok": true]
        case "stop":
            stopPlayback()
            return ["ok": true]
        case "seek":
            seek(time: double(payload["time"]))
            return ["ok": true]
        case "libraryPlaylists":
            return try await libraryPlaylists()
        case "playlistTracks":
            return try await playlistTracks(
                id: string(payload["id"]),
                kind: string(payload["kind"], fallback: "library"),
                name: string(payload["name"])
            )
        case "albumTracks":
            return try await albumTracks(id: string(payload["id"]))
        case "artistSongs":
            return try await artistSongs(id: string(payload["id"]))
        case "recommendations":
            return try await recommendations()
        default:
            throw AppleMusicError.message("未知操作：\(action)")
        }
    }

    // MARK: - Auth / status

    @MainActor
    private func authorize() async throws -> [String: Any] {
        let status = await MusicAuthorization.request()
        guard status == .authorized else {
            return await currentStatus(error: authorizationHint(status))
        }
        return await currentStatus()
    }

    @MainActor
    private func currentStatus(error: String? = nil) async -> [String: Any] {
        let auth = MusicAuthorization.currentStatus
        var canPlay = false
        var canSubscribe = false
        if auth == .authorized {
            do {
                let subscription = try await MusicSubscription.current
                canPlay = subscription.canPlayCatalogContent
                canSubscribe = subscription.canBecomeSubscriber
            } catch {
                canPlay = false
            }
        }
        var payload: [String: Any] = [
            "available": true,
            "authorized": auth == .authorized,
            "authStatus": authLabel(auth),
            "canPlayCatalog": canPlay,
            "canBecomeSubscriber": canSubscribe,
            "nickname": "Apple Music",
        ]
        if let error, !error.isEmpty {
            payload["error"] = error
        }
        return payload
    }

    // MARK: - Search

    @MainActor
    private func search(term: String, category: String, limit: Int) async throws -> [String: Any] {
        let query = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            throw AppleMusicError.message("请输入搜索词")
        }

        async let itunesTask = itunesSearch(term: query, category: category, limit: limit)
        var catalog: [String: Any] = [:]
        if MusicAuthorization.currentStatus == .authorized {
            catalog = await withTimeout(seconds: 10) {
                try await self.catalogSearch(term: query, category: category, limit: limit)
            } ?? [:]
        }
        return mergeSearch(catalog, try await itunesTask)
    }

    @available(macOS 12.0, *)
    @MainActor
    private func catalogSearch(term: String, category: String, limit: Int) async throws -> [String: Any] {
        let types: [any MusicCatalogSearchable.Type]
        switch category {
        case "song":
            types = [Song.self]
        case "album":
            types = [Album.self]
        case "playlist":
            types = [Playlist.self]
        case "artist":
            types = [Artist.self]
        default:
            types = [Song.self, Playlist.self, Album.self, Artist.self]
        }
        var request = MusicCatalogSearchRequest(term: term, types: types)
        request.limit = max(1, min(limit, 25))
        let response = try await request.response()
        return [
            "songs": response.songs.map { songPayload($0) },
            "playlists": response.playlists.map { playlistPayload($0, kind: "catalog") },
            "albums": response.albums.map { albumPayload($0) },
            "artists": response.artists.map { artistPayload($0) },
            "source": "musickit",
        ]
    }

    @MainActor
    private func itunesSearch(term: String, category: String, limit: Int) async throws -> [String: Any] {
        var songs: [[String: Any]] = []
        var albums: [[String: Any]] = []
        var artists: [[String: Any]] = []
        for country in itunesCountries() {
            if (category == "all" || category == "song") && songs.count < limit {
                let extra = (try await itunesLookup(term: term, entity: "song", country: country, limit: limit))
                    .compactMap { itunesSong($0) }
                songs = mergeRows(songs, extra, key: "songid", limit: limit)
            }
            if (category == "all" || category == "album") && albums.count < min(limit, 15) {
                let extra = (try await itunesLookup(term: term, entity: "album", country: country, limit: min(limit, 15)))
                    .compactMap { itunesAlbum($0) }
                albums = mergeRows(albums, extra, key: "id", limit: min(limit, 15))
            }
            if (category == "all" || category == "artist") && artists.count < min(limit, 10) {
                let extra = (try await itunesLookup(term: term, entity: "musicArtist", country: country, limit: min(limit, 10)))
                    .compactMap { itunesArtist($0) }
                artists = mergeRows(artists, extra, key: "id", limit: min(limit, 10))
            }
            if category == "song" && songs.count >= limit { break }
            if category == "album" && albums.count >= min(limit, 15) { break }
            if category == "artist" && artists.count >= min(limit, 10) { break }
            if category == "all" && songs.count >= 8 { break }
        }
        return [
            "songs": songs,
            "playlists": [],
            "albums": albums,
            "artists": artists,
            "source": "itunes",
        ]
    }

    private func mergeSearch(_ catalog: [String: Any], _ itunes: [String: Any]) -> [String: Any] {
        let catalogSongs = catalog["songs"] as? [[String: Any]] ?? []
        let catalogPlaylists = catalog["playlists"] as? [[String: Any]] ?? []
        let catalogAlbums = catalog["albums"] as? [[String: Any]] ?? []
        let catalogArtists = catalog["artists"] as? [[String: Any]] ?? []
        let itunesSongs = itunes["songs"] as? [[String: Any]] ?? []
        let itunesAlbums = itunes["albums"] as? [[String: Any]] ?? []
        let itunesArtists = itunes["artists"] as? [[String: Any]] ?? []
        return [
            "songs": mergeRows(catalogSongs, itunesSongs, key: "songid", limit: 25),
            "playlists": catalogPlaylists,
            "albums": mergeRows(catalogAlbums, itunesAlbums, key: "id", limit: 15),
            "artists": mergeRows(catalogArtists, itunesArtists, key: "id", limit: 10),
            "source": catalogSongs.isEmpty ? "itunes" : (catalog["source"] as? String ?? "musickit"),
        ]
    }

    private func mergeRows(
        _ primary: [[String: Any]],
        _ extra: [[String: Any]],
        key: String,
        limit: Int
    ) -> [[String: Any]] {
        var seen = Set<String>()
        var rows: [[String: Any]] = []
        for item in primary + extra {
            let id = string(item[key])
            guard !id.isEmpty, seen.insert(id).inserted else { continue }
            rows.append(item)
            if rows.count >= limit { break }
        }
        return rows
    }

    private func itunesLookup(term: String, entity: String, country: String, limit: Int) async throws -> [[String: Any]] {
        var comps = URLComponents(string: "https://itunes.apple.com/search")!
        comps.queryItems = [
            URLQueryItem(name: "term", value: term),
            URLQueryItem(name: "media", value: "music"),
            URLQueryItem(name: "entity", value: entity),
            URLQueryItem(name: "limit", value: String(max(1, min(limit, 25)))),
            URLQueryItem(name: "country", value: country),
        ]
        guard let url = comps.url else { return [] }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.setValue("RyanMusic/2.0", forHTTPHeaderField: "User-Agent")
        let (data, _) = try await URLSession.shared.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return json?["results"] as? [[String: Any]] ?? []
    }

    private func itunesLookupById(id: String, entity: String, country: String, limit: Int) async throws -> [[String: Any]] {
        var comps = URLComponents(string: "https://itunes.apple.com/lookup")!
        comps.queryItems = [
            URLQueryItem(name: "id", value: id),
            URLQueryItem(name: "entity", value: entity),
            URLQueryItem(name: "limit", value: String(max(1, min(limit, 25)))),
            URLQueryItem(name: "country", value: country),
        ]
        guard let url = comps.url else { return [] }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.setValue("RyanMusic/2.0", forHTTPHeaderField: "User-Agent")
        let (data, _) = try await URLSession.shared.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return json?["results"] as? [[String: Any]] ?? []
    }

    private func itunesSongsById(_ id: String, entity: String) async -> [[String: Any]] {
        for country in itunesCountries() {
            let rows = (try? await itunesLookupById(id: id, entity: entity, country: country, limit: 25)) ?? []
            let songs = rows.compactMap { itunesSong($0) }
            if !songs.isEmpty { return songs }
        }
        return []
    }

    private func itunesCountries() -> [String] {
        var seen = Set<String>()
        return [storefrontCountry(), "hk", "tw", "us", "jp"].filter { seen.insert($0).inserted }
    }

    // MARK: - Library

    @MainActor
    private func libraryPlaylists() async throws -> [String: Any] {
        try requireAuthorized()
        if #available(macOS 14.0, *) {
            if let playlists: [Playlist] = await withTimeout(seconds: 10, { () -> [Playlist] in
                var request = MusicLibraryRequest<Playlist>()
                request.sort(by: \.name, ascending: true)
                request.limit = 100
                return Array(try await request.response().items)
            }), !playlists.isEmpty {
                for playlist in playlists {
                    cachedPlaylists[playlist.id.rawValue] = playlist
                }
                var rows = playlists.map { playlistPayload($0, kind: "library") }
                await materializeCovers(&rows)
                return ["playlists": rows]
            }
        }
        if var playlists = try? AppleMusicLocalLibrary.playlists(), !playlists.isEmpty {
            if #available(macOS 14.0, *) {
                await applyPlaylistArtwork(&playlists)
            }
            return ["playlists": playlists]
        }
        throw AppleMusicError.message("读取资料库歌单需要 macOS 14 或更新版本")
    }

    @available(macOS 14.0, *)
    @MainActor
    private func applyPlaylistArtwork(_ playlists: inout [[String: Any]]) async {
        let items: [Playlist] = await withTimeout(seconds: 6, { () -> [Playlist] in
            var request = MusicLibraryRequest<Playlist>()
            request.limit = 100
            return Array(try await request.response().items)
        }) ?? []
        guard !items.isEmpty else { return }
        var byName: [String: Playlist] = [:]
        for item in items {
            byName[item.name.lowercased()] = item
        }
        await withTaskGroup(of: (Int, String).self) { group in
            for (index, row) in playlists.enumerated() {
                guard let id = row["id"] as? String, let name = row["name"] as? String else { continue }
                let owned = AppleMusicLocalLibrary.artDirectory().appendingPathComponent("\(id)-cover.jpg")
                if FileManager.default.fileExists(atPath: owned.path) {
                    playlists[index]["cover"] = "/apple-art/\(id)-cover.jpg"
                    continue
                }
                guard let playlist = byName[name.lowercased()],
                      let artwork = playlist.artwork,
                      let url = artwork.url(width: 640, height: 640) else { continue }
                group.addTask {
                    do {
                        let (data, _) = try await URLSession.shared.data(from: url)
                        return (index, AppleMusicLocalLibrary.writePlaylistArtwork(id: id, data: data))
                    } catch {
                        return (index, "")
                    }
                }
            }
            for await (index, cover) in group where !cover.isEmpty {
                playlists[index]["cover"] = cover
            }
        }
    }

    @MainActor
    private func playlistTracks(id: String, kind: String, name: String = "") async throws -> [String: Any] {
        try requireAuthorized()
        guard !id.isEmpty else { throw AppleMusicError.message("缺少歌单 ID") }
        if let virtual = virtualPlaylists[id], !virtual.tracks.isEmpty {
            return [
                "id": id,
                "name": name.isEmpty ? virtual.name : name,
                "cover": virtual.cover,
                "tracks": virtual.tracks,
            ]
        }
        if kind != "catalog", let local = try? AppleMusicLocalLibrary.tracks(playlistId: id, name: name), !local.tracks.isEmpty {
            if #available(macOS 14.0, *) {
                Task { await self.prefetchLibrarySongs(local.tracks) }
            }
            return [
                "id": id,
                "name": local.name,
                "cover": local.cover,
                "tracks": local.tracks,
            ]
        }
        if kind != "catalog", #available(macOS 14.0, *),
           let payload = await musicKitLibraryTracks(id: id, name: name) {
            return payload
        }
        if kind == "catalog" {
            if let payload = await catalogPlaylistTracks(id: id, name: name) {
                return payload
            }
            throw AppleMusicError.message("这个 Apple Music 目录歌单暂时打不开，请改用资料库或最近播放。")
        }
        throw AppleMusicError.message("找不到这个资料库歌单")
    }

    @available(macOS 14.0, *)
    @MainActor
    private func musicKitLibraryTracks(id: String, name: String) async -> [String: Any]? {
        if cachedPlaylists[id] == nil {
            let items: [Playlist] = await withTimeout(seconds: 8, { () -> [Playlist] in
                var request = MusicLibraryRequest<Playlist>()
                request.limit = 100
                return Array(try await request.response().items)
            }) ?? []
            for item in items {
                cachedPlaylists[item.id.rawValue] = item
            }
        }
        let folded = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let playlist = cachedPlaylists[id]
            ?? cachedPlaylists.values.first { !$0.name.isEmpty && $0.name.lowercased() == folded }
        guard let playlist else { return nil }
        guard let detailed = await withTimeout(seconds: 8, {
            try await playlist.with([.tracks])
        }) else { return nil }
        var tracks = (try? await collectTracks(detailed.tracks)) ?? []
        guard !tracks.isEmpty else { return nil }
        await materializeCovers(&tracks, idKey: "songid", coverKey: "pic")
        var cover = artworkURL(detailed.artwork, fallback: tracks.first?["pic"] as? String)
        if cover.hasPrefix("musicKit") {
            var rows: [[String: Any]] = [["id": detailed.id.rawValue, "cover": cover]]
            await materializeCovers(&rows)
            cover = string(rows.first?["cover"], fallback: cover)
        }
        return [
            "id": detailed.id.rawValue,
            "name": detailed.name,
            "cover": cover,
            "tracks": tracks,
        ]
    }

    @MainActor
    private func materializeCovers(_ rows: inout [[String: Any]], idKey: String = "id", coverKey: String = "cover") async {
        await withTaskGroup(of: (Int, String).self) { group in
            for (index, row) in rows.enumerated() {
                let id = string(row[idKey], fallback: string(row["songid"]))
                let cover = string(row[coverKey])
                guard !id.isEmpty else { continue }
                if cover.hasPrefix("http://") || cover.hasPrefix("https://") || cover.hasPrefix("/apple-art/") {
                    continue
                }
                guard cover.hasPrefix("musicKit") || cover.isEmpty else { continue }
                let owned = AppleMusicLocalLibrary.artDirectory().appendingPathComponent("\(id)-cover.jpg")
                if FileManager.default.fileExists(atPath: owned.path) {
                    rows[index][coverKey] = "/apple-art/\(id)-cover.jpg"
                    continue
                }
                guard let remote = URL(string: cover), cover.hasPrefix("musicKit") else { continue }
                group.addTask {
                    do {
                        let (data, _) = try await URLSession.shared.data(from: remote)
                        return (index, AppleMusicLocalLibrary.writePlaylistArtwork(id: id, data: data))
                    } catch {
                        return (index, "")
                    }
                }
            }
            for await (index, cover) in group where !cover.isEmpty {
                rows[index][coverKey] = cover
            }
        }
    }

    @MainActor
    private func collectTracks(_ firstBatch: MusicItemCollection<Track>?) async throws -> [[String: Any]] {
        var items: [Track] = []
        var batch = firstBatch
        while let current = batch {
            items.append(contentsOf: current)
            guard current.hasNextBatch else { break }
            do {
                batch = try await current.nextBatch(limit: 300)
            } catch {
                NSLog("RyanMusic nextBatch failed: \(error)")
                break
            }
        }
        return items.map { trackPayload($0) }
    }

    @MainActor
    private func albumTracks(id: String) async throws -> [String: Any] {
        guard !id.isEmpty else { throw AppleMusicError.message("缺少专辑 ID") }
        do {
            let request = MusicCatalogResourceRequest<Album>(matching: \.id, equalTo: MusicItemID(id))
            if let album = try await request.response().items.first {
                let detailed = try await album.with([.tracks])
                let tracks = songsFromTracks(detailed.tracks)
                if !tracks.isEmpty {
                    return [
                        "id": id,
                        "name": detailed.title,
                        "cover": artworkURL(detailed.artwork, fallback: tracks.first?["pic"] as? String),
                        "tracks": tracks,
                    ]
                }
            }
        } catch {
            // 目录拿不到时走 iTunes lookup
        }
        let tracks = await itunesSongsById(id, entity: "song")
        guard !tracks.isEmpty else { throw AppleMusicError.message("找不到这张专辑") }
        return [
            "id": id,
            "name": string(tracks.first?["album"], fallback: "专辑"),
            "cover": string(tracks.first?["pic"]),
            "tracks": tracks,
        ]
    }

    @MainActor
    private func artistSongs(id: String) async throws -> [String: Any] {
        guard !id.isEmpty else { throw AppleMusicError.message("缺少艺人 ID") }
        do {
            let request = MusicCatalogResourceRequest<Artist>(matching: \.id, equalTo: MusicItemID(id))
            if let artist = try await request.response().items.first {
                let detailed = try await artist.with([.topSongs])
                let songs = detailed.topSongs?.prefix(25).map { songPayload($0) } ?? []
                if !songs.isEmpty {
                    return [
                        "id": id,
                        "name": detailed.name,
                        "cover": artworkURL(detailed.artwork, fallback: songs.first?["pic"] as? String),
                        "tracks": Array(songs),
                    ]
                }
            }
        } catch {
            // 目录拿不到时走 iTunes lookup
        }
        let tracks = await itunesSongsById(id, entity: "song")
        guard !tracks.isEmpty else { throw AppleMusicError.message("找不到这位艺人") }
        return [
            "id": id,
            "name": string(tracks.first?["author"], fallback: "艺人"),
            "cover": string(tracks.first?["pic"]),
            "tracks": tracks,
        ]
    }

    @MainActor
    private func recommendations() async throws -> [String: Any] {
        try requireAuthorized()
        var items: [[String: Any]] = []

        if let recent = AppleMusicLocalLibrary.recentTracks() {
            rememberVirtual("apple-recent", recent)
            items.append(recommendCard(
                id: "apple-recent",
                name: recent.name,
                cover: firstTrackCover(recent.tracks) ?? recent.cover,
                count: recent.tracks.count,
                kind: "library",
                description: "来自你的资料库",
                covers: trackCoverList(recent.tracks),
                coverItems: trackCoverItems(recent.tracks)
            ))
        }
        if let frequent = AppleMusicLocalLibrary.mostPlayedTracks() {
            rememberVirtual("apple-frequent", frequent)
            items.append(recommendCard(
                id: "apple-frequent",
                name: frequent.name,
                cover: firstTrackCover(frequent.tracks) ?? frequent.cover,
                count: frequent.tracks.count,
                kind: "library",
                description: "播放次数最多的歌曲",
                covers: trackCoverList(frequent.tracks),
                coverItems: trackCoverItems(frequent.tracks)
            ))
        }

        if #available(macOS 13.0, *) {
            if let personal = await withTimeout(seconds: 4, { () -> [[String: Any]] in
                try await self.musicKitRecommendations()
            }), !personal.isEmpty {
                items.append(contentsOf: personal)
            }
        }

        for country in itunesCountries() {
            let label = chartLabel(country)
            let songs = (try? await rssChart(country: country, entity: "songs", limit: 25)) ?? []
            let tracks = songs.compactMap { rssSong($0) }
            if !tracks.isEmpty {
                let cover = string(tracks.first?["pic"])
                rememberVirtual("apple-chart-\(country)", (label + "热门歌曲", cover, tracks))
                items.append(recommendCard(
                    id: "apple-chart-\(country)",
                    name: label + "热门歌曲",
                    cover: cover,
                    count: tracks.count,
                    kind: "catalog",
                    description: "Apple Music 今日榜",
                    covers: trackCoverList(tracks),
                    coverItems: trackCoverItems(tracks)
                ))
            }
            let albums = (try? await rssChart(country: country, entity: "albums", limit: 8)) ?? []
            for album in albums.prefix(4) {
                let id = string(album["id"])
                let name = string(album["name"])
                guard !id.isEmpty, !name.isEmpty else { continue }
                items.append(recommendCard(
                    id: id,
                    name: name,
                    cover: itunesArtwork(album["artworkUrl100"] as? String),
                    count: 0,
                    kind: "album",
                    description: string(album["artistName"], fallback: label + "热门专辑")
                ))
            }
            if items.count >= 18 { break }
        }

        return ["items": uniqueRecommend(items)]
    }

    @available(macOS 13.0, *)
    @MainActor
    private func musicKitRecommendations() async throws -> [[String: Any]] {
        var items: [[String: Any]] = []
        let response = try await MusicPersonalRecommendationsRequest().response()
        for recommendation in response.recommendations.prefix(8) {
            for playlist in recommendation.playlists.prefix(2) {
                cachedCatalogPlaylists[playlist.id.rawValue] = playlist
                cachedPlaylists[playlist.id.rawValue] = playlist
                var row = playlistPayload(playlist, kind: "catalog")
                row["recommendKind"] = "playlist"
                row["description"] = recommendation.title ?? playlist.name
                if let virtual = virtualPlaylists[playlist.id.rawValue] {
                    row["cover"] = virtual.cover
                    row["covers"] = trackCoverList(virtual.tracks)
                    row["coverItems"] = trackCoverItems(virtual.tracks)
                    row["trackCount"] = virtual.tracks.count
                }
                items.append(row)
                Task { await self.prefetchCatalogPlaylist(playlist) }
            }
            for album in recommendation.albums.prefix(2) {
                items.append(recommendCard(
                    id: album.id.rawValue,
                    name: album.title,
                    cover: artworkURL(album.artwork),
                    count: album.trackCount,
                    kind: "album",
                    description: recommendation.title ?? album.artistName
                ))
            }
        }
        return items
    }

    private func rememberVirtual(_ id: String, _ value: (name: String, cover: String, tracks: [[String: Any]])) {
        virtualPlaylists[id] = value
        rememberMetas(value.tracks)
    }

    private func firstTrackCover(_ tracks: [[String: Any]]) -> String? {
        trackCoverList(tracks, limit: 1).first
    }

    private func trackCoverList(_ tracks: [[String: Any]], limit: Int = 12) -> [String] {
        var seen = Set<String>()
        var covers: [String] = []
        for row in tracks {
            let pic = string(row["pic"])
            guard !pic.isEmpty, seen.insert(pic).inserted else { continue }
            covers.append(pic)
            if covers.count >= limit { break }
        }
        return covers
    }

    private func trackCoverItems(_ tracks: [[String: Any]], limit: Int = 12) -> [[String: Any]] {
        var seen = Set<String>()
        var items: [[String: Any]] = []
        for row in tracks {
            let pic = string(row["pic"])
            guard !pic.isEmpty, seen.insert(pic).inserted else { continue }
            items.append([
                "url": pic,
                "title": string(row["title"], fallback: string(row["album"])),
            ])
            if items.count >= limit { break }
        }
        return items
    }

    private func prefetchCatalogPlaylist(_ playlist: Playlist) async {
        let id = playlist.id.rawValue
        if let existing = virtualPlaylists[id], !existing.tracks.isEmpty { return }
        if let payload = await catalogTracksFromPlaylist(playlist, name: playlist.name) {
            rememberVirtual(id, (
                playlist.name,
                string(payload["cover"], fallback: artworkURL(playlist.artwork)),
                payload["tracks"] as? [[String: Any]] ?? []
            ))
        }
    }

    private func catalogPlaylistTracks(id: String, name: String) async -> [String: Any]? {
        if let cached = cachedCatalogPlaylists[id] ?? cachedPlaylists[id],
           let payload = await catalogTracksFromPlaylist(cached, name: name.isEmpty ? cached.name : name) {
            return payload
        }

        do {
            let request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(id))
            if let playlist = try await request.response().items.first {
                cachedCatalogPlaylists[id] = playlist
                cachedPlaylists[id] = playlist
                if let payload = await catalogTracksFromPlaylist(playlist, name: name.isEmpty ? playlist.name : name) {
                    return payload
                }
            }
        } catch {
            NSLog("RyanMusic catalog playlist request failed: \(error)")
        }

        return await catalogTracksFromItunes(id: id, name: name)
    }

    private func catalogTracksFromPlaylist(_ playlist: Playlist, name: String) async -> [String: Any]? {
        do {
            let detailed = try await playlist.with([.tracks])
            let tracks = (try? await collectTracks(detailed.tracks)) ?? []
            if !tracks.isEmpty {
                let cover = artworkURL(detailed.artwork, fallback: tracks.first?["pic"] as? String)
                let payload: [String: Any] = [
                    "id": playlist.id.rawValue,
                    "name": detailed.name,
                    "cover": cover,
                    "tracks": tracks,
                ]
                rememberVirtual(playlist.id.rawValue, (detailed.name, cover, tracks))
                return payload
            }
        } catch {
            NSLog("RyanMusic catalog playlist tracks failed: \(error)")
        }
        return await catalogTracksFromItunes(id: playlist.id.rawValue, name: name.isEmpty ? playlist.name : name)
    }

    private func catalogSearchTerms(_ name: String) -> [String] {
        let raw = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return [] }
        var terms = [raw]
        let aliases: [String: String] = [
            "cando-popped": "cantonese pop",
            "mando-popped": "mandarin pop",
            "k-popped": "k-pop",
            "western-popped": "pop hits",
            "jazzed": "jazz",
            "rocked": "rock",
            "classical": "classical",
        ]
        if let alias = aliases[raw.lowercased()] {
            terms.append(alias)
        }
        let stripped = raw
            .replacingOccurrences(of: "-POPPED", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "POPPED", with: " pop", options: .caseInsensitive)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !stripped.isEmpty, stripped.caseInsensitiveCompare(raw) != .orderedSame {
            terms.append(stripped)
        }
        var seen = Set<String>()
        return terms.filter { seen.insert($0.lowercased()).inserted }
    }

    private func catalogTracksFromItunes(id: String, name: String) async -> [String: Any]? {
        for term in catalogSearchTerms(name) {
            let found = (try? await itunesSearch(term: term, category: "song", limit: 25)) ?? [:]
            var songs = found["songs"] as? [[String: Any]] ?? []
            if songs.isEmpty, let catalog = try? await catalogSearch(term: term, category: "song", limit: 25) {
                songs = catalog["songs"] as? [[String: Any]] ?? []
            }
            guard !songs.isEmpty else { continue }
            let cover = songs.first?["pic"] as? String ?? ""
            rememberVirtual(id, (name.isEmpty ? term : name, cover, songs))
            return [
                "id": id,
                "name": name.isEmpty ? term : name,
                "cover": cover,
                "tracks": songs,
            ]
        }
        return nil
    }

    private func recommendCard(
        id: String,
        name: String,
        cover: String,
        count: Int,
        kind: String,
        description: String,
        covers: [String] = [],
        coverItems: [[String: Any]] = []
    ) -> [String: Any] {
        var row: [String: Any] = [
            "id": id,
            "name": name,
            "cover": cover,
            "trackCount": count,
            "kind": kind,
            "recommendKind": "playlist",
            "description": description,
            "type": "apple",
        ]
        if !covers.isEmpty {
            row["covers"] = covers
        }
        if !coverItems.isEmpty {
            row["coverItems"] = coverItems
        }
        return row
    }

    private func uniqueRecommend(_ items: [[String: Any]]) -> [[String: Any]] {
        var seen = Set<String>()
        return items.filter { row in
            let id = string(row["id"])
            return !id.isEmpty && seen.insert(id).inserted
        }
    }

    private func chartLabel(_ country: String) -> String {
        switch country {
        case "cn": return "内地"
        case "hk": return "香港"
        case "tw": return "台湾"
        case "jp": return "日本"
        default: return "全球"
        }
    }

    private func rssChart(country: String, entity: String, limit: Int) async throws -> [[String: Any]] {
        let url = URL(string: "https://rss.marketingtools.apple.com/api/v2/\(country)/music/most-played/\(limit)/\(entity).json")
        guard let url else { return [] }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.setValue("RyanMusic/2.0", forHTTPHeaderField: "User-Agent")
        let (data, _) = try await URLSession.shared.data(for: request)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let feed = json?["feed"] as? [String: Any]
        return feed?["results"] as? [[String: Any]] ?? []
    }

    private func rssSong(_ row: [String: Any]) -> [String: Any]? {
        let id = string(row["id"])
        let title = string(row["name"])
        guard !id.isEmpty, !title.isEmpty else { return nil }
        return [
            "type": "apple",
            "songid": id,
            "title": title,
            "author": string(row["artistName"]),
            "album": "",
            "pic": itunesArtwork(row["artworkUrl100"] as? String),
            "url": appleURL(id),
            "link": string(row["url"]),
            "durationMs": 0,
            "lrc": "",
        ]
    }

    // MARK: - Playback

    @MainActor
    private func play(songIds: [String], index: Int) async throws {
        let epoch = bumpPlaybackEpoch()
        let ids = songIds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !ids.isEmpty else { throw AppleMusicError.message("没有可播放的歌曲") }
        queuedSongIds = ids
        let start = max(0, min(index, ids.count - 1))
        lastSongId = ids[start]
        lastStatus = "loading"
        haltCurrentAudio()
        emitState()
        guard #available(macOS 14.0, *) else {
            throw AppleMusicError.message("在 App 内播放 Apple Music 需要 macOS 14 或更新版本")
        }
        try await playWithMusicKit(ids: ids, start: start, epoch: epoch)
        guard isCurrentEpoch(epoch) else { return }
        startStateTimer()
    }

    @available(macOS 14.0, *)
    @MainActor
    private func playWithMusicKit(ids: [String], start: Int, epoch: UInt64) async throws {
        let startId = ids[start]
        var startSong = cachedSongs[startId]
        if startSong?.playParameters == nil {
            startSong = await resolvePlayableSong(id: startId)
        }
        guard isCurrentEpoch(epoch) else { return }
        NSLog("RyanMusic play start=\(startId) ready=\(startSong?.playParameters != nil)")
        if let song = startSong, song.playParameters != nil {
            try await startPlayback(items: [song], startingAt: song, epoch: epoch)
            guard isCurrentEpoch(epoch) else {
                haltCurrentAudio()
                return
            }
            lastStatus = "playing"
            emitPlaying(duration: song.duration ?? songMeta(for: startId).duration)
            Task { @MainActor in
                await self.prefetchNearby(ids: ids, start: start)
            }
            return
        }
        if playLocalFile(id: startId) {
            guard isCurrentEpoch(epoch) else {
                haltCurrentAudio()
                return
            }
            lastStatus = "playing"
            emitPlaying(duration: songMeta(for: startId).duration)
            return
        }
        throw AppleMusicError.message("这首歌现在不能在 App 内播放。请确认已授权 Apple Music，并且本机已登录订阅。")
    }

    @available(macOS 14.0, *)
    @MainActor
    private func startPlayback<Item: PlayableMusicItem>(items: [Item], startingAt start: Item, epoch: UInt64) async throws {
        guard isCurrentEpoch(epoch) else { return }
        let player = ApplicationMusicPlayer.shared
        player.state.repeatMode = MusicPlayer.RepeatMode.none
        player.state.shuffleMode = .off
        player.queue = ApplicationMusicPlayer.Queue(for: items, startingAt: start)
        await waitForQueue()
        guard isCurrentEpoch(epoch) else {
            haltCurrentAudio()
            return
        }
        if await attemptPlay(player, epoch: epoch) { return }
        guard isCurrentEpoch(epoch) else { return }
        throw AppleMusicError.message("播放超时，请再试一次")
    }

    @available(macOS 14.0, *)
    @MainActor
    private func attemptPlay(_ player: MusicKit.MusicPlayer, epoch: UInt64) async -> Bool {
        guard isCurrentEpoch(epoch) else { return false }
        do {
            try await player.play()
        } catch {
            NSLog("RyanMusic play() threw: \(error)")
            if !isCurrentEpoch(epoch) { return false }
            if player.state.playbackStatus == .playing { return true }
            if isPrepareFailure(error) {
                try? await Task.sleep(nanoseconds: 250_000_000)
                guard isCurrentEpoch(epoch) else { return false }
                do {
                    try await player.play()
                } catch {
                    NSLog("RyanMusic play() retry threw: \(error)")
                }
            } else {
                return player.state.playbackStatus == .playing
            }
        }
        for _ in 0..<20 {
            if !isCurrentEpoch(epoch) { return false }
            if player.state.playbackStatus == .playing { return true }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        return isCurrentEpoch(epoch) && player.state.playbackStatus == .playing
    }

    @available(macOS 14.0, *)
    @MainActor
    private func waitForQueue() async {
        let player = ApplicationMusicPlayer.shared
        for _ in 0..<20 {
            if player.queue.currentEntry != nil { return }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
    }

    private func isPrepareFailure(_ error: Error) -> Bool {
        let nsError = error as NSError
        return nsError.domain == "MPMusicPlayerControllerErrorDomain" && nsError.code == 6
    }

    @MainActor
    private func playLocalFile(id: String) -> Bool {
        guard let url = AppleMusicLocalLibrary.fileURL(id: id) else { return false }
        return startLocalPlayer(url: url)
    }

    @MainActor
    private func startLocalPlayer(url: URL) -> Bool {
        if #available(macOS 14.0, *) {
            ApplicationMusicPlayer.shared.stop()
        }
        let player = AVPlayer(url: url)
        avPlayer = player
        usingLocalPlayer = true
        player.play()
        return true
    }

    @MainActor
    private func stopLocalPlayer() {
        avPlayer?.pause()
        avPlayer?.replaceCurrentItem(with: nil)
        avPlayer = nil
        usingLocalPlayer = false
    }

    @MainActor
    private func pause() {
        _ = bumpPlaybackEpoch()
        if usingLocalPlayer {
            avPlayer?.pause()
        } else if #available(macOS 14.0, *) {
            ApplicationMusicPlayer.shared.pause()
        }
        lastStatus = "paused"
        stateTimer?.invalidate()
        stateTimer = nil
        emitState()
    }

    @MainActor
    private func resume() async throws {
        if usingLocalPlayer {
            avPlayer?.play()
            lastStatus = "playing"
            startStateTimer()
            emitState()
            return
        }
        guard #available(macOS 14.0, *) else {
            throw AppleMusicError.message("当前系统版本不支持恢复 Apple Music 播放")
        }
        let player = ApplicationMusicPlayer.shared
        if player.queue.currentEntry == nil {
            throw AppleMusicError.message("没有可恢复的播放")
        }
        try await player.play()
        lastStatus = "playing"
        startStateTimer()
        emitState()
    }

    @MainActor
    private func stopPlayback() {
        _ = bumpPlaybackEpoch()
        haltCurrentAudio()
        lastStatus = "idle"
        stateTimer?.invalidate()
        stateTimer = nil
        emitState()
    }

    private func bumpPlaybackEpoch() -> UInt64 {
        playbackEpoch += 1
        return playbackEpoch
    }

    private func isCurrentEpoch(_ epoch: UInt64) -> Bool {
        playbackEpoch == epoch
    }

    @MainActor
    private func haltCurrentAudio() {
        stopLocalPlayer()
        if #available(macOS 14.0, *) {
            ApplicationMusicPlayer.shared.stop()
        }
    }

    @available(macOS 14.0, *)
    @MainActor
    private func prefetchNearby(ids: [String], start: Int) async {
        let nearby = ids.enumerated().compactMap { offset, id -> [String: Any]? in
            guard offset != start, abs(offset - start) <= 8 else { return nil }
            return ["songid": id]
        }
        await prefetchLibrarySongs(nearby)
    }

    @MainActor
    private func seek(time: Double) {
        let safe = max(0, time)
        if usingLocalPlayer {
            avPlayer?.seek(to: CMTime(seconds: safe, preferredTimescale: 600))
        } else if #available(macOS 14.0, *) {
            ApplicationMusicPlayer.shared.playbackTime = safe
        }
        emitState(time: safe)
    }

    @available(macOS 14.0, *)
    @MainActor
    private func prefetchLibrarySongs(_ rows: [[String: Any]]) async {
        rememberMetas(rows)
        for row in rows.prefix(8) {
            let id = string(row["songid"], fallback: string(row["id"]))
            guard !id.isEmpty, cachedSongs[id]?.playParameters == nil else { continue }
            _ = await resolvePlayableSong(id: id)
        }
    }

    @available(macOS 14.0, *)
    @MainActor
    private func resolvePlayableSong(id: String) async -> Song? {
        if let cached = cachedSongs[id], cached.playParameters != nil {
            return cached
        }
        if !id.hasPrefix("i."), !id.hasPrefix("l."), !id.hasPrefix("p."),
           let songs = await withTimeout(seconds: 4, { try await self.fetchSongs(ids: [id]) }),
           let song = songs.first {
            remember(song: song, localId: id)
            if song.playParameters != nil { return song }
        }
        if let song = await timedSong(seconds: 4, {
            var request = MusicLibraryRequest<Song>()
            request.filter(matching: \.id, equalTo: MusicItemID(id))
            request.limit = 1
            return try? await request.response().items.first
        }) {
            remember(song: song, localId: id)
            return song
        }
        let meta = songMeta(for: id)
        if !meta.title.isEmpty {
            if let song = await timedSong(seconds: 4, {
                await self.findLibrarySong(title: meta.title, artist: meta.artist)
            }) {
                remember(song: song, localId: id)
                return song
            }
            if let song = await timedSong(seconds: 5, {
                await self.searchCatalogSong(title: meta.title, artist: meta.artist)
            }) {
                remember(song: song, localId: id)
                return song
            }
        }
        if let cached = cachedSongs[id] { return cached }
        return nil
    }

    @available(macOS 14.0, *)
    @MainActor
    private func timedSong(seconds: Double, _ work: @escaping @MainActor () async -> Song?) async -> Song? {
        await withTimeout(seconds: seconds) {
            guard let song = await work() else { throw AppleMusicError.message("none") }
            return song
        }
    }

    private func rememberMetas(_ value: Any?) {
        let rows: [[String: Any]]
        if let list = value as? [[String: Any]] {
            rows = list
        } else if let list = value as? [Any] {
            rows = list.compactMap { $0 as? [String: Any] }
        } else {
            return
        }
        for row in rows {
            let id = string(row["songid"], fallback: string(row["id"]))
            let title = string(row["title"])
            guard !id.isEmpty, !title.isEmpty else { continue }
            songMetas[id] = (title, string(row["author"]), Double(int(row["durationMs"])) / 1000)
            if let preview = URL(string: string(row["previewUrl"])) {
                previewURLs[id] = preview
            }
        }
    }

    private func songMeta(for id: String) -> (title: String, artist: String, duration: Double) {
        if let cached = songMetas[id] { return cached }
        if let local = AppleMusicLocalLibrary.trackMeta(id: id) {
            let meta = (local.title, local.artist, Double(local.durationMs) / 1000)
            songMetas[id] = meta
            return meta
        }
        return ("", "", 0)
    }

    @available(macOS 14.0, *)
    @MainActor
    private func findLibrarySong(title: String, artist: String) async -> Song? {
        var request = MusicLibraryRequest<Song>()
        request.filter(matching: \.title, equalTo: title)
        request.limit = 8
        let items = (try? await request.response().items) ?? []
        let artistFold = artist.lowercased()
        if !artistFold.isEmpty {
            if let exact = items.first(where: { $0.artistName.lowercased() == artistFold }) {
                return exact
            }
            if let partial = items.first(where: {
                $0.artistName.lowercased().contains(artistFold) || artistFold.contains($0.artistName.lowercased())
            }) {
                return partial
            }
        }
        return items.first
    }

    private func remember(song: Song, localId: String) {
        cachedSongs[localId] = song
        cachedSongs[song.id.rawValue] = song
        if localId != song.id.rawValue {
            localIdBySongId[song.id.rawValue] = localId
        }
    }

    private func songKey(_ title: String, _ artist: String) -> String {
        let foldedTitle = title.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let foldedArtist = artist.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(foldedTitle)|\(foldedArtist)"
    }

    @MainActor
    private func loadLibrarySongIndex() async {
        guard !librarySongsReady else { return }
        librarySongsReady = true
        guard #available(macOS 14.0, *) else { return }
        do {
            var request = MusicLibraryRequest<Song>()
            request.limit = 10_000
            for song in try await request.response().items {
                cachedSongs[song.id.rawValue] = song
                librarySongsByKey[songKey(song.title, song.artistName)] = song
                if librarySongsByKey[songKey(song.title, "")] == nil {
                    librarySongsByKey[songKey(song.title, "")] = song
                }
            }
        } catch {
            // 目录 ID 和标题搜索仍可兜底
        }
    }

    @MainActor
    private func searchCatalogSong(title: String, artist: String) async -> Song? {
        let term = [title, artist].filter { !$0.isEmpty }.joined(separator: " ")
        guard !term.isEmpty else { return nil }
        do {
            var request = MusicCatalogSearchRequest(term: term, types: [Song.self])
            request.limit = 5
            let songs = try await request.response().songs
            for song in songs { cachedSongs[song.id.rawValue] = song }
            let titleFold = title.lowercased()
            let artistFold = artist.lowercased()
            return songs.first(where: {
                $0.title.lowercased() == titleFold && (artistFold.isEmpty || $0.artistName.lowercased() == artistFold)
            }) ?? songs.first(where: { $0.title.lowercased() == titleFold }) ?? songs.first
        } catch {
            return nil
        }
    }

    @available(macOS 12.0, *)
    private func fetchSongs(ids: [String]) async throws -> [Song] {
        var songs: [Song] = []
        var seen = Set<String>()
        for chunk in stride(from: 0, to: ids.count, by: 20) {
            let slice = Array(ids[chunk..<min(chunk + 20, ids.count)])
            let request = MusicCatalogResourceRequest<Song>(
                matching: \.id,
                memberOf: slice.map { MusicItemID($0) }
            )
            let response = try await request.response()
            for song in response.items where seen.insert(song.id.rawValue).inserted {
                songs.append(song)
            }
        }
        return songs.sorted { left, right in
            (ids.firstIndex(of: left.id.rawValue) ?? .max) < (ids.firstIndex(of: right.id.rawValue) ?? .max)
        }
    }

    // MARK: - Playback observers

    private func startStateTimer() {
        stateTimer?.invalidate()
        stateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                self?.emitState()
            }
        }
        RunLoop.main.add(stateTimer!, forMode: .common)
    }

    @MainActor
    private func emitState(time forcedTime: Double? = nil) {
        var status = lastStatus
        var time = forcedTime ?? 0
        var duration = songMetas[lastSongId]?.duration ?? 0
        var songId = lastSongId

        let wasPlaying = lastStatus == "playing"
        if usingLocalPlayer, let player = avPlayer {
            time = forcedTime ?? CMTimeGetSeconds(player.currentTime())
            if let item = player.currentItem {
                let itemDuration = CMTimeGetSeconds(item.duration)
                if itemDuration.isFinite, itemDuration > 0 {
                    duration = itemDuration
                }
            }
            status = player.rate > 0.01 ? "playing" : (lastStatus == "loading" ? "loading" : "paused")
        } else if #available(macOS 14.0, *) {
            let player = ApplicationMusicPlayer.shared
            time = forcedTime ?? player.playbackTime
            switch player.state.playbackStatus {
            case .playing, .seekingForward, .seekingBackward:
                status = "playing"
            case .paused:
                status = "paused"
            case .stopped:
                status = lastStatus == "loading" ? "loading" : "paused"
            case .interrupted:
                status = lastStatus == "paused" ? "paused" : "playing"
            @unknown default: break
            }
            if lastStatus != "loading", let entry = player.queue.currentEntry {
                applyQueueEntry(entry, songId: &songId, duration: &duration)
            }
        }

        let ended = wasPlaying && duration > 1 && time >= duration - 0.35 && status != "playing"
        if ended {
            status = "ended"
        }
        lastStatus = status == "ended" ? "paused" : status
        lastSongId = songId
        emit([
            "type": ended ? "ended" : "state",
            "status": status,
            "time": time.isFinite ? time : 0,
            "duration": duration.isFinite ? duration : 0,
            "songId": songId,
        ])
    }

    @available(macOS 14.0, *)
    private func applyQueueEntry(_ entry: ApplicationMusicPlayer.Queue.Entry, songId: inout String, duration: inout Double) {
        switch entry.item {
        case .song(let song):
            songId = localIdBySongId[song.id.rawValue] ?? song.id.rawValue
            duration = song.duration ?? duration
        default:
            break
        }
    }

    @MainActor
    private func emitPlaying(duration: Double) {
        lastStatus = "playing"
        let safe = duration.isFinite && duration > 0 ? duration : (songMetas[lastSongId]?.duration ?? 0)
        emit([
            "type": "state",
            "status": "playing",
            "time": 0,
            "duration": safe,
            "songId": lastSongId,
        ])
    }

    // MARK: - Payloads

    private func songPayload(_ song: Song) -> [String: Any] {
        cachedSongs[song.id.rawValue] = song
        return [
            "type": "apple",
            "songid": song.id.rawValue,
            "title": song.title,
            "author": song.artistName,
            "album": song.albumTitle ?? "",
            "pic": artworkURL(song.artwork),
            "url": appleURL(song.id.rawValue),
            "link": song.url?.absoluteString ?? "",
            "durationMs": Int((song.duration ?? 0) * 1000),
            "lrc": "",
        ]
    }

    private func trackPayload(_ track: Track) -> [String: Any] {
        switch track {
        case .song(let song):
            return songPayload(song)
        default:
            return [
                "type": "apple",
                "songid": track.id.rawValue,
                "title": track.title,
                "author": track.artistName,
                "album": "",
                "pic": artworkURL(track.artwork),
                "url": appleURL(track.id.rawValue),
                "link": "",
                "durationMs": Int((track.duration ?? 0) * 1000),
                "lrc": "",
            ]
        }
    }

    private func playlistPayload(_ playlist: Playlist, kind: String) -> [String: Any] {
        if kind == "catalog" {
            cachedCatalogPlaylists[playlist.id.rawValue] = playlist
        }
        var row: [String: Any] = [
            "id": playlist.id.rawValue,
            "name": playlist.name,
            "cover": artworkURL(playlist.artwork),
            "trackCount": playlist.tracks?.count ?? 0,
            "kind": kind,
            "type": "apple",
        ]
        if let virtual = virtualPlaylists[playlist.id.rawValue] {
            row["cover"] = virtual.cover
            row["covers"] = trackCoverList(virtual.tracks)
            row["coverItems"] = trackCoverItems(virtual.tracks)
            row["trackCount"] = virtual.tracks.count
        }
        return row
    }

    private func albumPayload(_ album: Album) -> [String: Any] {
        [
            "id": album.id.rawValue,
            "name": album.title,
            "cover": artworkURL(album.artwork),
            "artist": album.artistName,
            "type": "apple",
        ]
    }

    private func artistPayload(_ artist: Artist) -> [String: Any] {
        [
            "id": artist.id.rawValue,
            "name": artist.name,
            "cover": artworkURL(artist.artwork),
            "type": "apple",
        ]
    }

    private func songsFromTracks(_ tracks: MusicItemCollection<Track>?) -> [[String: Any]] {
        guard let tracks else { return [] }
        return tracks.compactMap { track in
            switch track {
            case .song(let song):
                return songPayload(song)
            default:
                return nil
            }
        }
    }

    private func itunesSong(_ row: [String: Any]) -> [String: Any]? {
        let id = itunesId(row["trackId"])
        let title = row["trackName"] as? String ?? ""
        guard !id.isEmpty, !title.isEmpty else { return nil }
        return [
            "type": "apple",
            "songid": id,
            "title": title,
            "author": row["artistName"] as? String ?? "",
            "album": row["collectionName"] as? String ?? "",
            "pic": itunesArtwork(row["artworkUrl100"] as? String),
            "url": appleURL(id),
            "link": row["trackViewUrl"] as? String ?? "",
            "durationMs": int(row["trackTimeMillis"]),
            "previewUrl": row["previewUrl"] as? String ?? "",
            "lrc": "",
        ]
    }

    private func itunesAlbum(_ row: [String: Any]) -> [String: Any]? {
        let id = itunesId(row["collectionId"])
        let name = row["collectionName"] as? String ?? ""
        guard !id.isEmpty, !name.isEmpty else { return nil }
        return [
            "id": id,
            "name": name,
            "cover": itunesArtwork(row["artworkUrl100"] as? String),
            "artist": row["artistName"] as? String ?? "",
            "type": "apple",
        ]
    }

    private func itunesArtist(_ row: [String: Any]) -> [String: Any]? {
        let id = itunesId(row["artistId"])
        let name = row["artistName"] as? String ?? ""
        guard !id.isEmpty, !name.isEmpty else { return nil }
        return [
            "id": id,
            "name": name,
            "cover": "",
            "type": "apple",
        ]
    }

    // MARK: - Helpers

    private func friendlyMusicError(_ error: Error) -> String {
        if let apple = error as? AppleMusicError {
            return apple.errorDescription ?? "Apple Music 请求失败"
        }
        let raw = "\((error as NSError).domain) \(error.localizedDescription)"
        if raw.localizedCaseInsensitiveContains("MusicDataRequest")
            || raw.localizedCaseInsensitiveContains("MusicKit") {
            return "Apple Music 目录暂时不可用，请改用资料库歌单或最近播放。"
        }
        return error.localizedDescription
    }

    private func requireAuthorized() throws {
        if MusicAuthorization.currentStatus != .authorized {
            throw AppleMusicError.message("还没有授权 Apple Music")
        }
    }

    private func appleURL(_ id: String) -> String { "applemusic://\(id)" }

    private func artworkURL(_ artwork: Artwork?, size: Int = 640, fallback: String? = nil) -> String {
        if let artwork {
            for side in [size, 400, 240, 120] {
                if let url = artwork.url(width: side, height: side)?.absoluteString, !url.isEmpty {
                    return url
                }
            }
        }
        return fallback?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private func itunesArtwork(_ raw: String?) -> String {
        guard var url = raw, !url.isEmpty else { return "" }
        url = url.replacingOccurrences(of: "100x100bb", with: "640x640bb")
        url = url.replacingOccurrences(of: "100x100", with: "640x640")
        return url
    }

    private func itunesId(_ value: Any?) -> String {
        if let number = value as? NSNumber { return number.stringValue }
        if let text = value as? String { return text }
        if let intVal = value as? Int { return String(intVal) }
        return ""
    }

    private func withTimeout<T: Sendable>(
        seconds: Double,
        _ work: @escaping @Sendable () async throws -> T
    ) async -> T? {
        await withTaskGroup(of: T?.self) { group in
            group.addTask {
                try? await work()
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }

    private func storefrontCountry() -> String {
        if #available(macOS 13.0, *) {
            return Locale.current.region?.identifier.lowercased() ?? "cn"
        }
        return Locale.current.regionCode?.lowercased() ?? "cn"
    }

    private func authLabel(_ status: MusicAuthorization.Status) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private func authorizationHint(_ status: MusicAuthorization.Status) -> String {
        switch status {
        case .denied:
            return "已拒绝授权。请到系统设置 → 隐私与安全性 → 媒体与 Apple Music 打开 RyanMusic。"
        case .restricted:
            return "当前设备限制了 Apple Music 访问。"
        default:
            return "尚未授权 Apple Music。"
        }
    }

    private func string(_ value: Any?, fallback: String = "") -> String {
        (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? fallback
    }

    private func stringArray(_ value: Any?) -> [String] {
        if let list = value as? [String] { return list }
        if let list = value as? [Any] { return list.compactMap { $0 as? String } }
        return []
    }

    private func int(_ value: Any?, fallback: Int = 0) -> Int {
        if let number = value as? NSNumber { return number.intValue }
        if let number = value as? Int { return number }
        if let text = value as? String, let parsed = Int(text) { return parsed }
        return fallback
    }

    private func double(_ value: Any?, fallback: Double = 0) -> Double {
        if let number = value as? NSNumber { return number.doubleValue }
        if let number = value as? Double { return number }
        if let text = value as? String, let parsed = Double(text) { return parsed }
        return fallback
    }

    private func reply(id: String, ok: Bool, data: [String: Any]) {
        var payload = data
        payload["requestId"] = id
        payload["ok"] = ok
        emitRaw("__ryanAppleMusicReply", payload)
    }

    private func emit(_ payload: [String: Any]) {
        emitRaw("__ryanAppleMusicEvent", payload)
    }

    private func emitRaw(_ fn: String, _ payload: [String: Any]) {
        guard let webView, JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        let script = "window.\(fn)&&window.\(fn)(JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(atob('\(data.base64EncodedString())'),function(c){return c.charCodeAt(0)}))))"
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}

private enum AppleMusicError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        }
    }
}
