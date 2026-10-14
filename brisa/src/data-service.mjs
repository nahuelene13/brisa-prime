import { getDocumentProxy } from "unpdf";
export const SOURCES = {
  epen: "https://www.epen.gov.ar/index.php/cuadros-tarifarios/",
  fx: "https://dolarapi.com/v1/dolares/oficial",
  panel:
    "https://www.alterenergysas.com.ar/productos-energia-solar/paneles-solares/panel-solar-fotovoltaico-144-celdas-550-wp",
  battery:
    "https://www.alterenergysas.com.ar/productos-energia-solar/baterias/bateria-de-litio-uf5000-48v-512kwh",
};
const now = () => new Date().toISOString();
export async function remote(url, type = "text") {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    headers: { Accept: type === "json" ? "application/json" : "*/*" },
  });
  if (!r.ok) throw Error("La fuente respondió " + r.status);
  const size = Number(r.headers.get("content-length"));
  if (size > 12000000) throw Error("Documento demasiado grande");
  if (type === "json") return r.json();
  if (type === "bytes") return new Uint8Array(await r.arrayBuffer());
  const bytes = await r.arrayBuffer();
  return new TextDecoder(
    new URL(url).hostname === "www.enre.gov.ar" ? "windows-1252" : "utf-8",
  ).decode(bytes);
}
export function arNumber(value) {
  return Number(value.replaceAll(".", "").replace(",", "."));
}
export function parseTariffPage(text) {
  const compact = text.replace(/\s+/g, " ");
  let rows = [];
  let previousMax = 0;
  for (let i = 1; i <= 7; i++) {
    const begin = compact.indexOf("T1-R" + i + "-");
    const end =
      i < 7
        ? compact.indexOf("T1-R" + (i + 1) + "-", begin + 1)
        : compact.length;
    if (begin < 0 || end < begin)
      throw Error("No se reconoce la tabla residencial");
    const line = compact.slice(begin, end);
    const money = "([\\d.]+,\\d+)";
    const get = (pattern) => {
      const m = line.match(new RegExp(pattern + money, "i"));
      if (!m) throw Error("Falta un importe de R" + i);
      const n = arNumber(m[1]);
      if (!Number.isFinite(n) || n <= 0 || n > 1e6)
        throw Error("Importe inválido");
      return n;
    };
    const fixed = get("Cargo fijo\\s*");
    const unsubsidized = get("SIN SUBSIDIO\\s*");
    const withBlock = line.match(/CON SUBSIDIO primeros\s+(\d+)\s*KWh/i);
    const subsidized = get(
      "CON SUBSIDIO" + (withBlock ? " primeros\\s+\\d+\\s*KWh" : "") + "\\s*",
    );
    const excess = withBlock
      ? get("CON SUBSIDIO excedente de\\s+\\d+\\s*KWh\\s*")
      : unsubsidized;
    const bound = line.match(/inferior o igual a\s+([\d.]+)\s*KWh/i);
    const max = i === 7 ? null : Number(bound?.[1]?.replaceAll(".", ""));
    const lower =
      i === 1
        ? 0
        : Number(
            line.match(/mayor a\s+([\d.]+)\s*KWh/i)?.[1]?.replaceAll(".", ""),
          );
    if (
      (max !== null && (!Number.isFinite(max) || max <= previousMax)) ||
      lower !== previousMax
    )
      throw Error("Bandas de consumo no reconocibles");
    previousMax = max;
    rows.push({
      category: "R" + i,
      maxKWh: max,
      fixedARS: fixed,
      unsubsidizedARS: unsubsidized,
      subsidizedARS: subsidized,
      subsidyLimitKWh: withBlock ? Number(withBlock[1]) : null,
      excessARS: excess,
    });
  }
  return rows;
}
export async function tariffFeed() {
  const html = await remote(SOURCES.epen);
  const matches = [...html.matchAll(/https?:[^\s"'<>]+\.pdf/gi)].map((v) =>
    v[0].replace(/&amp;/g, "&"),
  );
  const pdfURL = matches.find(
    (v) =>
      new URL(v).hostname === "www.epen.gov.ar" && /CT[-_]|consumos/i.test(v),
  );
  if (!pdfURL) throw Error("EPEN no ofrece un PDF reconocible");
  const bytes = await remote(pdfURL, "bytes");
  const pdf = await getDocumentProxy(bytes, {
    useSystemFonts: false,
    disableFontFace: true,
  });
  try {
    if (pdf.numPages < 2 || pdf.numPages > 40)
      throw Error("Documento inesperado");
    const page = await pdf.getPage(2);
    const items = await page.getTextContent();
    const text = items.items.map((v) => v.str).join(" ");
    const cover = await (await pdf.getPage(1)).getTextContent();
    const coverText = cover.items.map((v) => v.str).join(" ");
    const period =
      coverText.match(
        /PER[IÍ]ODO DE FACTURACI[OÓ]N\s+(.+?)\s*(?:SUBSIDIOS|TARIFA Nº|Los precios)/i,
      )?.[1] || coverText.match(/CONSUMOS\s+[A-ZÁÉÍÓÚ]+\s+20\d\d/i)?.[0];
    if (!period) throw Error("No se pudo verificar el período");
    return {
      provider: "EPEN",
      currency: "ARS",
      period: period.trim().slice(0, 160),
      sourceURL: pdfURL,
      indexURL: SOURCES.epen,
      checkedAt: now(),
      rows: parseTariffPage(text),
      notice:
        "Residencial convencional inferior a 10 kW. No incluye IVA, tributos ni bonificaciones especiales. No se aplica a otras distribuidoras. No se afirma que sea un cuadro de este mes: es el último enlazado por EPEN.",
    };
  } finally {
    await pdf.cleanup?.();
  }
}
export function parseProduct(html) {
  const value = html.match(
    /<meta\s+property=["']product:price:amount["']\s+content=["']([\d.]+)["']/i,
  );
  const currency = html.match(
    /<meta\s+property=["']product:price:currency["']\s+content=["']([^"']+)["']/i,
  )?.[1];
  const price = Number(value?.[1]);
  if (
    currency !== "ARS" ||
    !Number.isFinite(price) ||
    price < 10000 ||
    price > 100000000
  )
    throw Error("Precio público no verificable");
  return price;
}
export async function priceFeed() {
  const items = [
    {
      id: "panel",
      name: "Jinko Tiger Pro 550 Wp",
      powerW: 550,
      areaM2: 2.279 * 1.134,
      url: SOURCES.panel,
    },
    {
      id: "battery",
      name: "Pylontech UF5000 · 5,12 kWh",
      capacityKWh: 5.12,
      url: SOURCES.battery,
    },
  ];
  const settled = await Promise.allSettled(
    items.map(async (item) => ({
      ...item,
      priceARS: parseProduct(await remote(item.url)),
      currency: "ARS",
      supplier: "Alter Energy SAS · Neuquén",
      checkedAt: now(),
      terms:
        "Precio público de lista. No incluye envío ni instalación. Confirmar stock, impuestos aplicables y forma de pago con el proveedor.",
    })),
  );
  return {
    checkedAt: now(),
    items: settled.map((v, i) =>
      v.status === "fulfilled"
        ? v.value
        : { ...items[i], error: "No se pudo verificar el precio actual." },
    ),
  };
}
export async function exchangeFeed() {
  const j = await remote(SOURCES.fx, "json");
  if (
    j.casa !== "oficial" ||
    !Number.isFinite(j.venta) ||
    j.venta <= 0 ||
    j.venta > 1e7 ||
    Number.isNaN(Date.parse(j.fechaActualizacion))
  )
    throw Error("Cotización inválida");
  return {
    sellARS: j.venta,
    buyARS: j.compra,
    publishedAt: j.fechaActualizacion,
    checkedAt: now(),
    sourceURL:
      "https://dolarapi.com/docs/argentina/operations/get-dolar-oficial",
    provider: "DolarApi · datos de Ámbito Financiero",
    notice:
      "Venta oficial de referencia, no cotización garantizada para comprar equipos.",
  };
}

export { PROVIDERS } from "./providers.mjs";
import { PROVIDERS } from "./providers.mjs";
const strip = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
export function parseENRE(html, id) {
  const column = id === "edenor" ? 2 : 3;
  const period = strip(html).match(/Per[ií]odo\s+(\d{2})\/(\d{2})/i);
  if (!period || Number(period[1]) < 1 || Number(period[1]) > 12)
    throw Error("Período ENRE no verificable");
  const without = html
    .split(/Tarifa 1\s*-\s*R\s+sin subsidio/i)[1]
    ?.split(/Tarifa 1\s*-\s*R\s+con subsidio/i)[0];
  const withSubsidy = html
    .split(/Tarifa 1\s*-\s*R\s+con subsidio/i)[1]
    ?.split(/Tarifa 1\s*-\s*G/i)[0];
  if (!without || !withSubsidy) throw Error("Tabla ENRE incompleta");
  const tables = (part) =>
    [...part.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) =>
      [...m[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
        [...r[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
          strip(c[1]),
        ),
      ),
    );
  const a = tables(without),
    b = tables(withSubsidy);
  if (a.length !== 6 || b.length !== 6)
    throw Error("Categorías ENRE no reconocidas");
  const text = strip(withSubsidy);
  // Only apply documented seasonal bases; reject a changed rule rather than guessing.
  if (
    !/dic\/feb y mayo\/agosto: consumo base de 300 kWh\/mes/i.test(text) ||
    !/marzo\/abril y septiembre\/noviembre: consumo base de 150 kWh\/mes/i.test(
      text,
    )
  )
    throw Error("Bloques estacionales no reconocidos");
  let prior = 0;
  const numeric = (s) => {
    const n = Number(s?.replaceAll(",", ""));
    if (!Number.isFinite(n) || n <= 0 || n > 1e6)
      throw Error("Importe ENRE inválido");
    return n;
  };
  const rows = a.map((table, i) => {
    const sub = b[i];
    if (
      table[0]?.[0] !== "R" + (i + 1) ||
      sub[0]?.[0] !== table[0][0] ||
      table[0][2] !== "EDENOR" ||
      table[0][3] !== "EDESUR"
    )
      throw Error("Columnas ENRE inválidas");
    const fixed = table.find((r) => /^Cargo Fijo/.test(r[0]));
    const rate = table.find((r) => /^Cargo Variable/.test(r[0]));
    const band = fixed?.[0].match(/(\d+)-(\d+)|\+\s*(\d+)/);
    const max = i === 5 ? null : Number(band?.[2]);
    const low = Number(i === 5 ? band?.[3] : band?.[1]);
    if (
      low !== (i === 0 ? 0 : i === 5 ? prior : prior + 1) ||
      (max !== null && max <= prior)
    )
      throw Error("Bandas ENRE inválidas");
    prior = max;
    const base = sub.find(
      (r) => /^Cargo Variable/.test(r[0]) && !/excedente/i.test(r[0]),
    );
    const excess = sub.find((r) => /Cargo Variable excedente/i.test(r[0]));
    if (i > 0 && !excess) throw Error("Falta bloque excedente");
    return {
      category: "R" + (i + 1),
      maxKWh: max,
      fixedARS: numeric(fixed?.[column]),
      unsubsidizedARS: numeric(rate?.[column]),
      subsidizedARS: numeric(base?.[column]),
      excessARS: excess ? numeric(excess[column]) : numeric(rate?.[column]),
      subsidyLimitKWh: 150,
      subsidyLimitsByMonth: [
        300, 300, 150, 150, 300, 300, 300, 300, 150, 150, 150, 300,
      ],
    };
  });
  return { period: period[1] + "/20" + period[2], rows };
}
export async function regionalTariffFeed(id) {
  const p = PROVIDERS.find((p) => p.id === id);
  if (!p) throw Error("Distribuidora desconocida");
  if (id === "epen")
    return { ...(await tariffFeed()), providerId: id, automatic: true };
  if (id === "edenor" || id === "edesur") {
    const index = await remote(p.sourceURL);
    const links = [
      ...index.matchAll(
        /href="([^"]+)"[^>]*>Cuadro Tarifario del (\d{2})-(20\d{2})/gi,
      ),
    ]
      .map((m) => ({
        url: new URL(m[1].replaceAll("\\", "/"), p.sourceURL).href,
        order: Number(m[3] + m[2]),
      }))
      .sort((a, b) => b.order - a.order);
    const u = links[0]?.url;
    if (!u || new URL(u).hostname !== "www.enre.gov.ar")
      throw Error("Sin cuadro oficial enlazado");
    const values = parseENRE(await remote(u), id);
    return {
      provider: p.name,
      providerId: id,
      automatic: true,
      currency: "ARS",
      ...values,
      sourceURL: u,
      indexURL: p.sourceURL,
      checkedAt: now(),
      notice:
        "ENRE: residencial T1-R. Antes de impuestos y bonificaciones especiales. Bloques subsidiados estacionales publicados: 300 o 150 kWh/mes. Se mantienen los precios del cuadro consultado para el escenario anual; no se predicen tarifas futuras.",
    };
  }
  const html = await remote(p.sourceURL);
  let period = null,
    sourceURL = p.sourceURL;
  if (id === "edersa") {
    period =
      strip(html).match(
        /Cuadro Tarifario Vigente:\s*([a-záéíóú]+\s+20\d\d)/i,
      )?.[1] || null;
    const iframe = html.match(/<iframe[^>]+src=["']([^"']+\.pdf[^"']*)/i)?.[1];
    if (iframe) {
      const u = new URL(iframe, p.sourceURL);
      if (u.hostname === "www.edersa.com.ar") sourceURL = u.href;
    }
  }
  return {
    provider: p.name,
    providerId: id,
    automatic: false,
    period,
    sourceURL,
    indexURL: p.sourceURL,
    checkedAt: now(),
    notice:
      "Fuente oficial consultada. La app todavía no interpreta automáticamente este cuadro. Copiá el cargo variable de tu categoría desde la factura; no aplica valores de otra empresa.",
  };
}
