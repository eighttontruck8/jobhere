import { describe, expect, it, vi } from "vitest";
import { ImageParser, type ImageDataUrlEncoder } from "./image-parser";

describe("ImageParser", () => {
  it("이미지 소스만 지원한다", () => {
    const parser = new ImageParser();

    expect(
      parser.supports({
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 1,
        data: new Uint8Array([1]),
      }),
    ).toBe(true);
    expect(
      parser.supports({ kind: "link", url: "https://example.com/job" }),
    ).toBe(false);
  });

  it.each([
    ["image/jpeg", new Uint8Array([0xff, 0xd8, 0xff]), "/9j/"],
    ["image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "iVBORw=="],
  ] as const)("%s 이미지를 비전 입력용 데이터 URL로 변환한다", async (mimeType, data, base64) => {
    const parser = new ImageParser();

    const result = await parser.extractRawContent({
      kind: "image",
      mimeType,
      sizeBytes: data.byteLength,
      data,
    });

    expect(result).toEqual({
      kind: "image",
      mimeType,
      data,
      dataUrl: `data:${mimeType};base64,${base64}`,
    });
    expect(result.data).not.toBe(data);
  });

  it("선언한 크기와 실제 바이트 크기가 다르면 변환하지 않는다", async () => {
    const encoder = vi.fn<ImageDataUrlEncoder>();
    const parser = new ImageParser(encoder);

    await expect(
      parser.extractRawContent({
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 2,
        data: new Uint8Array([1]),
      }),
    ).rejects.toMatchObject({
      name: "UnsupportedImageError",
      reason: "SIZE_MISMATCH",
    });
    expect(encoder).not.toHaveBeenCalled();
  });

  it.each([
    {
      mimeType: "image/gif",
      sizeBytes: 1,
      data: new Uint8Array([1]),
      reason: "UNSUPPORTED_FORMAT",
    },
    {
      mimeType: "image/png",
      sizeBytes: 0,
      data: new Uint8Array(),
      reason: "EMPTY_IMAGE",
    },
    {
      mimeType: "image/jpeg",
      sizeBytes: 10 * 1024 * 1024 + 1,
      data: new Uint8Array([1]),
      reason: "SIZE_EXCEEDED",
    },
  ])("지원 조건을 위반한 입력을 $reason 오류로 거부하고 변환하지 않는다", async (input) => {
    const encoder = vi.fn<ImageDataUrlEncoder>();
    const parser = new ImageParser(encoder);

    await expect(
      parser.extractRawContent({ kind: "image", ...input }),
    ).rejects.toMatchObject({ reason: input.reason });
    expect(encoder).not.toHaveBeenCalled();
  });

  it("이미지가 아닌 소스를 명확히 거부한다", async () => {
    const parser = new ImageParser();

    await expect(
      parser.extractRawContent({
        kind: "link",
        url: "https://example.com/job",
      }),
    ).rejects.toThrow("ImageParser는 이미지 소스만 처리할 수 있습니다.");
  });
});
