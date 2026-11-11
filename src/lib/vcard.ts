import type { BusinessCard } from "@/lib/business-card";

function escapeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).byteLength;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function splitName(fullName: string): { family: string; given: string } {
  const words = fullName.trim().split(/\s+/);
  if (words.length < 2) {
    return { family: "", given: words[0] ?? "" };
  }
  return { family: words[words.length - 1], given: words.slice(0, -1).join(" ") };
}

export function toTelUri(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function buildVCard(card: BusinessCard): string {
  const { family, given } = splitName(card.fullName);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${escapeValue(card.fullName)}`,
    `N:${escapeValue(family)};${escapeValue(given)};;;`,
    `ORG:${escapeValue(card.organizationName)}`,
    card.role ? `TITLE:${escapeValue(card.role)}` : "",
    `TEL;VALUE=uri;TYPE=work,voice:${toTelUri(card.phone)}`,
    `EMAIL;TYPE=work:${escapeValue(card.email)}`,
    `ADR;TYPE=work:;;${escapeValue(card.organizationAddress)};;;;`,
    `NOTE:${escapeValue(`Organization ID: ${card.organizationID}`)}`,
    "END:VCARD",
  ].filter((line) => line !== "");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
