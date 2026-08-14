/**
 * Carga .env.local para los scripts de CLI.
 *
 * Next inyecta las variables por su cuenta al arrancar, pero `tsx scripts/...`
 * corre fuera de Next, así que sin esto los scripts nunca verían DATABASE_URL
 * ni las API keys.
 */
import fs from "node:fs";
import path from "node:path";

export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;

    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // El primer fichero gana, y una variable ya presente en el entorno real
      // (CI, shell) nunca se pisa.
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
