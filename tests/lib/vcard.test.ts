import { describe, expect, it } from "vitest";
import type { BusinessCard } from "@/lib/business-card";
import { buildVCard, toTelUri } from "@/lib/vcard";

const card: BusinessCard = {
  fullName: "Anna Maria Berzina",
  organizationName: "Acme, Ltd; Riga",
  organizationID: "LV40003000000",
  organizationAddress: "Brivibas iela 1, Riga",
  role: "Head of Sales",
  phone: "+371 (2) 000-0000",
  email: "anna@example.com",
};

describe("buildVCard", () => {
  const vcard = buildVCard(card);
  const lines = vcard.split("\r\n");

  it("produces a vCard 4.0 with CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[1]).toBe("VERSION:4.0");
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
  });

  it("escapes commas and semicolons", () => {
    expect(lines).toContain("ORG:Acme\\, Ltd\\; Riga");
    expect(lines).toContain("ADR;TYPE=work:;;Brivibas iela 1\\, Riga;;;;");
  });

  it("splits the name into family and given parts", () => {
    expect(lines).toContain("N:Berzina;Anna Maria;;;");
    expect(lines).toContain("FN:Anna Maria Berzina");
  });

  it("writes the phone as a tel URI and keeps the organization ID", () => {
    expect(lines).toContain("TEL;VALUE=uri;TYPE=work,voice:tel:+37120000000");
    expect(lines).toContain("NOTE:Organization ID: LV40003000000");
  });

  it("omits the title when the role is empty", () => {
    expect(buildVCard({ ...card, role: "" })).not.toContain("TITLE:");
  });

  it("folds lines longer than 75 octets", () => {
    const folded = buildVCard({ ...card, organizationAddress: "Ā".repeat(60) });
    for (const line of folded.split("\r\n")) {
      expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    }
  });
});

describe("toTelUri", () => {
  it("keeps only digits and a leading plus", () => {
    expect(toTelUri("+1 (555) 010-0000")).toBe("tel:+15550100000");
  });
});
