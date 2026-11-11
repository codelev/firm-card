import { deflateSync } from "node:zlib";

type Rgb = [number, number, number];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function insideRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (x < left || x >= right || y < top || y >= bottom) {
    return false;
  }
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

export function renderCardIcon(size: number, background: Rgb, foreground: Rgb, accent: Rgb): Buffer {
  const unit = size / 16;
  const card = { left: 2 * unit, top: 4 * unit, right: 14 * unit, bottom: 12 * unit, radius: unit };
  const bars = [
    { left: 3.5 * unit, top: 6 * unit, right: 9.5 * unit, bottom: 7 * unit, radius: unit / 2 },
    { left: 3.5 * unit, top: 8.25 * unit, right: 8 * unit, bottom: 9 * unit, radius: unit / 3 },
    { left: 3.5 * unit, top: 9.75 * unit, right: 7 * unit, bottom: 10.5 * unit, radius: unit / 3 },
  ];
  const badge = { left: 10.5 * unit, top: 6 * unit, right: 12.5 * unit, bottom: 8 * unit, radius: unit / 3 };

  const rows: Buffer[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const at = (r: typeof card) => insideRoundedRect(px, py, r.left, r.top, r.right, r.bottom, r.radius);
      let color = background;
      if (at(card)) {
        color = foreground;
        if (bars.some(at) || at(badge)) {
          color = accent;
        }
      }
      row.set(color, 1 + x * 3);
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
