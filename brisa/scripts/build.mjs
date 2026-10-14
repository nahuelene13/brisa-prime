import { PROVIDERS } from "../src/providers.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
const names = {
  "index.html": "text/html; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "app.js": "application/javascript; charset=utf-8",
  "household.js": "application/javascript; charset=utf-8",
  "providers.js": "application/javascript; charset=utf-8",
  "explore.js": "application/javascript; charset=utf-8",
  "vendor/leaflet.js": "application/javascript; charset=utf-8",
  "vendor/leaflet.css": "text/css; charset=utf-8",
  "vendor/leaflet-LICENSE.txt": "text/plain; charset=utf-8",
};
await writeFile(
  "dist/providers.js",
  "const ELECTRICITY_PROVIDERS=" + JSON.stringify(PROVIDERS) + ";",
);
await mkdir("dist/vendor", { recursive: true });
for (const file of ["leaflet.js", "leaflet.css"])
  await writeFile(
    "dist/vendor/" + file,
    await readFile("node_modules/leaflet/dist/" + file),
  );
await writeFile(
  "dist/vendor/leaflet-LICENSE.txt",
  await readFile("node_modules/leaflet/LICENSE"),
);
const assets = {};
for (const [name, type] of Object.entries(names))
  assets["/" + name] = { type, body: await readFile("dist/" + name, "utf8") };
await writeFile(
  "src/assets.generated.mjs",
  "export const assets=" + JSON.stringify(assets) + ";",
);
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["src/worker.mjs"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  minify: true,
  conditions: ["workerd", "worker", "browser"],
  external: ["node:*"],
});
