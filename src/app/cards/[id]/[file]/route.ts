import { readCardAppFile } from "@/lib/card-app/generate";
import { cardAppFiles, isCardAppFile } from "@/lib/card-app/templates";
import { dataDir } from "@/lib/paths";

export async function GET(_request: Request, ctx: RouteContext<"/cards/[id]/[file]">) {
  const { id, file } = await ctx.params;
  if (!isCardAppFile(file)) {
    return new Response("Not found", { status: 404 });
  }
  const content = await readCardAppFile(dataDir, id, file);
  if (!content) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": cardAppFiles[file],
      "Cache-Control": file === "sw.js" ? "no-cache" : "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
    },
  });
}
