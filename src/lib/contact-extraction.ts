import { findPhoneNumbersInText, isSupportedCountry, type CountryCode } from "libphonenumber-js/max";

const emailPattern = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const atSubstitutes = /([\w.-])\s*(?:\(at\)|\[at\]|\{at\}|©|®)\s*([\w-])/gi;
const dotSubstitutes = /([\w-])\s*(?:\(dot\)|\[dot\]|\{dot\})\s*([\w-])/gi;
const emailLabel = /^(?:e-?mail|mail|e)\s*[:.]\s*/i;
const faxLabel = /(?<!\p{L})fax(?!\p{L})|^\s*f\s*[:.]/iu;
const tldToCountry: Record<string, string> = { uk: "GB" };

export function extractEmail(line: string): string {
  if (!/@|\(at\)|\[at\]|\{at\}|©|®/i.test(line)) {
    return "";
  }
  const normalized = line
    .replace(emailLabel, "")
    .replace(atSubstitutes, "$1@$2")
    .replace(dotSubstitutes, "$1.$2")
    .replace(/\s*@\s*/g, "@")
    .replace(/(@[^\s]*?)\s*\.\s*(?=[a-z])/gi, "$1.");
  const match = emailPattern.exec(normalized);
  return match ? match[0].toLowerCase().replace(/\.+$/, "") : "";
}

function fixOcrDigits(line: string): string {
  let result = line.replace(/(\+\d{1,3})\s*\(0\)\s*/g, "$1 ");
  for (let pass = 0; pass < 2; pass += 1) {
    result = result
      .replace(/(?<=[\d+(][\s.-]?)[Oo](?=[\s.)-]?[\dOo])/g, "0")
      .replace(/(?<=[\d+(][\s.-]?)[lI|](?=[\s.)-]?[\dlI|])/g, "1");
  }
  return result;
}

function toCountry(code: string): CountryCode | undefined {
  const country = (tldToCountry[code.toLowerCase()] ?? code).toUpperCase();
  return isSupportedCountry(country) ? country : undefined;
}

export function countriesFromText(text: string): CountryCode[] {
  const fromDomains = (text.toLowerCase().match(/(?:@|www\.|https?:\/\/)[a-z0-9.-]+\.([a-z]{2})\b/g) ?? []).map(
    (domain) => domain.slice(domain.lastIndexOf(".") + 1),
  );
  const fromPostcodes = [...text.matchAll(/\b([A-Z]{2})-\d{3,6}\b/g)].map((match) => match[1]);
  const countries = [...fromPostcodes, ...fromDomains].map(toCountry).filter((country) => country !== undefined);
  return [...new Set(countries)];
}

export function extractPhone(lines: string[], countries: CountryCode[] = []): string {
  const candidates = lines.filter((line) => !faxLabel.test(line)).map(fixOcrDigits);
  for (const defaultCountry of [undefined, ...countries]) {
    for (const line of candidates) {
      const [found] = findPhoneNumbersInText(line, defaultCountry ? { defaultCountry } : undefined);
      if (found?.number.isValid()) {
        return found.number.formatInternational();
      }
    }
  }
  for (const line of candidates) {
    const match = /\+?\d[\d\s().-]{5,}\d/.exec(line);
    const digits = match?.[0].replace(/\D/g, "") ?? "";
    if (match && digits.length >= 7 && digits.length <= 15) {
      return match[0].trim();
    }
  }
  return "";
}

const honorifics = /^(?:dr|mr|mrs|ms|miss|mx|prof|sir|ing|mag)\.?\s+/i;
const postNominals = /,?\s+(?:phd|ph\.d\.|mba|msc|bsc|md|esq|jr|sr|cpa)\.?$/i;
const trailingCredentials = /(?:\s*,\s*\p{Lu}{2,6})+$/u;
const nameParticles = new Set(["van", "von", "der", "den", "de", "da", "di", "du", "del", "la", "le", "bin", "al"]);
const nameWord = /^[\p{L}][\p{L}'’.-]*$/u;

function isAllCaps(word: string): boolean {
  return /\p{Lu}/u.test(word) && word === word.toUpperCase() && word.replace(/[^\p{L}]/gu, "").length > 1;
}

function titleCase(word: string): string {
  return word.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (_, separator: string, letter: string) => {
    return separator + letter.toUpperCase();
  });
}

function scriptOf(word: string): "cyrillic" | "latin" | "other" {
  if (/\p{Script=Cyrillic}/u.test(word)) {
    return "cyrillic";
  }
  return /\p{Script=Latin}/u.test(word) ? "latin" : "other";
}

function dropStrayWords(words: string[]): string[] {
  const meaningful = words.filter((word) => word.replace(/[^\p{L}]/gu, "").length >= 2 || /^\p{Lu}\.$/u.test(word));
  const counts = new Map<string, number>();
  for (const word of meaningful) {
    counts.set(scriptOf(word), (counts.get(scriptOf(word)) ?? 0) + 1);
  }
  const [majority] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["latin"];
  return meaningful.filter((word) => scriptOf(word) === majority);
}

function isMostlyCaps(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  return letters.length > 1 && upper > letters.length / 2 && upper < letters.length;
}

export function normalizeFullName(candidate: string): string | null {
  const stripped = candidate.replace(honorifics, "").replace(trailingCredentials, "").replace(postNominals, "").trim();
  if (/\d/.test(stripped)) {
    return null;
  }
  const words = dropStrayWords(stripped.split(/\s+/).filter(Boolean));
  if (words.length < 2 || words.length > 4 || !words.every((word) => nameWord.test(word))) {
    return null;
  }
  const significant = words.filter((word) => !nameParticles.has(word.toLowerCase()));
  const fullWords = significant.filter((word) => word.replace(/[^\p{L}]/gu, "").length >= 2);
  if (fullWords.length < 2 || !significant.every((word) => /^\p{Lu}/u.test(word))) {
    return null;
  }
  const capsWords = significant.filter(isAllCaps);
  const surnameFirst = capsWords.length > 0 && capsWords.length < significant.length && isAllCaps(words[0]);
  const ordered = surnameFirst
    ? [...words.filter((word) => !isAllCaps(word)), ...words.filter((word) => isAllCaps(word))]
    : words;
  return ordered
    .map((word) => (isAllCaps(word) || isMostlyCaps(word) ? titleCase(word) : word))
    .join(" ")
    .trim();
}
