import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MAXIMUM_IMAGE_COUNT,
  MAXIMUM_IMAGE_SIZE_BYTES,
  MAXIMUM_TOTAL_IMAGE_SIZE_BYTES,
  SUPPORTED_IMAGE_MIME_TYPES,
  UnsupportedImageError,
  validateImageCollectionMetadata,
  validateImageMetadata,
} from "./image-validation";

describe("validateImageMetadata", () => {
  it("Property 16: JPEG/PNG이며 1바이트 이상 10MB 이하인 이미지만 허용한다", () => {
    const supportedMimeType = fc.constantFrom(
      ...SUPPORTED_IMAGE_MIME_TYPES,
    );
    const validSize = fc.integer({ min: 1, max: MAXIMUM_IMAGE_SIZE_BYTES });
    const invalidMimeType = fc
      .string()
      .filter(
        (value) =>
          !SUPPORTED_IMAGE_MIME_TYPES.includes(
            value as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number],
          ),
      );
    const invalidSize = fc.oneof(
      fc.integer({ min: Number.MIN_SAFE_INTEGER, max: 0 }),
      fc.integer({
        min: MAXIMUM_IMAGE_SIZE_BYTES + 1,
        max: MAXIMUM_IMAGE_SIZE_BYTES * 4,
      }),
      fc.double({ noNaN: false, noDefaultInfinity: false }).filter(
        (value) => !Number.isSafeInteger(value),
      ),
    );

    fc.assert(
      fc.property(supportedMimeType, validSize, (mimeType, sizeBytes) => {
        expect(validateImageMetadata(mimeType, sizeBytes)).toEqual({
          mimeType,
          sizeBytes,
        });
      }),
    );

    fc.assert(
      fc.property(invalidMimeType, validSize, (mimeType, sizeBytes) => {
        expect(() => validateImageMetadata(mimeType, sizeBytes)).toThrow(
          UnsupportedImageError,
        );
      }),
    );

    fc.assert(
      fc.property(supportedMimeType, invalidSize, (mimeType, sizeBytes) => {
        expect(() => validateImageMetadata(mimeType, sizeBytes)).toThrow(
          UnsupportedImageError,
        );
      }),
    );
  });

  it("제한 경계인 정확히 10MB를 허용한다", () => {
    expect(
      validateImageMetadata("image/png", MAXIMUM_IMAGE_SIZE_BYTES),
    ).toEqual({
      mimeType: "image/png",
      sizeBytes: MAXIMUM_IMAGE_SIZE_BYTES,
    });
  });

  it.each([
    ["image/gif", 1, "UNSUPPORTED_FORMAT"],
    ["image/jpg", 1, "UNSUPPORTED_FORMAT"],
    ["image/png", 0, "EMPTY_IMAGE"],
    ["image/png", -1, "INVALID_SIZE"],
    ["image/jpeg", 1.5, "INVALID_SIZE"],
    ["image/jpeg", MAXIMUM_IMAGE_SIZE_BYTES + 1, "SIZE_EXCEEDED"],
  ])("%s, %s 바이트를 %s 오류로 거부한다", (mimeType, sizeBytes, reason) => {
    expect(() =>
      validateImageMetadata(mimeType as string, sizeBytes as number),
    ).toThrow(expect.objectContaining({ reason }));
  });
});

describe("validateImageCollectionMetadata", () => {
  it("여러 이미지의 개수와 전체 용량을 제한한다", () => {
    expect(() => validateImageCollectionMetadata(
      Array.from({ length: MAXIMUM_IMAGE_COUNT + 1 }, () => ({ mimeType: "image/png", sizeBytes: 1 })),
    )).toThrow(expect.objectContaining({ reason: "TOO_MANY_IMAGES" }));

    expect(() => validateImageCollectionMetadata([
      { mimeType: "image/png", sizeBytes: MAXIMUM_IMAGE_SIZE_BYTES },
      { mimeType: "image/png", sizeBytes: MAXIMUM_IMAGE_SIZE_BYTES },
      { mimeType: "image/png", sizeBytes: MAXIMUM_IMAGE_SIZE_BYTES },
      { mimeType: "image/png", sizeBytes: MAXIMUM_TOTAL_IMAGE_SIZE_BYTES - MAXIMUM_IMAGE_SIZE_BYTES * 3 + 1 },
    ])).toThrow(expect.objectContaining({ reason: "TOTAL_SIZE_EXCEEDED" }));
  });
});
