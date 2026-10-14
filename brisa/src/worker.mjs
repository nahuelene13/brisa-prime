import { assets } from "./assets.generated.mjs";
import {
  regionalTariffFeed,
  priceFeed,
  exchangeFeed,
} from "./data-service.mjs";
export default {
  async fetch(request, env, ctx) {
    const u = new URL(request.url);
    if (request.method !== "GET")
      return new Response("Método no permitido", { status: 405 });
    const feeds = {
      "/api/tariffs": () => regionalTariffFeed(u.searchParams.get("provider")),
      "/api/prices": priceFeed,
      "/api/exchange": exchangeFeed,
    };
    if (feeds[u.pathname]) {
      const cache = globalThis.caches?.default,
        key = new Request(
          u.origin +
            u.pathname +
            (u.pathname === "/api/tariffs"
              ? "?provider=" +
                encodeURIComponent(u.searchParams.get("provider") || "")
              : ""),
        );
      const cached = await cache?.match(key);
      if (cached) return cached;
      try {
        const body = await feeds[u.pathname]();
        const r = Response.json(body, {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "X-Brisa-Source": "live-public-source",
          },
        });
        if (cache && ctx?.waitUntil) ctx.waitUntil(cache.put(key, r.clone()));
        return r;
      } catch {
        return Response.json(
          {
            error:
              "No se pudo consultar o validar la fuente. No se sustituyó por un precio inventado.",
            checkedAt: new Date().toISOString(),
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const path = u.pathname === "/" ? "/index.html" : u.pathname;
    const asset = assets[path];
    if (!asset) return new Response("No encontrado", { status: 404 });
    return new Response(asset.body, {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  },
};
