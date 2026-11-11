import { describe, expect, it } from "vitest";
import { countriesFromText, extractEmail, extractPhone, normalizeFullName } from "@/lib/contact-extraction";

describe("extractPhone", () => {
  it.each([
    ["Tel: +44 20 7946 0958", "+44 20 7946 0958"],
    ["Mob. +371 2612 3456", "+371 26 123 456"],
    ["+1 (415) 555-2671", "+1 415 555 2671"],
    ["Phone +49 30 901820", "+49 30 901820"],
    ["+81 3-1234-5678", "+81 3 1234 5678"],
    ["+91 98765 43210", "+91 98765 43210"],
    ["+55 11 91234-5678", "+55 11 91234 5678"],
    ["+61 2 9374 4000", "+61 2 9374 4000"],
    ["+86 10 6552 9988", "+86 10 6552 9988"],
    ["+33 (0)1 42 68 53 00", "+33 1 42 68 53 00"],
  ])("finds %s", (line, expected) => {
    expect(extractPhone([line])).toBe(expected);
  });

  it("fixes letters OCR confuses with digits", () => {
    expect(extractPhone(["Tel: +44 2O 7946 O958"])).toBe("+44 20 7946 0958");
    expect(extractPhone(["+371 26l2 3456"])).toBe("+371 26 123 456");
  });

  it("uses the default country for national numbers", () => {
    expect(extractPhone(["Tel. 030 901820"], ["DE"])).toBe("+49 30 901820");
    expect(extractPhone(["(415) 555-2671"], ["US"])).toBe("+1 415 555 2671");
  });

  it("skips fax numbers", () => {
    expect(extractPhone(["Fax: +44 20 7946 0000", "Tel: +44 20 7946 0958"])).toBe("+44 20 7946 0958");
  });

  it("ignores dates and short numbers", () => {
    expect(extractPhone(["Since 2004", "Office 12-14"])).toBe("");
  });

  it("falls back to the raw number when the country is unknown", () => {
    expect(extractPhone(["Tel. 2612 3456"])).toBe("2612 3456");
  });
});

describe("countriesFromText", () => {
  it("infers countries from email or website domains", () => {
    expect(countriesFromText("anna@acme.lv")).toEqual(["LV"]);
    expect(countriesFromText("www.acme.de")).toEqual(["DE"]);
    expect(countriesFromText("john@acme.co.uk")).toEqual(["GB"]);
    expect(countriesFromText("john@acme.com")).toEqual([]);
  });

  it("prefers country-prefixed postcodes over domains", () => {
    expect(countriesFromText("anna@northwind.ly\nBrivibas iela 1, Riga, LV-1010")).toEqual(["LV", "LY"]);
  });
});

describe("extractPhone with several country hints", () => {
  it("uses the first country where the number is valid", () => {
    expect(extractPhone(["Tālr. 2612 3456"], ["LY", "LV"])).toBe("+371 26 123 456");
  });
});

describe("extractEmail", () => {
  it.each([
    ["john.smith@acme.example", "john.smith@acme.example"],
    ["E-mail: John.Smith@Acme.Example", "john.smith@acme.example"],
    ["e: anna @ acme . lv", "anna@acme.lv"],
    ["anna(at)acme.lv", "anna@acme.lv"],
    ["anna [at] acme [dot] lv", "anna@acme.lv"],
    ["anna©acme.lv", "anna@acme.lv"],
    ["mail: info@acme.co.uk.", "info@acme.co.uk"],
  ])("reads %s", (line, expected) => {
    expect(extractEmail(line)).toBe(expected);
  });

  it("returns an empty string for lines without an email", () => {
    expect(extractEmail("Acme Solutions Ltd")).toBe("");
  });
});

describe("normalizeFullName", () => {
  it.each([
    ["John Smith", "John Smith"],
    ["JOHN SMITH", "John Smith"],
    ["SMITH John", "John Smith"],
    ["BERZINA Anna Maria", "Anna Maria Berzina"],
    ["Dr. Anna Bērziņa", "Anna Bērziņa"],
    ["Jane Doe, PhD", "Jane Doe"],
    ["Ludwig van Beethoven", "Ludwig van Beethoven"],
    ["MARY-JANE O'NEIL", "Mary-Jane O'Neil"],
    ["José García", "José García"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeFullName(input)).toBe(expected);
  });

  it.each(["Acme", "221B Baker Street", "john smith", "Call us today for more info", "A B"])("rejects %s", (input) => {
    expect(normalizeFullName(input)).toBeNull();
  });
});

describe("normalizeFullName with OCR noise", () => {
  it.each([
    ["JANE DOE, CISA", "Jane Doe"],
    ["JANE DOE, CPA, CISA", "Jane Doe"],
    ["x JANE DOE", "Jane Doe"],
    ["ИВАН ПЕТРОВ", "Иван Петров"],
    ["JANe Doe", "Jane Doe"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeFullName(input)).toBe(expected);
  });
});
