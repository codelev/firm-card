import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import type { BusinessCard } from "@/lib/business-card";
import { renderCardIcon } from "@/lib/card-app/png-icon";
import {
  cardAppFiles,
  cardAppUrl,
  renderAppJs,
  renderIndexHtml,
  renderManifest,
  renderServiceWorker,
  styleCss,
  type CardAppFile,
} from "@/lib/card-app/templates";
import { buildVCard } from "@/lib/vcard";

const cardIdPattern = /^[A-Za-z0-9_-]{22}$/;

export function isCardId(value: string): boolean {
  return cardIdPattern.test(value);
}

export function newCardId(): string {
  return randomBytes(16).toString("base64url");
}

function cardsDir(dataDir: string): string {
  return path.join(dataDir, "cards");
}

export async function generateCardApp(
  dataDir: string,
  card: BusinessCard,
  id: string = newCardId(),
): Promise<{ id: string; appUrl: string }> {
  const vcard = buildVCard(card);
  const qrSvg = await QRCode.toString(vcard, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const background: [number, number, number] = [30, 41, 59];
  const foreground: [number, number, number] = [248, 250, 252];
  const accent: [number, number, number] = [100, 116, 139];

  const files: Record<CardAppFile, string | Buffer> = {
    "index.html": renderIndexHtml(id, card, qrSvg),
    "style.css": styleCss,
    "app.js": renderAppJs(id),
    "sw.js": renderServiceWorker(id),
    "manifest.webmanifest": renderManifest(id, card),
    "icon-192.png": renderCardIcon(192, background, foreground, accent),
    "icon-512.png": renderCardIcon(512, background, foreground, accent),
    "card.vcf": vcard,
  };

  const root = cardsDir(dataDir);
  const staging = path.join(root, `.${id}.tmp`);
  await mkdir(staging, { recursive: true });
  await Promise.all(
    (Object.keys(cardAppFiles) as CardAppFile[]).map((name) => writeFile(path.join(staging, name), files[name])),
  );
  await writeFile(path.join(staging, "card.json"), JSON.stringify(card));
  await rename(staging, path.join(root, id));

  return { id, appUrl: cardAppUrl(id) };
}

export async function readCardAppFile(dataDir: string, id: string, name: CardAppFile): Promise<Buffer | null> {
  if (!isCardId(id)) {
    return null;
  }
  try {
    return await readFile(path.join(cardsDir(dataDir), id, name));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
