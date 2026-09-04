export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
] as const;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export const MAXIMUM_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAXIMUM_IMAGE_COUNT = 10;
export const MAXIMUM_TOTAL_IMAGE_SIZE_BYTES = 30 * 1024 * 1024;

export type UnsupportedImageReason =
  | "UNSUPPORTED_FORMAT"
  | "INVALID_SIZE"
  | "EMPTY_IMAGE"
  | "SIZE_EXCEEDED"
  | "SIZE_MISMATCH"
  | "TOO_MANY_IMAGES"
  | "TOTAL_SIZE_EXCEEDED";

export class UnsupportedImageError extends Error {
  constructor(
    public readonly reason: UnsupportedImageReason,
    message: string,
  ) {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

export interface ValidatedImageMetadata {
  mimeType: SupportedImageMimeType;
  sizeBytes: number;
}

export function isSupportedImageMimeType(
  mimeType: string,
): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.some(
    (supportedMimeType) => supportedMimeType === mimeType,
  );
}

export function validateImageMetadata(
  mimeType: string,
  sizeBytes: number,
): ValidatedImageMetadata {
  if (!isSupportedImageMimeType(mimeType)) {
    throw new UnsupportedImageError(
      "UNSUPPORTED_FORMAT",
      "JPEG 또는 PNG 이미지만 업로드할 수 있습니다.",
    );
  }

  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new UnsupportedImageError(
      "INVALID_SIZE",
      "이미지 크기 정보가 올바르지 않습니다.",
    );
  }

  if (sizeBytes === 0) {
    throw new UnsupportedImageError(
      "EMPTY_IMAGE",
      "내용이 있는 이미지를 업로드해 주세요.",
    );
  }

  if (sizeBytes > MAXIMUM_IMAGE_SIZE_BYTES) {
    throw new UnsupportedImageError(
      "SIZE_EXCEEDED",
      "이미지는 10MB 이하만 업로드할 수 있습니다.",
    );
  }

  return { mimeType, sizeBytes };
}

export function validateImageCollectionMetadata(
  images: readonly { mimeType: string; sizeBytes: number }[],
): ValidatedImageMetadata[] {
  if (images.length === 0) {
    throw new UnsupportedImageError(
      "EMPTY_IMAGE",
      "내용이 있는 이미지를 한 장 이상 올려 주세요.",
    );
  }
  if (images.length > MAXIMUM_IMAGE_COUNT) {
    throw new UnsupportedImageError(
      "TOO_MANY_IMAGES",
      `이미지는 최대 ${MAXIMUM_IMAGE_COUNT}장까지 올릴 수 있습니다.`,
    );
  }

  const validated = images.map(({ mimeType, sizeBytes }) =>
    validateImageMetadata(mimeType, sizeBytes));
  const totalSizeBytes = validated.reduce((sum, image) => sum + image.sizeBytes, 0);
  if (totalSizeBytes > MAXIMUM_TOTAL_IMAGE_SIZE_BYTES) {
    throw new UnsupportedImageError(
      "TOTAL_SIZE_EXCEEDED",
      "이미지 전체 용량은 30MB 이하만 올릴 수 있습니다.",
    );
  }
  return validated;
}
