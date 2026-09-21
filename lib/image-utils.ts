/**
 * Image processing utilities for client-side WebP conversion,
 * dimension optimization, and file size formatting.
 */

export interface WebPConversionResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number; // e.g. 0.75 for 75% savings
}

export interface ConvertOptions {
  quality?: number; // 0 to 1, default 0.88 (near-lossless high quality)
  maxDimension?: number; // max width or height, default 2560
}

/**
 * Formats a byte number into a readable string (e.g. "124 KB", "1.2 MB").
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Loads any image file (PNG, JPG, GIF, SVG, BMP, AVIF, etc.) into an HTMLImageElement.
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image file for conversion."));
    };
    img.src = url;
  });
}

/**
 * Converts whatever image in whatever format into a highly optimized WebP image.
 * Uses high-quality canvas rendering with automatic resolution capping for optimal
 * clarity and maximum disk/storage savings.
 */
export async function convertImageToWebP(
  file: File,
  options: ConvertOptions = {}
): Promise<WebPConversionResult> {
  const quality = options.quality ?? 0.88;
  const maxDimension = options.maxDimension ?? 2560;
  const originalSize = file.size;

  const img = await loadImageElement(file);

  let { width, height } = img;

  // Calculate scaled dimensions if larger than maxDimension
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // Create canvas and draw image
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context for WebP conversion.");
  }

  // Optimize image smoothing quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw image to canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Convert canvas to WebP Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas to WebP blob conversion returned null."));
      },
      "image/webp",
      quality
    );
  });

  const optimizedSize = blob.size;
  const compressionRatio =
    originalSize > 0
      ? Math.max(0, Math.round(((originalSize - optimizedSize) / originalSize) * 100))
      : 0;

  // Generate .webp filename
  const baseName = file.name.replace(/\.[^/.]+$/, "") || "note-image";
  const webpFileName = `${baseName}.webp`;

  const webpFile = new File([blob], webpFileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });

  // Generate data URL for instant client-side preview without waiting for upload
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return {
    file: webpFile,
    blob,
    dataUrl,
    width,
    height,
    originalSize,
    optimizedSize,
    compressionRatio,
  };
}
