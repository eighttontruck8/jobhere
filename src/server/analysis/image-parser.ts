import { Buffer } from "node:buffer";
import {
  UnsupportedImageError,
  validateImageMetadata,
  type SupportedImageMimeType,
} from "./image-validation";
import type {
  ImageRawContent,
  ImageSourceInput,
  SourceInput,
  SourceParser,
} from "./source-parser";

export type ImageDataUrlEncoder = (
  data: Uint8Array,
  mimeType: SupportedImageMimeType,
) => string;

function encodeImageDataUrl(
  data: Uint8Array,
  mimeType: SupportedImageMimeType,
): string {
  return `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`;
}

export class ImageParser implements SourceParser {
  constructor(
    private readonly encodeDataUrl: ImageDataUrlEncoder = encodeImageDataUrl,
  ) {}

  supports(input: SourceInput): input is ImageSourceInput {
    return input.kind === "image";
  }

  async extractRawContent(input: SourceInput): Promise<ImageRawContent> {
    if (!this.supports(input)) {
      throw new TypeError("ImageParser는 이미지 소스만 처리할 수 있습니다.");
    }

    const metadata = validateImageMetadata(input.mimeType, input.sizeBytes);

    if (input.data.byteLength !== metadata.sizeBytes) {
      throw new UnsupportedImageError(
        "SIZE_MISMATCH",
        "이미지 크기 정보와 실제 파일 크기가 일치하지 않습니다.",
      );
    }

    const data = new Uint8Array(input.data);

    return {
      kind: "image",
      mimeType: metadata.mimeType,
      data,
      dataUrl: this.encodeDataUrl(data, metadata.mimeType),
    };
  }
}
