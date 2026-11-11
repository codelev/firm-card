import type { BusinessCard } from "@/lib/business-card";
import { toTelUri } from "@/lib/vcard";

export const cardAppFiles = {
  "index.html": "text/html; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "sw.js": "text/javascript; charset=utf-8",
  "manifest.webmanifest": "application/manifest+json",
  "icon-192.png": "image/png",
  "icon-512.png": "image/png",
  "card.vcf": "text/vcard; charset=utf-8",
} as const;

export type CardAppFile = keyof typeof cardAppFiles;

export function isCardAppFile(name: string): name is CardAppFile {
  return Object.hasOwn(cardAppFiles, name);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function cardBasePath(id: string): string {
  return `/cards/${id}/`;
}

export function cardAppUrl(id: string): string {
  return `${cardBasePath(id)}index.html`;
}

export function renderIndexHtml(id: string, card: BusinessCard, qrSvg: string): string {
  const base = cardBasePath(id);
  const rows: [string, string][] = [
    ["Organization", card.organizationName],
    ["Organization ID", card.organizationID],
    ["Address", card.organizationAddress],
    ["Phone", `<a href="${escapeHtml(toTelUri(card.phone))}">${escapeHtml(card.phone)}</a>`],
    ["Email", `<a href="mailto:${escapeHtml(card.email)}">${escapeHtml(card.email)}</a>`],
  ];
  const details = rows
    .map(([label, value], index) => {
      const html = index < 3 ? escapeHtml(value) : value;
      return `<div><dt>${label}</dt><dd>${html}</dd></div>`;
    })
    .join("\n        ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#1e293b">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(card.fullName)}">
    <title>${escapeHtml(card.fullName)}</title>
    <link rel="manifest" href="${base}manifest.webmanifest">
    <link rel="icon" href="${base}icon-192.png" type="image/png">
    <link rel="apple-touch-icon" href="${base}icon-192.png">
    <link rel="stylesheet" href="${base}style.css">
    <script src="${base}app.js" defer></script>
  </head>
  <body>
    <main>
      <figure class="qr" aria-label="QR code with contact details">${qrSvg}</figure>
      <h1>${escapeHtml(card.fullName)}</h1>
      ${card.role ? `<p class="role">${escapeHtml(card.role)}</p>` : ""}
      <dl>
        ${details}
      </dl>
      <a class="save" href="${base}card.vcf" download="${escapeHtml(card.fullName)}.vcf">Save contact</a>
    </main>
  </body>
</html>
`;
}

export const styleCss = `:root {
  color-scheme: light dark;
  --bg: #f8fafc;
  --fg: #0f172a;
  --muted: #475569;
  --surface: #ffffff;
  --border: #e2e8f0;
  --accent: #1e293b;
  --accent-fg: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b1120;
    --fg: #f1f5f9;
    --muted: #94a3b8;
    --surface: #111827;
    --border: #1f2937;
    --accent: #e2e8f0;
    --accent-fg: #0f172a;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
main {
  max-width: 28rem;
  margin: 0 auto;
  padding: max(1.5rem, env(safe-area-inset-top)) 1rem max(1.5rem, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.qr {
  margin: 0 0 1rem;
  width: min(100%, 18rem);
  padding: 0.75rem;
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid var(--border);
}
.qr svg { display: block; width: 100%; height: auto; }
h1 { margin: 0; font-size: 1.5rem; text-align: center; }
.role { margin: 0; color: var(--muted); text-align: center; }
dl {
  width: 100%;
  margin: 1rem 0;
  padding: 0.25rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
}
dl div { padding: 0.625rem 0; border-bottom: 1px solid var(--border); }
dl div:last-child { border-bottom: 0; }
dt { font-size: 0.75rem; color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
a { color: inherit; }
.save {
  display: block;
  width: 100%;
  padding: 0.75rem;
  text-align: center;
  text-decoration: none;
  font-weight: 600;
  background: var(--accent);
  color: var(--accent-fg);
  border-radius: 0.75rem;
}
.save:focus-visible { outline: 3px solid var(--muted); outline-offset: 2px; }
`;

export function renderAppJs(id: string): string {
  const base = cardBasePath(id);
  return `if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("${base}sw.js", { scope: "${base}" });
  });
}
`;
}

export function renderServiceWorker(id: string): string {
  const base = cardBasePath(id);
  const assets = (Object.keys(cardAppFiles) as CardAppFile[])
    .filter((name) => name !== "sw.js")
    .map((name) => `${base}${name}`);
  return `const cacheName = "firmcard-${id}";
const assets = ${JSON.stringify(assets)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  const url = new URL(event.request.url);
  const key = url.pathname === "${base}" ? "${base}index.html" : url.pathname;
  event.respondWith(caches.match(key).then((cached) => cached || fetch(event.request)));
});
`;
}

export function renderManifest(id: string, card: BusinessCard): string {
  const base = cardBasePath(id);
  const shortName = card.fullName.split(/\s+/)[0] || card.fullName;
  return JSON.stringify(
    {
      id: base,
      name: card.fullName,
      short_name: shortName.slice(0, 12),
      description: [card.role, card.organizationName].filter(Boolean).join(", "),
      start_url: `${base}index.html`,
      scope: base,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#1e293b",
      icons: [
        { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  );
}
