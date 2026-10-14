# Brisa · Hogar y técnico

El modo hogar tiene un recorrido propio de seis pasos: objetivo, ubicación y uso, consumo, espacio, respaldo y revisión. Pregunta en lenguaje cotidiano y ofrece tarjetas grandes, ayudas visibles y detalles opcionales. El formulario anterior queda como modo técnico.

## Datos reales y actualización

Las consultas se realizan al abrir el recorrido hogar, abrir Fuentes o pulsar Actualizar referencias. El servidor reutiliza cada respuesta válida hasta una hora; cuando vence, la próxima consulta vuelve a buscar la publicación original. No hay una tarea que corra con la app cerrada ni se prometen precios de compra garantizados.

- **Ubicación y empresa:** se guarda localidad, provincia y país de la búsqueda. La provincia filtra candidatos, pero nunca confirma el área de concesión: la persona debe elegir la empresa de su factura. Neuquén ofrece EPEN y CALF; Río Negro EdERSA; Córdoba EPEC; AMBA Edenor/Edesur; Mendoza EDEMSA. Es un directorio inicial, no una cobertura de todas las distribuidoras ni cooperativas. Fuera de Argentina no se asignan estas empresas. Al cambiar de localidad se borra la selección y la tarifa aplicada. Los equipos se muestran como referencias del proveedor neuquino, no cotizaciones locales: envío y montaje requieren presupuesto.
- **ENRE / Edenor y Edesur:** descubre el cuadro más reciente del índice oficial del ENRE, lee por separado las columnas de las dos empresas y verifica seis categorías, importes y bandas. El cuadro comprobado corresponde a octubre de 2026. Interpreta los bloques subsidiados documentados de 300 kWh/mes en diciembre-febrero y mayo-agosto, y de 150 en marzo-abril y septiembre-noviembre. Si cambia esa regla o formato, el lector falla explícitamente.
- **CALF, EdERSA, EPEC, EDEMSA:** ofrece fuentes oficiales verificables. Consulta la página de la empresa elegida; en EdERSA muestra el período y PDF de su publicación vigente. Todavía no interpreta numéricamente estos cuadros: se ingresa el cargo variable desde la factura. Una consulta fallida mantiene el enlace y el aviso de falta de verificación.
- **EPEN:** descubre el PDF enlazado en https://www.epen.gov.ar/index.php/cuadros-tarifarios/ y lee la tabla residencial convencional inferior a 10 kW. Verifica siete categorías consecutivas, importes, límites y bloques subsidiados. Muestra el período de facturación y consumo que dice el documento, además de la fecha de consulta. El último documento comprobado el 8 de octubre de 2026 corresponde a facturación septiembre / consumos agosto 2026; no se etiqueta como tarifa de octubre. Las tarifas sociales, electrodependientes, estacionales y bonificaciones especiales quedan fuera de este lector. No incluye IVA ni otros tributos.
- **Precios:** consulta los metadatos públicos de lista de un panel Jinko 550 Wp y una batería Pylontech UF5000 5,12 kWh vendidos por Alter Energy SAS (Neuquén). Verifica moneda ARS y un importe positivo plausible. No es un promedio de mercado, no confirma compatibilidad ni stock y no incluye el resto de la instalación. Se guardan producto, proveedor, URL e instante de consulta en el escenario.
- **Cotización:** consulta la venta oficial de DolarApi, que declara Ámbito Financiero como fuente. Registra la fecha publicada y la consultada. Se descartan cotizaciones de más de siete días al aplicar al hogar. Es una referencia, no una cotización del proveedor.
- **Clima:** NASA POWER por coordenadas; climatología histórica modelada. El modo hogar no calcula con el clima ficticio inicial si falla esta consulta.

Si una fuente no se reconoce o falla, el servidor responde que el dato no pudo verificarse. No inserta un precio ficticio ni cambia la fecha de un dato anterior. Las páginas del proveedor y el formato del cuadro pueden cambiar; en ese caso hay que adaptar el lector.

## Precio del kWh y alcance del cálculo

El hogar elige su distribuidora. EPEN, Edenor o Edesur solo se aplican al confirmar la empresa de la factura, tarifa residencial convencional, y elegir con o sin subsidio. Las fuentes oficiales se consultan separadamente por empresa y la caché incluye su identificador para evitar mezclar tarifas. Las demás distribuidoras ingresan su cargo variable desde la factura. Cuando se desconoce, el costo permanece pendiente.

El cálculo de tarifas documentadas conserva para cada mes la categoría definida por la demanda de referencia y aplica el bloque subsidiado al consumo importado. No simula reclasificación tarifaria después de instalar paneles ni bonificaciones especiales. La cifra del hogar es energía comprada evitada, antes de impuestos y mantenimiento; no se llama ahorro neto. Los cargos fijos no se presentan como evitados. El hogar muestra un subtotal de componentes consultados; no anuncia costo total ni recuperación si no se ingresa un presupuesto completo.

## Supuestos que siguen siendo revisables

Orientación sugerida hacia el ecuador, pérdidas solares del 20%, descuentos ilustrativos por sombras y perfiles horarios sintéticos. Inversor de 3 kW, potencia de banco de 3 kW y aparatos de referencia requieren verificación. Para aparatos se respetan ocupación y consumo residual supuesto de 1 kWh/día. Para una factura se extiende el promedio al año sin volver a descontar ocupación, y esto se explica. El modelo no simula eventos de corte, días nublados consecutivos ni arranques. El tamaño de reserva es orientativo y necesita diseño compatible. La eólica se revisa en modo técnico con datos adecuados.

## Archivos

- `dist/index.html`, `dist/styles.css`, `dist/app.js`, `dist/household.js`: interfaz editable.
- `src/data-service.mjs`: lectores de publicaciones reales.
- `src/worker.mjs`: servidor de la app y endpoints de fuentes.
- `scripts/build.mjs`: empaqueta interfaz y servidor como módulo Cloudflare Worker.
- `package.json`, `package-lock.json`: dependencias fijadas.

`npm ci` y `npm run build` producen `dist/server/index.js`. `src/providers.mjs` es el directorio único que genera `dist/providers.js`. El servidor exporta `fetch` y sirve las rutas de la interfaz y `/api/tariffs`, `/api/prices`, `/api/exchange`.

La descarga incluye `netlify.toml` y `netlify/functions/sources.mjs`, adaptador para funciones Netlify. Para publicarlo con datos reales, conectar este proyecto a un repositorio en una cuenta propia de Netlify y desplegar con ese archivo de configuración (npm instala dependencias y ejecuta el build). La actualización automática requiere publicar esas funciones; arrastrar solo los archivos HTML/CSS/JS conserva la interfaz pero no habilita las consultas de precios y tarifa del servidor.

## Datos personales y respaldos

Se conserva `localStorage` bajo `brisa-v2` y el respaldo 2.0. No hay cuentas autenticadas ni sincronización. Exportá desde Mi perfil e importá en otra dirección para trasladar escenarios. Los escenarios guardan una copia de los valores y fuentes usados; abrirlos no sustituye silenciosamente su historia por cotizaciones posteriores.

## Comprobaciones

Se cotejó el lector con el PDF oficial y se verificaron importes y límites. Se consultaron realmente los precios y la cotización. Se probaron separación de modos, recorrido hogar, falta de factura, tarifa subsidiada, presupuesto incompleto y bloqueo del clima de ejemplo en un DOM simulado. Se verificaron además columnas y bloques ENRE, filtrado por país/provincia y rechazo de una tarifa de otra empresa. Dieciocho escenarios técnicos sin nueva tarifa conservan balances y cifras de la versión anterior. No se afirma una certificación de accesibilidad ni una validación de ingeniería de la instalación.


## Mapa y simulador visual

- `dist/explore.js` agrega la selección manual en un mapa Leaflet 1.9.4, con teselas estándar de OpenStreetMap y atribución visible. Se cargan solo las teselas de la vista interactiva, sin descarga masiva, precarga ni modo offline. Leaflet se distribuye localmente con su licencia; los mapas externos requieren conexión y pueden no estar disponibles.
- El lugar puede elegirse con clic/toque, búsqueda de localidad, centro del mapa (teclado) o detección opcional del navegador. No se requiere geolocalización automática. Confirmar un punto actualiza coordenadas y deja el clima y tarifa anteriores sin aplicar. Las provincias no se infieren de un clic: la persona puede confirmarlas y debe verificar la empresa en la factura.
- El directorio se amplió con fuentes oficiales de la Secretaría de Energía y distribuidoras. No es un mapa de concesiones ni incluye todas las cooperativas. Solo EPEN/Edenor/Edesur tienen lector numérico automático. Las otras fuentes son enlaces de consulta y usan el valor ingresado desde factura. No se usa un promedio nacional como sustituto. El modo técnico distingue entradas manuales de tarifas consultadas; al cambiar la ubicación o empresa se limpia la tarifa anterior.
- “Probá con tu casa” es un apartado opcional, con acceso desde el inicio y el paso de espacio del hogar. Su croquis representa una cara rectangular del techo. Medidas, módulo vertical/horizontal, separación, borde, inclinación y orientación son editables. Se agregan o quitan módulos con clic/toque o teclado; también se reservan obstáculos y se pueden deshacer cambios. Cambiar la grilla borra las posiciones que ya no representan esas medidas.
- Las posiciones se convierten en una cantidad manual de módulos solo al pulsar Usar estos paneles. El modelo existente calcula con esa cantidad, superficie y orientación. El croquis no verifica estructura, cableado ni sombras geométricas. Marcar un obstáculo excluye una posición y no calcula la sombra sobre vecinos. La orientación es un parámetro: la perspectiva del dibujo no rota ni reproduce una trayectoria solar.
- Sin NASA POWER consultada para el lugar, la producción queda pendiente. Con clima, se muestra un gráfico mensual y, si hay consumo ingresado, la comparación de energía de red con/sin paneles. Un módulo cuya potencia o área difiera del producto cotizado no hereda su precio de lista.
- La distribución aplicada forma parte del escenario guardado y del respaldo JSON. Un croquis que todavía no se guardó con una propuesta se pierde al recargar la página. No se implementa guardado de borradores automático.
- Comprobaciones: mapa y confirmación en DOM simulado, rechazo de latitudes fuera del modelo, cambio de proveedor, grilla/paneles/obstáculos, aplicación de cantidades y orientación, bloqueo de producción con clima de ejemplo, módulos personalizados sin precio ajeno, y regresión de 18 escenarios técnicos. Se comprobó el módulo del servidor en el runtime Worker con fixtures oficiales. El proyecto no dispone de un preview de navegador compatible para esta arquitectura; estas comprobaciones no equivalen a una prueba de interfaz en un navegador real.
