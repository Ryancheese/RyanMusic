import type { TemperaLayerImage } from '../types';
import {
  buildStoredVisualizerImageAsset,
  clearStoredVisualizerImageAsset,
  getStoredVisualizerImageAsset,
  isSupportedVisualizerImageFile,
  saveStoredVisualizerImageAsset,
} from '../lib/visualizerImageAsset';

export interface StoredTemperaLayerImage {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
  thumbnail?: Blob;
}

const THUMBNAIL_MAX_EDGE = 256;
const keyFor = (id: string) => `tempera_layer_image_${id}`;

export const isSupportedTemperaLayerImageFile = isSupportedVisualizerImageFile;

export const getTemperaLayerImage = async (id: string) => (
  getStoredVisualizerImageAsset<StoredTemperaLayerImage>(keyFor(id))
);

export const saveTemperaLayerImage = async (image: StoredTemperaLayerImage) => {
  await saveStoredVisualizerImageAsset(keyFor(image.id), image);
};

export const clearTemperaLayerImage = async (id: string) => {
  await clearStoredVisualizerImageAsset(keyFor(id));
};

export const buildStoredTemperaLayerImage = (file: File) => (
  buildStoredVisualizerImageAsset<StoredTemperaLayerImage>(file)
);

export const createTemperaLayerImageThumbnail = async (file: Blob): Promise<Blob | null> => {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
};

export const prepareTemperaLayerImage = async (file: File): Promise<StoredTemperaLayerImage> => {
  const stored = buildStoredTemperaLayerImage(file);
  const thumbnail = await createTemperaLayerImageThumbnail(file);
  return thumbnail ? { ...stored, thumbnail } : stored;
};

export const loadTemperaLayerImageThumbnails = async (
  placements: Pick<TemperaLayerImage, 'id'>[],
): Promise<Map<string, Blob>> => {
  const blobs = new Map<string, Blob>();
  await Promise.all(placements.map(async (placement) => {
    const stored = await getTemperaLayerImage(placement.id).catch(() => null);
    const preview = stored?.thumbnail ?? stored?.blob;
    if (preview) blobs.set(placement.id, preview);
  }));
  return blobs;
};

export const loadTemperaLayerImageBlobs = async (
  placements: Pick<TemperaLayerImage, 'id'>[],
): Promise<Map<string, Blob>> => {
  const blobs = new Map<string, Blob>();
  await Promise.all(placements.map(async (placement) => {
    const stored = await getTemperaLayerImage(placement.id).catch(() => null);
    if (stored?.blob) blobs.set(placement.id, stored.blob);
  }));
  return blobs;
};
