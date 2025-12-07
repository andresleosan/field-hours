/**
 * Creates a thumbnail version of an image file
 * @param file - Original image file
 * @param maxSize - Maximum width/height for the thumbnail (default 150px)
 * @param quality - JPEG quality 0-1 (default 0.6 for ~10% file size)
 * @returns Promise<Blob> - Thumbnail blob
 */
export const createThumbnail = (
  file: File,
  maxSize: number = 150,
  quality: number = 0.6
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create thumbnail"));
            }
          },
          "image/jpeg",
          quality
        );
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Creates a thumbnail from a Blob
 */
export const createThumbnailFromBlob = (
  blob: Blob,
  maxSize: number = 150,
  quality: number = 0.6
): Promise<Blob> => {
  const file = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
  return createThumbnail(file, maxSize, quality);
};

/**
 * Gets the thumbnail path from an original photo path
 */
export const getThumbnailPath = (originalPath: string): string => {
  const parts = originalPath.split("/");
  const fileName = parts.pop();
  return [...parts, "thumbs", fileName].join("/");
};

/**
 * Gets the original path from a thumbnail path
 */
export const getOriginalPath = (thumbnailPath: string): string => {
  return thumbnailPath.replace("/thumbs/", "/");
};
