import { describe, expect, it } from "vitest";
import { linesFromText, parsePaperCard, type OcrLine } from "@/lib/paper-card-parser";

describe("parsePaperCard", () => {
  it("extracts fields from typical OCR output", () => {
    const text = [
      "Acme Solutions Ltd",
      "John Smith",
      "Senior Software Engineer",
      "Tel: +44 20 7946 0000",
      "john.smith@acme.example",
      "www.acme.example",
      "221B Baker Street, London NW1 6XE",
    ].join("\n");

    expect(parsePaperCard(linesFromText(text))).toEqual({
      fullName: "John Smith",
      organizationName: "Acme Solutions Ltd",
      organizationAddress: "221B Baker Street, London NW1 6XE",
      role: "Senior Software Engineer",
      phone: "+44 20 7946 0000",
      email: "john.smith@acme.example",
    });
  });

  it("picks the name by text size", () => {
    const lines: OcrLine[] = [
      { text: "Northwind Traders", height: 30, top: 10 },
      { text: "Quality Since Forever", height: 18, top: 50 },
      { text: "BERZINA Anna", height: 60, top: 100 },
      { text: "anna@northwind.lv", height: 20, top: 200 },
      { text: "Tālr. 2612 3456", height: 20, top: 230 },
    ];

    const card = parsePaperCard(lines);

    expect(card.fullName).toBe("Anna Berzina");
    expect(card.organizationName).toBe("Northwind Traders");
    expect(card.phone).toBe("+371 26 123 456");
    expect(card.email).toBe("anna@northwind.lv");
    expect(card.organizationAddress).toBe("");
  });

  it("returns empty strings when nothing is recognized", () => {
    expect(parsePaperCard([])).toEqual({
      fullName: "",
      organizationName: "",
      organizationAddress: "",
      role: "",
      phone: "",
      email: "",
    });
  });
});
