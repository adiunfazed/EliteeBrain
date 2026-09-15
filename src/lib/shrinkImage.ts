/**
 * Shrink a photo before sending it to the model.
 *
 * A modern phone camera produces 4–12 MB files. Sent raw they take an age to
 * upload on a slow connection, and the model gains nothing from the extra
 * pixels — 900px on the long edge is ample for recognising food, posture or a
 * page of notes.
 *
 * Extracted from the vision tools so the chat and the tools shrink photos
 * identically rather than drifting apart.
 */

export interface ShrunkImage {
  /** Base64 without the data-URL prefix, which is what the API expects. */
  base64: string;
  mimeType: string;
  /** A blob URL for previewing. The caller must revoke it when finished. */
  preview: string;
  bytes: number;
}

/** Long edge in pixels. Enough detail for the model, small enough to send. */
const MAX_SIDE = 900;

/** JPEG quality. Below about 0.7 compression artefacts start to mislead. */
const QUALITY = 0.78;

export function shrinkImage(file: File): Promise<ShrunkImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That is not an image file.'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not read that image.'));
        return;
      }

      // White behind the image: a transparent PNG would otherwise flatten to
      // black, which changes what the model sees.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      const base64 = dataUrl.split(',')[1] || '';

      if (!base64) {
        reject(new Error('Could not process that image.'));
        return;
      }

      resolve({
        base64,
        mimeType: 'image/jpeg',
        preview: dataUrl,
        bytes: Math.floor((base64.length * 3) / 4),
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try a different photo.'));
    };

    img.src = url;
  });
}
