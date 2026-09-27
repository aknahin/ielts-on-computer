import { promises as fs } from "node:fs";
import { listMedia, mediaPath } from "@/lib/contents";

/**
 * Serves the recordings and images that live beside a test in `contents/`.
 * Every file is prerendered at build time; under `next dev` new files are
 * picked up on request.
 */
export async function generateStaticParams() {
  return (await listMedia()).map((segments) => ({ path: segments }));
}

export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const media = mediaPath(segments.map((s) => decodeURIComponent(s)));
  if (!media) return new Response("Not found", { status: 404 });

  try {
    const body = await fs.readFile(media.file);
    return new Response(body, {
      headers: {
        "Content-Type": media.type,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
