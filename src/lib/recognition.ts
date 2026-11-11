import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { createWorker, type Page, type Worker } from "tesseract.js";
import { logger } from "@/lib/logger";
import { prepareImageForOcr, type OcrVariant } from "@/lib/ocr-image";
import type { OcrLine } from "@/lib/paper-card-parser";
import { bundledOcrDataDir, dataDir } from "@/lib/paths";
import { ServiceBusyError, ServiceTimeoutError } from "@/lib/service-errors";

export const ocrLanguages = ["eng", "bul"];

const uprightVariants: OcrVariant[] = [
  { rotate: 0, flatten: false },
  { rotate: 0, flatten: true },
];

const rotatedVariants: OcrVariant[] = [
  { rotate: 90, flatten: true },
  { rotate: 270, flatten: true },
];

const goodEnoughScore = 12;
const maxQueuedRecognitions = 4;
const recognitionTimeoutMs = 30_000;

const globalForOcr = globalThis as typeof globalThis & {
  firmcardOcrWorker?: Promise<Worker>;
  firmcardOcrQueue?: number;
};

async function hasBundledOcrData(): Promise<boolean> {
  try {
    await Promise.all(
      ocrLanguages.map((language) => access(path.join(bundledOcrDataDir, `${language}.traineddata.gz`))),
    );
    return true;
  } catch {
    return false;
  }
}

async function startWorker(): Promise<Worker> {
  if (await hasBundledOcrData()) {
    const worker = await createWorker(ocrLanguages, 1, { langPath: bundledOcrDataDir, cacheMethod: "none" });
    logger.info("ocr worker ready", { languageData: "bundled" });
    return worker;
  }
  const cachePath = path.join(dataDir, "tesseract");
  await mkdir(cachePath, { recursive: true });
  const worker = await createWorker(ocrLanguages, 1, { cachePath });
  logger.info("ocr worker ready", { languageData: "downloaded" });
  return worker;
}

function getWorker(): Promise<Worker> {
  globalForOcr.firmcardOcrWorker ??= startWorker().catch((error: unknown) => {
    globalForOcr.firmcardOcrWorker = undefined;
    throw error;
  });
  return globalForOcr.firmcardOcrWorker;
}

function readabilityScore(page: Page): number {
  const words = (page.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)),
  );
  const confident = words.filter((word) => word.confidence > 75 && /\p{L}{2,}|\d{2,}/u.test(word.text)).length;
  const noise = words.filter((word) => word.confidence < 50).length;
  return confident - noise / 2;
}

const minWordConfidence = 55;

function toLines(page: Page): OcrLine[] {
  return (page.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text.trim(),
        confidentText: line.words
          .filter((word) => word.confidence >= minWordConfidence)
          .map((word) => word.text)
          .join(" ")
          .trim(),
        height: line.bbox.y1 - line.bbox.y0,
        top: line.bbox.y0,
      })),
    ),
  );
}

async function recognizeVariant(worker: Worker, image: Buffer, variant: OcrVariant) {
  const prepared = await prepareImageForOcr(image, variant);
  const { data } = await worker.recognize(prepared, {}, { blocks: true });
  return { page: data, score: readabilityScore(data) };
}

async function resetWorker() {
  const current = globalForOcr.firmcardOcrWorker;
  globalForOcr.firmcardOcrWorker = undefined;
  await current?.then((worker) => worker.terminate()).catch(() => undefined);
}

export async function recognizeLines(image: Buffer): Promise<OcrLine[]> {
  const queued = globalForOcr.firmcardOcrQueue ?? 0;
  if (queued >= maxQueuedRecognitions) {
    throw new ServiceBusyError();
  }
  globalForOcr.firmcardOcrQueue = queued + 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ServiceTimeoutError()), recognitionTimeoutMs);
  });
  try {
    return await Promise.race([recognizeBest(image), timeout]);
  } catch (error) {
    if (error instanceof ServiceTimeoutError) {
      await resetWorker();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    globalForOcr.firmcardOcrQueue = (globalForOcr.firmcardOcrQueue ?? 1) - 1;
  }
}

async function recognizeBest(image: Buffer): Promise<OcrLine[]> {
  const worker = await getWorker();
  let best = await recognizeVariant(worker, image, uprightVariants[0]);
  for (const variant of [...uprightVariants.slice(1), ...rotatedVariants]) {
    if (variant.rotate !== 0 && best.score >= goodEnoughScore) {
      break;
    }
    const candidate = await recognizeVariant(worker, image, variant);
    if (candidate.score > best.score) {
      best = candidate;
    }
  }
  return toLines(best.page);
}
