import type { PaperCard } from "@/lib/business-card";
import { countriesFromText, extractEmail, extractPhone, normalizeFullName } from "@/lib/contact-extraction";

export type OcrLine = {
  text: string;
  confidentText?: string;
  height: number;
  top: number;
};

type ParsedLine = {
  text: string;
  confidentText: string;
  height: number;
  top: number;
};

function keywordPattern(keywords: string[]): RegExp {
  const escaped = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

const urlPattern = /(?:https?:\/\/|www\.)\S+/gi;
const emailInLine = /\S+@\S+/g;
const phoneInLine = /\+?\d[\d\s().-]{6,}\d/g;
const contactLabels = keywordPattern(["tel", "phone", "mob", "mobile", "cell", "fax", "e-mail", "email"]);

const taglinePattern = keywordPattern([
  "since",
  "est.",
  "established",
  "founded",
  "trusted",
  "quality",
  "leading",
  "your partner",
]);

const organizationSuffixes = keywordPattern([
  "inc",
  "ltd",
  "llc",
  "llp",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "sas",
  "srl",
  "bv",
  "nv",
  "oy",
  "ab",
  "as",
  "sia",
  "uab",
  "oü",
  "corp",
  "corporation",
  "company",
  "co",
  "group",
  "holding",
  "holdings",
  "studio",
  "agency",
  "partners",
  "solutions",
  "technologies",
  "labs",
]);

const roleKeywords = keywordPattern([
  "ceo",
  "cto",
  "cfo",
  "coo",
  "cmo",
  "founder",
  "co-founder",
  "owner",
  "president",
  "director",
  "manager",
  "head",
  "lead",
  "chief",
  "officer",
  "engineer",
  "developer",
  "designer",
  "consultant",
  "architect",
  "analyst",
  "specialist",
  "advisor",
  "partner",
  "associate",
  "assistant",
  "coordinator",
  "executive",
  "representative",
  "sales",
  "marketing",
  "accountant",
  "lawyer",
  "attorney",
]);

const addressHints = new RegExp(
  `${
    keywordPattern([
      "street",
      "st",
      "avenue",
      "ave",
      "road",
      "rd",
      "boulevard",
      "blvd",
      "lane",
      "ln",
      "drive",
      "square",
      "sq",
      "iela",
      "straße",
      "strasse",
      "str",
      "suite",
      "floor",
      "building",
      "zip",
      "po box",
    ]).source
  }|\\d{4,6}|,`,
  "iu",
);

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}+(]+/u, "")
    .replace(/[\s|_~—-]+$/u, "")
    .trim();
}

function tidyWords(text: string): string {
  return text
    .split(" ")
    .filter((word) => /[\p{L}\p{N}]{2,}|^&$/u.test(word))
    .join(" ");
}

function withoutContacts(text: string): string {
  return text
    .replace(urlPattern, " ")
    .replace(emailInLine, " ")
    .replace(phoneInLine, " ")
    .replace(new RegExp(contactLabels.source, "giu"), " ")
    .replace(/[\s:;.,]+$/u, "")
    .replace(/^[\s:;.,]+/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function linesFromText(text: string): OcrLine[] {
  return text.split(/\r?\n/).map((line, index) => ({ text: line, height: 1, top: index }));
}

export function parsePaperCard(ocrLines: OcrLine[]): PaperCard {
  const lines: ParsedLine[] = ocrLines
    .map((line) => ({
      text: cleanText(line.text),
      confidentText: cleanText(line.confidentText ?? line.text),
      height: line.height,
      top: line.top,
    }))
    .filter((line) => line.text.length > 1);
  const allText = lines.map((line) => line.text).join("\n");

  const email = lines.map((line) => extractEmail(line.text)).find((found) => found !== "") ?? "";

  const phone = extractPhone(
    lines.map((line) => line.text.replace(urlPattern, " ").replace(emailInLine, " ")),
    countriesFromText(allText),
  );

  const remaining: ParsedLine[] = lines
    .filter((line) => !taglinePattern.test(line.text))
    .map((line) => ({
      ...line,
      text: withoutContacts(line.text),
      confidentText: withoutContacts(line.confidentText),
    }))
    .filter((line) => line.text.replace(/[^\p{L}]/gu, "").length >= 2);

  const nameCandidates = remaining
    .map((line) => ({ line, name: normalizeFullName(line.confidentText) }))
    .filter(
      (candidate): candidate is { line: ParsedLine; name: string } =>
        candidate.name !== null &&
        !organizationSuffixes.test(candidate.line.text) &&
        !roleKeywords.test(candidate.line.text),
    )
    .sort((a, b) => b.line.height - a.line.height || a.line.top - b.line.top);
  const nameMatch = nameCandidates[0];
  const unused = remaining.filter((line) => line !== nameMatch?.line);

  const take = (predicate: (line: ParsedLine) => boolean): ParsedLine | undefined => {
    const index = unused.findIndex(predicate);
    return index === -1 ? undefined : unused.splice(index, 1)[0];
  };

  const organizationName = take((line) => organizationSuffixes.test(line.text))?.text ?? "";
  const role = tidyWords(take((line) => roleKeywords.test(line.confidentText))?.confidentText ?? "");
  const organizationAddress = unused
    .filter((line) => addressHints.test(line.text))
    .map((line) => line.text)
    .join(", ");
  const fallbackOrganization =
    organizationName ||
    ([...unused].sort((a, b) => b.height - a.height).find((line) => !addressHints.test(line.text))?.text ?? "");

  return {
    fullName: nameMatch?.name ?? "",
    organizationName: fallbackOrganization,
    organizationAddress,
    role,
    phone,
    email,
  };
}
