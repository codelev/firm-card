import sharp from "sharp";
import { InvalidImageError } from "@/lib/service-errors";

export type OcrVariant = {
  rotate: 0 | 90 | 180 | 270;
  flatten: boolean;
};

const minWidth = 1600;
const maxWidth = 3000;
const backgroundBlurSigma = 40;
export const maxInputPixels = 40_000_000;

export async function prepareImageForOcr(image: Buffer, variant: OcrVariant): Promise<Buffer> {
  const oriented = await sharp(image, { failOn: "error", limitInputPixels: maxInputPixels })
    .rotate()
    .rotate(variant.rotate)
    .grayscale()
    .toBuffer()
    .catch(() => {
      throw new InvalidImageError();
    });
  const { width = minWidth } = await sharp(oriented).metadata();
  let gray = await sharp(oriented)
    .resize({ width: Math.min(Math.max(width, minWidth), maxWidth), kernel: "lanczos3" })
    .toBuffer();

  if (variant.flatten) {
    const inverseBackground = await sharp(gray).blur(backgroundBlurSigma).negate().toBuffer();
    gray = await sharp(gray)
      .composite([{ input: inverseBackground, blend: "colour-dodge" }])
      .grayscale()
      .toBuffer();
  }

  return sharp(gray).normalise({ lower: 1, upper: 99 }).sharpen({ sigma: 1 }).png().toBuffer();
}
