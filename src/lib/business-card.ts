import { z } from "zod";

const optionalText = z.string().trim().max(200).optional().default("");
const requiredText = z.string().trim().min(1, "Required").max(200);

export const cardCreationSchema = z.object({
  fullName: requiredText,
  organizationName: requiredText,
  organizationID: requiredText,
  organizationAddress: requiredText,
  role: optionalText,
  phone: requiredText.regex(/^\+?[\d\s().-]{5,}$/, "Invalid phone number"),
  email: z.string().trim().max(200).pipe(z.email("Invalid email")),
});

export type CardCreation = z.infer<typeof cardCreationSchema>;

export const businessCardSchema = cardCreationSchema;

export type BusinessCard = z.infer<typeof businessCardSchema>;

export const paperCardSchema = z.object({
  fullName: z.string(),
  organizationName: z.string(),
  organizationAddress: z.string(),
  role: z.string(),
  phone: z.string(),
  email: z.string(),
});

export type PaperCard = z.infer<typeof paperCardSchema>;

export const maxImageBytes = 5 * 1024 * 1024;

export const supportedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const imageDataUrlPattern = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export const cardRecognitionSchema = z.object({
  image: z
    .string()
    .max(Math.ceil((maxImageBytes * 4) / 3) + 64, "Image is larger than 5 MB")
    .regex(imageDataUrlPattern, "Image must be a JPEG, PNG, or WebP data URL"),
});

export type CardRecognition = z.infer<typeof cardRecognitionSchema>;

export function decodeImageDataUrl(dataUrl: string): Buffer {
  const match = imageDataUrlPattern.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid image data URL");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength > maxImageBytes) {
    throw new Error("Image is larger than 5 MB");
  }
  return bytes;
}
