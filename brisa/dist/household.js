"use strict";
// A separate household journey; the technical forms and v2 storage stay intact.
let householdStep = 0,
  householdDetailed = false,
  feeds = { tariffs: null, prices: null, exchange: null },
  feedErrors = {},
  feedsLoading = false,
  technicalProvider = "unknown",
  feedRequest = 0;
const technicalWizard = wizard,
  technicalResults = results,
  originalRender = render;
function newHousehold() {
  d = defaults();
  d.role = "home";
  d.title = "Mi casa · posibilidad solar";
  d.hogar = {
    purpose: "saving",
    placement: "roof",
    wantBattery: "no",
    occupancy: "all",
    selectedLocation: false,
    province: "",
    countryCode: "",
    locality: "",
    energyInput: "bill",
    billKWh: "",
    billDays: 30,
    billTariffARS: "",
    provider: "unknown",
    subsidy: "unknown",
    space: "unknown",
    shadows: "unknown",
    backupHours: 6,
    selectedAppliances: ["fridge", "lights", "router"],
    customAppliances: [],
    quoteARS: "",
    budgetKnown: false,
    priceEvidence: [],
    tariffEvidence: null,
    fxEvidence: null,
  };
  householdStep = 0;
  householdDetailed = false;
  step = 0;
  result = null;
  go("simulate");
  void refreshFeeds();
}
function hg() {
  if (!d.hogar)
    d.hogar = {
      purpose: d.connection === "offgrid" ? "offgrid" : "saving",
      placement: "roof",
      wantBattery: "no",
      occupancy: "all",
      selectedLocation: !!d.location,
      province: "",
      countryCode: "",
      locality: "",
      energyInput: "bill",
      billKWh: "",
      billDays: 30,
      billTariffARS: "",
      provider: "unknown",
      subsidy: "unknown",
      space: "unknown",
      shadows: "unknown",
      backupHours: 6,
      selectedAppliances: ["fridge", "lights", "router"],
      customAppliances: [],
      quoteARS: "",
      budgetKnown: false,
      priceEvidence: [],
      tariffEvidence: null,
      fxEvidence: null,
    };
  return d.hogar;
}
function dateLabel(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "Sin fecha"
    : dt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}
function safeSource(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? esc(u.href) : "#";
  } catch {
    return "#";
  }
}
const ars = (v) => "$ " + fmt(v, 0) + " ARS";
const HOME_STEPS = [
  "Tu objetivo",
  "Tu casa",
  "Tu consumo",
  "El espacio",
  "El respaldo",
  "Tu propuesta",
];
const HOME_APPLIANCES = [
  {
    id: "fridge",
    name: "Heladera",
    icon: "❄",
    watts: 60,
    hours: 24,
    note: "60 W medios de ciclo: ejemplo. Preferí los kWh/día de la etiqueta.",
  },
  {
    id: "lights",
    name: "Luces",
    icon: "☀",
    watts: 60,
    hours: 5,
    note: "Ejemplo: seis lámparas de 10 W.",
  },
  {
    id: "router",
    name: "Internet",
    icon: "◎",
    watts: 12,
    hours: 24,
    note: "Ejemplo de router: verificá tu equipo.",
  },
  {
    id: "tv",
    name: "Televisor",
    icon: "▣",
    watts: 80,
    hours: 4,
    note: "Potencia y horas ilustrativas.",
  },
  {
    id: "pump",
    name: "Bomba de agua",
    icon: "≈",
    watts: 750,
    hours: 1,
    note: "El arranque necesita evaluación del instalador.",
  },
];
function homeChoice(key, value, title, description, icon = "") {
  return `<button type="button" class="home-choice ${String(hg()[key]) === String(value) ? "selected" : ""}" data-hg-select="${key}" data-hg-value="${esc(value)}" aria-pressed="${String(hg()[key]) === String(value)}"><span class="home-choice-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><span>${description}</span></button>`;
}
function homeInput(
  key,
  label,
  { type = "number", hint = "", min = 0, max = 1e8, required = false } = {},
) {
  return `<div class="field"><label for="hg-${key}">${label}</label><input id="hg-${key}" data-hg="${key}" type="${type}" value="${esc(hg()[key] ?? "")}" ${type === "number" ? `min="${min}" max="${max}" step="any"` : ""} ${required ? "required" : ""}>${hint ? `<small>${hint}</small>` : ""}</div>`;
}
function householdWizard() {
  let h = hg(),
    body = "",
    title = "",
    intro = "";
  if (householdStep === 0) {
    title = "¿Qué te gustaría resolver?";
    intro = "Elegí lo que más te importa. No necesitás conocer los equipos.";
    body = `<div class="home-choice-grid">${homeChoice("purpose", "saving", "Gastar menos en electricidad", "Aprovechar el sol para comprar menos energía.", "☀")}${homeChoice("purpose", "backup", "Tener un respaldo", "Explorar una reserva para los aparatos importantes.", "ϟ")}${homeChoice("purpose", "offgrid", "Una casa sin electricidad de red", "Explorar cómo abastecer una vivienda aislada.", "⌂")}</div>`;
  }
  if (householdStep === 1) {
    title = "¿Dónde está tu casa?";
    intro = "El sol disponible cambia según el lugar. Busquemos el tuyo.";
    body = `<div class="home-search"><div class="field"><label for="hg-location">Localidad</label><input id="hg-location" type="text" value="${esc(d.location)}" autocomplete="off" placeholder="Por ejemplo, San Martín de los Andes"></div><button type="button" class="btn" data-hg-action="search" ${busy ? "disabled" : ""}>${busy ? "Buscando…" : "Buscar"}</button></div><div class="locationresults">${geoResults.map((g, i) => `<button type="button" class="btn quiet" data-hg-geo="${i}">${esc(g.name)} · ${esc(g.admin1 || g.country)}</button>`).join("")}</div>${h.selectedLocation ? `<p class="notice">Lugar elegido: <strong>${esc(d.location)}</strong>.</p>` : ""}<details class="home-details"><summary>Mi casa está lejos del centro de la localidad</summary><p>Podés indicar un punto más preciso. No hace falta escribir una dirección.</p><div class="formgrid">${f("lat", "Latitud", { min: -60, max: 60 })}${f("lon", "Longitud", { min: -180, max: 180 })}</div><button type="button" class="btn quiet" data-hg-action="coordinates">Usar estas coordenadas</button></details><h2>¿Cuándo la usás?</h2><div class="home-choice-grid compact">${homeChoice("occupancy", "all", "Todo el año", "Vivo acá habitualmente.")}${homeChoice("occupancy", "weekends", "Fines de semana", "Unos 8 días por mes.")}${homeChoice("occupancy", "season", "En algunos meses", "Voy a elegir la temporada.")}</div>${h.occupancy === "season" ? `<div class="monthselect spaced">${M.map((m, i) => `<label class="choice"><input type="checkbox" data-month="${i}" ${d.months[i] ? "checked" : ""}>${m}</label>`).join("")}</div>` : ""}<p class="home-inline-help">Al continuar consultamos la climatología de NASA POWER con estas coordenadas. Son promedios históricos modelados, no el pronóstico de hoy ni una medición de tu techo.</p>`;
  }
  if (householdStep === 2) {
    title = "¿Tenés una factura a mano?";
    intro =
      "Nos interesa la cantidad de energía, no el total de dinero que pagaste.";
    body = `<div class="home-choice-grid compact">${homeChoice("energyInput", "bill", "Sí, tengo una factura", "Voy a buscar el consumo.")}${homeChoice("energyInput", "appliances", "No la tengo", "Voy a elegir mis aparatos.")}</div>${h.energyInput === "bill" ? `<div class="invoice-guide"><span>Buscá una línea como esta en tu factura</span><strong>Consumo de energía: <b>___ kWh</b></strong><small>Esos son los números que necesitamos. No cargues el importe total.</small></div><div class="formgrid spaced">${homeInput("billKWh", "¿Cuántos kWh dice?", { required: true, max: 100000 })}${homeInput("billDays", "¿Cuántos días abarca?", { required: true, min: 1, max: 120, hint: "Si es mensual, unos 30; bimestral, unos 60. Usá los días impresos." })}</div><p class="home-inline-help">Para estimar el año extendemos este promedio a los otros meses. Si usás calefacción eléctrica o aire acondicionado, el consumo puede cambiar mucho.</p>` : householdAppliances(false)}<details class="home-details" ${h.provider !== "unknown" ? "open" : ""}><summary>También quiero consultar el costo de mi electricidad</summary><p>Es opcional. Sin este dato podemos explorar energía, pero no calcular dinero evitado.</p>${providerControls()}</details>`;
  }
  if (householdStep === 3) {
    title = "¿Dónde podrías poner los paneles?";
    intro =
      "No hace falta medir con precisión ahora. Lo que no sepas quedará pendiente.";
    body = `<div class="home-choice-grid compact">${homeChoice("placement", "roof", "En el techo", "Espacio libre, sin obstáculos.")}${homeChoice("placement", "ground", "En el patio o terreno", "También hay que separar las filas.")}</div><h2>¿Cuánto espacio libre tenés?</h2><div class="home-choice-grid compact">${["10", "20", "40", "80"].map((v) => homeChoice("space", v, v + " m²", "Aproximadamente.")).join("")}${homeChoice("space", "unknown", "No lo sé", "Te diremos cuánto espacio necesitaría la propuesta.")}</div><h2>¿Le da sombra durante el día?</h2><div class="home-choice-grid compact">${homeChoice("shadows", "none", "No veo sombras", "Espacio despejado.")}${homeChoice("shadows", "some", "En algunos momentos", "Árboles, paredes u otros obstáculos.")}${homeChoice("shadows", "many", "Gran parte del día", "Puede reducir mucho la generación.")}${homeChoice("shadows", "unknown", "No estoy seguro", "Queda marcado para revisar.")}</div><p class="home-inline-help">Las sombras necesitan una visita al lugar. Estas opciones orientan el cálculo; no son una medición.</p>`;
  }
  if (householdStep === 4) {
    title =
      h.purpose === "saving"
        ? "¿También te interesa guardar energía?"
        : "¿Qué necesitás mantener funcionando?";
    intro =
      h.purpose === "saving"
        ? "Las baterías permiten usar después parte de la energía del día. Agregarlas tiene un costo."
        : "Elegí los aparatos importantes. La propuesta de reserva no garantiza superar cualquier corte.";
    body =
      h.purpose === "saving"
        ? `<div class="home-choice-grid compact">${homeChoice("wantBattery", "no", "Por ahora, sin baterías", "Usar la energía cuando se produce.")}${homeChoice("wantBattery", "yes", "Explorar con baterías", "Guardar una parte para después.")}</div>`
        : "";
    if (h.purpose !== "saving" || h.wantBattery === "yes") {
      body +=
        householdAppliances(true) +
        `<h2>¿Por cuánto tiempo querés una reserva?</h2><div class="home-choice-grid compact">${[4, 6, 12, 24].map((v) => homeChoice("backupHours", v, v + " horas", "Para los aparatos elegidos.")).join("")}</div><p class="home-inline-help">Usamos el consumo diario elegido para aproximar esa reserva. La potencia del banco, los arranques y el inversor deben verificarse; los cortes de red no se simulan como eventos.</p>`;
    }
    if (h.purpose === "offgrid")
      body +=
        '<p class="notice warn">Una casa sin red necesita estudiar días nublados y un posible respaldo adicional. La eólica requiere mediciones del lugar: se revisa en modo técnico.</p>';
  }
  if (householdStep === 5) {
    title = "Tu propuesta, con los datos a la vista.";
    intro = "Revisá lo que sabemos y lo que todavía hay que confirmar.";
    body = `<div class="home-review-grid"><section><span class="eyebrow">Tu casa</span><h3>${esc(d.location || "Lugar pendiente")}</h3><p>${h.purpose === "offgrid" ? "Sin red eléctrica" : "Con red eléctrica"} · ${h.occupancy === "all" ? "Uso habitual" : h.occupancy === "weekends" ? "Fines de semana" : "Temporadas"}</p><p>${h.energyInput === "bill" ? esc(h.billKWh) + " kWh en " + esc(h.billDays) + " días" : "Consumo calculado desde los aparatos elegidos"}</p></section><section><span class="eyebrow">El recurso</span><h3>${d.resourceMode === "nasa" ? "Datos de NASA POWER" : "Falta confirmar el clima"}</h3><p>${d.resourceMode === "nasa" ? "Consulta: " + esc(d.resource?.date || "") : "No vamos a usar el clima de ejemplo para representar tu casa."}</p><button type="button" class="btn quiet" data-hg-action="climate" ${busy ? "disabled" : ""}>${busy ? "Consultando…" : "Volver a consultar el clima"}</button></section></div>${pricesCard()}<details class="home-details"><summary>Tengo un presupuesto completo de instalación</summary><p>Opcional. Incluí equipos, montaje y demás conceptos. Los precios de paneles y baterías consultados por separado no son un presupuesto completo.</p>${homeInput("quoteARS", "Total del presupuesto · pesos", { max: 1e10 })}</details><p class="notice">${d.visualPlan?.applied ? "Usaremos los paneles y la orientación que aplicaste en el croquis," : "Usaremos una orientación hacia el ecuador,"} pérdidas globales del 20% y los supuestos de sombra elegidos. Son hipótesis revisables; podés abrirlas en modo técnico.</p>`;
  }
  return `<section class="household-shell"><div class="home-mode-heading"><span class="badge">Modo hogar</span><button type="button" class="btn quiet small" data-hg-action="switch-tech">Abrir modo técnico</button></div><div class="home-progress"><span>Paso ${householdStep + 1} de 6 · ${HOME_STEPS[householdStep]}</span><div class="progress-track" role="progressbar" aria-label="Recorrido hogar" aria-valuemin="1" aria-valuemax="6" aria-valuenow="${householdStep + 1}"><span style="width:${((householdStep + 1) / 6) * 100}%"></span></div></div><h1>${title}</h1><p class="home-intro">${intro}</p><form id="household-form">${body}<p id="home-error" role="alert" class="error"></p><div class="home-footer"><button type="button" class="btn secondary" data-hg-action="back">${householdStep ? "Volver" : "Ir al inicio"}</button><button type="submit" class="btn" ${busy ? "disabled" : ""}>${busy ? "Consultando…" : householdStep === 5 ? "Ver mi propuesta" : "Continuar"}</button></div></form></section>`;
}
function householdAppliances(backup) {
  let h = hg();
  const selections = backup
    ? h.selectedAppliances
    : h.consumptionAppliances || ["fridge", "lights", "router"];
  return `<div class="appliance-card-grid">${HOME_APPLIANCES.map((a) => `<label class="appliance-card ${selections.includes(a.id) ? "selected" : ""}"><input type="checkbox" data-hg-appliance="${a.id}" data-hg-backup="${backup}" ${selections.includes(a.id) ? "checked" : ""}><span aria-hidden="true">${a.icon}</span><strong>${a.name}</strong></label>`).join("")}</div><details class="home-details"><summary>Revisar potencia y tiempo de uso de mis aparatos</summary><p>Estos valores son ejemplos, no datos de tu casa. Cambialos usando la etiqueta o una medición. Para heladeras, la potencia media de ciclo es distinta de la máxima.</p>${HOME_APPLIANCES.filter(
    (a) => selections.includes(a.id),
  )
    .map((a) => {
      const value = h.applianceValues?.[a.id] || a;
      return `<div class="home-appliance-row"><strong>${a.name}</strong><label>Potencia media · W<input type="number" data-hg-watts="${a.id}" min="0" max="100000" step="any" value="${value.watts}"></label><label>Uso · horas/día<input type="number" data-hg-hours="${a.id}" min="0" max="24" step="any" value="${value.hours}"></label><small>${a.note}</small></div>`;
    })
    .join(
      "",
    )}<p class="home-inline-help">Si necesitás sumar calefacción, cocina u otros consumos importantes, agregalos abajo o completá la lista en modo técnico.</p><button type="button" class="btn quiet" data-hg-action="add-custom">Agregar otro aparato</button>${(h.customAppliances || []).map((a, i) => `<div class="home-appliance-row"><label>Nombre<input data-hg-custom="${i}" data-hg-prop="name" type="text" value="${esc(a.name)}" maxlength="80"></label><label>Potencia media · W<input data-hg-custom="${i}" data-hg-prop="watts" type="number" min="0" max="100000" value="${a.watts}"></label><label>Horas/día<input data-hg-custom="${i}" data-hg-prop="hours" type="number" min="0" max="24" step="any" value="${a.hours}"></label></div>`).join("")}</details>`;
}
function selectedProvider() {
  return d.hogar?.provider || technicalProvider;
}
function providerOptions() {
  const h = d.hogar;
  const normalize = (v) =>
    (v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  if (h?.countryCode && h.countryCode !== "AR") return [];
  const region = normalize(h?.province);
  return region
    ? ELECTRICITY_PROVIDERS.filter((p) =>
        p.regions.some((r) => region.includes(r)),
      )
    : ELECTRICITY_PROVIDERS;
}
function providerControls() {
  const h = hg(),
    options = providerOptions(),
    p = ELECTRICITY_PROVIDERS.find((p) => p.id === h.provider);
  return `<p><strong>¿Qué empresa aparece en tu factura?</strong></p><p class="notice">Si tu empresa o cooperativa no aparece, elegí “Otra empresa” y cargá el cargo variable de tu factura. <strong>No usamos un promedio nacional ni el precio de otra distribuidora.</strong> Sin ese valor, el costo queda pendiente.</p><p class="home-inline-help">${h.countryCode && h.countryCode !== "AR" ? "Todavía no tenemos un lector tarifario para este país. Usá tu factura." : h.province ? "Opciones orientativas para " + esc(h.province) + ". La provincia no determina tu empresa: pueden existir cooperativas u otras distribuidoras." : "Confirmá la empresa en tu factura. Con coordenadas solas no asignamos una distribuidora."}</p><div class="home-choice-grid compact">${options
    .slice(0, 6)
    .map((p) =>
      homeChoice(
        "provider",
        p.id,
        p.name,
        p.automatic
          ? "Lectura automática del cuadro oficial."
          : "Fuente oficial; cargás el valor de tu factura.",
      ),
    )
    .join(
      "",
    )}${homeChoice("provider", "manual", "Otra empresa / cooperativa", "Usar el cargo variable de mi factura.")}${homeChoice("provider", "unknown", "No lo sé todavía", "Dejar el costo pendiente.")}</div>${p?.automatic ? `<p>¿Tu factura indica subsidio a la energía?</p><div class="home-choice-grid compact">${homeChoice("subsidy", "yes", "Sí", "Con subsidio.")}${homeChoice("subsidy", "no", "No", "Sin subsidio.")}${homeChoice("subsidy", "unknown", "No lo sé", "Dejar la tarifa pendiente.")}</div><p class="home-inline-help">Solo tarifa residencial convencional. Confirmá empresa y subsidio en tu factura. Tarifa social, electrodependientes y bonificaciones especiales requieren revisión.</p>` : ""}${options.length > 6 ? sourceProviderSelect() : ""}${p ? tariffCard() : ""}${h.provider === "manual" || (p && !p.automatic) ? `<label>Empresa / cooperativa de la factura<input type="text" data-hg="manualProvider" value="${esc(h.manualProvider || p?.name || "")}" placeholder="Nombre de tu distribuidora" maxlength="100"></label>` + homeInput("billTariffARS", "Precio de la energía · pesos por kWh", { hint: "Copiá el cargo variable de tu categoría, sin cargo fijo ni impuestos. No dividas el total de la factura por los kWh.", max: 100000 }) : ""}`;
}
function tariffCard() {
  const id = selectedProvider(),
    p = ELECTRICITY_PROVIDERS.find((p) => p.id === id),
    t = feeds.tariffs;
  if (!p)
    return '<p class="notice">Elegí tu distribuidora para consultar su fuente. No hay un precio único del kWh para todo el país.</p>';
  if (!t || t.providerId !== id)
    return `<section class="source-card"><h3>${esc(p.name)}</h3><p>${esc(feedErrors.tariffs || "Fuente pendiente de consulta.")}</p><a href="${safeSource(p.sourceURL)}" target="_blank" rel="noopener">Abrir fuente oficial</a><button type="button" class="btn quiet" data-hg-action="refresh">Consultar</button></section>`;
  const h = d.hogar,
    load = h?.billKWh ? (Number(h.billKWh) * 30) / Number(h.billDays) : 0,
    row = t.rows?.find((v) => v.maxKWh === null || load <= v.maxKWh);
  return `<section class="source-card"><span class="badge">Fuente oficial · ${esc(t.provider)}</span><h3>${esc(t.period || "Período no verificado automáticamente")}</h3>${t.automatic && h?.subsidy !== "unknown" && row ? `<p>${row.category} · ${ars(h?.subsidy === "yes" ? row.subsidizedARS : row.unsubsidizedARS)} por kWh${h?.subsidy === "yes" && row.subsidyLimitKWh ? " · bloque subsidiado de " + (row.subsidyLimitsByMonth ? "150 o 300 kWh según el mes" : row.subsidyLimitKWh + " kWh") + "; excedente " + ars(row.excessARS) + " por kWh" : ""}.</p>` : ""}<p>${esc(t.notice)}</p><small>Consulta: ${dateLabel(t.checkedAt)}. La fecha de consulta no es la vigencia de la tarifa.</small><a href="${safeSource(t.sourceURL)}" target="_blank" rel="noopener">Abrir publicación oficial</a></section>`;
}
function pricesCard() {
  const p = feeds.prices;
  return `<section class="source-card"><span class="eyebrow">Precios publicados, no inventados</span><h2>Referencias de equipos</h2>${p?.items?.map((v) => `<div class="source-product"><strong>${esc(v.name)}</strong><span>${Number.isFinite(v.priceARS) ? ars(v.priceARS) : "Precio no disponible"}</span><small>${esc(v.supplier || "Alter Energy SAS")} · ${dateLabel(v.checkedAt || p.checkedAt)}</small><a href="${safeSource(v.url)}" target="_blank" rel="noopener">Ver publicación</a></div>`).join("") || `<p>${esc(feedErrors.prices || "Consultando precios del proveedor…")}</p>`}<p class="home-inline-help">Son precios de lista de un proveedor, no un promedio de mercado. Confirmá stock, envío e impuestos. Faltan otros equipos y montaje para obtener una inversión completa.</p><button type="button" class="btn quiet" data-hg-action="refresh" ${feedsLoading ? "disabled" : ""}>${feedsLoading ? "Consultando…" : "Actualizar referencias"}</button></section>`;
}
function officialEnergyCost(kwh, referenceKWh, x, month = 0) {
  const t = x.tariffDefinition;
  if (!t || x.exchange <= 0) return kwh * x.tariff;
  const row = t.rows.find((v) => v.maxKWh === null || referenceKWh <= v.maxKWh);
  if (!row) return kwh * x.tariff;
  const n = Math.max(0, kwh),
    limit = row.subsidyLimitsByMonth?.[month] ?? row.subsidyLimitKWh;
  const cost = t.subsidized
    ? limit === null
      ? n * row.subsidizedARS
      : Math.min(n, limit) * row.subsidizedARS +
        Math.max(0, n - limit) * row.excessARS
    : n * row.unsubsidizedARS;
  return cost / x.exchange;
}
async function refreshFeeds() {
  const request = ++feedRequest,
    provider = selectedProvider();
  feedsLoading = true;
  const names = ["prices", "exchange"];
  if (ELECTRICITY_PROVIDERS.some((p) => p.id === provider))
    names.push("tariffs");
  else feeds.tariffs = null;
  await Promise.all(
    names.map(async (name) => {
      try {
        const value = await getJSON(
          "/api/" +
            name +
            (name === "tariffs"
              ? "?provider=" + encodeURIComponent(provider)
              : ""),
        );
        if (value.error) throw Error(value.error);
        if (
          name === "tariffs" &&
          (value.providerId !== provider ||
            (value.automatic &&
              (!Array.isArray(value.rows) || !value.rows.length)))
        )
          throw Error("Fuente de otra empresa o tabla incompleta");
        if (request !== feedRequest) return;
        feeds[name] = value;
        delete feedErrors[name];
      } catch {
        if (request !== feedRequest) return;
        feeds[name] = null;
        feedErrors[name] =
          "No se pudo verificar la fuente actual. Podés consultar el enlace oficial o cargar tu factura.";
      }
    }),
  );
  if (request !== feedRequest) return;
  feedsLoading = false;
  if (route() === "data" || route() === "simulate") render();
}
function selectedLoads(backup) {
  const h = hg(),
    ids = backup
      ? h.selectedAppliances
      : h.consumptionAppliances || ["fridge", "lights", "router"];
  return [
    ...HOME_APPLIANCES.filter((a) => ids.includes(a.id)).map((a) => ({
      name: a.name,
      watts: h.applianceValues?.[a.id]?.watts ?? a.watts,
      hours: h.applianceValues?.[a.id]?.hours ?? a.hours,
      qty: 1,
    })),
    ...(h.customAppliances || []).map((a) => ({ ...a, qty: 1 })),
  ];
}
function prepareHousehold() {
  const h = hg();
  d.connection = h.purpose === "offgrid" ? "offgrid" : "grid";
  d.goal = h.occupancy === "season" ? "season" : "saving";
  d.days = h.occupancy === "weekends" ? 8 : 30;
  d.technology = "solar";
  d.sizing = "recommend";
  d.placement = h.placement || "roof";
  d.area = h.space === "unknown" ? 100000 : Number(h.space);
  d.shadeChoice = h.shadows;
  d.ideal = true;
  d.appliances = selectedLoads(false);
  if (h.energyInput === "bill") {
    d.energyMode = "bill";
    d.monthly = (Number(h.billKWh) * 30) / Number(h.billDays);
    d.monthlyCustom = true;
    d.monthlyValues = DAYS.map(
      (v) => (Number(h.billKWh) / Number(h.billDays)) * v,
    );
    delete d.unknown.monthly;
  } else {
    d.energyMode = "appliances";
    d.monthlyCustom = false;
    d.monthly = applianceDaily(d) * 30;
    d.unknown.monthly = true;
  }
  d.battery =
    h.purpose === "saving" && h.wantBattery !== "yes" ? "none" : "recommend";
  d.generator = false;
  d.autonomy = Math.max(0.1, Number(h.backupHours) / 24);
  const essentialDaily = sum(
    selectedLoads(true).map((a) => (a.watts * a.hours) / 1000),
  );
  const totalDaily =
    h.energyInput === "bill" ? d.monthly / 30 : applianceDaily(d);
  d.essential = clamp(
    totalDaily > 0 ? (essentialDaily / totalDaily) * 100 : 100,
    1,
    100,
  );
  h.essentialDailyKWh = essentialDaily;
  h.reserveOnly = essentialDaily > totalDaily;
  d.peak = 3;
  d.inverter = 3;
  d.batteryPower = 3;
  d.unknown.peak = true;
  d.unknown.inverter = true;
  d.unknown.batteryPower = true;
  d.costInverter = 0;
  d.costStructure = 0;
  d.costProtection = 0;
  d.costCable = 0;
  d.costController = 0;
  d.costLabor = 0;
  d.costTransport = 0;
  d.costPermits = 0;
  d.costGen = 0;
  d.panelPrice = 0;
  d.batteryUnitPrice = 0;
  d.exchange = 0;
  d.tariff = 0;
  d.fixed = 0;
  d.tariffDefinition = null;
  h.priceEvidence = [];
  h.tariffEvidence = null;
  h.fxEvidence = null;
  const fx = feeds.exchange;
  if (
    fx?.sellARS > 0 &&
    Date.now() - Date.parse(fx.publishedAt) < 7 * 86400000
  ) {
    d.exchange = fx.sellARS;
    d.exchangeDate = fx.publishedAt.slice(0, 10);
    h.fxEvidence = clone(fx);
  }
  const products = feeds.prices?.items || [];
  for (const v of products) {
    if (
      !Number.isFinite(v.priceARS) ||
      Date.now() - Date.parse(v.checkedAt) > 7 * 86400000
    )
      continue;
    h.priceEvidence.push(clone(v));
    if (v.id === "panel") {
      d.panelPower = v.powerW;
      d.panelArea = v.areaM2;
      if (d.exchange) d.panelPrice = v.priceARS / d.exchange;
    }
    if (v.id === "battery") {
      d.batteryUnit = v.capacityKWh;
      if (d.exchange) d.batteryUnitPrice = v.priceARS / d.exchange;
    }
  }
  if (
    (h.provider === "manual" ||
      ELECTRICITY_PROVIDERS.some((p) => p.id === h.provider && !p.automatic)) &&
    Number(h.billTariffARS) > 0
  ) {
    h.tariffEvidence = {
      type: "invoice",
      provider:
        ELECTRICITY_PROVIDERS.find((p) => p.id === h.provider)?.name ||
        h.manualProvider ||
        "Factura ingresada",
      sourceURL: ELECTRICITY_PROVIDERS.find((p) => p.id === h.provider)
        ?.sourceURL,
      valueARS: Number(h.billTariffARS),
      date: new Date().toISOString().slice(0, 10),
    };
    if (d.exchange) d.tariff = Number(h.billTariffARS) / d.exchange;
  } else if (
    ELECTRICITY_PROVIDERS.some((p) => p.id === h.provider && p.automatic) &&
    h.subsidy !== "unknown" &&
    feeds.tariffs?.providerId === h.provider &&
    feeds.tariffs.automatic &&
    Date.now() - Date.parse(feeds.tariffs.checkedAt) < 7 * 86400000 &&
    d.exchange
  ) {
    d.tariffDefinition = {
      ...clone(feeds.tariffs),
      subsidized: h.subsidy === "yes",
    };
    h.tariffEvidence = { type: "official", ...clone(feeds.tariffs) };
  }
  if (d.visualPlan?.applied && typeof applyVisualInputs === "function")
    applyVisualInputs(d);
  h.budgetKnown = false;
  d.quotedRemainder = 0;
  const quote = Number(h.quoteARS);
  if (quote > 0 && d.exchange) {
    const config = setup(d),
      known =
        (config.panels * d.panelPrice + config.bankUnits * d.batteryUnitPrice) *
        d.exchange;
    if (quote < known)
      throw Error(
        "El presupuesto total es menor que los componentes consultados. Revisá los importes o quitá ese presupuesto.",
      );
    d.quotedRemainder = (quote - known) / d.exchange;
    h.budgetKnown = true;
  }
  d.title =
    "Mi casa · " +
    {
      saving: "energía solar",
      backup: "reserva con baterías",
      offgrid: "sin red",
    }[h.purpose];
  return d;
}
function householdResults() {
  const r = result;
  if (!r)
    return `<section class="household-shell"><span class="badge">Modo hogar</span><h1>Falta confirmar el recurso de tu lugar.</h1><p>No usamos el clima de ejemplo para calcular tu casa. Podés reintentar o cargar datos documentados en modo técnico.</p><button class="btn" data-hg-action="retry-result">Volver a consultar</button><button class="btn secondary" data-hg-action="edit-home">Revisar mis datos</button></section>`;
  const { x, s, a } = r,
    h = x.hogar,
    coverage = a.demand > 0 ? clamp((a.used / a.demand) * 100, 0, 100) : 0,
    knownEnergy = !!h.tariffEvidence && x.exchange > 0;
  const prices = h.priceEvidence || [];
  const panel = prices.find((v) => v.id === "panel"),
    battery = prices.find((v) => v.id === "battery");
  let subtotal =
    (panel ? s.panels * panel.priceARS : 0) +
    (battery ? s.bankUnits * battery.priceARS : 0);
  const energyAvoided =
    x.connection === "grid" && knownEnergy
      ? (sum(
          r.base.rows.map((v, i) =>
            officialEnergyCost(v.gridEnergy, v.energy, x, i),
          ),
        ) -
          sum(
            a.rows.map((v, i) =>
              officialEnergyCost(v.gridEnergy, v.energy, x, i),
            ),
          )) *
        x.exchange
      : null;
  return `<section class="household-shell"><div class="home-mode-heading"><span class="badge">Tu propuesta · modo hogar</span><button class="btn quiet small" data-hg-action="technical-result">Ver detalles técnicos</button></div><h1>${h.purpose === "offgrid" ? "Un primer escenario para tu casa aislada." : "Esto podría aportar el sol a tu casa."}</h1><p class="home-intro">${esc(x.location)}. Es una primera aproximación con climatología de NASA POWER y las entradas que elegiste.</p><div class="home-result-metrics"><article><span>Consumo abastecido con renovables</span><strong>${fmt(coverage)}%</strong><small>Estimación anual. El resto usa red o queda sin cubrir, según tu conexión.</small></article><article><span>Paneles considerados</span><strong>${s.panels}</strong><small>${fmt(s.panels * x.panelArea, 1)} m² de módulos${x.placement === "ground" ? ", más separación y accesos" : ""}.</small></article><article><span>${energyAvoided !== null ? "Energía comprada que podrías evitar" : "Costo de electricidad"}</span><strong>${energyAvoided !== null ? ars(Math.max(0, energyAvoided) / 12) : "Pendiente"}</strong><small>${energyAvoided !== null ? "Promedio mensual en pesos de referencia. No es ahorro neto: faltan mantenimiento, impuestos y cambios futuros." : "Hace falta una tarifa documentada y una cotización para calcular dinero."}</small></article></div><section class="card spaced"><h2>La energía, mes a mes</h2><p>Verde: lo que produciría el sistema. Azul: lo que usaría tu casa. Generar más no significa poder usar todo.</p>${chart(a.rows)}</section><div class="home-result-grid"><section class="card"><h2>Qué equipos se consideraron</h2><ul><li>${s.panels} paneles de ${x.panelPower} W cada uno.</li><li>Un inversor de ${x.inverter} kW usado como supuesto. Su potencia final debe verificarse.</li><li>${s.bank ? `${s.bankUnits} módulos de batería; ${fmt(s.bank, 2)} kWh nominales.` : "Sin baterías: la energía del día no queda guardada para la noche."}</li></ul>${s.bank ? `<p class="home-inline-help">Reserva orientativa para ${h.backupHours} horas de los aparatos elegidos. ${h.reserveOnly ? "Los esenciales elegidos superan el consumo total declarado: revisá esa inconsistencia. " : ""}No se simulan cortes reales ni secuencias de días nublados.</p>` : ""}<p>Ubicación de paneles: ${x.placement === "roof" ? "techo" : "terreno"}. ${h.space === "unknown" ? "Espacio disponible pendiente de medir." : "Superficie disponible indicada: " + h.space + " m²."}</p></section><section class="card"><h2>Cuánto podría costar</h2>${h.budgetKnown ? `<div class="metric">${ars(Number(h.quoteARS))}</div><p>Presupuesto total ingresado por vos. No lo convierte en una cotización de Brisa.</p>` : subtotal > 0 ? `<div class="metric">${ars(subtotal)}</div><p>Subtotal de ${panel ? "paneles" : ""}${panel && battery && s.bank ? " y " : ""}${battery && s.bank ? "baterías" : ""} con precios consultados. <strong>No es la inversión completa.</strong></p>` : "<p>No hay precios verificables suficientes para mostrar un importe.</p>"}<p class="notice">Falta confirmar inversor, protecciones, estructura, montaje, transporte y compatibilidad. Por eso ${h.budgetKnown ? "la vida útil y los supuestos económicos siguen siendo revisables" : "no mostramos años de recuperación ni rentabilidad"}.</p>${prices.map((v) => `<p><a href="${safeSource(v.url)}" target="_blank" rel="noopener">${esc(v.name)}</a> · ${ars(v.priceARS)} por unidad<br><small>Consulta: ${dateLabel(v.checkedAt)}</small></p>`).join("")}</section></div><section class="card spaced"><h2>Qué falta comprobar</h2><ul><li>Orientación, sombras, estructura del techo y espacio real.</li><li>Potencia simultánea y arranques de motores.</li><li>${h.energyInput === "bill" ? "Consumo anual: se extendió el promedio de una factura al resto del año; la ocupación elegida no vuelve a reducir esos totales." : "Potencia y horas de los aparatos: si no los editaste, siguen siendo ejemplos."}</li><li>Inversor, banco y funcionamiento ante cortes: requiere un diseño compatible.</li>${a.missing > 0.01 ? `<li class="warn">Quedan ${fmt(a.missing)} kWh/año sin cubrir en el modelo.</li>` : ""}</ul></section><details class="card spaced"><summary>De dónde salen los datos</summary><p><strong>Clima:</strong> ${esc(x.source)}. Consulta ${esc(x.resource?.date || "")}. Climatología histórica modelada, no medición del techo.</p><p><strong>Electricidad:</strong> ${h.tariffEvidence?.type === "official" ? esc(h.tariffEvidence.period) + " · " + esc(h.tariffEvidence.provider) + ". Categoría por demanda mensual de referencia; se mantienen los bloques subsidiados. No se modela cambio de categoría después de instalar ni bonificaciones especiales." : h.tariffEvidence?.type === "invoice" ? "Precio por kWh ingresado desde tu factura." : "Pendiente: no se aplicó una tarifa inventada."}</p>${h.tariffEvidence?.sourceURL ? `<a href="${safeSource(h.tariffEvidence.sourceURL)}" target="_blank" rel="noopener">Ver cuadro tarifario</a>` : ""}<p><strong>Cotización:</strong> ${h.fxEvidence ? ars(h.fxEvidence.sellARS) + " por USD · " + esc(h.fxEvidence.provider) + " · " + dateLabel(h.fxEvidence.publishedAt) : "No disponible."}</p><p><strong>Supuestos:</strong> pérdidas globales ${x.losses}%, consumo durante ausencias ${x.absence} kWh/día y ocupación ${x.days} días/mes (solo si sumaste aparatos), sombra orientativa ${s.shade}%, inversor ${x.inverter} kW${s.bank ? ", descarga utilizable " + x.dod + "% y eficiencia de ciclo " + x.batteryEff + "%" : ""}. Se revisan en modo técnico.</p><p>Las consultas de precios se renuevan al abrir el recorrido o pulsar Actualizar referencias. El servidor reutiliza cada consulta hasta una hora. La fecha del cuadro tarifario puede ser anterior a la consulta.</p></details><div class="actions spaced"><button class="btn" data-action="save">Guardar propuesta</button><button class="btn secondary" data-action="edit">Cambiar mis respuestas</button><button class="btn quiet" data-action="print">Imprimir</button></div></section>`;
}
function sourcePage() {
  return `<span class="eyebrow">Datos y procedencia</span><h1>Fuentes que podés comprobar.</h1><p>Consultamos publicaciones externas al usar la app. La fecha de consulta no cambia el período de la fuente. Si una consulta falla, lo indicamos.</p><button class="btn" data-hg-action="refresh" ${feedsLoading ? "disabled" : ""}>${feedsLoading ? "Consultando…" : "Actualizar fuentes"}</button>${sourceProviderSelect()}${tariffCard()}<details class="card spaced"><summary>Cobertura de fuentes por zona</summary><p>Directorio inicial; no cubre todas las distribuidoras ni cooperativas. La selección es orientativa: confirmá con tu factura.</p>${ELECTRICITY_PROVIDERS.map((p) => `<p><a href="${safeSource(p.sourceURL)}" target="_blank" rel="noopener">${esc(p.name)}</a> · ${esc(p.area)} · ${p.automatic ? "Lectura de tarifas automática" : "Valor del kWh desde factura; enlace oficial"}</p>`).join("")}</details>${pricesCard()}<section class="card spaced"><h2>Cotización para comparar importes</h2>${feeds.exchange ? `<div class="metric">${ars(feeds.exchange.sellARS)} / USD</div><p>${esc(feeds.exchange.provider)} · publicada ${dateLabel(feeds.exchange.publishedAt)}</p><a href="${safeSource(feeds.exchange.sourceURL)}" target="_blank" rel="noopener">Ver fuente</a>` : `<p>${esc(feedErrors.exchange || "Sin consulta todavía.")}</p>`}<p class="notice">La venta oficial sirve como referencia para convertir importes. No garantiza la cotización comercial que use un proveedor.</p></section><section class="card spaced"><h2>Clima de cada vivienda</h2><p>NASA POWER entrega climatología por coordenadas. Se consulta al elegir el lugar; no se usa el clima de ejemplo para la propuesta del modo hogar.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/climatology/" target="_blank" rel="noopener">Documentación NASA POWER</a></section>`;
}
wizard = function () {
  return d.role === "home" ? householdWizard() : technicalWizard();
};
results = function () {
  return result?.x?.hogar && !householdDetailed
    ? householdResults()
    : technicalResults();
};
render = function () {
  originalRender();
  const r = route();
  if (r === "data") $("#main").innerHTML = sourcePage();
  if (r === "results" && !result && d.role === "home")
    $("#main").innerHTML = householdResults();
  if (d.role === "home" && ["simulate", "results"].includes(r))
    $("#crumb").textContent =
      r === "simulate"
        ? "Modo hogar · " + HOME_STEPS[householdStep]
        : "Mi propuesta";
};
navs.push(["data", "◇", "Fuentes"]);
document.addEventListener("input", (e) => {
  const t = e.target;
  if (
    !t.dataset.hg &&
    t.id !== "hg-location" &&
    !t.dataset.hgWatts &&
    !t.dataset.hgHours &&
    t.dataset.hgCustom === undefined
  )
    return;
  const h = hg();
  if (t.dataset.hg) h[t.dataset.hg] = t.value;
  if (t.id === "hg-location") {
    d.location = t.value;
    h.selectedLocation = false;
    if (d.resourceMode === "nasa") d.resourceMode = "stale";
  }
  if (t.dataset.hgWatts || t.dataset.hgHours) {
    const id = t.dataset.hgWatts || t.dataset.hgHours;
    h.applianceValues ??= {};
    h.applianceValues[id] ??= { ...HOME_APPLIANCES.find((v) => v.id === id) };
    h.applianceValues[id][t.dataset.hgWatts ? "watts" : "hours"] = Number(
      t.value,
    );
  }
  if (t.dataset.hgCustom !== undefined) {
    h.customAppliances[+t.dataset.hgCustom][t.dataset.hgProp] =
      t.dataset.hgProp === "name" ? t.value : Number(t.value);
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.hgAppliance) {
    const key =
      t.dataset.hgBackup === "true"
        ? "selectedAppliances"
        : "consumptionAppliances";
    const h = hg();
    h[key] ??= ["fridge", "lights", "router"];
    h[key] = t.checked
      ? [...new Set([...h[key], t.dataset.hgAppliance])]
      : h[key].filter((v) => v !== t.dataset.hgAppliance);
    render();
  }
});
function houseError(text) {
  const box = $("#home-error");
  if (box) box.textContent = text;
  else toast(text);
}
async function continueHousehold() {
  const h = hg();
  try {
    if (householdStep === 1) {
      if (!h.selectedLocation)
        throw Error(
          "Elegí una localidad de los resultados o confirmá tus coordenadas.",
        );
      if (!d.months.some(Boolean)) throw Error("Elegí al menos un mes de uso.");
      if (d.resourceMode !== "nasa") await climate();
    }
    if (householdStep === 2) {
      if (
        h.energyInput === "bill" &&
        (!(Number(h.billKWh) > 0) || !(Number(h.billDays) > 0))
      )
        throw Error("Ingresá el consumo y los días de tu factura.");
      if (
        h.energyInput === "appliances" &&
        sum(selectedLoads(false).map((a) => (a.watts * a.hours) / 1000)) <= 0
      )
        throw Error("Elegí al menos un aparato con consumo.");
    }
    if (
      householdStep === 4 &&
      (h.purpose !== "saving" || h.wantBattery === "yes") &&
      !selectedLoads(true).length
    )
      throw Error("Elegí al menos un aparato para respaldar.");
    if (householdStep < 5) {
      householdStep++;
      render();
      window.scrollTo(0, 0);
      return;
    }
    prepareHousehold();
    if (d.resourceMode !== "nasa") {
      result = null;
      go("results");
      return;
    }
    result = calculate(d);
    go("results");
  } catch (e) {
    houseError(e.message);
  }
}
document.addEventListener("submit", (e) => {
  if (e.target.id !== "household-form") return;
  e.preventDefault();
  void continueHousehold();
});
document.addEventListener(
  "click",
  async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.start === "home") {
      e.preventDefault();
      e.stopImmediatePropagation();
      newHousehold();
      return;
    }
    if (t.dataset.start === "tech") {
      householdDetailed = false;
    }
    if (t.dataset.open) {
      householdDetailed = false;
    }
    if (t.dataset.hgSelect) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hg()[t.dataset.hgSelect] = t.dataset.hgValue;
      if (t.dataset.hgSelect === "provider") {
        d.tariffDefinition = null;
        hg().tariffEvidence = null;
        feeds.tariffs = null;
        delete feedErrors.tariffs;
        void refreshFeeds();
      }
      if (t.dataset.hgSelect === "occupancy" && t.dataset.hgValue !== "season")
        d.months = Array(12).fill(true);
      render();
      return;
    }
    if (t.dataset.hgGeo !== undefined) {
      e.stopImmediatePropagation();
      const g = geoResults[+t.dataset.hgGeo];
      d.location = g.name + ", " + (g.admin1 || g.country);
      d.lat = g.latitude;
      d.lon = g.longitude;
      hg().selectedLocation = true;
      hg().province = g.admin1 || "";
      hg().countryCode = g.country_code || "";
      hg().locality = g.name;
      hg().provider = "unknown";
      hg().subsidy = "unknown";
      hg().billTariffARS = "";
      hg().manualProvider = "";
      hg().tariffEvidence = null;
      d.tariffDefinition = null;
      feeds.tariffs = null;
      feedRequest++;
      d.resourceMode = "stale";
      geoResults = [];
      render();
      return;
    }
    if (t.dataset.action === "edit" && result?.x?.hogar) {
      e.stopImmediatePropagation();
      d = clone(result.x);
      householdStep = 0;
      householdDetailed = false;
      go("simulate");
      return;
    }
    if (t.dataset.route === "data") void refreshFeeds();
    if (!t.dataset.hgAction) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    switch (t.dataset.hgAction) {
      case "back":
        if (householdStep) {
          householdStep--;
          render();
          window.scrollTo(0, 0);
        } else go("home");
        break;
      case "search":
        d.location = $("#hg-location").value;
        await searchGeo();
        break;
      case "coordinates":
        if (
          !Number.isFinite(d.lat) ||
          !Number.isFinite(d.lon) ||
          Math.abs(d.lat) > 60 ||
          Math.abs(d.lon) > 180
        ) {
          houseError("Revisá las coordenadas.");
          break;
        }
        hg().selectedLocation = true;
        hg().province = "";
        hg().countryCode = "";
        hg().provider = "unknown";
        hg().tariffEvidence = null;
        d.tariffDefinition = null;
        feeds.tariffs = null;
        feedRequest++;
        d.location = "Coordenadas " + d.lat + ", " + d.lon;
        render();
        break;
      case "climate":
        await climate();
        break;
      case "refresh":
        void refreshFeeds();
        render();
        break;
      case "switch-tech":
        delete d.hogar;
        d.role = "tech";
        step = 0;
        householdDetailed = true;
        go("simulate");
        break;
      case "technical-result":
        householdDetailed = true;
        render();
        break;
      case "edit-home":
        householdStep = 1;
        go("simulate");
        break;
      case "retry-result":
        await climate();
        if (d.resourceMode === "nasa") {
          try {
            prepareHousehold();
            result = calculate(d);
            render();
          } catch (err) {
            toast(err.message);
          }
        }
        break;
      case "add-custom":
        hg().customAppliances.push({
          name: "Otro aparato",
          watts: 100,
          hours: 1,
        });
        render();
        break;
    }
  },
  true,
);
render();
function applyTechnicalPrices() {
  const fx = feeds.exchange;
  if (!fx?.sellARS || Date.now() - Date.parse(fx.publishedAt) > 7 * 86400000)
    throw Error("Hace falta una cotización reciente.");
  const products =
    feeds.prices?.items?.filter(
      (v) =>
        Number.isFinite(v.priceARS) &&
        Date.now() - Date.parse(v.checkedAt) < 7 * 86400000,
    ) || [];
  if (!products.length) throw Error("No hay precios recientes verificados.");
  d.exchange = fx.sellARS;
  d.exchangeDate = fx.publishedAt.slice(0, 10);
  d.sourceEvidence = { exchange: clone(fx), products: clone(products) };
  for (const v of products) {
    if (v.id === "panel") {
      d.panelPower = v.powerW;
      d.panelArea = v.areaM2;
      d.panelPrice = v.priceARS / d.exchange;
    }
    if (v.id === "battery") {
      d.batteryUnit = v.capacityKWh;
      d.batteryUnitPrice = v.priceARS / d.exchange;
    }
  }
}
function sourceProviderSelect() {
  return `<label>Empresa de tu factura<select data-source-provider><option value="unknown">Elegí la distribuidora</option>${(d.hogar ? providerOptions() : ELECTRICITY_PROVIDERS).map((p) => `<option value="${p.id}" ${selectedProvider() === p.id ? "selected" : ""}>${esc(p.name)} · ${esc(p.area)}</option>`).join("")}</select></label>`;
}
function technicalSourcePanel() {
  return `<section class="source-card noprint"><span class="badge">Fuentes reales</span><h2>Aplicar datos documentados</h2><p>Confirmá la distribuidora de la factura. Las fuentes automáticas cubren EPEN, Edenor y Edesur. Las demás empresas usan el cargo variable de tu factura.</p><p class="notice">Si no aplicaste una fuente oficial, el precio del kWh es la entrada manual del escenario: no es un promedio nacional ni una tarifa consultada. Al cambiar de empresa, se deja pendiente hasta aplicar el cuadro o ingresar el valor.</p>${sourceProviderSelect()}${tariffCard()}<div class="actions"><button type="button" class="btn quiet" data-live-action="refresh">Consultar fuentes</button><button type="button" class="btn secondary" data-live-action="prices">Aplicar precios de equipos</button>${ELECTRICITY_PROVIDERS.some((p) => p.id === selectedProvider() && p.automatic) ? '<button type="button" class="btn secondary" data-live-action="tariff-no">Aplicar sin subsidio</button><button type="button" class="btn secondary" data-live-action="tariff-yes">Aplicar con subsidio</button>' : ""}<button type="button" class="btn quiet" data-route="data">Ver fuentes y fechas</button></div><p class="home-inline-help">Residencial convencional, antes de impuestos. Categoría constante por demanda mensual de referencia. Los precios de equipos corresponden a Alter Energy SAS: el envío y montaje dependen de tu ubicación y presupuesto.</p>${d.tariffDefinition ? `<p class="notice">${esc(d.tariffDefinition.provider)}: ${esc(d.tariffDefinition.period)}. <button type="button" class="btn quiet" data-live-action="clear-tariff">Volver a tarifa manual</button></p>` : ""}</section>`;
}
const householdWizardOnly = wizard;
wizard = function () {
  if (d.role === "home") return householdWizardOnly();
  let html = technicalWizard();
  if ([2, 3, 4].includes(step))
    html = html.replace(
      '<form id="wizard">',
      technicalSourcePanel() + '<form id="wizard">',
    );
  return html;
};
const sourceResults = results;
results = function () {
  const html = sourceResults();
  if (result?.x.hogar && !result.x.hogar.budgetKnown && householdDetailed)
    return (
      '<p class="notice warn">Presupuesto parcial: faltan equipos y montaje. Las cifras de inversión no son un costo total confirmado.</p>' +
      html
    );
  const e = result?.x.sourceEvidence,
    t = result?.x.tariffDefinition;
  if (!e && !t) return html;
  return (
    html +
    `<details class="card spaced"><summary>Precios y tarifa documentados en este escenario</summary>${e?.products?.map((v) => `<p>${esc(v.name)} · ${ars(v.priceARS)} · ${dateLabel(v.checkedAt)}<br><a href="${safeSource(v.url)}" target="_blank" rel="noopener">Fuente del precio</a></p>`).join("") || ""}${t ? `<p>${esc(t.provider)}: ${esc(t.period)} · ${t.subsidized ? "con subsidio" : "sin subsidio"}. Categoría constante según demanda mensual de referencia; no incluye impuestos ni descuentos especiales.</p><a href="${safeSource(t.sourceURL)}" target="_blank" rel="noopener">Cuadro oficial</a>` : ""}</details>`
  );
};
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-live-action]");
  if (!t) return;
  e.preventDefault();
  const action = t.dataset.liveAction;
  try {
    if (action === "clear-tariff") {
      d.tariffDefinition = null;
      render();
      return;
    }
    await refreshFeeds();
    if (action === "prices") {
      applyTechnicalPrices();
      render();
      toast(
        "Precios consultados aplicados. Los demás rubros siguen siendo tus entradas.",
      );
    }
    if (action.startsWith("tariff-")) {
      if (
        !feeds.tariffs?.automatic ||
        feeds.tariffs.providerId !== selectedProvider() ||
        !feeds.exchange?.sellARS
      )
        throw Error("No se pudo verificar tarifa y cotización.");
      d.exchange = feeds.exchange.sellARS;
      d.exchangeDate = feeds.exchange.publishedAt.slice(0, 10);
      d.tariffDefinition = {
        ...clone(feeds.tariffs),
        subsidized: action === "tariff-yes",
      };
      render();
      toast(
        "Cuadro de tu distribuidora aplicado al escenario. Revisá período y categoría.",
      );
    }
  } catch (err) {
    toast(err.message);
  }
});
// Editing a manual tariff detaches the document-backed tariff explicitly.
document.addEventListener("input", (e) => {
  if (["tariff", "tariffARS"].includes(e.target.dataset.k))
    d.tariffDefinition = null;
});
render();

document.addEventListener("change", (e) => {
  if (!e.target.matches("[data-source-provider]")) return;
  const id = e.target.value;
  if (d.hogar) {
    hg().provider = id;
    hg().tariffEvidence = null;
  } else {
    technicalProvider = id;
    d.tariff = 0;
    d.tariffARS = 0;
  }
  d.tariffDefinition = null;
  feeds.tariffs = null;
  delete feedErrors.tariffs;
  render();
  void refreshFeeds();
});
