/**
 * Vacía las tablas sin tocar el esquema.
 *
 *   npm run db:reset
 *
 * Sólo borra datos: no hace DROP de tablas, tipos, índices ni de la función
 * match_listings(). Para rehacer el esquema desde cero, borra ./.data/pglite (o
 * ejecuta db:migrate contra una base limpia).
 */
import { loadEnv } from "./env";
import { run } from "./run";

loadEnv();

async function main() {
  const { getDb } = await import("../src/lib/db/index");
  const db = await getDb();

  console.log(`→ Driver: ${db.driver}`);
  // El cascade arrastra listings y contact_requests por las claves foráneas.
  await db.exec("truncate table companies cascade;");
  console.log("✔ Datos borrados (esquema intacto).");
}

run(main);
