"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  M = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ],
  DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  KEY = "brisa-v2",
  VERSION = "2.0";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n, d = 0) =>
    Number(n).toLocaleString("es-AR", { maximumFractionDigits: d }),
  usd = (n) => "US$ " + fmt(n, 2),
  clone = (x) => JSON.parse(JSON.stringify(x)),
  sum = (a) => a.reduce((s, x) => s + x, 0),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let store = { profile: "Mi hogar", history: [], houses: [], catalog: [] },
  storageBlocked = false;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (
    saved &&
    Array.isArray(saved.history) &&
    Array.isArray(saved.catalog) &&
    Array.isArray(saved.houses)
  )
    store = saved;
} catch {
  storageBlocked = true;
}
const defaults = () => ({
  role: "home",
  title: "Mi proyecto energético",
  house: "Mi casa",
  months: Array(12).fill(true),
  days: 30,
  absence: 1,
  connection: "grid",
  goal: "saving",
  location: "",
  lat: -40.4,
  lon: -71.3,
  resource: null,
  resourceMode: "demo",
  source: "Ejemplo didáctico, no representa mediciones de la vivienda",
  ghi: [6.5, 5.7, 4.5, 3.1, 2, 1.5, 1.7, 2.5, 3.7, 4.9, 5.8, 6.6],
  wind: Array(12).fill(4),
  diffuse: Array(12).fill(null),
  placement: "roof",
  roof: "Chapa",
  area: 40,
  tilt: 35,
  azimuth: 0,
  ideal: true,
  shade: 10,
  shadeChoice: "unknown",
  terrain: "open",
  trees: 10,
  treeDistance: 20,
  energyMode: "bill",
  monthly: 300,
  monthlyValues: Array(12).fill(300),
  monthlyCustom: false,
  habit: "evening",
  peak: 3,
  exchange: 0,
  exchangeDate: new Date().toISOString().slice(0, 10),
  tariff: 0.15,
  tariffARS: 0,
  fixed: 0,
  exportEnabled: false,
  exportTariff: 0,
  technology: "solar",
  sizing: "recommend",
  panelPower: 550,
  panelArea: 2.6,
  panelPrice: 140,
  panels: 6,
  inverter: 3,
  losses: 20,
  turbinePower: 1500,
  turbinePrice: 1500,
  turbines: 1,
  hub: 18,
  measureHeight: 10,
  shear: 0.14,
  cutin: 3,
  rated: 12,
  cutout: 25,
  windLoss: 20,
  battery: "none",
  batterySize: 10.24,
  batteryUnit: 5.12,
  batteryUnitPrice: 1000,
  dod: 80,
  batteryEff: 90,
  batteryPower: 3,
  voltage: 51.2,
  autonomy: 1,
  essential: 60,
  generator: false,
  genPower: 4,
  genLoad: 70,
  genFuel: "diesel",
  fuelRate: 1.2,
  fuelPrice: 1.2,
  genUse: "both",
  genCharge: 2,
  genMax: 24,
  costInverter: 700,
  costStructure: 300,
  costProtection: 200,
  costCable: 150,
  costController: 0,
  costLabor: 500,
  costTransport: 100,
  costPermits: 0,
  costTower: 900,
  costGen: 0,
  maintenance: 1,
  years: 20,
  discount: 5,
  degradation: 0.5,
  batteryLife: 10,
  inverterLife: 12,
  emissions: 0,
  unknown: {
    shade: true,
    losses: true,
    peak: true,
    tariff: true,
    discount: true,
    degradation: true,
    maintenance: true,
    monthly: true,
    absence: true,
  },
  appliances: [
    { name: "Heladera (promedio de ciclo)", watts: 60, qty: 1, hours: 24 },
    { name: "Luces LED", watts: 10, qty: 6, hours: 5 },
    { name: "Televisor", watts: 80, qty: 1, hours: 4 },
  ],
});
let d = defaults(),
  step = 0,
  result = null,
  geoResults = [],
  busy = false;
const HELP = {
  months: [
    "Meses de uso",
    "Elegí cuándo ocupás la vivienda. Después indicá cuántos días por mes y qué queda consumiendo al salir. Esto cambia la demanda y el objetivo de inclinación. No supone que la casa apagada consume cero.",
  ],
  exchange: [
    "Cotización del dólar",
    "Ingresá cuántos pesos argentinos equivalen a US$1 según la cotización que uses para presupuestar. Ejemplo: 1500 significa US$1 = ARS 1500. No se actualiza sola. Se guarda la fecha y cotización de cada simulación. Dejá 0 si no necesitás equivalencias en pesos.",
  ],
  tariff: [
    "Precio de cada kWh",
    "Es el cargo variable por energía que evitás comprar. Buscalo en la factura o cuadro tarifario de tu distribuidora. No dividas sin más el total de la factura por los kWh: mezclarías cargos fijos e impuestos. Si no sabés, usamos 0,15 USD/kWh como supuesto ilustrativo, no como tarifa argentina vigente.",
  ],
  fixed: [
    "Cargo fijo mensual",
    "Es el importe que se paga por estar conectado, aunque no consumas. Buscá “cargo fijo” en la factura. Si corresponde a dos meses, convertí al equivalente mensual. No se cuenta como ahorro solar. Si no lo sabés, 0 significa que no se incluye al mostrar gastos, no que desaparece.",
  ],
  losses: [
    "Pérdidas sin sombras",
    "Parte de la energía teórica que se pierde por temperatura, suciedad, cables, inversor y otros efectos. El supuesto inicial de 20% es educativo. Un técnico puede estimarlo con el clima, mantenimiento y fichas de equipos. Las sombras se aplican aparte, una sola vez.",
  ],
  shade: [
    "Pérdida por sombras",
    "Parte de la producción que se pierde por árboles, montañas, chimeneas u obstáculos. Para conocerla se estudian sombras en distintos horarios y estaciones. Las opciones visuales son supuestos, no mediciones: sin obstáculos 0%, algunas sombras 10%, frecuentes 25%. “No sé” usa 10% y queda marcado.",
  ],
  habit: [
    "Cuándo usás la energía",
    "Usamos un perfil horario sintético para repartir tu consumo. Solar de día se usa directamente; de noche hace falta batería, red o generador. No pedimos un porcentaje de autoconsumo: lo calcula el balance horario aproximado. Para mayor precisión se necesita consumo medido hora a hora.",
  ],
  discount: [
    "Tasa de descuento real",
    "Permite comparar dinero invertido hoy con ahorros futuros. “Real” significa sin inflación. Con 5%, un ahorro de US$105 dentro de un año equivale a US$100 hoy. No es un gasto ni una pérdida del panel. Se elige según el criterio económico; 5% es un escenario editable, no una rentabilidad garantizada.",
  ],
  degradation: [
    "Degradación del panel",
    "Reducción gradual de la producción con los años. Buscá la garantía de potencia del fabricante. Con 0,5% anual, el segundo año produce aproximadamente 99,5% del primero, manteniendo el resto igual. Aquí se usa una tasa constante; no modela una caída especial del primer año.",
  ],
  emissions: [
    "Factor de emisiones de la red",
    "Kg de CO₂ asociados a cada kWh de red. Buscalo en una publicación oficial indicando año y metodología. No hay un valor universal. Dejamos 0 y omitimos el resultado hasta que ingreses uno documentado. No calculamos emisiones del grupo ni ciclo de vida.",
  ],
  battery: [
    "Banco de baterías",
    "La capacidad nominal es toda la energía del banco. La utilizable es menor por la profundidad de descarga y las pérdidas. Recomendamos kWh nominales a partir del consumo esencial y días de autonomía. Es una reserva teórica: no garantiza atravesar secuencias de días nublados. Verificá compatibilidad, corriente y temperatura con las fichas.",
  ],
  autonomy: [
    "Días de autonomía",
    "Cuántos días querés cubrir el consumo esencial sin generación. Se usa para sugerir el banco. Un día de reserva no significa que la producción solar alcance para recargarlo. Los resultados muestran faltantes.",
  ],
  essential: [
    "Consumos esenciales",
    "Porcentaje del consumo diario que querés respaldar al dimensionar el banco. Ejemplo: luces, heladera y comunicaciones, sin calefacción. El balance energético sigue evaluando toda la casa; este porcentaje solo define el tamaño recomendado de reserva.",
  ],
  peak: [
    "Potencia simultánea",
    "Suma de las potencias de los aparatos que pueden funcionar juntos. Mirá sus etiquetas. Una bomba o heladera puede pedir más al arrancar. El supuesto 3 kW no verifica esos arranques. Este dato sirve para advertir sobre inversor, batería o grupo insuficientes.",
  ],
  fuelRate: [
    "Consumo del grupo",
    "Litros, kg o m³ por hora a la carga de trabajo elegida. Sale del manual o de medir combustible y horas. No uses el consumo a máxima carga si trabajarás al 50%. La referencia de 1,2 L/h es ilustrativa y puede ser muy distinta en tu grupo. Se aproxima consumo proporcional al tiempo de marcha.",
  ],
  genLoad: [
    "Carga del generador",
    "Porcentaje de potencia nominal al que suponemos que trabaja. Un grupo de 4 kW al 70% entrega 2,8 kW. No es su rendimiento energético. El combustible debe corresponder a esa carga.",
  ],
  genUse: [
    "Uso del generador",
    "Directo: funciona cuando falta energía y atiende la carga. Carga de banco: repone energía mediante cargador. Ambos: atiende la casa y aprovecha potencia sobrante para cargar. Los tiempos son equivalentes aproximados, sin modelar arranques, calentamiento ni ciclos mínimos.",
  ],
  area: [
    "Superficie disponible",
    "En techo, ingresá área neta libre, descontando obstáculos y accesos. En suelo, el modelo reserva dos veces el área de módulos para separación y acceso: es una regla orientativa, no un plano de filas ni cálculo de sombras entre ellas.",
  ],
  ideal: [
    "Disposición sugerida",
    "Exploramos inclinaciones de 0 a 70° en pasos de 5°, orientadas al ecuador (norte en Argentina). Elegimos según meses de uso y objetivo. El cálculo usa un día solar representativo de cada mes: no considera el horizonte real, nieve ni sombras entre filas.",
  ],
  resource: [
    "Recurso solar y viento",
    "NASA POWER entrega promedios climáticos por coordenadas, no una estación en tu terreno. Consultamos radiación horizontal, difusa y viento a 10 m. La app transpone el recurso solar a la inclinación elegida. Podés ingresar 12 valores propios con fuente. El ejemplo incorporado es inventado y nunca se presenta como dato local.",
  ],
  terrain: [
    "Entorno eólico",
    "Árboles y edificios producen turbulencia y resguardo. La categoría genera advertencias; no inventa un descuento preciso. Altura y distancia de árboles se documentan para revisión. Un atlas o viento regional no reemplaza mediciones a la altura del rotor.",
  ],
  wind: [
    "Velocidad del viento",
    "Promedio mensual en m/s a una altura declarada. Lo obtenés de mediciones o de una base meteorológica. El modelo usa una distribución Rayleigh y una curva genérica; la velocidad media por sí sola no determina una producción real.",
  ],
  shear: [
    "Exponente de altura",
    "Se usa v₂ = v₁ × (h₂/h₁)^α. El valor 0,14 es solo una referencia. Bosques y entornos complejos no se describen bien con un único exponente. Conviene medir a la altura de buje.",
  ],
  cost: [
    "Costo orientativo en USD",
    "Los valores iniciales son ejemplos editables, no cotizaciones actuales. Pedí un presupuesto e ingresá cada componente por separado. Paneles, baterías y turbinas se suman automáticamente; no vuelvas a incluirlos en otros rubros.",
  ],
  maintenance: [
    "Mantenimiento anual",
    "Porcentaje de la inversión renovable que reservás por año para revisiones y mantenimiento. 1% es un supuesto didáctico. El combustible se suma aparte. Las reposiciones de batería e inversor se incluyen según la vida declarada.",
  ],
  exportTariff: [
    "Compensación por excedentes",
    "Importe recibido por kWh entregado a red. No suele coincidir con lo que pagás por comprar energía. Ingresalo solo si tu instalación puede inyectar y conocés el esquema aplicable. Sin habilitación, los excedentes no se valorizan.",
  ],
  monthly: [
    "Consumo mensual",
    "Ingresá kWh del período, no pesos. Para una factura bimestral, dividí según los días y llevá a mes de 30 días, o cargá los doce meses reales. En carga promedio, se aplica solo a los días ocupados; las ausencias usan el consumo residual.",
  ],
  monthlyValues: [
    "Consumos mensuales reales",
    "Cada valor debe incluir todo el consumo de ese mes, incluidas ausencias. No volvemos a reducirlo por días ocupados. Si un mes no tiene factura, estimá y documentalo.",
  ],
  voltage: [
    "Tensión del banco",
    "Los Ah solo tienen sentido asociados a tensión: Ah = kWh × 1000 / V. Por ejemplo 5,12 kWh a 51,2 V son 100 Ah. No es una instrucción de conexionado; respetá límites y compatibilidad del fabricante.",
  ],
};
Object.assign(HELP, {
  title: [
    "Nombre del escenario",
    "Poné un nombre que te ayude a compararlo después: por ejemplo “Casa de verano · 6 paneles y banco”. No cambia el cálculo.",
  ],
  house: [
    "Nombre de la vivienda",
    "Es un nombre para identificar la casa en tu historial. Al guardar un resultado también se guarda su ficha, que podés reutilizar.",
  ],
  days: [
    "Días de ocupación",
    "Cantidad promedio de días que ocupás la casa en cada mes elegido. En un mes de 28 días se limita a 28. Se combina con el consumo residual de las ausencias. Si cargás doce facturas reales no se vuelve a descontar ocupación.",
  ],
  absence: [
    "Consumo durante ausencias",
    "Energía diaria que sigue usando la casa cuando no estás: heladera, alarma, router, bomba automática. Sumá W × horas / 1000. Si realmente apagás todo, ingresá 0. La referencia de 1 kWh/día no es un dato de tu vivienda.",
  ],
  connection: [
    "Red o casa aislada",
    "Con red: la distribuidora cubre el faltante después de las fuentes seleccionadas. Aislada: si renovables, batería y grupo no alcanzan, queda demanda sin cubrir. Los cortes de red no se simulan como eventos.",
  ],
  goal: [
    "Qué significa una disposición ideal",
    "Ahorrar: prioriza recurso donde hay más consumo, sin optimización de precios. Meses de uso: prioriza generación en los meses elegidos. Mes más desfavorable: busca mejorar el menor recurso entre esos meses. La recomendación no reemplaza un estudio de sombras.",
  ],
  placement: [
    "Techo o suelo",
    "En techo, usá superficie libre y verificá capacidad estructural. En suelo suele haber más libertad de orientación; reservamos aproximadamente el doble del área de paneles para accesos y filas. La distancia real depende de pendiente, inclinación y sombras.",
  ],
  roof: [
    "Tipo de cubierta",
    "Describe dónde irá la estructura. No asigna resistencia ni precio automáticamente. Un instalador debe definir fijaciones, impermeabilización y cargas de viento o nieve. En suelo seleccioná estructura en suelo.",
  ],
  panels: [
    "Cantidad de módulos",
    "Número entero de paneles. Multiplicado por sus W nominales da la potencia pico del conjunto. La producción real depende de radiación y pérdidas. En recomendación automática se limita por espacio disponible.",
  ],
  turbines: [
    "Cantidad de aerogeneradores",
    "Cantidad de unidades a evaluar. No considera estelas ni distancias entre rotores; debe verificarse el emplazamiento. La recomendación automática de paneles no dimensiona por sí sola una instalación eólica.",
  ],
  turbinePower: [
    "Potencia nominal eólica",
    "W que declara el fabricante a una velocidad nominal específica. No es producción constante. Usá la misma ficha para las velocidades de arranque, nominal y corte. El modelo aproxima una curva genérica.",
  ],
  cutin: [
    "Viento de arranque",
    "Velocidad en m/s a partir de la cual el equipo empieza a entregar energía útil, según su ficha. No equivale necesariamente a la velocidad a la que las palas comienzan a girar.",
  ],
  rated: [
    "Viento nominal",
    "Velocidad en m/s a la que el fabricante declara la potencia nominal. Cambiarla modifica mucho la producción estimada. Revisá la curva de potencia de ese equipo.",
  ],
  cutout: [
    "Viento de corte",
    "Velocidad en m/s a la que el equipo deja de producir por protección, si así opera. La curva genérica no reproduce todos los mecanismos de control de pequeñas turbinas.",
  ],
  windLoss: [
    "Pérdidas y disponibilidad eólica",
    "Porcentaje conjunto por cableado, control y tiempo fuera de servicio. 20% es un escenario educativo, no una corrección válida para cualquier bosque. Las interferencias requieren evaluación local.",
  ],
  genMax: [
    "Máximo diario de marcha",
    "Límite de horas equivalentes de funcionamiento por día representativo. Si el grupo necesita más, se muestra energía sin cubrir o comprada de red. No establece horarios ni verifica restricciones de ruido.",
  ],
  years: [
    "Horizonte de evaluación",
    "Cantidad de años para acumular flujos y calcular VAN. Usamos precios constantes, degradación solar y reposiciones de batería e inversor. No se pronostican tarifas ni dólar.",
  ],
  batteryLife: [
    "Reposición de batería",
    "Años hasta reemplazar el banco completo, al precio actual indicado. Estimalo con ciclos, garantía, temperatura y uso previstos. La vida real depende de esas condiciones; no se simula envejecimiento de capacidad entre reposiciones.",
  ],
  inverterLife: [
    "Reposición de inversor",
    "Año de reemplazo del inversor, repetido a ese intervalo. Se utiliza el precio ingresado en presupuesto. Es un supuesto de mantenimiento, no una predicción de falla.",
  ],
});
function help(k) {
  const h = HELP[k] || [
    "Cómo completar este dato",
    "Usá la ficha técnica, una medición o un presupuesto. Los valores iniciales son orientativos y se pueden editar. Las unidades aparecen al comienzo de la etiqueta.",
  ];
  $("#dialog").setAttribute("aria-labelledby", "help-title");
  $("#dialog").innerHTML =
    '<button class="theme dialogclose" onclick="this.closest(\'dialog\').close()" aria-label="Cerrar ayuda">✕</button><span class="eyebrow">Brisa te explica</span><h2 id="help-title">' +
    esc(h[0]) +
    "</h2><p>" +
    esc(h[1]) +
    '</p><button class="btn" onclick="this.closest(\'dialog\').close()">Entendido</button>';
  $("#dialog").showModal();
}
function toast(t) {
  $("#toast").textContent = t;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").textContent = ""), 4500);
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    storageBlocked = false;
    return true;
  } catch {
    toast("No se pudo guardar. Exportá un respaldo antes de cerrar.");
    return false;
  }
}
function f(
  key,
  label,
  {
    type = "number",
    min = 0,
    max = 1e9,
    options = null,
    helpKey = key,
    hint = "",
    unknown = null,
  } = {},
) {
  return `<div class="field"><div class="fieldheading"><label for="f-${key}">${esc(label)}</label><button type="button" class="help" data-help="${HELP[key] ? key : helpKey}" aria-label="Ayuda: ${esc(label)}">?</button></div>${
    options
      ? `<select id="f-${key}" data-k="${key}">${options
          .map((o) => {
            let v = Array.isArray(o) ? o[0] : o,
              t = Array.isArray(o) ? o[1] : o;
            return `<option value="${esc(v)}" ${String(d[key]) === String(v) ? "selected" : ""}>${esc(t)}</option>`;
          })
          .join("")}</select>`
      : `<input id="f-${key}" data-k="${key}" type="${type}" value="${esc(d[key])}" ${type === "number" ? `min="${min}" max="${max}" step="any" required` : ""} ${type === "text" ? 'maxlength="150"' : ""}>`
  }${hint ? `<small>${esc(hint)}</small>` : ""}${unknown !== null ? `<button type="button" class="unknown" data-unknown="${key}" data-value="${unknown}">No sé · usar referencia (${unknown})</button>` : ""}${d.unknown[key] ? "<small>◌ Valor estimado · revisable</small>" : ""}</div>`;
}
const choice = (key, opts) =>
  `<div class="choices">${opts.map(([v, t]) => `<label class="choice"><input type="radio" name="${key}" data-k="${key}" value="${v}" ${d[key] === v ? "checked" : ""}>${t}</label>`).join("")}</div>`;
const check = (key, label) =>
  `<label class="choice"><input type="checkbox" data-k="${key}" ${d[key] ? "checked" : ""}>${label}</label>`;
const block = (title, body, sub = "") =>
  `<section class="card spaced"><h2>${title}</h2>${sub ? `<p class="muted">${sub}</p>` : ""}${body}</section>`;
const numberMonths = (key, label) =>
  `<div class="months">${M.map((m, i) => `<div class="field"><label for="${key}-${i}">${m} · ${label}</label><input id="${key}-${i}" type="number" min="0" max="${key === "ghi" ? 15 : key === "wind" ? 40 : 100000}" step="any" required data-array="${key}" data-index="${i}" value="${d[key][i]}"></div>`).join("")}</div>`;
const art = `<svg class="hero-art" viewBox="0 0 470 300" role="img" aria-label="Casa con paneles solares entre árboles"><defs><linearGradient id="land" x2="0" y2="1"><stop stop-color="#537c53"/><stop offset="1" stop-color="#234b39"/></linearGradient></defs><circle cx="364" cy="66" r="37" fill="#d6ed9c"/><circle cx="364" cy="66" r="51" fill="none" stroke="#d6ed9c" opacity=".15"/><path d="M10 223 Q110 162 235 211T465 199V300H10" fill="url(#land)"/><path d="m120 171 129-71 128 72-130 74z" fill="#bed29e"/><path d="m120 171 127 73v52l-127-74z" fill="#e6e9ca"/><path d="m247 244 130-72v51l-130 73z" fill="#aac493"/><path d="m99 170 148-87 151 87-29 15-122-69-122 70z" fill="#789769"/><path d="m151 154 93-54 94 54-94 55z" fill="#143e38" stroke="#8eaca0" stroke-width="2"/><g stroke="#87a9a0" stroke-width="1.3"><path d="m182 136 94 54m-63-72 94 54m-125 0 93-54m-62 72 94-54"/></g><path d="m145 203 24 14v32l-24-14z" fill="#385f4b"/><path d="m189 227 27 15v25l-27-15z" fill="#f5ce7e"/><path d="m285 238 27-15v23l-27 15z" fill="#f5ce7e"/><g fill="#709960"><path d="m50 190 30-100 30 100z"/><path d="m391 226 27-98 27 98z"/></g><g stroke="#bfd098" stroke-width="4"><path d="M80 173v60m338-20v46"/></g><path d="M244 216v19" stroke="#def4ac" stroke-width="3"/><circle cx="244" cy="216" r="5" fill="#d6ed9c"/><path d="M28 263q77-12 125 25" fill="none" stroke="#9bbd7d" opacity=".5" stroke-width="2"/></svg>`;
const navs = [
  ["home", "⌂", "Inicio"],
  ["simulate", "＋", "Simular"],
  ["history", "◷", "Historial"],
  ["catalog", "▦", "Equipos"],
  ["learn", "☀", "Aprender"],
  ["profile", "◎", "Mi perfil"],
];
function route() {
  return location.hash.slice(1) || "home";
}
function render() {
  const r = route();
  $("#nav").innerHTML = navs
    .map(
      ([id, ic, t]) =>
        `<button data-route="${id}" class="${r === id ? "active" : ""}" ${r === id ? 'aria-current="page"' : ""}><span>${ic}</span>${t}</button>`,
    )
    .join("");
  $("#crumb").textContent = navs.find((x) => x[0] === r)?.[2] || "Resultados";
  $("#main").innerHTML =
    r === "simulate"
      ? wizard()
      : r === "results" && result
        ? results()
        : r === "history"
          ? history()
          : r === "catalog"
            ? catalog()
            : r === "learn"
              ? learn()
              : r === "profile"
                ? profile()
                : home();
  if (storageBlocked)
    $("#main").insertAdjacentHTML(
      "afterbegin",
      '<p class="notice warn">El almacenamiento no está disponible o no se pudo leer. Exportá tus simulaciones para conservarlas.</p>',
    );
}
function go(r) {
  location.hash = r;
  if (route() === r) render();
  window.scrollTo(0, 0);
}
function homeBase() {
  return `<div class="sectionhead" style="margin-top:0"><div><span class="eyebrow">Un futuro más liviano</span><h2>Hola, ${esc(store.profile)}.</h2></div><span class="badge">Solar · Eólica · Respaldo</span></div><section class="hero"><div><span class="eyebrow">Tu casa tiene potencial</span><h1>Menos dudas.<br>Más energía propia.</h1><p>Descubrí qué pueden hacer el sol y el viento por tu hogar. Con números claros, a tu ritmo.</p><button class="btn lime" data-action="new">Explorar mi hogar ↗</button></div>${art}</section><div class="grid spaced"><article class="card"><div class="icon">☀</div><h3>De tu lugar a tu energía</h3><p class="muted">Consultá el recurso climático por ubicación y elegí techo o suelo.</p><small>Con fuentes y supuestos a la vista.</small></article><article class="card"><div class="icon">ϟ</div><h3>El respaldo que necesitás</h3><p class="muted">Probá con o sin baterías y estimá el uso de un grupo electrógeno.</p><small>Red, casa aislada o sistema mixto.</small></article><article class="card"><div class="icon">◷</div><h3>Decisiones que podés comparar</h3><p class="muted">Guardá escenarios, revisá los costos en USD y volvé cuando quieras.</p><small>${store.history.length} simulaciones guardadas en este navegador.</small></article></div><div class="sectionhead"><h2>Una app, dos maneras de explorar.</h2></div><div class="two"><article class="card"><span class="badge">Modo hogar</span><h3 class="spaced">No tenés que saberlo todo.</h3><p class="muted">Preguntas simples, botones de ayuda y “No sé” para los datos que podemos estimar.</p><button class="btn quiet" data-start="home">Soy dueño de casa →</button></article><article class="card"><span class="badge">Modo técnico</span><h3 class="spaced">Los supuestos, bajo tu control.</h3><p class="muted">Recurso mensual, parámetros de equipos y evaluación económica editables.</p><button class="btn quiet" data-start="tech">Soy técnico →</button></article></div>`;
}
function wizardBase() {
  let content = "";
  if (step === 0) {
    content =
      block(
        "Primero, ¿cómo querés trabajar?",
        choice("role", [
          ["home", "⌂ Soy dueño de casa"],
          ["tech", "▦ Soy técnico"],
        ]) +
          `<div class="formgrid spaced">${f("title", "Nombre de la simulación", { type: "text" })}${f("house", "Nombre de la vivienda", { type: "text" })}</div>`,
      ) +
      block(
        "¿En qué meses usás la casa?",
        `<button type="button" class="help" data-help="months" aria-label="Ayuda sobre ocupación">?</button><div class="monthselect spaced">${M.map((m, i) => `<label class="choice"><input type="checkbox" data-month="${i}" ${d.months[i] ? "checked" : ""}>${m}</label>`).join("")}</div><div class="formgrid spaced">${f("days", "días/mes · Ocupación en meses elegidos", { min: 1, max: 31, hint: "Se aplica si usás un consumo promedio o lista de artefactos." })}${f("absence", "kWh/día · Consumo cuando no estás", { max: 1000, unknown: 1 })}</div>`,
      ) +
      block(
        "¿Qué necesita tu hogar?",
        `<div class="formgrid">${f("connection", "Conexión eléctrica", {
          options: [
            ["grid", "Tengo red eléctrica"],
            ["offgrid", "Casa aislada / sin red"],
          ],
        })}${f("goal", "Mi prioridad", {
          options: [
            ["saving", "Ahorrar energía comprada"],
            ["season", "Generar más en los meses de uso"],
            ["winter", "Priorizar el mes más desfavorable"],
          ],
        })}</div><p class="notice">Las baterías y el generador se eligen más adelante. Esta simulación orienta; no reemplaza el proyecto de instalación.</p>`,
      );
  }
  if (step === 1) {
    content =
      block(
        "Encontrá tu lugar",
        `<div class="formgrid">${f("location", "Localidad o referencia", { type: "text", helpKey: "resource", hint: "Escribí una localidad y elegí el resultado correcto." })}<div class="field"><label>Buscar coordenadas</label><button type="button" class="btn secondary" data-action="search" ${busy ? "disabled" : ""}>${busy ? "Consultando…" : "Buscar localidad ↗"}</button></div></div><div class="locationresults">${geoResults.map((g, i) => `<button type="button" class="btn quiet" data-geo="${i}">${esc(g.name)} · ${esc(g.admin1 || "")} · ${esc(g.country || "")} (${fmt(g.latitude, 3)}, ${fmt(g.longitude, 3)})</button>`).join("")}</div><div class="formgrid spaced">${f("lat", "° · Latitud (sur negativa)", { min: -60, max: 60, helpKey: "resource" })}${f("lon", "° · Longitud (oeste negativa)", { min: -180, max: 180, helpKey: "resource" })}</div><button type="button" class="btn quiet spaced" data-action="geolocate">Usar mi ubicación actual</button><small class="spaced">Solo si estás en la vivienda. El navegador te pedirá permiso; la ubicación se envía a NASA al consultar el recurso.</small><small class="spaced">La coordenada inicial es solo un ejemplo. Confirmá tu punto. Búsqueda: Open-Meteo / GeoNames.</small><button type="button" class="btn spaced" data-action="climate" ${busy ? "disabled" : ""}>${busy ? "Consultando…" : "Cargar recurso de NASA POWER"}</button><p class="notice">${esc(d.source)}${d.resource ? "<br>Consulta: " + esc(d.resource.date) + " · Período: " + esc(d.resource.period) : ""}</p>`,
      ) +
      block(
        "Cómo instalarías los paneles",
        `<div class="formgrid">${f("placement", "Lugar de instalación", {
          options: [
            ["roof", "En el techo"],
            ["ground", "En el suelo"],
          ],
        })}${f("roof", "Tipo de cubierta / soporte", { options: ["Chapa", "Teja", "Losa", "Estructura en suelo"] })}${f("area", "m² · Superficie disponible", { max: 100000, unknown: 40 })}${f(
          "shadeChoice",
          "Sombras sobre los paneles",
          {
            helpKey: "shade",
            options: [
              ["none", "Sin obstáculos visibles"],
              ["some", "Algunas horas / algunos obstáculos"],
              ["many", "Sombras frecuentes"],
              ["unknown", "No sé todavía"],
              ["custom", "Ingresar porcentaje técnico"],
            ],
          },
        )}</div>${d.shadeChoice === "custom" ? `<div class="formgrid spaced">${f("shade", "% · Pérdida adicional por sombra", { max: 95, unknown: 10 })}</div>` : ""}<div class="spaced">${check("ideal", "Buscar una inclinación orientativa según mi objetivo")} <button type="button" class="help" data-help="ideal" aria-label="Ayuda sobre inclinación">?</button></div>${!d.ideal ? `<div class="formgrid spaced">${f("tilt", "° · Inclinación del panel", { max: 90, helpKey: "ideal" })}${f("azimuth", "° · Orientación desde el norte", { max: 359, helpKey: "ideal", hint: "Norte 0° · Este 90° · Sur 180° · Oeste 270°" })}</div>` : '<small class="spaced">En techo, confirmar que la estructura permita la inclinación sugerida. En suelo, revisar sombras y separaciones.</small>'}`,
      ) +
      `<details class="card spaced"><summary>Recurso manual / datos de una guía o medición</summary><p>Ingresá radiación global horizontal diaria media mensual, en kWh/m²/día. Si tu fuente ya está inclinada, no la ingreses aquí: este modelo transpone desde horizontal.</p>${numberMonths("ghi", "kWh/m²/día")}<div class="formgrid spaced">${f("source", "Fuente y período de los datos", { type: "text", helpKey: "resource" })}</div><p>Al editar la radiación se identifica como carga manual y se estima la componente difusa. La Guía del Recurso Solar puede usarse como fuente; no hay tablas de esa guía precargadas.</p></details>`;
  }
  if (step === 2) {
    content =
      block(
        "Tu consumo, sin adivinar unidades",
        choice("energyMode", [
          ["bill", "Tengo consumo de factura"],
          ["appliances", "Prefiero sumar artefactos"],
        ]) +
          `<p class="muted spaced">Los kWh son energía. Los kW son potencia. El botón “?” te ayuda a encontrar cada dato.</p>` +
          (d.energyMode === "bill"
            ? `${check("monthlyCustom", "Cargar los doce consumos mensuales reales")}${d.monthlyCustom ? `<p>kWh totales de cada mes, incluyendo ausencias.</p>${numberMonths("monthlyValues", "kWh")}` : `<div class="formgrid spaced">${f("monthly", "kWh/30 días · Consumo con la casa ocupada", { max: 100000, unknown: 300 })}</div>`}`
            : `<p class="notice">Para heladeras, usá el consumo de la etiqueta en kWh/día o una potencia media de ciclo, no la potencia máxima durante 24 horas.</p>${d.appliances
                .map(
                  (a, i) =>
                    `<div class="appliance">${[
                      ["name", "Artefacto", "text"],
                      ["watts", "W · Potencia media", "number"],
                      ["qty", "Cantidad", "number"],
                      ["hours", "h/día · Uso", "number"],
                    ]
                      .map(
                        ([k, t, type]) =>
                          `<div class="field"><label>${t}</label><input type="${type}" data-app="${i}" data-prop="${k}" value="${esc(a[k])}" ${type === "number" ? `min="0" max="${k === "hours" ? 24 : 100000}" step="any" required` : ""}></div>`,
                      )
                      .join(
                        "",
                      )}<button type="button" class="btn secondary small" data-remove-app="${i}" aria-label="Eliminar artefacto">✕</button></div>`,
                )
                .join(
                  "",
                )}<button type="button" class="btn quiet spaced" data-action="add-app">＋ Agregar artefacto</button><p class="notice">Consumo calculado: ${fmt(applianceDaily(d), 2)} kWh/día ocupado.</p>`),
      ) +
      block(
        "Cuándo y cómo consumís",
        `<div class="formgrid">${f("habit", "Horario principal de consumo", {
          options: [
            ["day", "Principalmente de día"],
            ["evening", "Principalmente tarde / noche"],
            ["flat", "Repartido durante todo el día"],
            ["unknown", "No sé · usar perfil repartido"],
          ],
        })}${f("peak", "kW · Potencia simultánea máxima", { min: 0.1, max: 1000, unknown: 3 })}</div>`,
      ) +
      block(
        "Todos los resultados en dólares",
        `<div class="formgrid">${f("exchange", "ARS/USD · Pesos por cada dólar", { max: 1e7, hint: "Opcional. 0 = no mostrar equivalencia en pesos." })}${f("exchangeDate", "Fecha de la cotización", { type: "date", helpKey: "exchange" })}${f("tariff", "USD/kWh · Tarifa variable", { max: 100, unknown: 0.15 })}${f("fixed", "USD/mes · Cargo fijo", { max: 100000, unknown: 0 })}</div>${d.exchange > 0 ? `<div class="formgrid spaced">${f("tariffARS", "ARS/kWh · Convertir tarifa de la factura", { helpKey: "tariff" })}<div><p class="muted">Al escribir aquí, convertimos automáticamente a USD usando tu cotización.</p><b id="converted">${usd(d.tariff)} / kWh</b></div></div>` : ""}${d.connection === "grid" ? `<div class="spaced">${check("exportEnabled", "Tengo inyección habilitada y quiero valorar excedentes")}</div>${d.exportEnabled ? `<div class="formgrid spaced">${f("exportTariff", "USD/kWh · Compensación por excedentes", { max: 100 })}</div>` : ""}` : '<p class="notice">Casa aislada: no se calcula ahorro contra una tarifa de red. Si agregás generador, comparamos combustible con y sin renovables.</p>'}`,
      );
  }
  if (step === 3) {
    content = block(
      "Elegí tu combinación",
      choice("technology", [
        ["solar", "☀ Solar"],
        ["wind", "≋ Eólica"],
        ["hybrid", "ϟ Solar + eólica"],
      ]) +
        `<div class="spaced">${choice("sizing", [
          ["recommend", "Recomendame un sistema"],
          ["manual", "Quiero probar mi configuración"],
        ])}</div>`,
    );
    if (d.technology !== "wind")
      content += block(
        "Paneles e inversor",
        `<div class="formgrid">${f("panelPower", "W · Potencia de cada módulo", { min: 10, max: 2000, helpKey: "cost" })}${f("panelArea", "m² · Superficie de cada módulo", { min: 0.1, max: 10, helpKey: "area" })}${f("panelPrice", "USD/unidad · Precio del módulo", { max: 100000, helpKey: "cost" })}${d.sizing === "manual" ? f("panels", "unidades · Cantidad de paneles", { min: 0, max: 10000 }) : '<div class="notice">La cantidad se sugiere según demanda, recurso, objetivo y espacio. No es una optimización económica.</div>'}${f("inverter", "kW AC · Potencia del inversor", { min: 0.1, max: 1000, helpKey: "peak", unknown: 3 })}${d.role === "tech" ? f("losses", "% · Pérdidas globales sin sombra", { max: 60, unknown: 20 }) : '<div class="notice">Pérdidas sin sombra: ' + d.losses + '% estimado. <button type="button" class="help" data-help="losses">?</button> Editable en modo técnico.</div>'}</div>`,
      );
    if (d.technology !== "solar")
      content += block(
        "El viento necesita contexto",
        `<div class="formgrid">${f("terrain", "Entorno del aerogenerador", {
          options: [
            ["open", "Terreno abierto"],
            ["suburban", "Suburbano"],
            ["urban", "Urbano"],
            ["forest", "Bosque / lugar arbolado"],
          ],
        })}${f("hub", "m · Altura del rotor", { min: 1, max: 150, helpKey: "wind" })}${f("measureHeight", "m · Altura del dato de viento", { min: 1, max: 150, helpKey: "wind" })}${f("turbinePower", "W · Potencia nominal por turbina", { min: 10, max: 100000 })}${f("turbines", "unidades · Aerogeneradores", { min: 0, max: 100 })}${f("turbinePrice", "USD/unidad · Precio de turbina", { helpKey: "cost" })}${d.terrain === "forest" ? f("trees", "m · Altura aproximada de árboles", { helpKey: "terrain" }) + f("treeDistance", "m · Distancia a los árboles", { helpKey: "terrain" }) : ""}</div><p class="notice warn">La propuesta eólica usa la cantidad elegida. No se recomienda automáticamente una turbina por viento regional; se requieren mediciones y curva real del equipo. Bosques y edificios pueden volver inadecuado el emplazamiento.</p>${numberMonths("wind", "m/s")}${d.role === "tech" ? `<div class="formgrid spaced">${f("shear", "α · Exponente de altura", { max: 1, unknown: 0.14 })}${f("windLoss", "% · Pérdidas eólicas", { max: 90, unknown: 20 })}${f("cutin", "m/s · Viento de arranque", { max: 30 })}${f("rated", "m/s · Viento nominal", { max: 40 })}${f("cutout", "m/s · Viento de corte", { max: 60 })}</div>` : ""}`,
      );
    content += block(
      "¿Querés guardar energía?",
      choice("battery", [
        ["none", "Sin banco · usar energía al producirse"],
        ["recommend", "Recomendar un banco"],
        ["manual", "Ya tengo / elijo un banco"],
      ]) +
        `<button type="button" class="help spaced" data-help="battery" aria-label="Ayuda sobre baterías">?</button>${d.battery !== "none" ? `<div class="formgrid spaced">${f("autonomy", "días · Autonomía deseada", { min: 0.1, max: 14 })}${f("essential", "% · Consumo esencial a respaldar", { min: 1, max: 100 })}${d.battery === "manual" ? f("batterySize", "kWh · Capacidad nominal del banco", { min: 0.1, max: 10000, helpKey: "battery" }) : ""}${f("batteryUnit", "kWh/unidad · Capacidad del módulo", { min: 0.1, max: 100, helpKey: "battery" })}${f("batteryUnitPrice", "USD/unidad · Precio del módulo", { helpKey: "cost" })}${f("batteryPower", "kW · Potencia de carga / descarga", { min: 0.1, max: 1000, helpKey: "peak", unknown: 3 })}${d.role === "tech" ? f("dod", "% · Profundidad de descarga utilizable", { min: 10, max: 100, helpKey: "battery" }) + f("batteryEff", "% · Eficiencia de ciclo completo", { min: 50, max: 100, helpKey: "battery" }) + f("voltage", "V · Tensión nominal del banco", { min: 1, max: 1000 }) : ""}</div>` : '<p class="notice">Sin baterías, el excedente del día no queda disponible para la noche. En una casa aislada, verificá que el inversor admita operar sin banco. Un inversor común conectado a red se apaga durante un corte.</p>'}`,
    );
    content += block(
      "Un grupo para cuando no alcanza",
      check("generator", "Incluir grupo electrógeno") +
        (d.generator
          ? `<div class="formgrid spaced">${f("genPower", "kW · Potencia nominal del grupo", { min: 0.1, max: 1000, helpKey: "peak", unknown: 4 })}${f("genLoad", "% · Carga de trabajo asumida", { min: 10, max: 100, unknown: 70 })}${f(
              "genFuel",
              "Combustible",
              {
                helpKey: "fuelRate",
                options: [
                  ["diesel", "Gasoil · litros"],
                  ["gasoline", "Nafta · litros"],
                  ["lpg", "GLP · kg"],
                  ["gas", "Gas natural · m³"],
                ],
              },
            )}${f("fuelRate", fuelUnit(d) + "/h · Consumo a esa carga", { min: 0.01, max: 1000, unknown: 1.2 })}${f("fuelPrice", "USD/" + fuelUnit(d) + " · Precio del combustible", { max: 1000, helpKey: "cost" })}${f(
              "genUse",
              "Uso del grupo",
              {
                options:
                  d.battery === "none"
                    ? [["direct", "Alimentar directamente la vivienda"]]
                    : [
                        ["direct", "Alimentar la vivienda"],
                        ["charge", "Cargar el banco"],
                        ["both", "Alimentar y cargar"],
                      ],
              },
            )}${d.battery !== "none" ? f("genCharge", "kW · Potencia máxima del cargador", { min: 0.1, max: 1000, helpKey: "genUse" }) : ""}${f("genMax", "h/día · Máximo de marcha permitido", { min: 0, max: 24, helpKey: "genUse" })}</div><button type="button" class="btn quiet spaced" data-action="suggest-gen">Sugerir potencia de grupo según mis consumos</button><p class="notice">Mostramos horas equivalentes y combustible por mes. No es una programación exacta de encendidos. En conexión a red priorizamos renovables → batería → grupo → red; podés desactivar el grupo para priorizar la red.</p>`
          : ""),
    );
  }
  if (step === 4) {
    const costFields = [
      ["costInverter", "Inversor"],
      ["costStructure", "Estructura"],
      ["costProtection", "Protecciones"],
      ["costCable", "Cableado"],
      ["costController", "Controlador adicional"],
      ["costLabor", "Mano de obra"],
      ["costTransport", "Transporte"],
      ["costPermits", "Trámites"],
      ...(d.technology !== "solar"
        ? [["costTower", "Torre y cimentación"]]
        : []),
      ...(d.generator
        ? [["costGen", "Compra de grupo (0 si ya lo tenés)"]]
        : []),
    ];
    content =
      block(
        "La inversión, pieza por pieza",
        `<p class="notice">Son precios ilustrativos, no cotizaciones de mercado. Módulos, turbinas y baterías se suman por separado. Revisá que el presupuesto no duplique inversor/controlador.</p><div class="formgrid">${costFields.map(([k, l]) => f(k, "USD · " + l, { helpKey: "cost", unknown: defaults()[k] })).join("")}</div>`,
      ) +
      block(
        "Mirar un poco más adelante",
        `<div class="formgrid">${f("years", "años · Horizonte de evaluación", { min: 1, max: 30 })}${f("maintenance", "%/año · Mantenimiento", { max: 20, unknown: 1 })}${d.battery !== "none" ? f("batteryLife", "años · Reposición de batería", { min: 1, max: 30, helpKey: "battery" }) : ""}${f("inverterLife", "años · Reposición de inversor", { min: 1, max: 30, helpKey: "cost" })}</div><details ${d.role === "tech" ? "open" : ""}><summary>Supuestos económicos y técnicos avanzados</summary><div class="formgrid spaced">${f("discount", "% real/año · Tasa de descuento", { max: 50, unknown: 5 })}${f("degradation", "%/año · Degradación solar", { max: 5, unknown: 0.5 })}${f("emissions", "kg CO₂/kWh · Factor de red", { max: 5, unknown: 0 })}</div></details><p class="notice">Precios constantes en USD: no pronosticamos dólar, tarifas ni combustibles. La equivalencia ARS usa exclusivamente la cotización que cargaste. El cálculo no dimensiona cables, protecciones, estructuras ni arranques de motores.</p>${d.resourceMode === "demo" ? '<p class="notice warn">Todavía estás usando clima de ejemplo. Volvé a Ubicación para cargar NASA POWER o valores propios antes de usar el resultado para tu casa.</p>' : ""}<label class="choice"><input type="checkbox" id="ack" required> Entiendo que es una estimación y que los valores de referencia deben verificarse.</label>`,
      );
  }
  return `<span class="eyebrow">${d.role === "tech" ? "Modo técnico" : "Modo hogar"} · Paso ${step + 1} de 5</span><h1>Diseñemos tu escenario.</h1><p class="muted intro">Cada dato tiene una explicación. Tocá “?” cuando lo necesites.</p><div class="stepper">${["Tu hogar", "Ubicación", "Consumo", "Sistema", "Inversión"].map((s, i) => `<button type="button" data-step="${i}" class="${i === step ? "active" : ""}">${i + 1}. ${s}</button>`).join("")}</div><form id="wizard">${content}<p id="formerror" class="error" role="alert"></p><div class="formfoot"><button type="button" class="btn secondary" data-action="back">${step ? "← Atrás" : "Volver al inicio"}</button><button class="btn" type="submit">${step === 4 ? "Ver mi simulación" : "Continuar"}</button></div></form>`;
}
function applianceDaily(x) {
  return sum(x.appliances.map((a) => (a.watts * a.qty * a.hours) / 1000));
}
function fuelUnit(x) {
  return x.genFuel === "lpg" ? "kg" : x.genFuel === "gas" ? "m³" : "L";
}
function dailyDemand(x, m) {
  if (x.energyMode === "bill" && x.monthlyCustom)
    return x.monthlyValues[m] / DAYS[m];
  const occupied = x.months[m] ? Math.min(x.days, DAYS[m]) : 0;
  return (
    ((x.energyMode === "appliances" ? applianceDaily(x) : x.monthly / 30) *
      occupied +
      x.absence * (DAYS[m] - occupied)) /
    DAYS[m]
  );
}
function loadProfile(x, m) {
  const raw = Array.from({ length: 24 }, (_, h) =>
      x.habit === "day"
        ? h >= 8 && h < 18
          ? 2
          : 0.6
        : x.habit === "evening"
          ? h >= 18 && h < 23
            ? 3
            : h >= 7 && h < 9
              ? 1.8
              : 0.5
          : 1,
    ),
    s = sum(raw);
  return raw.map((v) => (v / s) * dailyDemand(x, m));
}
const rad = (n) => (n * Math.PI) / 180;
function solarShape(x, m, tilt, az) {
  const lat = rad(x.lat),
    dec = rad(23.45 * Math.sin((2 * Math.PI * (284 + (m * 30.4 + 15))) / 365)),
    b = rad(tilt),
    a = rad(az);
  let horizontal = [],
    inc = [];
  for (let h = 0; h < 24; h++) {
    const H = rad((h + 0.5 - 12) * 15),
      up =
        Math.sin(lat) * Math.sin(dec) +
        Math.cos(lat) * Math.cos(dec) * Math.cos(H),
      north =
        Math.cos(lat) * Math.sin(dec) -
        Math.sin(lat) * Math.cos(dec) * Math.cos(H),
      east = -Math.cos(dec) * Math.sin(H);
    horizontal.push(Math.max(0, up));
    inc.push(
      up > 0
        ? Math.max(
            0,
            up * Math.cos(b) +
              north * Math.sin(b) * Math.cos(a) +
              east * Math.sin(b) * Math.sin(a),
          )
        : 0,
    );
  }
  const sh = sum(horizontal) || 1,
    ghi = x.ghi[m];
  const hd = Number.isFinite(x.diffuse[m])
    ? clamp(x.diffuse[m], 0, ghi)
    : ghi * 0.4;
  return inc.map(
    (v, h) =>
      ((ghi - hd) * v) / sh +
      (((hd * (1 + Math.cos(b))) / 2) * horizontal[h]) / sh +
      (((ghi * 0.2 * (1 - Math.cos(b))) / 2) * horizontal[h]) / sh,
  );
}
function bestTilt(x) {
  const az = x.lat < 0 ? 0 : 180;
  let best = { tilt: 0, score: -Infinity };
  for (let t = 0; t <= 70; t += 5) {
    let values = M.map((_, m) => sum(solarShape(x, m, t, az)));
    let score =
      x.goal === "winter"
        ? Math.min(...values.filter((_, m) => x.months[m]))
        : sum(
            values.map(
              (v, m) =>
                v *
                DAYS[m] *
                (x.goal === "season"
                  ? x.months[m]
                    ? 1
                    : 0
                  : dailyDemand(x, m)),
            ),
          );
    if (score > best.score) best = { tilt: t, score };
  }
  return { tilt: best.tilt, azimuth: az };
}
function windPower(x, m) {
  const mean = x.wind[m] * Math.pow(x.hub / x.measureHeight, x.shear);
  if (!mean) return 0;
  let p = 0;
  const scale = mean * Math.sqrt(2 / Math.PI);
  for (let v = 0.05; v < 50; v += 0.1) {
    const fraction =
      v < x.cutin || v >= x.cutout
        ? 0
        : v >= x.rated
          ? 1
          : (v ** 3 - x.cutin ** 3) / (x.rated ** 3 - x.cutin ** 3);
    p +=
      (x.turbinePower / 1000) *
      fraction *
      (v / (scale * scale)) *
      Math.exp((-v * v) / (2 * scale * scale)) *
      0.1;
  }
  return p * x.turbines * (1 - x.windLoss / 100);
}
function validate(x) {
  if(x.tariffDefinition){if(!Array.isArray(x.tariffDefinition.rows)||(x.tariffDefinition.rows.length<1||x.tariffDefinition.rows.length>20)||x.exchange<=0||typeof x.tariffDefinition.subsidized!=="boolean")throw Error("Tarifa documentada inválida");for(const row of x.tariffDefinition.rows){if(row.subsidyLimitsByMonth&&(!Array.isArray(row.subsidyLimitsByMonth)||row.subsidyLimitsByMonth.length!==12||row.subsidyLimitsByMonth.some(v=>!Number.isFinite(v)||v<0||v>100000)))throw Error("Bloques mensuales inválidos");for(const key of ["unsubsidizedARS","subsidizedARS","excessARS"]){if(!Number.isFinite(row[key])||row[key]<=0||row[key]>1e6)throw Error("Importe de tarifa inválido")};if(row.subsidyLimitKWh!==null&&(!Number.isFinite(row.subsidyLimitKWh)||row.subsidyLimitKWh<0||row.subsidyLimitKWh>100000))throw Error("Bloque subsidiado inválido");if(row.maxKWh!==null&&(!Number.isFinite(row.maxKWh)||row.maxKWh<=0))throw Error("Categoría inválida")}}
  if(x.quotedRemainder!==undefined&&(!Number.isFinite(x.quotedRemainder)||x.quotedRemainder<0||x.quotedRemainder>1e9))throw Error("Presupuesto inválido");
  if (!x || typeof x !== "object") throw Error("Escenario inválido.");
  const limits = {
    days: [1, 31],
    absence: [0, 1000],
    area: [0, 100000],
    tilt: [0, 90],
    azimuth: [0, 359],
    shade: [0, 95],
    monthly: [0, 100000],
    peak: [0.1, 1000],
    exchange: [0, 1e7],
    tariff: [0, 100],
    fixed: [0, 100000],
    exportTariff: [0, 100],
    panelPower: [10, 2000],
    panelArea: [0.1, 10],
    panelPrice: [0, 1e7],
    panels: [0, 10000],
    inverter: [0.1, 1000],
    losses: [0, 60],
    turbinePower: [10, 100000],
    turbinePrice: [0, 1e7],
    turbines: [0, 100],
    hub: [1, 150],
    measureHeight: [1, 150],
    shear: [0, 1],
    cutin: [0, 30],
    rated: [0.1, 40],
    cutout: [0.1, 60],
    windLoss: [0, 90],
    batterySize: [0.1, 10000],
    batteryUnit: [0.1, 100],
    batteryUnitPrice: [0, 1e7],
    dod: [10, 100],
    batteryEff: [50, 100],
    batteryPower: [0.1, 1000],
    voltage: [1, 1000],
    autonomy: [0.1, 14],
    essential: [1, 100],
    genPower: [0.1, 1000],
    genLoad: [10, 100],
    fuelRate: [0.01, 1000],
    fuelPrice: [0, 1000],
    genCharge: [0.1, 1000],
    genMax: [0, 24],
    maintenance: [0, 20],
    years: [1, 30],
    discount: [0, 50],
    degradation: [0, 5],
    batteryLife: [1, 30],
    inverterLife: [1, 30],
    emissions: [0, 5],
  };
  for (const [k, [lo, hi]] of Object.entries(limits))
    if (!Number.isFinite(x[k]) || x[k] < lo || x[k] > hi)
      throw Error(
        "Revisá " + (HELP[k]?.[0] || k) + ": rango " + lo + " a " + hi + ".",
      );
  for (const [k, v] of Object.entries(x))
    if (k.startsWith("cost") && (!Number.isFinite(v) || v < 0 || v > 1e9))
      throw Error("Costo inválido.");
  if (
    !Array.isArray(x.months) ||
    x.months.length !== 12 ||
    !Array.isArray(x.diffuse) ||
    x.diffuse.length !== 12 ||
    !Array.isArray(x.appliances)
  )
    throw Error("Datos mensuales incompletos.");
  for (const a of x.appliances)
    if (
      typeof a.name !== "string" ||
      ![a.watts, a.qty, a.hours].every(Number.isFinite) ||
      a.watts < 0 ||
      a.qty < 0 ||
      a.hours < 0 ||
      a.hours > 24
    )
      throw Error("Artefacto inválido.");
  for (const [k, values] of Object.entries({
    connection: ["grid", "offgrid"],
    battery: ["none", "manual", "recommend"],
    technology: ["solar", "wind", "hybrid"],
    genUse: ["direct", "charge", "both"],
    resourceMode: ["demo", "manual", "nasa", "stale"],
  }))
    if (!values.includes(x[k])) throw Error("Configuración inválida: " + k);
  for (const k of ["years", "batteryLife", "inverterLife"])
    if (!Number.isInteger(x[k]))
      throw Error("Ingresá años enteros para " + (HELP[k]?.[0] || k) + ".");
  for (const [k, v] of Object.entries(x))
    if (typeof v === "number" && !Number.isFinite(v))
      throw Error("Revisá el dato " + k + ".");
  if (!x.months.some(Boolean)) throw Error("Elegí al menos un mes de uso.");
  if (!x.title.trim() || !x.house.trim())
    throw Error("Ingresá un nombre para el proyecto y la vivienda.");
  for (const key of ["ghi", "wind", "monthlyValues"])
    if (
      x[key].length !== 12 ||
      x[key].some((v) => !Number.isFinite(v) || v < 0)
    )
      throw Error("Revisá los doce valores mensuales.");
  if (x.technology !== "solar" && !(x.cutin < x.rated && x.rated < x.cutout))
    throw Error("Viento de arranque < nominal < corte.");
  if (!Number.isInteger(x.panels) || !Number.isInteger(x.turbines))
    throw Error("La cantidad de equipos debe ser un número entero.");
  if (Math.abs(x.lat) > 60 || Math.abs(x.lon) > 180)
    throw Error("Coordenadas fuera del rango de este modelo (latitud ±60°).");
  if (x.generator && x.genUse === "charge" && x.battery === "none")
    throw Error("Sin banco, el grupo debe alimentar directamente la vivienda.");
  if (
    x.panelArea <= 0 ||
    x.panelPower <= 0 ||
    x.inverter <= 0 ||
    x.batteryUnit <= 0 ||
    x.measureHeight <= 0
  )
    throw Error("Revisá las capacidades: deben ser mayores que cero.");
  if (x.dod <= 0 || x.dod > 100 || x.batteryEff <= 0 || x.batteryEff > 100)
    throw Error("Revisá los porcentajes de la batería.");
}
function setup(x) {
  let orient = x.ideal ? bestTilt(x) : { tilt: x.tilt, azimuth: x.azimuth };
  let poa = M.map((_, m) => solarShape(x, m, orient.tilt, orient.azimuth));
  let shade =
    x.shadeChoice === "custom"
      ? x.shade
      : { none: 0, some: 10, many: 25, unknown: 10 }[x.shadeChoice];
  let pr = (1 - x.losses / 100) * (1 - shade / 100);
  let demands = M.map((_, m) => dailyDemand(x, m));
  let maxPanels = Math.floor(
    x.area / (x.panelArea * (x.placement === "ground" ? 2 : 1)),
  );
  let target =
    x.goal === "winter"
      ? Math.max(
          ...demands.map((v, m) =>
            x.months[m] ? v / (sum(poa[m]) * pr || 1e-6) : 0,
          ),
        )
      : sum(demands.map((v, m) => v * DAYS[m])) /
        (sum(poa.map((a, m) => sum(a) * DAYS[m])) * pr || 1e-6);
  let recommendedPanels = Math.ceil(target / (x.panelPower / 1000));
  let panels =
    x.technology === "wind"
      ? 0
      : x.sizing === "recommend"
        ? Math.min(recommendedPanels, maxPanels)
        : x.panels;
  if (panels > maxPanels)
    throw Error(
      "La cantidad de paneles supera el espacio disponible. Reducí equipos o aumentá el área neta.",
    );
  const occupiedDaily =
    x.energyMode === "appliances"
      ? applianceDaily(x)
      : x.monthlyCustom
        ? Math.max(...demands)
        : x.monthly / 30;
  let bankNeed =
    (((occupiedDaily * x.essential) / 100) * x.autonomy) /
    ((x.dod / 100) * Math.sqrt(x.batteryEff / 100));
  let bank =
    x.battery === "none"
      ? 0
      : x.battery === "recommend"
        ? Math.ceil(bankNeed / x.batteryUnit) * x.batteryUnit
        : x.batterySize;
  return {
    ...orient,
    poa,
    pr,
    shade,
    panels,
    recommendedPanels,
    maxPanels,
    bank,
    bankNeed,
    bankUnits: bank ? Math.ceil(bank / x.batteryUnit) : 0,
    demands,
  };
}
function dispatch(x, s, m, factor = 1, baseline = false) {
  const load = loadProfile(x, m),
    solar = s.poa[m].map((v) =>
      baseline
        ? 0
        : Math.min(
            x.inverter,
            ((v * s.panels * x.panelPower) / 1000) * s.pr * factor,
          ),
    ),
    wind = baseline || x.technology === "solar" ? 0 : windPower(x, m),
    capacity = baseline ? 0 : (s.bank * x.dod) / 100,
    eff = Math.sqrt(x.batteryEff / 100),
    bp = Math.min(x.batteryPower, x.inverter),
    gp = (x.genPower * x.genLoad) / 100;
  let soc = 0,
    out;
  for (let day = 0; day < 12; day++) {
    out = {
      demand: sum(load),
      solar: sum(solar),
      wind: wind * 24,
      direct: 0,
      discharge: 0,
      charge: 0,
      genCharge: 0,
      gen: 0,
      genHours: 0,
      grid: 0,
      unserved: 0,
      excess: 0,
      exported: 0,
      batteryLoss: 0,
    };
    for (let h = 0; h < 24; h++) {
      let renewable = solar[h] + wind,
        l = load[h],
        direct = Math.min(l, renewable);
      l -= direct;
      renewable -= direct;
      out.direct += direct;
      let charge = Math.min(renewable, bp, Math.max(0, capacity - soc) / eff);
      soc += charge * eff;
      renewable -= charge;
      out.charge += charge;
      out.batteryLoss += charge * (1 - eff);
      let discharge = Math.min(l, bp, soc * eff);
      soc -= discharge / eff;
      l -= discharge;
      out.discharge += discharge;
      out.batteryLoss += discharge / eff - discharge;
      let availableTime = Math.max(0, Math.min(1, x.genMax - out.genHours));
      if (x.generator && availableTime > 0 && gp > 0) {
        if (baseline || x.genUse === "direct" || capacity === 0) {
          let supplied = Math.min(l, gp * availableTime);
          l -= supplied;
          out.gen += supplied;
          out.genHours += supplied / gp;
        } else if (l > 0 || (soc < capacity * 0.2 && renewable < 0.001)) {
          if (x.genUse === "charge") {
            let input = Math.min(gp, x.genCharge, bp) * availableTime;
            input = Math.min(input, Math.max(0, capacity - soc) / eff);
            soc += input * eff;
            out.gen += input;
            out.genCharge += input;
            out.genHours += input / Math.min(gp, x.genCharge, bp);
            out.batteryLoss += input * (1 - eff);
            let again = Math.min(l, Math.max(0, bp - discharge), soc * eff);
            soc -= again / eff;
            l -= again;
            out.discharge += again;
            out.batteryLoss += again / eff - again;
          } else {
            let directGen = Math.min(l, gp * availableTime);
            l -= directGen;
            let extra = Math.min(
              Math.max(0, gp * availableTime - directGen),
              x.genCharge * availableTime,
              bp * availableTime,
              Math.max(0, capacity - soc) / eff,
            );
            soc += extra * eff;
            out.gen += directGen + extra;
            out.genCharge += extra;
            out.genHours += (directGen + extra) / gp;
            out.batteryLoss += extra * (1 - eff);
          }
        }
      }
      if (x.connection === "grid") {
        out.grid += l;
        if (x.exportEnabled) out.exported += renewable;
      } else out.unserved += l;
      out.excess += renewable;
    }
  }
  out.fuel = out.genHours * x.fuelRate;
  out.usedRenewable = Math.max(
    0,
    out.demand - out.grid - out.unserved - out.gen + out.genCharge,
  ); // replaced below by energy accounting to exclude generator recharge
  // Renewable used = renewable generation minus spill and all storage losses; cyclic storage approximation.
  out.usedRenewable = clamp(
    out.solar +
      out.wind -
      out.excess -
      Math.max(0, out.batteryLoss - out.genCharge * (1 - eff * eff)),
    0,
    out.demand - out.grid - out.unserved,
  );
  return out;
}
function annual(x, s, factor = 1, baseline = false) {
  let rows = M.map((_, m) => {
    let v = dispatch(x, s, m, factor, baseline);
    return {
      ...v,
      month: M[m],
      days: DAYS[m],
      energy: v.demand * DAYS[m],
      generation: (v.solar + v.wind) * DAYS[m],
      gridEnergy: v.grid * DAYS[m],
      missing: v.unserved * DAYS[m],
      fuelTotal: v.fuel * DAYS[m],
      hoursTotal: v.genHours * DAYS[m],
      genEnergy: v.gen * DAYS[m],
      exportEnergy: v.exported * DAYS[m],
      used: v.usedRenewable * DAYS[m],
    };
  });
  const total = (k) => sum(rows.map((v) => v[k]));
  return {
    rows,
    demand: total("energy"),
    generation: total("generation"),
    grid: total("gridEnergy"),
    missing: total("missing"),
    fuel: total("fuelTotal"),
    hours: total("hoursTotal"),
    gen: total("genEnergy"),
    exported: total("exportEnergy"),
    used: total("used"),
    cost:
      (x.tariffDefinition ? sum(rows.map((v,i) => officialEnergyCost(v.gridEnergy, v.energy, x,i))) : total("gridEnergy") * x.tariff) +
      total("fuelTotal") * x.fuelPrice -
      total("exportEnergy") * x.exportTariff +
      (x.connection === "grid" ? x.fixed * 12 : 0),
  };
}
function calculate(input) {
  let x = clone(input);
  validate(x);
  let s = setup(x),
    a = annual(x, s),
    base = annual(x, s, 1, true);
  let panelCost = s.panels * x.panelPrice,
    turbineCost = x.technology === "solar" ? 0 : x.turbines * x.turbinePrice,
    batteryCost = s.bankUnits * x.batteryUnitPrice;
  const items = [
    ["Paneles solares", panelCost],
    ["Aerogeneradores", turbineCost],
    ["Banco de baterías", batteryCost],
    ["Inversor", x.costInverter],
    ["Estructura", x.technology === "wind" ? 0 : x.costStructure],
    ["Protecciones", x.costProtection],
    ["Cableado", x.costCable],
    ["Controlador", x.costController],
    ["Mano de obra", x.costLabor],
    ["Transporte", x.costTransport],
    ["Trámites", x.costPermits],
    ["Torre y cimentación", x.technology === "solar" ? 0 : x.costTower],
    ["Grupo electrógeno", x.generator ? x.costGen : 0],
    ["Otros componentes y montaje · presupuesto ingresado", Number.isFinite(x.quotedRemainder)?x.quotedRemainder:0],
  ];
  let capex = sum(items.map((a) => a[1])),
    maint = ((capex - (x.generator ? x.costGen : 0)) * x.maintenance) / 100;
  let annualSaving = base.cost - a.cost - maint;
  let cumulative = -capex,
    npv = -capex,
    payback = null,
    flows = [];
  let comparable = base.missing < 0.01 && a.missing < 0.01 && (!x.hogar || x.hogar.budgetKnown);
  for (let y = 1; y <= Math.floor(x.years); y++) {
    let ay =
        y === 1 ? a : annual(x, s, Math.pow(1 - x.degradation / 100, y - 1)),
      replacement =
        (s.bank && y % x.batteryLife === 0 ? batteryCost : 0) +
        (y % x.inverterLife === 0 ? x.costInverter : 0),
      cash = base.cost - ay.cost - maint - replacement,
      prev = cumulative;
    cumulative += cash;
    npv += cash / Math.pow(1 + x.discount / 100, y);
    if (payback === null && prev < 0 && cumulative >= 0)
      payback = y - 1 + -prev / cash;
    flows.push({ year: y, saving: cash, replacement, cumulative });
    if (ay.missing > 0.01) comparable = false;
  }
  let warnings = [];
  if (x.resourceMode === "stale")
    warnings.push(
      "La ubicación cambió después de cargar el clima: consultá nuevamente el recurso. Los datos actuales corresponden al punto anterior.",
    );
  if (x.resourceMode === "demo")
    warnings.push(
      "Recurso climático de ejemplo: estos resultados no describen tu ubicación hasta cargar NASA POWER o valores documentados.",
    );
  if (x.resourceMode === "manual")
    warnings.push(
      "Radiación manual: verificá que sea horizontal y que fuente, período y coordenadas correspondan.",
    );
  if (
    s.panels < s.recommendedPanels &&
    x.sizing === "recommend" &&
    x.technology !== "wind"
  )
    warnings.push("El espacio limita la cantidad sugerida de paneles.");
  if (x.technology !== "solar")
    warnings.push(
      "Eólica: curva genérica y promedio horario constante. Puede sobreestimar la regularidad del suministro y subestimar baterías o grupo. Requiere mediciones y curva certificada.",
    );
  if (x.technology !== "solar" && x.terrain !== "open")
    warnings.push(
      "El entorno con obstáculos necesita evaluación de turbulencia. No aplicamos una corrección arbitraria por árboles o edificios.",
    );
  if (a.missing > 0.01)
    warnings.push(
      "Queda demanda sin cubrir. Revisá generación, banco, potencia y horario del grupo.",
    );
  if (x.battery === "none" && x.connection === "offgrid")
    warnings.push(
      "Sin banco ni red: confirmar que el inversor soporte esa operación. La generación no garantiza abastecimiento continuo.",
    );
  if (x.peak > x.inverter)
    warnings.push(
      "La potencia simultánea declarada supera la del inversor. El balance de energía no verifica arranques ni entrega instantánea.",
    );
  if (x.generator && x.peak > (x.genPower * x.genLoad) / 100)
    warnings.push(
      "El grupo a la carga declarada no alcanza la potencia simultánea máxima.",
    );
  if (s.bank && x.peak > x.batteryPower)
    warnings.push(
      "La potencia declarada del banco no cubre todos los consumos simultáneos.",
    );
  if (!comparable)
    warnings.push(
      "No se presenta recuperación ni VAN: los escenarios no aseguran el mismo servicio energético o falta una fuente de suministro de referencia.",
    );
  if (x.connection === "offgrid" && !x.generator)
    warnings.push(
      "Sin red ni grupo de referencia, se muestra inversión y cobertura, no ahorro monetario inventado.",
    );
  if (x.generator)
    warnings.push(
      "Combustible aproximado: curva de consumo plana a la carga elegida, sin ralentí, arranques ni servicio del grupo. Horas equivalentes medias, no un cronograma real.",
    );
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    version: VERSION,
    date: new Date().toISOString(),
    x,
    s,
    a,
    base,
    capex,
    items,
    maint,
    annualSaving,
    flows,
    npv,
    payback,
    comparable,
    warnings,
  };
}
function chartBase(rows) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.energy, r.generation]));
  return `<div class="legend"><span><i style="background:#347859"></i>Generación renovable</span><span><i style="background:#c7dc92"></i>Consumo</span></div><div class="chart" role="img" aria-label="Generación renovable y consumo mensual; valores exactos en la tabla inferior">${rows.map((r) => `<div class="chartgroup"><div class="bars"><div class="bar" style="height:${(r.generation / max) * 100}%;background:#347859" title="${r.month}: ${fmt(r.generation)} kWh generados"></div><div class="bar" style="height:${(r.energy / max) * 100}%;background:#c7dc92" title="${r.month}: ${fmt(r.energy)} kWh consumidos"></div></div><small>${r.month}</small></div>`).join("")}</div>`;
}
function resultsBase() {
  let r = result,
    { x, s, a } = r;
  return `<div class="resulthead"><div><span class="eyebrow">Tu escenario · ${new Date(r.date).toLocaleDateString("es-AR")}</span><h1>${esc(x.title)}</h1><p class="muted">${esc(x.house)} · ${esc(x.location || "Ubicación por coordenadas")} · ${x.connection === "grid" ? "Con red eléctrica" : "Casa aislada"}</p></div><div class="actions noprint"><button class="btn secondary" data-action="edit">Editar</button><button class="btn" data-action="save">Guardar escenario</button></div></div><div class="grid spaced"><article class="card"><span class="eyebrow">Inversión estimada</span><div class="metric">${usd(r.capex)}</div><small>${x.exchange > 0 ? "ARS " + fmt(r.capex * x.exchange) + " · cotización " + esc(x.exchangeDate) : "Costos orientativos · precios constantes"}</small></article><article class="card"><span class="eyebrow">Generación anual</span><div class="metric">${fmt(a.generation)} <small style="display:inline">kWh</small></div><small>${fmt(a.demand)} kWh de demanda anual</small></article><article class="card"><span class="eyebrow">${r.comparable ? "Ahorro neto · primer año" : "Demanda sin cubrir"}</span><div class="metric">${r.comparable ? usd(r.annualSaving) : fmt(a.missing) + ' <small style="display:inline">kWh/año</small>'}</div><small>${r.comparable ? "Incluye combustible y mantenimiento" : a.missing > 0.01 ? "Revisá las alertas antes de decidir" : "Sin referencia económica comparable"}</small></article></div><div class="split spaced"><section class="card"><h2>Tu energía, mes a mes.</h2><p class="muted">Generar de sobra en verano no asegura cubrir una noche de invierno.</p>${chart(a.rows)}</section><section class="card"><span class="badge">Configuración evaluada</span><h2 class="spaced">${s.panels} paneles${x.technology !== "solar" ? " + " + x.turbines + " turbina(s)" : ""}</h2><p>${fmt((s.panels * x.panelPower) / 1000, 2)} kWp solar · ${fmt(x.inverter, 1)} kW de inversor</p><p>${x.placement === "ground" ? "En suelo" : "En techo"} · inclinación ${s.tilt}° · azimut ${s.azimuth}°</p><p>${s.bank ? `${fmt(s.bank, 2)} kWh nominales de banco<br><small>${fmt((s.bank * x.dod) / 100, 2)} kWh utilizables antes de pérdidas · ${fmt((s.bank * 1000) / x.voltage)} Ah a ${x.voltage} V<br>${s.bankUnits} módulos equivalentes de ${x.batteryUnit} kWh</small>` : "Sin banco de baterías"}</p><small>${x.ideal ? "Inclinación sugerida por modelo simplificado." : "Disposición ingresada por el usuario."} Verificar montaje y compatibilidad.</small></section></div><div class="grid spaced"><article class="card"><h3>Energía de la red</h3><div class="metric">${fmt(a.grid)} <small style="display:inline">kWh/año</small></div><small>${fmt(a.exported)} kWh/año de excedentes valorizados</small></article><article class="card"><h3>Recuperación simple</h3><div class="metric">${r.comparable ? (r.payback !== null ? fmt(r.payback, 1) + " años" : "No recupera") : "No evaluable"}</div><small>${r.comparable ? "Primera recuperación; revisar reposiciones posteriores." : "Se necesita suministro comparable en ambos casos."}</small></article><article class="card"><h3>Valor actual neto</h3><div class="metric">${r.comparable ? usd(r.npv) : "—"}</div><small>${x.years} años · tasa real ${x.discount}% · supuestos constantes</small></article></div>${x.generator ? block("El grupo, como apoyo", `<div class="grid"><div><span class="eyebrow">Funcionamiento anual</span><div class="metric">${fmt(a.hours)} h</div></div><div><span class="eyebrow">Combustible anual</span><div class="metric">${fmt(a.fuel, 1)} ${fuelUnit(x)}</div></div><div><span class="eyebrow">Gasto en combustible</span><div class="metric">${usd(a.fuel * x.fuelPrice)}</div></div></div><p class="muted">Grupo de ${x.genPower} kW a ${x.genLoad}% de carga. Referencia sin renovables: ${fmt(r.base.fuel)} ${fuelUnit(x)}/año. Los tiempos diarios son promedios de todos los días del mes, incluidas ausencias.</p>`) : ""}${block("Detalle mensual", `<div class="scroll"><table><thead><tr><th>Mes</th><th>Consumo<br>kWh</th><th>Renovables<br>kWh</th><th>Red<br>kWh</th><th>Sin cubrir<br>kWh</th>${x.generator ? "<th>Grupo<br>h/día promedio</th><th>Combustible<br>" + fuelUnit(x) + "/mes</th>" : ""}</tr></thead><tbody>${a.rows.map((v) => `<tr><td>${v.month}</td><td>${fmt(v.energy)}</td><td>${fmt(v.generation)}</td><td>${fmt(v.gridEnergy)}</td><td>${fmt(v.missing, 1)}</td>${x.generator ? `<td>${fmt(v.genHours, 1)}</td><td>${fmt(v.fuelTotal, 1)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`)}<div class="two spaced"><section class="card"><h2>Presupuesto desglosado</h2><table><tbody>${r.items
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<tr><td>${k}</td><td>${usd(v)}</td></tr>`)
    .join(
      "",
    )}<tr><th>Total</th><th>${usd(r.capex)}</th></tr></tbody></table><small class="spaced">Banco manual: precio redondeado a módulos completos. No incluye financiación ni impuestos separados.</small></section><section class="card"><h2>Lo que hay que revisar</h2>${r.warnings.map((w) => `<p class="notice warn">${esc(w)}</p>`).join("")}<p class="notice">Balance con días representativos y perfiles horarios sintéticos. No simula rachas de mal tiempo ni garantiza autonomía.</p></section></div>${block("Compará alternativas con tus mismos datos", `<p class="muted">Se recalculan banco y grupo. Si quitás el banco, el grupo pasa a suministro directo. Si quitás el grupo, también se quita su compra.</p><div class="actions"><button class="btn secondary" data-action="without-battery">Probar sin baterías</button><button class="btn secondary" data-action="without-gen">Probar sin grupo</button></div>`)}<details class="card spaced"><summary>Fuentes, supuestos y procedencia</summary><p>${esc(x.source)}</p><p>Ubicación: ${x.lat}, ${x.lon}. ${x.resource ? "Consulta " + esc(x.resource.date) + " · " + esc(x.resource.period) : "Sin consulta climática registrada."}</p><p>Sombras: ${s.shade}%. Pérdidas globales: ${x.losses}%. Perfil de consumo: ${esc(x.habit)}. Parámetros marcados como estimados: ${
    Object.keys(x.unknown)
      .filter((k) => x.unknown[k])
      .map((k) => esc(HELP[k]?.[0] || k))
      .join(", ") || "ninguno"
  }.</p><p>Si falta radiación difusa se asume 40% de la horizontal; albedo 0,20. No se usa IA ni se inventan fuentes. Los datos de ejemplo no son climáticos reales.</p>${x.emissions > 0 && x.connection === "grid" ? `<p>Emisiones de red evitadas estimadas: ${fmt(Math.max(0, r.base.grid - a.grid) * x.emissions)} kg CO₂/año. Factor ingresado: ${x.emissions} kg CO₂/kWh. No incluye emisiones del grupo ni fabricación.</p>` : ""}</details><details class="card spaced"><summary>Flujo económico año a año</summary><p>${r.comparable ? "USD constantes. Degradación solar recalculada en el balance de cada año." : "Flujos orientativos no comparables: no usar para concluir rentabilidad."}</p><div class="scroll"><table><thead><tr><th>Año</th><th>Flujo neto USD</th><th>Reposiciones USD</th><th>Acumulado USD</th></tr></thead><tbody><tr><td>0</td><td>${fmt(-r.capex)}</td><td>—</td><td>${fmt(-r.capex)}</td></tr>${r.flows.map((v) => `<tr><td>${v.year}</td><td>${fmt(v.saving)}</td><td>${fmt(v.replacement)}</td><td>${fmt(v.cumulative)}</td></tr>`).join("")}</tbody></table></div></details><div class="actions spaced noprint"><button class="btn secondary" data-action="print">Imprimir / guardar PDF</button><button class="btn secondary" data-action="csv">Descargar tabla CSV</button></div>`;
}
function history() {
  let hs = store.history;
  return `<span class="eyebrow">Tu recorrido</span><h1>Ideas que quedan guardadas.</h1><p class="muted">Historial local de ${esc(store.profile)}. No se sincroniza entre dispositivos. Exportá un respaldo para trasladarlo.</p><div class="actions"><button class="btn" data-action="new">＋ Nueva simulación</button><button class="btn secondary" data-action="export">Exportar respaldo</button></div>${hs.length ? `<div class="two spaced">${hs.map((r) => `<article class="card"><span class="badge">${esc(r.x.technology)} · ${new Date(r.date).toLocaleDateString("es-AR")}</span><h2 class="spaced">${esc(r.x.title)}</h2><p class="muted">${esc(r.x.house)} · ${esc(r.x.location || "Por coordenadas")}</p><div class="metric">${usd(r.capex)}</div><small>${fmt(r.a.generation)} kWh/año · ${fmt(r.a.missing)} kWh sin cubrir</small><div class="actions spaced"><button class="btn small" data-open="${esc(r.id)}">Ver resultado</button><button class="btn secondary small" data-compare="${esc(r.id)}">Comparar</button><button class="btn secondary small" data-delete="${esc(r.id)}">Eliminar</button></div></article>`).join("")}</div>` : '<div class="card empty spaced"><div class="icon">◷</div><h2>Tu primera idea empieza acá.</h2><p class="muted">Simulá y tocá “Guardar escenario” al ver el resultado.</p></div>'}<details class="card spaced"><summary>Viviendas guardadas (${store.houses.length})</summary><p>Al guardar un escenario se conserva una ficha de la vivienda. Cargarla crea un borrador nuevo.</p><div class="actions">${store.houses.map((h, i) => `<button class="btn secondary small" data-house="${i}">${esc(h.house)}</button>`).join("") || "Todavía no guardaste viviendas."}</div></details>`;
}
const builtins = [
  {
    name: "Solar mono · referencia 550 W",
    kind: "solar",
    power: 550,
    area: 2.6,
    price: 140,
  },
  {
    name: "Solar compacto · referencia 450 W",
    kind: "solar",
    power: 450,
    area: 2.1,
    price: 120,
  },
  {
    name: "Banco LFP · referencia 5,12 kWh",
    kind: "battery",
    power: 5.12,
    price: 1000,
  },
  {
    name: "Eólica · referencia 1,5 kW",
    kind: "wind",
    power: 1500,
    price: 1500,
  },
];
function catalog() {
  return `<span class="eyebrow">Tu biblioteca técnica</span><h1>Equipos con números claros.</h1><p class="muted">Referencias didácticas sin marca ni cotización vigente. Agregá la ficha y el precio de tu proveedor.</p><button class="btn" data-action="new-equipment">＋ Agregar equipo</button><div class="grid spaced">${[...builtins, ...store.catalog].map((e, i) => `<article class="card"><div class="icon">${e.kind === "solar" ? "☀" : e.kind === "wind" ? "≋" : "ϟ"}</div><span class="badge">${e.kind === "solar" ? "Panel" : e.kind === "wind" ? "Aerogenerador" : "Batería"}</span><h3 class="spaced">${esc(e.name)}</h3><div class="metric">${fmt(e.power, 2)} <small style="display:inline">${e.kind === "battery" ? "kWh" : "W"}</small></div>${e.kind === "solar" ? `<small>${e.area} m² · eficiencia STC aproximada ${fmt((e.power / (e.area * 1000)) * 100, 1)}%</small>` : e.kind === "wind" ? "<small>Curva genérica editable en modo técnico.</small>" : "<small>Capacidad nominal; uso condicionado por DoD.</small>"}<p>${usd(e.price)} / unidad</p><button class="btn quiet small" data-equipment="${i}">Usar en mi borrador →</button>${i >= builtins.length ? `<button class="btn secondary small" data-delete-equipment="${i - builtins.length}">Eliminar</button>` : ""}</article>`).join("")}</div>`;
}
function learn() {
  return `<span class="eyebrow">Energía entendible</span><h1>Un poco de luz sobre el tema.</h1>${block(
    "Del sol a tu casa",
    `<div class="flow">${[
      ["☀", "01 · Sol", "La radiación llega al módulo."],
      ["▦", "02 · Panel", "Genera electricidad continua."],
      ["ϟ", "03 · Inversor", "Adapta la energía a tus consumos."],
      ["⌂", "04 · Hogar", "Usás, almacenás o gestionás el excedente."],
    ]
      .map(
        ([ic, t, p]) =>
          `<div><span style="font-size:28px">${ic}</span><b>${t}</b><small>${p}</small></div>`,
      )
      .join("")}</div>`,
  )}<div class="two spaced"><article class="card"><h2>Potencia ≠ energía</h2><p>Un aparato de 1 kW durante 2 horas consume 2 kWh. El inversor y el grupo deben soportar potencia; paneles y baterías deben aportar energía.</p></article><article class="card"><h2>Generar no siempre es ahorrar</h2><p>La energía debe coincidir con tu consumo, guardarse o entregarse a una red habilitada. Un excedente no aprovechado no reduce tu factura.</p></article></div>${block("Qué hace este modelo", `<details open><summary>Solar: ubicación, inclinación y pérdidas</summary><p>NASA POWER: promedios mensuales de radiación horizontal (ALLSKY_SFC_SW_DWN), radiación difusa (ALLSKY_SFC_SW_DIFF) y viento a 10 m (WS10M). Si un parámetro falta, la consulta no se presenta como completa. La orientación se resuelve mediante geometría solar de un día representativo por mes, cielo difuso isotrópico y albedo 0,20. Sin difusa medida/modelada se asume 40% de GHI.</p><p>La energía se distribuye en 24 horas solares y se limita por potencia del inversor. Se aplican pérdidas y sombras una vez. No se modelan horizontes, nieve, temperaturas horarias ni sombras entre filas. Latitudes admitidas: ±60°.</p></details><details><summary>Baterías y generador</summary><p>Se repite 12 veces el día promedio de cada mes para aproximar un estado de carga periódico. La batería respeta capacidad utilizable, potencia y eficiencia de ciclo. El generador atiende la demanda faltante o carga, según la elección. No hay energía inicial gratuita. No se modelan secuencias de nubes, arranques ni tiempos mínimos de marcha.</p><p>La carga mensual promedio incluye ausencias: las horas de grupo no describen un día ocupado concreto. El banco sugerido usa consumo esencial × autonomía / (DoD × eficiencia de descarga), redondeado a módulos. No verifica corriente máxima, BMS, temperatura ni compatibilidad del inversor.</p></details><details><summary>Eólica</summary><p>Velocidad ajustada por altura con ley potencial. Distribución Rayleigh (Weibull k=2) integrada sobre una curva genérica cúbica entre arranque y nominal, con corte. Se usa densidad de referencia implícita en la curva; no hay corrección por altitud. La potencia media se reparte uniforme durante el día: simplificación fuerte que no evalúa calmas ni turbulencia. El entorno solo agrega advertencias, no corrige mágicamente el recurso.</p></details><details><summary>Dinero e historial</summary><p>USD constantes. Referencia sin renovables: red o grupo seleccionado. Ahorro neto: diferencia de energía comprada y combustible, menos mantenimiento. Reposición de batería e inversor según vida indicada; sin financiación, inflación, impuestos separados, valor residual o reposición de paneles/turbinas. La degradación solar se aplica año a año. VAN y recuperación se omiten si los escenarios no cubren la misma demanda.</p><p>Los perfiles son locales sin contraseña: no son cuentas autenticadas. El historial no se migra automáticamente desde la versión 1 ni se sincroniza. El respaldo JSON de esta versión se puede importar en otro navegador.</p></details>`)}${block("Fuentes para seguir aprendiendo", `<p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/climatology/" target="_blank" rel="noopener">NASA POWER · recurso climático y API ↗</a></p><p><a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener">Open-Meteo / GeoNames · búsqueda de localidades ↗</a></p><p><a href="https://www.argentina.gob.ar/economia/energia/energia-electrica/renovables/estudios-y-publicaciones" target="_blank" rel="noopener">Secretaría de Energía · Guía del Recurso Solar ↗</a></p><p><a href="https://www.argentina.gob.ar/economia/energia/informacion-geografica-energia/mapas-irradiancia-solar" target="_blank" rel="noopener">Mapas de irradiación de Argentina ↗</a></p><p class="muted">La guía argentina es una referencia para carga manual. Esta edición no contiene una base extraída de sus tablas ni afirma usarla en consultas automáticas. No se usa IA: se consultan fuentes y se calculan supuestos explícitos.</p>`)}<section class="hero spaced"><div><span class="eyebrow">Brisa · By Los Vagos</span><h1>Tu próxima decisión<br>empieza con energía.</h1><p>Explorá escenarios solares, eólicos y de respaldo. Datos claros para conversar con tu instalador.</p><button class="btn lime noprint" data-action="print">Imprimir folleto ↗</button></div>${art}</section>`;
}
function profile() {
  return `<span class="eyebrow">Tu espacio local</span><h1>Mi perfil.</h1><div class="two spaced"><section class="card"><h2>¿Cómo te llamamos?</h2><form id="profileform"><div class="field"><label for="profilename">Nombre del perfil</label><input id="profilename" name="name" maxlength="80" value="${esc(store.profile)}" required></div><button class="btn spaced">Guardar nombre</button></form><p class="notice">Este nombre identifica el espacio de este navegador. No es una cuenta online ni tiene contraseña. Personas que usen este mismo navegador pueden acceder a sus datos.</p></section><section class="card"><h2>Tus datos, con vos.</h2><p class="muted">Descargá el respaldo y guardalo en un lugar seguro. Incluye historial, viviendas y catálogo.</p><div class="actions"><button class="btn secondary" data-action="export">Exportar respaldo</button><button class="btn secondary" data-action="import">Importar respaldo v2</button></div><input type="file" id="importfile" accept="application/json,.json" hidden><small class="spaced">Importar reemplaza el espacio local, después de confirmarlo. No borra el historial de Brisa v1, guardado con otra clave.</small></section></div>`;
}
function download(name, data, type) {
  let blob = new Blob([data], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function getJSON(url) {
  const ctrl = new AbortController(),
    timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    let r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw Error("Respuesta " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
async function searchGeo() {
  if (d.location.trim().length < 3)
    return toast("Escribí al menos tres letras de la localidad.");
  busy = true;
  render();
  try {
    const j = await getJSON(
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(d.location) +
        "&count=8&language=es&format=json",
    );
    geoResults = j.results || [];
    if (!geoResults.length)
      toast(
        "Sin coincidencias. Probá una localidad cercana o ingresá coordenadas.",
      );
  } catch {
    toast(
      "No se pudo consultar. Podés ingresar latitud y longitud manualmente.",
    );
  } finally {
    busy = false;
    render();
  }
}
async function climate() {
  if (d.lat < -60 || d.lat > 60 || d.lon < -180 || d.lon > 180)
    return toast("Revisá las coordenadas.");
  busy = true;
  render();
  let lat = d.lat,
    lon = d.lon;
  try {
    const j = await getJSON(
      "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF,WS10M&community=RE&longitude=" +
        lon +
        "&latitude=" +
        lat +
        "&format=JSON",
    );
    const p = j.properties?.parameter,
      keys = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
    const read = (k) => keys.map((m) => p?.[k]?.[m]);
    let g = read("ALLSKY_SFC_SW_DWN"),
      df = read("ALLSKY_SFC_SW_DIFF"),
      w = read("WS10M");
    if (
      g.some((v) => !Number.isFinite(v) || v < 0 || v > 15) ||
      df.some((v) => !Number.isFinite(v) || v < 0 || v > 15) ||
      w.some((v) => !Number.isFinite(v) || v < 0 || v > 40)
    )
      throw Error("Serie incompleta");
    if(d.lat!==lat || d.lon!==lon){toast("La ubicación cambió durante la consulta. Consultá el clima del nuevo punto.");return;}
    d.ghi = g;
    d.diffuse = df;
    d.wind = w;
    d.measureHeight = 10;
    d.resourceMode = "nasa";
    d.resource = {
      date: new Date().toISOString().slice(0, 10),
      period:
        j.header?.range ||
        String(j.header?.start || "inicio no informado") +
          " – " +
          String(j.header?.end || "fin no informado"),
      lat,
      lon,
    };
    d.source =
      "NASA POWER · climatología modelada por coordenadas " + lat + ", " + lon;
    toast("Recurso mensual cargado. Verificá la ubicación.");
  } catch {
    toast(
      "No se pudo cargar NASA POWER. Conservamos los datos anteriores y su fuente; podés reintentar o ingresar datos documentados.",
    );
  } finally {
    busy = false;
    render();
  }
}
function equipmentDialog() {
  let dialog = $("#dialog");
  dialog.innerHTML = `<button class="theme dialogclose" onclick="this.closest('dialog').close()">✕</button><h2>Agregar ficha</h2><form id="eqform"><div class="formgrid"><div class="field full"><label>Nombre / modelo</label><input name="name" maxlength="100" required></div><div class="field"><label>Tipo</label><select name="kind"><option value="solar">Panel solar</option><option value="wind">Aerogenerador</option><option value="battery">Batería</option></select></div><div class="field"><label>W · Potencia / kWh · Batería</label><input name="power" type="number" step="any" min=".1" max="100000" required></div><div class="field"><label>m² · Área (solo panel)</label><input name="area" type="number" step="any" min=".1" max="100" value="2.6" required></div><div class="field"><label>USD · Precio unitario</label><input name="price" type="number" step="any" min="0" max="10000000" required></div></div><p class="muted">Para eólica, ajustá arranque, nominal y corte en el modo técnico. No se importa una curva certificada.</p><button class="btn">Guardar equipo</button></form>`;
  dialog.showModal();
}
let comparisons = [];
function compare(id) {
  comparisons.push(id);
  comparisons = [...new Set(comparisons)];
  if (comparisons.length < 2)
    return toast("Ahora tocá “Comparar” en otro escenario.");
  let [a, b] = comparisons
    .slice(-2)
    .map((id) => store.history.find((r) => r.id === id));
  comparisons = [];
  $("#dialog").innerHTML =
    `<button class="theme dialogclose" onclick="this.closest('dialog').close()">✕</button><h2>Dos ideas, lado a lado.</h2><div class="scroll"><table><tr><th>Indicador</th><th>${esc(a.x.title)}</th><th>${esc(b.x.title)}</th></tr>${[
      ["Inversión", usd(a.capex), usd(b.capex)],
      ["Generación kWh/año", fmt(a.a.generation), fmt(b.a.generation)],
      ["Sin cubrir kWh/año", fmt(a.a.missing), fmt(b.a.missing)],
      ["Banco nominal kWh", fmt(a.s.bank, 2), fmt(b.s.bank, 2)],
      [
        "Ahorro neto USD/año",
        a.comparable ? fmt(a.annualSaving) : "No evaluable",
        b.comparable ? fmt(b.annualSaving) : "No evaluable",
      ],
    ]
      .map(
        (row) =>
          "<tr>" +
          row
            .map((v, i) => `<${i ? "td" : "th"}>${v}</${i ? "td" : "th"}>`)
            .join("") +
          "</tr>",
      )
      .join(
        "",
      )}</table></div><p class="notice">Compará escenarios con demanda, fuente y precios equivalentes. El menor costo no implica igual servicio.</p>`;
  $("#dialog").showModal();
}
function markManualClimate() {
  d.resourceMode = "manual";
  d.resource = null;
  d.diffuse = Array(12).fill(null);
  if (d.source.startsWith("NASA") || d.source.startsWith("Ejemplo"))
    d.source = "Carga manual · completar fuente y período";
}
function updateValue(t) {
  let k = t.dataset.k;
  if (k) {
    let val =
      t.type === "checkbox"
        ? t.checked
        : t.type === "number"
          ? t.value === ""
            ? NaN
            : Number(t.value)
          : t.value;
    d[k] = val;
    if (d.unknown[k]) delete d.unknown[k];
    if (k === "lat" || k === "lon") {
      if (d.resourceMode === "nasa") {
        d.resourceMode = "manual";
        d.resource = null;
        d.source =
          "Datos de ubicación anterior: recargar NASA POWER para estas coordenadas.";
        d.resourceMode = "stale";
      }
    }
    if (k === "tariffARS" && d.exchange > 0) {
      d.tariff = d.tariffARS / d.exchange;
      delete d.unknown.tariff;
      let el = $("#f-tariff");
      if (el) el.value = d.tariff;
      let out = $("#converted");
      if (out) out.textContent = usd(d.tariff) + " / kWh";
    }
    if (k === "exchange" && d.exchange > 0 && d.tariffARS > 0)
      d.tariff = d.tariffARS / d.exchange;
    if (k === "battery" && val === "none") d.genUse = "direct";
    if (k === "genFuel") {
      d.unknown.fuelRate = true;
      toast("Revisá consumo y precio: cambió la unidad del combustible.");
    }
    if (k === "source" && d.resourceMode === "demo") markManualClimate();
  }
  if (t.dataset.array) {
    d[t.dataset.array][+t.dataset.index] =
      t.value === "" ? NaN : Number(t.value);
    if (t.dataset.array === "ghi") markManualClimate();
    if (t.dataset.array === "wind" && d.resourceMode === "nasa")
      d.source = d.source.includes("viento editado")
        ? d.source
        : d.source + " · viento editado manualmente";
  }
  if (t.dataset.month !== undefined) d.months[+t.dataset.month] = t.checked;
  if (t.dataset.app !== undefined)
    d.appliances[+t.dataset.app][t.dataset.prop] =
      t.type === "number" ? Number(t.value) : t.value;
}

Object.assign(HELP, {
  location: [
    "Localidad de la vivienda",
    "Buscá la localidad y seleccioná la coincidencia correcta. La búsqueda completa coordenadas; no carga automáticamente el clima. Si la casa está lejos del centro, ingresá sus coordenadas.",
  ],
  lat: [
    "Latitud",
    "Distancia angular al ecuador. En Argentina es negativa; por ejemplo −40,4°. Este modelo admite entre −60° y 60°. Confirmá el punto antes de consultar NASA POWER.",
  ],
  lon: [
    "Longitud",
    "Distancia angular al meridiano de Greenwich. En Argentina es negativa; por ejemplo −71,3°. Combinada con la latitud identifica el punto de consulta, no el área del techo.",
  ],
  source: [
    "Fuente del recurso",
    "Anotá quién publicó los datos, su período y el lugar al que corresponden. Los valores manuales deben ser promedios mensuales de radiación horizontal; no ingreses radiación ya inclinada.",
  ],
  panelPower: [
    "Potencia nominal del panel",
    "Potencia de un módulo en Wp bajo condiciones de ensayo. Un panel de 550 W no produce 550 W todo el día. La cantidad de módulos y el recurso climático determinan la energía estimada.",
  ],
  panelArea: [
    "Superficie de un módulo",
    "Área física de un solo panel en m²: largo por ancho. Un módulo de 2,2 m × 1,1 m ocupa 2,42 m². Este dato se usa para limitar cuántos módulos caben; no es el área de todo el techo.",
  ],
  panelPrice: [
    "Precio de un panel",
    "Costo en USD de un solo módulo. El presupuesto lo multiplica por la cantidad de paneles. No incluyas aquí inversor, estructura ni mano de obra.",
  ],
  inverter: [
    "Potencia del inversor",
    "Potencia de salida en corriente alterna, en kW. Limita la conversión solar en el modelo. La potencia de los paneles se expresa en kWp y puede diferir; verificá límites de entrada, tensión, corriente y arranques con la ficha.",
  ],
  tilt: [
    "Inclinación de los paneles",
    "Ángulo respecto del plano horizontal: 0° es horizontal y 90° es vertical. Se usa al convertir la radiación horizontal al plano del módulo. En un techo verificá que el montaje permita ese ángulo.",
  ],
  azimuth: [
    "Orientación de los paneles",
    "Rumbo medido desde el norte: norte 0°, este 90°, sur 180° y oeste 270°. Es distinto de la inclinación. En Argentina el norte suele ser la referencia para captar el recurso solar.",
  ],
  batterySize: [
    "Capacidad nominal del banco",
    "Energía nominal total en kWh. La reserva utilizable es menor por profundidad de descarga y pérdidas. No ingreses Ah sin convertirlos a energía usando la tensión del banco.",
  ],
  batteryUnit: [
    "Capacidad de cada módulo de batería",
    "kWh nominales de una unidad. Se usa para redondear el banco a módulos completos y calcular su precio. Por ejemplo: dos módulos de 5,12 kWh suman 10,24 kWh nominales.",
  ],
  batteryUnitPrice: [
    "Precio de un módulo de batería",
    "Costo en USD de una unidad de la capacidad indicada. El presupuesto multiplica este precio por el número de módulos completos; no es el precio del banco entero.",
  ],
  batteryPower: [
    "Potencia de carga y descarga",
    "Máxima potencia en kW que el banco puede absorber o entregar en este modelo. Es distinta de su capacidad en kWh: un banco grande puede tener poca potencia disponible. Revisá BMS y compatibilidad.",
  ],
  dod: [
    "Profundidad de descarga",
    "Porcentaje de la capacidad nominal que permitís utilizar. Un banco de 10 kWh al 80% ofrece 8 kWh antes de pérdidas. Respetá el límite del fabricante para el uso previsto.",
  ],
  batteryEff: [
    "Eficiencia de ciclo de batería",
    "Porcentaje de energía que vuelve después de cargar y descargar. Con 90%, de cada 10 kWh de entrada recuperás aproximadamente 9 kWh. El modelo reparte las pérdidas entre carga y descarga.",
  ],
  hub: [
    "Altura del rotor",
    "Altura del centro del rotor sobre el suelo, en metros. La velocidad se ajusta desde la altura del dato usando el exponente de altura. No reemplaza una evaluación de obstáculos y turbulencia.",
  ],
  measureHeight: [
    "Altura de medición del viento",
    "Altura sobre el suelo a la que corresponde la velocidad mensual. NASA POWER proporciona WS10M a 10 m. No ingreses la altura del rotor aquí salvo que el dato se haya medido allí.",
  ],
  trees: [
    "Altura de los árboles",
    "Altura aproximada de los obstáculos en metros. Se registra para revisar el emplazamiento eólico; no aplica automáticamente una corrección de viento ni dimensiona una torre.",
  ],
  treeDistance: [
    "Distancia a los árboles",
    "Separación horizontal entre el emplazamiento y los árboles, en metros. Ayuda a documentar obstáculos; este modelo no calcula una zona de turbulencia a partir de esta distancia.",
  ],
  turbinePrice: [
    "Precio de una turbina",
    "Costo en USD de un aerogenerador. Torre, cimentación, cableado y montaje se cargan en los rubros correspondientes para evitar duplicarlos.",
  ],
  genPower: [
    "Potencia nominal del grupo",
    "Potencia eléctrica nominal en kW. La potencia efectiva del modelo es este valor multiplicado por su carga de trabajo. Verificá si la ficha indica potencia continua o de emergencia y los arranques.",
  ],
  genFuel: [
    "Tipo de combustible",
    "Define la unidad del consumo: gasoil y nafta en litros, GLP en kg y gas natural en m³. Cambiarlo no convierte el consumo anterior: revisá consumo por hora y precio por unidad.",
  ],
  fuelPrice: [
    "Precio del combustible",
    "Precio en USD por litro, kg o m³, según el combustible seleccionado. El gasto es consumo anual por ese precio. No es el costo de compra del grupo.",
  ],
  genCharge: [
    "Potencia del cargador",
    "Límite en kW para cargar el banco desde el grupo. También se limita por la potencia de batería y energía disponible. No equivale a capacidad en kWh ni a potencia nominal del generador.",
  ],
  exchangeDate: [
    "Fecha de la cotización",
    "Fecha de referencia del valor ARS/USD que ingresaste. Se guarda con el escenario; la aplicación no actualiza esa cotización automáticamente.",
  ],
  tariffARS: [
    "Tarifa de energía en pesos",
    "Cargo variable por kWh de la factura en ARS. La app lo divide por tu cotización ARS/USD para obtener USD/kWh. No incluyas cargos fijos en este importe.",
  ],
});
const costNames = {
  costInverter: "inversor",
  costStructure: "estructura",
  costProtection: "protecciones",
  costCable: "cableado",
  costController: "controlador adicional",
  costLabor: "mano de obra",
  costTransport: "transporte",
  costPermits: "trámites",
  costTower: "torre y cimentación",
  costGen: "compra del grupo electrógeno",
};
for (const [k, name] of Object.entries(costNames))
  HELP[k] = [
    "Costo de " + name,
    "Ingresá el costo total en USD de " +
      name +
      " para este escenario, según un presupuesto. Los precios iniciales son ejemplos. Paneles, turbinas y baterías se suman en sus propios rubros; evitá repetir importes.",
  ];
function monthReadout(v) {
  return (
    v.month +
    " · Generación: " +
    fmt(v.generation, 1) +
    " kWh · Consumo: " +
    fmt(v.energy, 1) +
    " kWh · Red: " +
    fmt(v.gridEnergy, 1) +
    " kWh · Sin cubrir: " +
    fmt(v.missing, 1) +
    " kWh"
  );
}
function chart(rows) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.energy, r.generation]));
  return `<div class="monthly-chart"><div class="legend"><span><i class="swatch generation"></i>Generación renovable</span><span><i class="swatch demand"></i>Consumo</span></div><small>Escala máxima: ${fmt(max)} kWh/mes. Elegí un mes para ver sus valores.</small><div class="chart">${rows.map((v, i) => `<button type="button" class="chartgroup" data-chart-month="${i}" aria-pressed="${i === 0}" aria-label="${esc(monthReadout(v))}"><span class="bars"><span class="bar generation" style="height:${(v.generation / max) * 100}%;--delay:${i * 25}ms"></span><span class="bar demand" style="height:${(v.energy / max) * 100}%;--delay:${i * 25 + 50}ms"></span></span><span class="month-label">${v.month}</span></button>`).join("")}</div><p class="chart-readout" aria-live="polite">${esc(monthReadout(rows[0]))}</p></div>`;
}
function cashChart(r) {
  if (!r.comparable)
    return '<p class="notice">La rentabilidad no se grafica porque los escenarios no ofrecen un suministro comparable.</p>';
  let values = [-r.capex, ...r.flows.map((v) => v.cumulative)],
    lo = Math.min(...values, 0),
    hi = Math.max(...values, 0),
    range = Math.max(1, hi - lo),
    xp = (i) => 44 + (i / (values.length - 1)) * 620,
    yp = (v) => 185 - ((v - lo) / range) * 150,
    zero = yp(0);
  return `<div class="cash-chart"><svg viewBox="0 0 720 230" role="img" aria-label="Flujo acumulado: comienza en ${esc(usd(-r.capex))} y termina en ${esc(usd(values.at(-1)))} al año ${r.flows.length}. Valores exactos en el flujo económico año a año."><line x1="44" x2="664" y1="${zero}" y2="${zero}" class="axis"/><text x="8" y="${zero - 6}">0 USD</text><polyline points="${values.map((v, i) => xp(i) + "," + yp(v)).join(" ")}" class="cash-line"/>${values.map((v, i) => `<circle cx="${xp(i)}" cy="${yp(v)}" r="3" class="cash-point"><title>Año ${i}: ${usd(v)}</title></circle>`).join("")}<text x="44" y="215">Año 0</text><text x="604" y="215">Año ${r.flows.length}</text><text x="44" y="24">${esc(usd(hi))}</text><text x="44" y="200">${esc(usd(lo))}</text></svg><p class="muted">Saldo acumulado al año ${r.flows.length}: <strong>${usd(values.at(-1))}</strong>. Incluye reposiciones; no está descontado.</p></div>`;
}
function overview(r) {
  const a = r.a,
    pct =
      a.demand > 0
        ? clamp(((a.demand - a.missing) / a.demand) * 100, 0, 100)
        : 0;
  let sources =
    r.x.resourceMode === "demo"
      ? "Clima de ejemplo"
      : r.x.resourceMode === "stale"
        ? "Clima de otra ubicación"
        : r.x.resourceMode === "nasa"
          ? "Clima de NASA POWER"
          : "Recurso manual";
  return `<section class="scenario-overview" aria-label="Lectura del escenario"><div><span class="eyebrow">Primero, lo esencial</span><h2>${a.missing > 0.01 ? "Hay demanda por cubrir." : "La demanda queda cubierta en el modelo."}</h2><p>${a.missing > 0.01 ? `${fmt(a.missing, 1)} kWh/año quedan sin abastecer. Revisá sistema y respaldo antes de evaluar la inversión.` : "El balance combina las fuentes seleccionadas. Cubrir la demanda no significa autonomía frente a cortes ni garantiza servicio real."}</p><span class="badge">${sources}</span></div><div class="coverage"><div class="coverage-ring" style="--coverage:${pct}%"><strong>${fmt(pct, 1)}%<small>cubierto</small></strong></div><p>Cobertura de demanda<br><small>Incluye red y grupo si están activos.</small></p></div></section><nav class="result-sections" aria-label="Secciones del resultado"><a href="#energy-section" data-section="energy-section">Energía</a><a href="#investment-section" data-section="investment-section">Inversión</a><a href="#review-section" data-section="review-section">Revisión técnica</a></nav>`;
}
function results() {
  let html = resultsBase();
  const start = html.indexOf('<div class="grid spaced">');
  html = html.slice(0, start) + overview(result) + html.slice(start);
  html = html.replace(
    "<h2>Tu energía, mes a mes.</h2>",
    '<h2 id="energy-section">Tu energía, mes a mes.</h2>',
  );
  html = html.replace(
    "<h2>Presupuesto desglosado</h2>",
    '<h2 id="investment-section">Presupuesto desglosado</h2>',
  );
  html = html.replace(
    "<h2>Lo que hay que revisar</h2>",
    '<h2 id="review-section">Lo que hay que revisar</h2>',
  );
  html = html.replace(
    '<section class="card spaced"><h2>Detalle mensual</h2>',
    '<details class="card spaced"><summary>Tabla mensual · valores exactos</summary>',
  );
  const tableEnd = html.indexOf(
    "</section>",
    html.indexOf("<summary>Tabla mensual"),
  );
  if (tableEnd >= 0)
    html = html.slice(0, tableEnd) + "</details>" + html.slice(tableEnd + 10);
  html = html.replace(
    '<details class="card spaced"><summary>Flujo económico año a año</summary>',
    `<section class="card spaced"><h2>¿Cómo evoluciona tu inversión?</h2>${cashChart(result)}</section><details class="card spaced"><summary>Flujo económico año a año · tabla</summary>`,
  );
  return html;
}
const STEP_TEXT = [
  [
    "Tu vivienda y tu objetivo",
    "Definí cuándo usás la casa y qué necesitás del sistema.",
  ],
  [
    "El lugar y su recurso",
    "Confirmá el punto, el clima y el espacio de instalación.",
  ],
  [
    "La energía que necesitás",
    "Usá la factura o sumá artefactos. Energía y potencia van por separado.",
  ],
  [
    "Tu combinación de equipos",
    "Probá generación, almacenamiento y respaldo según tus necesidades.",
  ],
  [
    "El presupuesto y el horizonte",
    "Revisá costos y supuestos antes de calcular.",
  ],
];
function summaryContent() {
  const tech = { solar: "Solar", wind: "Eólica", hybrid: "Solar + eólica" };
  return `<span class="eyebrow">Tu escenario en construcción</span><h3>${esc(d.house || "Mi vivienda")}</h3><dl><dt>Conexión</dt><dd>${d.connection === "grid" ? "Con red" : "Aislada"}</dd><dt>Meses de uso</dt><dd>${d.months.filter(Boolean).length} de 12</dd><dt>Consumo ingresado</dt><dd>${d.energyMode === "appliances" ? fmt(applianceDaily(d), 1) + " kWh/día" : d.monthlyCustom ? "12 valores mensuales" : fmt(d.monthly) + " kWh/30 días"}</dd><dt>Tecnología</dt><dd>${tech[d.technology]}</dd><dt>Respaldo</dt><dd>${d.battery === "none" ? "Sin banco" : "Con baterías"}${d.generator ? " + grupo" : ""}</dd></dl><p class="notice ${d.resourceMode === "demo" || d.resourceMode === "stale" ? "warn" : ""}">${d.resourceMode === "demo" ? "Clima de ejemplo: cargá el recurso de tu ubicación." : d.resourceMode === "stale" ? "La ubicación cambió. Volvé a consultar el clima." : esc(d.source)}</p><small>Resumen de tus entradas. Los resultados se calculan al finalizar.</small>`;
}
function refreshSummary() {
  const el = $("#scenario-summary");
  if (el) el.innerHTML = summaryContent();
}
function wizard() {
  let html = wizardBase();
  html = html
    .replace(
      "<h1>Diseñemos tu escenario.</h1>",
      `<h1>${STEP_TEXT[step][0]}</h1>`,
    )
    .replace(
      "Cada dato tiene una explicación. Tocá “?” cuando lo necesites.",
      STEP_TEXT[step][1],
    );
  html = html
    .replace(
      '<form id="wizard">',
      `<div class="wizard-layout"><form id="wizard">`,
    )
    .replace(
      "</form>",
      `</form><section class="scenario-summary card" id="scenario-summary">${summaryContent()}</section></div>`,
    );
  html = html.replace(
    '<div class="stepper">',
    `<div class="progress-track" role="progressbar" aria-label="Paso de configuración" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${step + 1}"><span style="width:${(step + 1) * 20}%"></span></div><div class="stepper">`,
  );
  html = html.replaceAll(
    'class="active">',
    'class="active" aria-current="step">',
  );
  return html;
}
function home() {
  const last = store.history[0];
  return `<div class="sectionhead" style="margin-top:0"><div><span class="eyebrow">Tu espacio energético</span><h2>Hola, ${esc(store.profile)}.</h2></div><span class="badge">${store.history.length} escenarios guardados</span></div><section class="hero"><div><span class="eyebrow">Solar · Eólica · Respaldo</span><h1>Entendé tu energía.<br>Elegí tu sistema.</h1><p>Desde el consumo de tu casa hasta la inversión. Explorá cada decisión con sus datos y supuestos.</p><div class="actions"><button class="btn lime" data-start="home">Explorar mi casa</button><button class="btn hero-secondary" data-start="tech">Abrir modo técnico</button></div></div>${art}</section><div class="sectionhead"><h2>Tu casa, en seis preguntas simples.</h2></div><div class="journey-grid">${[
    ["01", "Qué buscás", "Bajar compras de energía o tener respaldo."],
    ["02", "Dónde vivís", "El sol de tu lugar y cuándo usás la casa."],
    ["03", "Qué consumís", "Tu factura o los aparatos que usás."],
    ["04", "Dónde instalar", "El espacio y las sombras."],
    ["05", "Qué respaldar", "Los aparatos que querés mantener."],
    ["06", "Tu propuesta", "Lo que sabemos y lo que falta confirmar."],
  ]
    .map(
      ([n, t, desc]) =>
        `<article class="journey-item"><span>${n}</span><h3>${t}</h3><p>${desc}</p></article>`,
    )
    .join(
      "",
    )}</div><div class="two spaced"><section class="card"><span class="eyebrow">De los datos a las decisiones</span><h2 class="spaced">Leé el resultado de un vistazo.</h2><p class="muted">Compará generación y consumo mes a mes, revisá demanda sin cubrir y seguí la evolución de la inversión.</p><div class="home-resource">${defaults()
    .ghi.map(
      (v, i) =>
        `<div><span style="height:${(v / 7) * 100}%" title="${M[i]}: ${v} kWh/m²/día"></span><small>${M[i]}</small></div>`,
    )
    .join(
      "",
    )}</div><p class="notice">Ejemplo ilustrativo de radiación mensual, en kWh/m²/día. No corresponde a tu ubicación.</p><button class="btn quiet" data-route="learn">Entender los conceptos</button></section><section class="card"><span class="eyebrow">Continuá desde tus datos</span><h2 class="spaced">${last ? "Tu último escenario" : "Tu primer escenario empieza acá."}</h2>${last ? `<h3>${esc(last.x.title)}</h3><p class="muted">${esc(last.x.house)} · ${new Date(last.date).toLocaleDateString("es-AR")}</p><div class="metric">${last.x.hogar&&!last.x.hogar.budgetKnown?"Presupuesto pendiente":usd(last.capex)}</div><button class="btn" data-open="${esc(last.id)}">Abrir escenario</button><button class="btn quiet spaced" data-route="history">Ver historial</button>` : '<p class="muted">Usá tus facturas y fichas de equipos. Si falta un dato, las ayudas explican cómo obtenerlo y cuáles son los supuestos.</p><button class="btn" data-start="tech">Empezar simulación</button>'}<p class="notice spaced">Tu historial se guarda en este navegador. Exportá un respaldo para llevarlo a otra dirección o dispositivo.</p><button class="btn quiet" data-route="profile">Gestionar respaldos</button></section></div>`;
}
// Section links scroll inside the result without replacing its hash route.
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-section]");
  if (!link) return;
  e.preventDefault();
  const section = document.getElementById(link.dataset.section);
  section?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
  if (section) {
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
  }
});

document.addEventListener("input", (e) => {
  updateValue(e.target);
  refreshSummary();
});
document.addEventListener("change", (e) => {
  let t = e.target;
  updateValue(t);
  if (
    t.dataset.k &&
    [
      "role",
      "connection",
      "placement",
      "ideal",
      "shadeChoice",
      "energyMode",
      "monthlyCustom",
      "technology",
      "sizing",
      "battery",
      "generator",
      "genFuel",
      "terrain",
      "exportEnabled",
      "exchange",
    ].includes(t.dataset.k)
  )
    render();
  if (t.id === "importfile") importBackup(t.files[0]);
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "wizard") {
    try {
      if (!d.months.some(Boolean)) throw Error("Elegí al menos un mes de uso.");
      if (step < 4) {
        step++;
        render();
        window.scrollTo(0, 0);
      } else {
        result = calculate(d);
        go("results");
      }
    } catch (err) {
      $("#formerror").textContent = err.message;
    }
  }
  if (e.target.id === "profileform") {
    store.profile = new FormData(e.target).get("name").trim() || "Mi hogar";
    persist();
    toast("Nombre actualizado.");
    render();
  }
  if (e.target.id === "eqform") {
    const f = new FormData(e.target);
    let item = {
      name: f.get("name"),
      kind: f.get("kind"),
      power: Number(f.get("power")),
      area: Number(f.get("area")),
      price: Number(f.get("price")),
    };
    if (item.kind === "solar" && item.power / (item.area * 1000) > 0.4)
      return toast(
        "Potencia y superficie incompatibles con un panel de referencia.",
      );
    store.catalog.push(item);
    persist();
    $("#dialog").close();
    render();
  }
});
document.addEventListener("click", (e) => {
  let t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.chartMonth !== undefined) {
    const i = +t.dataset.chartMonth;
    const box = t.closest(".monthly-chart");
    box
      .querySelectorAll("[data-chart-month]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
    box.querySelector(".chart-readout").textContent = monthReadout(
      result.a.rows[i],
    );
    return;
  }
  if (t.dataset.help) return help(t.dataset.help);
  if (t.dataset.route) return go(t.dataset.route);
  if (t.dataset.start) {
    d = defaults();
    d.role = t.dataset.start;
    step = 0;
    return go("simulate");
  }
  if (t.dataset.step !== undefined) {
    let form = $("#wizard");
    if (form && !form.reportValidity()) return;
    step = +t.dataset.step;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (t.dataset.unknown) {
    let k = t.dataset.unknown;
    d[k] = +t.dataset.value;
    d.unknown[k] = true;
    render();
    return;
  }
  if (t.dataset.geo !== undefined) {
    let g = geoResults[+t.dataset.geo];
    d.location = g.name + ", " + (g.admin1 || g.country);
    d.lat = g.latitude;
    d.lon = g.longitude;
    if (d.resourceMode === "nasa") {
      d.resourceMode = "manual";
      d.resource = null;
      d.source = "Ubicación modificada: recargar recurso.";
      d.resourceMode = "stale";
    }
    geoResults = [];
    render();
    return;
  }
  if (t.dataset.removeApp !== undefined) {
    d.appliances.splice(+t.dataset.removeApp, 1);
    render();
    return;
  }
  if (t.dataset.equipment !== undefined) {
    const eq = [...builtins, ...store.catalog][+t.dataset.equipment];
    if (eq.kind === "solar") {
      d.panelPower = eq.power;
      d.panelArea = eq.area;
      d.panelPrice = eq.price;
      if (d.technology === "wind") d.technology = "hybrid";
    }
    if (eq.kind === "wind") {
      d.turbinePower = eq.power;
      d.turbinePrice = eq.price;
      if (d.technology === "solar") d.technology = "hybrid";
    }
    if (eq.kind === "battery") {
      d.batteryUnit = eq.power;
      d.batteryUnitPrice = eq.price;
      d.battery = "recommend";
    }
    step = 3;
    go("simulate");
    toast("Equipo aplicado al borrador.");
    return;
  }
  if (t.dataset.deleteEquipment !== undefined) {
    if (confirm("¿Eliminar esta ficha del catálogo?")) {
      store.catalog.splice(+t.dataset.deleteEquipment, 1);
      persist();
      render();
    }
    return;
  }
  if (t.dataset.open) {
    result = clone(store.history.find((r) => r.id === t.dataset.open));
    return go("results");
  }
  if (t.dataset.compare) return compare(t.dataset.compare);
  if (t.dataset.delete) {
    if (confirm("¿Eliminar esta simulación?")) {
      store.history = store.history.filter((r) => r.id !== t.dataset.delete);
      persist();
      render();
    }
    return;
  }
  if (t.dataset.house !== undefined) {
    d = clone(store.houses[+t.dataset.house]);
    d.title = "Nuevo escenario · " + d.house;
    step = 0;
    return go("simulate");
  }
  const a = t.dataset.action;
  switch (a) {
    case "new":
      d = defaults();
      step = 0;
      go("simulate");
      break;
    case "back":
      if (step) {
        step--;
        render();
        window.scrollTo(0, 0);
      } else go("home");
      break;
    case "geolocate":
      if (!navigator.geolocation) {
        toast("Tu navegador no ofrece ubicación. Ingresá coordenadas.");
        break;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          d.lat = Number(pos.coords.latitude.toFixed(5));
          d.lon = Number(pos.coords.longitude.toFixed(5));
          if (d.resourceMode === "nasa") {
            d.resourceMode = "stale";
            d.resource = null;
            d.source = "Ubicación modificada: recargar recurso.";
          }
          d.location = "Ubicación actual";
          render();
          toast("Coordenadas cargadas. Consultá el recurso para este punto.");
        },
        () =>
          toast(
            "No se pudo obtener la ubicación. Ingresá coordenadas o buscá una localidad.",
          ),
        { timeout: 15000 },
      );
      break;
    case "suggest-gen":
      d.genPower =
        Math.ceil(
          ((d.peak +
            (d.battery !== "none" && d.genUse === "both" ? d.genCharge : 0)) /
            (d.genLoad / 100)) *
            2,
        ) / 2;
      d.unknown.genPower = true;
      render();
      toast(
        "Potencia orientativa. Confirmá arranques y consumo de combustible en la ficha.",
      );
      break;
    case "search":
      searchGeo();
      break;
    case "climate":
      climate();
      break;
    case "add-app":
      d.appliances.push({
        name: "Nuevo artefacto",
        watts: 100,
        qty: 1,
        hours: 1,
      });
      render();
      break;
    case "edit":
      d = clone(result.x);
      step = 0;
      go("simulate");
      break;
    case "save":
      if (!store.history.some((r) => r.id === result.id))
        store.history.unshift(clone(result));
      store.houses = store.houses.filter((h) => h.house !== result.x.house);
      store.houses.unshift(clone(result.x));
      if (persist()) toast("Escenario y vivienda guardados.");
      break;
    case "without-battery":
    case "without-gen": {
      let x = clone(result.x);
      if (a === "without-battery") {
        x.battery = "none";
        x.genUse = "direct";
        x.title += " · sin banco";
      } else {
        x.generator = false;
        x.costGen = 0;
        x.title += " · sin grupo";
      }
      try {
        result = calculate(x);
        go("results");
      } catch (e) {
        toast(e.message);
      }
      break;
    }
    case "print":
      window.print();
      break;
    case "export":
      download(
        "brisa-respaldo-v2.json",
        JSON.stringify({ version: VERSION, store }, null, 2),
        "application/json",
      );
      break;
    case "import":
      $("#importfile").click();
      break;
    case "new-equipment":
      equipmentDialog();
      break;
    case "csv": {
      let rows = [
        [
          "Mes",
          "Consumo kWh",
          "Generacion kWh",
          "Red kWh",
          "Sin cubrir kWh",
          "Grupo h/dia",
          "Combustible " + fuelUnit(result.x),
        ],
        ...result.a.rows.map((v) => [
          v.month,
          v.energy,
          v.generation,
          v.gridEnergy,
          v.missing,
          v.genHours,
          v.fuelTotal,
        ]),
      ];
      download(
        "brisa-mensual.csv",
        "\uFEFF" +
          rows
            .map((row) =>
              row
                .map((v) =>
                  typeof v === "number" ? v.toFixed(2).replace(".", ",") : v,
                )
                .join(";"),
            )
            .join("\n"),
        "text/csv;charset=utf-8",
      );
      break;
    }
  }
});
async function importBackup(file) {
  if (!file) return;
  if (file.size > 10000000) return toast("El respaldo supera 10 MB.");
  try {
    let j = JSON.parse(await file.text());
    if (
      j.version !== VERSION ||
      !j.store ||
      typeof j.store.profile !== "string" ||
      !Array.isArray(j.store.history) ||
      !Array.isArray(j.store.houses) ||
      !Array.isArray(j.store.catalog)
    )
      throw Error("Formato incorrecto");
    let safe = {
      profile: j.store.profile.slice(0, 80),
      history: [],
      houses: [],
      catalog: [],
    };
    if (
      j.store.history.length > 200 ||
      j.store.houses.length > 200 ||
      j.store.catalog.length > 200
    )
      throw Error("Demasiados registros");
    for (const r of j.store.history) {
      validate(r.x);
      let computed = calculate(r.x);
      computed.id = String(r.id);
      computed.date = Number.isNaN(Date.parse(r.date)) ? computed.date : r.date;
      safe.history.push(computed);
    }
    for (const h of j.store.houses) {
      validate(h);
      safe.houses.push(h);
    }
    for (const eq of j.store.catalog) {
      if (
        !["solar", "wind", "battery"].includes(eq.kind) ||
        typeof eq.name !== "string" ||
        !Number.isFinite(eq.power) ||
        eq.power <= 0 ||
        !Number.isFinite(eq.price) ||
        eq.price < 0 ||
        (eq.kind === "solar" && (!Number.isFinite(eq.area) || eq.area <= 0))
      )
        throw Error("Ficha inválida");
      safe.catalog.push(eq);
    }
    if (
      confirm(
        "¿Reemplazar los datos locales por este respaldo? Exportá primero si querés conservarlos.",
      )
    ) {
      try {
        localStorage.setItem(KEY, JSON.stringify(safe));
        store = safe;
        render();
        toast("Respaldo importado.");
      } catch {
        toast("No se pudo guardar. Tus datos anteriores siguen intactos.");
      }
    }
  } catch {
    toast("No se importó: respaldo v2 inválido o incompleto.");
  }
}
function themeLabel() {
  let dark = document.body.classList.contains("dark");
  $("#theme").textContent = dark ? "☀ Modo claro" : "☾ Modo oscuro";
  $("#theme").setAttribute("aria-pressed", String(dark));
}
try {
  if (
    (localStorage.getItem("brisa-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")) === "dark"
  )
    document.body.classList.add("dark");
} catch {}
themeLabel();
$("#theme").onclick = () => {
  document.body.classList.toggle("dark");
  themeLabel();
  try {
    localStorage.setItem(
      "brisa-theme",
      document.body.classList.contains("dark") ? "dark" : "light",
    );
  } catch {}
};
window.addEventListener("hashchange", render);
$("#dialog").addEventListener("click", (e) => {
  if (e.target === $("#dialog")) {
    const r = $("#dialog").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("#dialog").close();
  }
});
render();

// Print expanded technical tables, then restore the visitor's chosen state.
let printDetails = [];
window.addEventListener("beforeprint", () => {
  printDetails = [...document.querySelectorAll("details")].map((el) => [
    el,
    el.open,
  ]);
  printDetails.forEach(([el]) => (el.open = true));
});
window.addEventListener("afterprint", () => {
  printDetails.forEach(([el, open]) => (el.open = open));
  printDetails = [];
});
// Optional structured access: use the same state as the visible interface.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tools = [
    {
      name: "read_brisa_scenario",
      description:
        "Read the current scenario inputs and calculated summary. Does not calculate or save.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || Object.keys(input).length)
          throw Error("No parameters expected");
        return {
          route: route(),
          step: step + 1,
          house: d.house,
          technology: d.technology,
          resourceMode: d.resourceMode,
          result: result
            ? {
                investmentUSD: result.capex,
                demandKWh: result.a.demand,
                generationKWh: result.a.generation,
                unservedKWh: result.a.missing,
                comparable: result.comparable,
              }
            : null,
        };
      },
    },
    {
      name: "navigate_brisa",
      description:
        "Open a Brisa section. Does not create, calculate, delete or save a scenario.",
      inputSchema: {
        type: "object",
        properties: {
          section: { type: "string", enum: navs.map((v) => v[0]) },
        },
        required: ["section"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !input ||
          Object.keys(input).some((k) => k !== "section") ||
          !navs.some((v) => v[0] === input.section)
        )
          throw Error("Invalid section");
        go(input.section);
        return { section: route() };
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        document.modelContext.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
