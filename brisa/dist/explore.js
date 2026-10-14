"use strict";
// Functional location picker and a roof-layout diagram linked to the existing scenario.
let mapDraft = null,
  liveMap = null,
  mapMarker = null,
  mapSearchResults = [],
  mapSearching = false;
const ARG_PROVINCES = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];
function openLocationMap() {
  mapDraft = {
    lat: Number.isFinite(d.lat) ? clamp(d.lat, -60, 60) : -40.4,
    lon: Number.isFinite(d.lon) ? clamp(d.lon, -180, 180) : -71.3,
    selected: !!d.hogar?.selectedLocation || d.resourceMode === "nasa",
    label: d.location || "",
    countryCode: d.hogar?.countryCode || "",
    province: d.hogar?.province || "",
    zoom: d.resourceMode === "nasa" || d.hogar?.selectedLocation ? 13 : 6,
    returnStep: step,
    returnRoute: route() === "visual" ? "visual" : "simulate",
  };
  mapSearchResults = [];
  go("map");
}
function mapPage() {
  if (!mapDraft)
    mapDraft = {
      lat: Number.isFinite(d.lat) ? clamp(d.lat, -60, 60) : -40.4,
      lon: Number.isFinite(d.lon) ? clamp(d.lon, -180, 180) : -71.3,
      selected: false,
      label: "",
      countryCode: "",
      province: "",
      zoom: 6,
      returnStep: step,
      returnRoute: route() === "visual" ? "visual" : "simulate",
    };
  return `<section><span class="eyebrow">Ubicación de tu vivienda</span><h1>Elegí el lugar en el mapa.</h1><p>Buscá una localidad, acercá el mapa y tocá el punto donde está tu casa. No hace falta que el equipo detecte tu ubicación.</p><div class="map-layout"><section class="card map-card"><form id="map-search-form" class="map-search"><label for="map-search">Localidad<input id="map-search" placeholder="Por ejemplo, Villa Meliquina" autocomplete="off"></label><button class="btn" ${mapSearching ? "disabled" : ""}>${mapSearching ? "Buscando…" : "Buscar"}</button></form><div class="map-results">${mapSearchResults.map((g, i) => `<button class="btn quiet" data-map-result="${i}">${esc(g.name)} · ${esc(g.admin1 || g.country)}</button>`).join("")}</div><div id="location-map" aria-label="Mapa para elegir la vivienda"></div><p id="map-status" class="home-inline-help" role="status">${mapDraft.selected ? "Punto elegido: " + mapDraft.lat.toFixed(5) + ", " + mapDraft.lon.toFixed(5) : "Tocá el mapa para marcar un punto."}</p><div class="actions"><button class="btn secondary" data-map-action="center">Marcar el centro del mapa</button><button class="btn quiet" data-map-action="locate">Intentar detectar mi ubicación</button></div><small>Mapa: OpenStreetMap. La detección requiere permiso del navegador y puede ser aproximada. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Informar un problema del mapa</a></small></section><aside class="card"><h2>Confirmá el punto.</h2><label>Nombre para reconocerlo<input id="map-label" value="${esc(mapDraft.label)}" placeholder="Mi casa / mi terreno" maxlength="120"></label><label class="spaced">País<select id="map-country"><option value="">Sin confirmar</option><option value="AR" ${mapDraft.countryCode === "AR" ? "selected" : ""}>Argentina</option><option value="OTHER" ${mapDraft.countryCode && mapDraft.countryCode !== "AR" ? "selected" : ""}>Otro país</option></select></label><label class="spaced">Provincia argentina · opcional<select id="map-province"><option value="">Sin confirmar</option>${ARG_PROVINCES.map((p) => `<option value="${p}" ${mapDraft.province === p ? "selected" : ""}>${p}</option>`).join("")}</select></label><p class="notice">El punto sirve para consultar el clima. El mapa no identifica la distribuidora: confirmá país y provincia para filtrar opciones, y la empresa en tu factura.</p><button class="btn" data-map-action="confirm">Usar este lugar</button><button class="btn quiet spaced" data-map-action="cancel">Volver sin cambiar</button><p class="home-inline-help">El modelo admite latitudes entre 60° sur y 60° norte. Si no carga el mapa, podés volver y buscar una localidad o ingresar coordenadas.</p></aside></div></section>`;
}
function updateMapPoint(lat, lon) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 60 ||
    Math.abs(lon) > 180
  ) {
    toast("Elegí un punto entre 60° sur y 60° norte.");
    return false;
  }
  mapDraft.lat = lat;
  mapDraft.lon = lon;
  mapDraft.selected = true;
  mapDraft.label = "Punto del mapa";
  if ($("#map-label")) $("#map-label").value = mapDraft.label;
  mapDraft.countryCode = "";
  mapDraft.province = "";
  if ($("#map-country")) $("#map-country").value = "";
  if ($("#map-province")) $("#map-province").value = "";
  if (liveMap) {
    if (mapMarker) mapMarker.setLatLng([lat, lon]);
    else
      mapMarker = L.circleMarker([lat, lon], {
        radius: 10,
        color: "#083f43",
        fillColor: "#c5ed62",
        fillOpacity: 1,
        weight: 3,
      }).addTo(liveMap);
  }
  if ($("#map-status"))
    $("#map-status").textContent =
      "Punto elegido: " +
      lat.toFixed(5) +
      ", " +
      lon.toFixed(5) +
      ". Confirmá país y provincia si los conocés.";
  return true;
}
function mountLocationMap() {
  if (!$("#location-map") || typeof L === "undefined") return;
  liveMap = L.map("location-map", {
    scrollWheelZoom: false,
    maxBounds: [
      [-60, -180],
      [60, 180],
    ],
    maxBoundsViscosity: 1,
  }).setView([mapDraft.lat, mapDraft.lon], mapDraft.zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  })
    .on("tileerror", () => {
      if ($("#map-status"))
        $("#map-status").textContent =
          "No se pudo cargar una parte del mapa. Probá nuevamente o usá la búsqueda de localidad.";
    })
    .addTo(liveMap);
  liveMap.on("click", (e) => updateMapPoint(e.latlng.lat, e.latlng.lng));
  liveMap.on("moveend", () => {
    const p = liveMap.getCenter();
    mapDraft.viewLat = p.lat;
    mapDraft.viewLon = p.lng;
    mapDraft.zoom = liveMap.getZoom();
  });
  if (mapDraft.selected)
    mapMarker = L.circleMarker([mapDraft.lat, mapDraft.lon], {
      radius: 10,
      color: "#083f43",
      fillColor: "#c5ed62",
      fillOpacity: 1,
      weight: 3,
    }).addTo(liveMap);
  if (mapDraft.viewLat !== undefined)
    liveMap.setView([mapDraft.viewLat, mapDraft.viewLon], mapDraft.zoom);
}
function confirmMapLocation() {
  if (!mapDraft?.selected)
    throw Error("Marcá un punto en el mapa antes de confirmar.");
  d.lat = mapDraft.lat;
  d.lon = mapDraft.lon;
  d.location =
    mapDraft.label.trim() ||
    "Punto del mapa (" + d.lat.toFixed(4) + ", " + d.lon.toFixed(4) + ")";
  d.resourceMode = "stale";
  d.resource = null;
  d.source = "Ubicación nueva: consultar NASA POWER.";
  d.tariffDefinition = null;
  d.tariff = 0;
  d.tariffARS = 0;
  feeds.tariffs = null;
  feedRequest++;
  feedsLoading = false;
  technicalProvider = "unknown";
  if (d.role === "home") {
    const h = hg();
    h.selectedLocation = true;
    h.province = mapDraft.countryCode === "AR" ? mapDraft.province : "";
    h.countryCode = mapDraft.countryCode;
    h.locality = d.location;
    h.provider = "unknown";
    h.subsidy = "unknown";
    h.billTariffARS = "";
    h.manualProvider = "";
    h.tariffEvidence = null;
    householdStep = 1;
  }
  step = mapDraft.returnStep || 1;
  result = null;
  go(mapDraft.returnRoute || "simulate");
  toast(
    "Lugar aplicado. El clima y la empresa de la factura se revisan para esta ubicación.",
  );
}
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "map-search-form") return;
  e.preventDefault();
  const name = $("#map-search").value.trim();
  if (name.length < 3) {
    toast("Escribí al menos tres letras.");
    return;
  }
  mapSearching = true;
  render();
  try {
    const j = await getJSON(
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(name) +
        "&count=8&language=es&format=json",
    );
    mapSearchResults = (j.results || []).filter(
      (g) => Math.abs(g.latitude) <= 60,
    );
    if (!mapSearchResults.length)
      toast("No encontramos esa localidad. Podés marcar el mapa directamente.");
  } catch {
    toast("No se pudo buscar. Podés marcar el mapa directamente.");
  } finally {
    mapSearching = false;
    render();
  }
});
document.addEventListener("input", (e) => {
  if (!mapDraft) return;
  if (e.target.id === "map-label") mapDraft.label = e.target.value;
});
document.addEventListener("change", (e) => {
  if (!mapDraft) return;
  if (e.target.id === "map-country") {
    mapDraft.countryCode = e.target.value;
    if (mapDraft.countryCode !== "AR") {
      mapDraft.province = "";
      $("#map-province").value = "";
    }
  }
  if (e.target.id === "map-province") {
    mapDraft.province = e.target.value;
    if (mapDraft.province) {
      mapDraft.countryCode = "AR";
      $("#map-country").value = "AR";
    }
  }
});
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-map-action],[data-map-result]");
  if (!t) return;
  e.preventDefault();
  if (t.dataset.mapResult !== undefined) {
    const g = mapSearchResults[+t.dataset.mapResult];
    if (!updateMapPoint(g.latitude, g.longitude)) return;
    mapDraft.label = g.name + ", " + (g.admin1 || g.country);
    mapDraft.countryCode = g.country_code;
    mapDraft.province = g.admin1 || "";
    mapDraft.zoom = 13;
    mapDraft.viewLat = g.latitude;
    mapDraft.viewLon = g.longitude;
    render();
    return;
  }
  switch (t.dataset.mapAction) {
    case "open":
      openLocationMap();
      break;
    case "center":
      if (liveMap) {
        const p = liveMap.getCenter();
        updateMapPoint(p.lat, p.lng);
      }
      break;
    case "confirm":
      try {
        confirmMapLocation();
      } catch (err) {
        toast(err.message);
      }
      break;
    case "cancel":
      go(mapDraft.returnRoute || "simulate");
      break;
    case "locate":
      if (!navigator.geolocation) {
        toast("Este equipo no ofrece detección. Marcá el mapa directamente.");
        break;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (route() !== "map") return;
          if (updateMapPoint(p.coords.latitude, p.coords.longitude))
            liveMap?.setView([p.coords.latitude, p.coords.longitude], 15);
        },
        () =>
          toast(
            "No pudimos detectar el lugar. Podés elegirlo directamente en el mapa.",
          ),
        { timeout: 12000, maximumAge: 60000 },
      );
      break;
  }
});
const beforeExploreWizard = wizard;
wizard = function () {
  let html = beforeExploreWizard();
  if (d.role === "home" && householdStep === 1)
    html = html.replace(
      "<h2>¿Cuándo la usás?</h2>",
      '<div class="map-entry"><button type="button" class="btn secondary" data-map-action="open">Elegir directamente en el mapa</button><p>También funciona si tu equipo no puede detectar la ubicación.</p></div><h2>¿Cuándo la usás?</h2>',
    );
  if (d.role === "tech" && step === 1)
    html = html.replace(
      '<form id="wizard">',
      '<div class="map-entry"><button type="button" class="btn secondary" data-map-action="open">Elegir ubicación en el mapa</button></div><form id="wizard">',
    );
  return html;
};
const beforeExploreRender = render;
render = function () {
  if (liveMap) {
    liveMap.remove();
    liveMap = null;
    mapMarker = null;
  }
  beforeExploreRender();
  if (route() === "map") {
    $("#main").innerHTML = mapPage();
    mountLocationMap();
  }
};
navs.push(["map", "⌖", "Mapa"]);
render();

document.addEventListener(
  "click",
  (e) => {
    const t = e.target.closest('[data-route="map"]');
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openLocationMap();
  },
  true,
);

let visualTool = "panel",
  visualUndo = [];
function visualPlan() {
  if (!d.visualPlan)
    d.visualPlan = {
      width: 8,
      length: 6,
      moduleWidth: 1.134,
      moduleLength: 2.279,
      modulePower: d.panelPower || 550,
      gap: 0.05,
      edge: 0.3,
      tilt: d.ideal ? Math.round(Math.abs(d.lat)) : d.tilt,
      azimuth: d.ideal ? (d.lat < 0 ? 0 : 180) : d.azimuth,
      landscape: false,
      slots: [],
      blocked: [],
      applied: false,
    };
  return d.visualPlan;
}
function layoutGrid(v = visualPlan()) {
  const w = v.landscape ? v.moduleLength : v.moduleWidth,
    h = v.landscape ? v.moduleWidth : v.moduleLength;
  const cols = Math.max(
      0,
      Math.floor((v.width - 2 * v.edge + v.gap) / (w + v.gap)),
    ),
    rows = Math.max(
      0,
      Math.floor((v.length - 2 * v.edge + v.gap) / (h + v.gap)),
    );
  return {
    w,
    h,
    cols,
    rows,
    total: cols * rows,
    usable: Math.max(
      0,
      Math.max(0, v.width - 2 * v.edge) * Math.max(0, v.length - 2 * v.edge) -
        v.blocked.length * w * h,
    ),
  };
}
function validatePlan(v) {
  for (const [key, min, max] of [
    ["width", 1, 30],
    ["length", 1, 30],
    ["moduleWidth", 0.3, 3],
    ["moduleLength", 0.3, 4],
    ["modulePower", 10, 2000],
    ["gap", 0.01, 1],
    ["edge", 0.1, 3],
    ["tilt", 0, 90],
    ["azimuth", 0, 359],
  ])
    if (!Number.isFinite(v[key]) || v[key] < min || v[key] > max)
      throw Error("Revisá " + key + ".");
  if (v.edge * 2 >= Math.min(v.width, v.length))
    throw Error(
      "El borde reservado ocupa todo el techo. Reducí el borde o aumentá las medidas.",
    );
  if (v.moduleWidth * v.moduleLength > 10)
    throw Error("El módulo debe ocupar como máximo 10 m².");
  const g = layoutGrid(v);
  if (g.total > 300)
    throw Error(
      "Este croquis admite hasta 300 posiciones. Aumentá el tamaño del módulo o reducí el techo.",
    );
  if (
    !Array.isArray(v.slots) ||
    !Array.isArray(v.blocked) ||
    new Set(v.slots).size !== v.slots.length ||
    new Set(v.blocked).size !== v.blocked.length ||
    [...v.slots, ...v.blocked].some(
      (i) => !Number.isInteger(i) || i < 0 || i >= g.total,
    ) ||
    v.slots.some((i) => v.blocked.includes(i))
  )
    throw Error("Posiciones del croquis inválidas.");
  return g;
}
function visualSnapshot() {
  const saved = d;
  let x;
  try {
    d = clone(d);
    if (d.hogar) {
      const h = d.hogar;
      if (h.energyInput === "bill" && !(Number(h.billKWh) > 0)) {
        h.billKWh = 0;
        h.billDays = 30;
      }
      prepareHousehold();
    }
    x = clone(d);
  } finally {
    d = saved;
  }
  const v = visualPlan(),
    g = validatePlan(v);
  Object.assign(x, {
    technology: "solar",
    sizing: "manual",
    panels: v.slots.length,
    placement: "roof",
    area: g.usable,
    panelPower: v.modulePower,
    panelArea: v.moduleWidth * v.moduleLength,
    ideal: false,
    tilt: v.tilt,
    azimuth: v.azimuth,
  });
  const s = setup(x),
    a = annual(x, s),
    without = annual({ ...x, panels: 0 }, setup({ ...x, panels: 0 }));
  const known = d.hogar
    ? d.hogar.energyInput === "appliances" || Number(d.hogar.billKWh) > 0
    : true;
  return { x, s, a, without, known };
}
function roofDiagram(v, g) {
  // Orthographic roof layout projected into a functional house diagram. No inferred geometry.
  const scale = Math.min(430 / v.width, 260 / v.length),
    W = v.width * scale,
    H = v.length * scale;
  const p = (x, y, z = 0) => [
    260 + 0.85 * x - 0.55 * y,
    60 + 0.22 * x + 0.58 * y + z,
  ];
  const str = (points) => points.map((a) => a.join(",")).join(" ");
  const A = p(0, 0),
    B = p(W, 0),
    C = p(W, H),
    D = p(0, H),
    depth = 125;
  let cells = "";
  for (let i = 0; i < g.total; i++) {
    const col = i % g.cols,
      row = Math.floor(i / g.cols),
      x = (v.edge + col * (g.w + v.gap)) * scale,
      y = (v.edge + row * (g.h + v.gap)) * scale,
      w = g.w * scale,
      h = g.h * scale,
      on = v.slots.includes(i),
      blocked = v.blocked.includes(i);
    cells += `<g role="button" tabindex="0" data-v-slot="${i}" aria-label="Posición ${i + 1}: ${blocked ? "obstáculo" : on ? "panel colocado" : "libre"}" aria-pressed="${on}"><title>Posición ${i + 1} · ${blocked ? "espacio ocupado" : on ? "quitar panel" : "colocar panel"}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="roof-slot ${on ? "has-panel" : blocked ? "blocked" : ""}"/>${on ? `<path d="M${x + w / 2} ${y + 4}v${h - 8} M${x + 4} ${y + h / 3}h${w - 8} M${x + 4} ${y + (2 * h) / 3}h${w - 8}" stroke="#88ccdd" stroke-width="1" pointer-events="none"/>` : blocked ? `<path d="M${x + 5} ${y + 5}L${x + w - 5} ${y + h - 5}M${x + w - 5} ${y + 5}L${x + 5} ${y + h - 5}" stroke="#8c5932" stroke-width="3" pointer-events="none"/>` : ""}</g>`;
  }
  return `<svg class="roof-diagram" viewBox="0 0 800 480" aria-label="Croquis interactivo de la casa y una cara del techo"><polygon points="${str([D, C, p(W, H, depth), p(0, H, depth)])}" fill="#e1ebe9" stroke="#789390"/><polygon points="${str([B, C, p(W, H, depth), p(W, 0, depth)])}" fill="#b8cecb" stroke="#789390"/><path d="M${D[0] + 35} ${D[1] + 45}v55h45v-55z" fill="#285d62"/><path d="M${D[0] + 100} ${D[1] + 50}v30h45v-30z" fill="#86b9c4" stroke="#285d62" stroke-width="3"/><g transform="matrix(.85 .22 -.55 .58 260 60)"><rect width="${W}" height="${H}" fill="#eef3f0" stroke="#567a78" stroke-width="5"/><rect x="${v.edge * scale}" y="${v.edge * scale}" width="${Math.max(0, W - 2 * v.edge * scale)}" height="${Math.max(0, H - 2 * v.edge * scale)}" fill="none" stroke="#90aca6" stroke-dasharray="6 4"/>${cells}</g><text x="32" y="410" fill="currentColor" font-size="19">${fmt(v.width, 1)} × ${fmt(v.length, 1)} m · una cara del techo</text><text x="32" y="442" fill="currentColor" font-size="17">Frente de los paneles: ${["Norte", "Este", "Sur", "Oeste"][Math.round(v.azimuth / 90) % 4]} (${v.azimuth}°) · inclinación ${v.tilt}°</text></svg>`;
}
function visualInput(key, label, min, max, step = 0.1) {
  return `<label>${label}<input type="number" data-v-input="${key}" min="${min}" max="${max}" step="${step}" value="${visualPlan()[key]}"></label>`;
}
function visualPage() {
  const v = visualPlan();
  let g = layoutGrid(v),
    preview = null,
    error = "";
  try {
    validatePlan(v);
    if (d.resourceMode === "nasa") preview = visualSnapshot();
  } catch (e) {
    error = e.message;
  }
  const coverage =
    preview?.known && preview.a.demand > 0
      ? clamp((100 * preview.a.used) / preview.a.demand, 0, 100)
      : null;
  return `<section class="visual-shell"><span class="eyebrow">Probá con tu casa</span><h1>Un panel más. Una idea más clara.</h1><p>Tocá los espacios del techo para colocar o quitar paneles. Es un croquis de una superficie rectangular, no un plano de instalación.</p><div class="visual-layout"><section class="card visual-stage"><div class="visual-toolbar"><button class="btn ${visualTool === "panel" ? "" : "secondary"}" data-v-action="panel">Colocar paneles</button><button class="btn ${visualTool === "block" ? "" : "secondary"}" data-v-action="block">Marcar obstáculos</button><button class="btn quiet" data-v-action="undo" ${visualUndo.length ? "" : "disabled"}>Deshacer</button></div>${g.total <= 300 ? roofDiagram(v, g) : '<p class="notice warn">Reducí las dimensiones: el croquis admite 300 posiciones.</p>'}<div class="roof-legend"><span>▣ Panel</span><span>× Obstáculo</span><span>□ Espacio libre</span></div><p class="home-inline-help">${visualTool === "block" ? "Tocá una posición para reservarla por chimenea, ventana u otro obstáculo." : "Tocá una posición libre para colocar un panel; tocá un panel para quitarlo."} También podés recorrer las posiciones con Tab y activar con Enter o Espacio.</p><div class="actions"><button class="btn secondary" data-v-action="add">Sumar un panel</button><button class="btn quiet" data-v-action="fill">Completar espacios libres</button><button class="btn quiet" data-v-action="clear">Quitar todos los paneles</button></div><p class="notice">La distribución se conserva cuando guardás la propuesta completa; un croquis sin guardar se pierde al recargar. Los obstáculos excluyen posiciones; no calculan sus sombras sobre otros paneles. Separación y borde son supuestos editables, no distancias reglamentarias.</p></section><aside class="card visual-controls"><h2>Tu techo y tus módulos</h2><div class="formgrid">${visualInput("width", "Ancho del techo · m", 1, 30)}${visualInput("length", "Largo de esta cara · m", 1, 30)}</div><label class="spaced">Colocación<select data-v-select="landscape"><option value="false" ${!v.landscape ? "selected" : ""}>Módulo vertical</option><option value="true" ${v.landscape ? "selected" : ""}>Módulo horizontal</option></select></label><div class="formgrid spaced">${visualInput("tilt", "Inclinación · grados", 0, 90, 1)}${visualInput("azimuth", "Orientación desde el norte · grados", 0, 359, 1)}</div><p class="home-inline-help">Norte 0° · Este 90° · Sur 180° · Oeste 270°. El dibujo mantiene una perspectiva fija; la orientación cambia el cálculo.</p><details><summary>Medidas del panel y espacios</summary><div class="formgrid spaced">${visualInput("moduleWidth", "Ancho de módulo · m", 0.3, 3, 0.001)}${visualInput("moduleLength", "Largo de módulo · m", 0.3, 4, 0.001)}${visualInput("modulePower", "Potencia de módulo · W", 10, 2000, 1)}${visualInput("gap", "Separación · m", 0.01, 1, 0.01)}${visualInput("edge", "Borde reservado · m", 0.1, 3, 0.1)}</div><p class="home-inline-help">Referencia inicial: módulo de 550 W, 1,134 × 2,279 m. Confirmá la ficha. Si cambiás el módulo, el precio de ese producto deja de aplicarse.</p></details><div class="home-result-metrics visual-metrics" aria-live="polite"><article><span>Paneles colocados</span><strong>${v.slots.length}</strong><small>${fmt((v.slots.length * v.modulePower) / 1000, 2)} kWp nominales</small></article><article><span>Posiciones libres</span><strong>${Math.max(0, g.total - v.slots.length - v.blocked.length)}</strong><small>${v.blocked.length} reservadas por obstáculos</small></article><article><span>Producción estimada</span><strong>${preview ? fmt(preview.a.generation) + " kWh/año" : "Pendiente"}</strong><small>${preview ? "Climatología NASA de " + esc(d.location) : "Elegí el lugar y consultá el clima."}</small></article></div>${error ? `<p role="alert" class="notice warn">${esc(error)}</p>` : ""}<div class="actions"><button class="btn secondary" data-map-action="open">Ubicar mi casa</button><button class="btn quiet" data-v-action="climate" ${busy ? "disabled" : ""}>${busy ? "Consultando…" : "Consultar clima"}</button></div><button class="btn spaced" data-v-action="apply" ${error ? "disabled" : ""}>Usar estos paneles en mi escenario</button>${v.applied ? '<p class="notice">Distribución aplicada al escenario. Si la modificás, volvé a aplicarla.</p>' : ""}<button class="btn quiet spaced" data-v-action="continue">Volver a las preguntas de mi casa</button></aside></div>${preview ? `<section class="card spaced"><h2>Con tus paneles, mes a mes</h2>${!preview.known ? '<p class="notice">Solo producción: todavía no ingresaste el consumo de tu casa.</p>' : ""}${chart(preview.a.rows)}<div class="visual-comparison"><article><span>Energía de red sin paneles</span><strong>${preview.known ? fmt(preview.without.grid) + " kWh/año" : "Falta tu consumo"}</strong></article><article><span>Energía de red con paneles</span><strong>${preview.known ? fmt(preview.a.grid) + " kWh/año" : "Falta tu consumo"}</strong></article><article><span>Consumo cubierto con renovables</span><strong>${coverage !== null ? fmt(coverage) + "%" : "Falta tu consumo"}</strong></article></div><p class="home-inline-help">${preview.known ? "Comparamos con y sin paneles manteniendo el consumo y los demás supuestos de tu escenario." : "Ingresá una factura o tus aparatos para comparar con el consumo real de tu casa."} El modelo incluye pérdidas, sombras orientativas y límite del inversor de ${d.inverter} kW. No calcula cableado, estructura, arranques ni sombras geométricas. Si tu casa está aislada, revisá la demanda que queda sin cubrir en la propuesta completa.</p></section>` : '<p class="notice spaced">La potencia nominal se puede explorar sin clima. No usamos el clima de ejemplo para mostrar producción anual de tu casa.</p>'}</section>`;
}
function planUndo() {
  visualUndo.push(clone(visualPlan()));
  if (visualUndo.length > 30) visualUndo.shift();
}
function toggleRoofSlot(i) {
  const v = visualPlan();
  const g = validatePlan(v);
  if (i < 0 || i >= g.total) return;
  planUndo();
  const list = visualTool === "block" ? v.blocked : v.slots;
  if (visualTool === "panel" && v.blocked.includes(i)) {
    toast(
      "Ese espacio está reservado por un obstáculo. Quitalo con la herramienta de obstáculos.",
    );
    visualUndo.pop();
    return;
  }
  const at = list.indexOf(i);
  if (at < 0) list.push(i);
  else list.splice(at, 1);
  if (visualTool === "block")
    v.slots = v.slots.filter((n) => !v.blocked.includes(n));
  v.applied = false;
  render();
  document.querySelector('[data-v-slot="' + i + '"]')?.focus?.();
}
function applyVisualLayout() {
  const v = visualPlan(),
    g = validatePlan(v);
  if (g.usable < 1)
    throw Error(
      "Queda menos de 1 m² útil. Revisá las medidas y los obstáculos antes de aplicar.",
    );
  Object.assign(d, {
    technology: "solar",
    sizing: "manual",
    panels: v.slots.length,
    panelPower: v.modulePower,
    panelArea: v.moduleWidth * v.moduleLength,
    area: g.usable,
    placement: "roof",
    ideal: false,
    tilt: v.tilt,
    azimuth: v.azimuth,
  });
  applyVisualInputs(d);
  if (d.hogar) {
    d.hogar.space = String(g.usable);
    d.hogar.placement = "roof";
  }
  v.applied = true;
  result = null;
  toast(
    "Paneles, superficie y orientación aplicados. Completá consumo y respaldo antes de ver la propuesta.",
  );
  render();
}
function applyVisualInputs(x) {
  const v = x.visualPlan,
    g = validatePlan(v);
  Object.assign(x, {
    technology: "solar",
    sizing: "manual",
    panels: v.slots.length,
    panelPower: v.modulePower,
    panelArea: v.moduleWidth * v.moduleLength,
    area: g.usable,
    placement: "roof",
    ideal: false,
    tilt: v.tilt,
    azimuth: v.azimuth,
  });
  const p =
    x.hogar?.priceEvidence?.find((p) => p.id === "panel") ||
    x.sourceEvidence?.products?.find((p) => p.id === "panel");
  if (
    p &&
    (p.powerW !== v.modulePower || Math.abs(p.areaM2 - x.panelArea) > 0.01)
  ) {
    x.panelPrice = 0;
    if (x.hogar)
      x.hogar.priceEvidence = x.hogar.priceEvidence.filter(
        (p) => p.id !== "panel",
      );
    if (x.sourceEvidence)
      x.sourceEvidence.products = x.sourceEvidence.products.filter(
        (p) => p.id !== "panel",
      );
  }
}
const beforeLayoutResults = results;
results = function () {
  const html = beforeLayoutResults();
  const v = result?.x.visualPlan;
  if (!v?.applied) return html;
  return (
    html +
    `<section class="card spaced"><h2>Distribución elegida en el croquis</h2><p>${v.slots.length} paneles · techo de ${fmt(v.width, 1)} × ${fmt(v.length, 1)} m · orientación ${v.azimuth}° · inclinación ${v.tilt}°. ${v.blocked.length} posiciones reservadas por obstáculos.</p><p class="home-inline-help">Se aplicó la cantidad y orientación del croquis al modelo energético. El dibujo no verifica sombras geométricas, estructura ni conexiones eléctricas.</p></section>`
  );
};
function detachVisualLayout() {
  if (d.visualPlan?.applied) {
    d.visualPlan.applied = false;
    toast(
      "Cambiaste una entrada del sistema: revisá y volvé a aplicar el croquis si querés usarlo.",
    );
  }
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.vInput) {
    const v = visualPlan(),
      next = clone(v);
    next[t.dataset.vInput] = Number(t.value);
    try {
      if (
        [
          "width",
          "length",
          "moduleWidth",
          "moduleLength",
          "gap",
          "edge",
        ].includes(t.dataset.vInput)
      ) {
        next.slots = [];
        next.blocked = [];
      }
      validatePlan(next);
      planUndo();
      next.applied = false;
      d.visualPlan = next;
      render();
      if (!next.slots.length)
        toast("Medidas actualizadas. Colocá los paneles en la nueva grilla.");
    } catch (err) {
      toast(err.message);
      t.value = v[t.dataset.vInput];
    }
  }
  if (t.dataset.vSelect === "landscape") {
    planUndo();
    const v = visualPlan();
    v.landscape = t.value === "true";
    v.slots = [];
    v.blocked = [];
    v.applied = false;
    render();
  }
});
document.addEventListener("keydown", (e) => {
  const t = e.target.closest("[data-v-slot]");
  if (t && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    try {
      toggleRoofSlot(+t.dataset.vSlot);
    } catch (err) {
      toast(err.message);
    }
  }
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-v-action],[data-v-slot]");
  if (!t) return;
  e.preventDefault();
  try {
    if (t.dataset.vSlot !== undefined) {
      toggleRoofSlot(+t.dataset.vSlot);
      return;
    }
    const v = visualPlan(),
      g = validatePlan(v);
    switch (t.dataset.vAction) {
      case "panel":
      case "block":
        visualTool = t.dataset.vAction;
        render();
        break;
      case "undo":
        if (visualUndo.length) {
          d.visualPlan = visualUndo.pop();
          d.visualPlan.applied = false;
          render();
        }
        break;
      case "add": {
        const free = Array.from({ length: g.total }, (_, i) => i).find(
          (i) => !v.slots.includes(i) && !v.blocked.includes(i),
        );
        if (free === undefined) {
          toast("No quedan posiciones libres.");
          break;
        }
        planUndo();
        v.slots.push(free);
        v.applied = false;
        render();
        break;
      }
      case "fill":
        planUndo();
        v.slots = Array.from({ length: g.total }, (_, i) => i).filter(
          (i) => !v.blocked.includes(i),
        );
        v.applied = false;
        render();
        break;
      case "clear":
        planUndo();
        v.slots = [];
        v.applied = false;
        render();
        break;
      case "apply":
        applyVisualLayout();
        break;
      case "continue":
        if (d.role === "home") {
          hg();
          householdStep = d.hogar.selectedLocation ? 2 : 1;
        }
        go("simulate");
        break;
      case "climate":
        if (
          d.resourceMode !== "nasa" &&
          !d.hogar?.selectedLocation &&
          !d.location
        ) {
          toast("Elegí primero tu casa en el mapa o buscá una localidad.");
          break;
        }
        await climate();
        break;
    }
  } catch (err) {
    toast(err.message);
  }
});
const beforeVisualRender = render;
render = function () {
  beforeVisualRender();
  if (route() === "visual") $("#main").innerHTML = visualPage();
  if (route() === "home")
    $("#main").insertAdjacentHTML(
      "afterbegin",
      `<section class="card visual-entry"><div><span class="badge">Probá con tu casa</span><h2>¿Y si colocás los paneles vos?</h2><p>Armá un croquis, reservá obstáculos y compará el aporte solar.</p></div><button class="btn" data-route="visual">Abrir simulador visual</button></section>`,
    );
};
const visualWizard = wizard;
wizard = function () {
  let html = visualWizard();
  if (d.role === "home" && householdStep === 3)
    html = html.replace(
      "<h2>¿Cuánto espacio libre tenés?</h2>",
      '<div class="map-entry"><button type="button" class="btn secondary" data-route="visual">Probar los paneles sobre una casa</button><p>Opcional: la distribución que apliques se usará en tu propuesta.</p></div><h2>¿Cuánto espacio libre tenés?</h2>',
    );
  return html;
};
navs.push(["visual", "▦", "Probá tu casa"]);
render();

document.addEventListener(
  "click",
  (e) => {
    if (e.target.closest("[data-geo]")) {
      technicalProvider = "unknown";
      d.tariff = 0;
      d.tariffARS = 0;
      d.tariffDefinition = null;
      feeds.tariffs = null;
    }
  },
  true,
);
document.addEventListener("input", (e) => {
  if (["lat", "lon", "location"].includes(e.target.dataset.k)) {
    d.tariff = 0;
    d.tariffARS = 0;
    technicalProvider = "unknown";
    d.tariffDefinition = null;
    feeds.tariffs = null;
  }
  if (
    [
      "panels",
      "panelPower",
      "panelArea",
      "area",
      "tilt",
      "azimuth",
      "ideal",
      "sizing",
    ].includes(e.target.dataset.k)
  )
    detachVisualLayout();
  if (["space", "placement"].includes(e.target.dataset.hg))
    detachVisualLayout();
});
document.addEventListener(
  "click",
  (e) => {
    const t = e.target.closest("[data-hg-select]");
    if (t && ["space", "placement"].includes(t.dataset.hgSelect))
      detachVisualLayout();
  },
  true,
);

const beforeExploreNewHousehold = newHousehold;
newHousehold = function () {
  visualUndo = [];
  mapDraft = null;
  beforeExploreNewHousehold();
};
document.addEventListener(
  "click",
  (e) => {
    if (e.target.closest("[data-open]")) {
      visualUndo = [];
      mapDraft = null;
    }
  },
  true,
);
