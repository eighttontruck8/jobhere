export interface LinkSourceInput {
  kind: "link";
  url: string;
}

export interface ImageSourceInput {
  kind: "image";
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array;
}

export interface PdfSourceInput {
  kind: "pdf";
  data: Uint8Array;
}

export interface HwpxSourceInput {
  kind: "hwpx";
  data: Uint8Array;
}

export type SourceInput =
  | LinkSourceInput
  | ImageSourceInput
  | PdfSourceInput
  | HwpxSourceInput;

export interface TextRawContent {
  kind: "text";
  text: string;
  sourceUrl: string;
}

export interface ImageRawContent {
  kind: "image";
  mimeType: "image/jpeg" | "image/png";
  data: Uint8Array;
  dataUrl: string;
}

export type RawContent = TextRawContent | ImageRawContent;

export interface SourceParser {
  supports(input: SourceInput): boolean;
  extractRawContent(input: SourceInput): Promise<RawContent>;
}
