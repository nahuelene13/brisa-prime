import {
  regionalTariffFeed,
  priceFeed,
  exchangeFeed,
} from "../../src/data-service.mjs";
export default async (request) => {
  const url = new URL(request.url),
    route = url.pathname;
  if (request.method !== "GET")
    return new Response("Método no permitido", { status: 405 });
  try {
    let data;
    if (route === "/api/tariffs")
      data = await regionalTariffFeed(url.searchParams.get("provider"));
    else if (route === "/api/prices") data = await priceFeed();
    else if (route === "/api/exchange") data = await exchangeFeed();
    else return new Response("No encontrado", { status: 404 });
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo verificar la fuente. Usá tu factura o volvé a consultar.",
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
};
export const config = { path: "/api/*" };
