import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { renderCardIcon } from "@/lib/card-app/png-icon";

describe("renderCardIcon", () => {
  it("produces a valid RGB PNG of the requested size", () => {
    const png = renderCardIcon(48, [0, 0, 0], [255, 255, 255], [128, 128, 128]);

    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(48);
    expect(png.readUInt32BE(20)).toBe(48);

    const idatLength = png.readUInt32BE(33);
    expect(png.subarray(37, 41).toString("ascii")).toBe("IDAT");
    const pixels = inflateSync(png.subarray(41, 41 + idatLength));
    expect(pixels.byteLength).toBe(48 * (1 + 48 * 3));
  });
});
