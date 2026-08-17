export type MediaId = string | number;
export type PlaybackSourceRef = {
  kind: 'online' | 'local' | 'navidrome' | 'stage';
  mediaId: string;
  providerId?: string;
};
export type ProviderCatalogRef = {
  providerId: string;
  kind: 'album' | 'artist' | 'playlist';
  id: MediaId;
};
