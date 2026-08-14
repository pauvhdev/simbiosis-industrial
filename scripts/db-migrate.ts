/**
 * Aplica supabase/schema.sql a la base de datos configurada.
 *
 *   npm run db:migrate
 *
 * Sin DATABASE_URL -> PGlite en ./.data/pglite
 * Con DATABASE_URL -> el Postgres remoto que apunte (Supabase, Neon...)
 *
 * El script es idempotente, así que se puede lanzar tantas veces como haga falta.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";
import { run } from "./run";

loadEnv();

async function main() {
  const { getDb } = await import("../src/lib/db/index");

  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const db = await getDb();
  console.log(`→ Driver: ${db.driver}`);
  console.log(`→ Aplicando ${path.relative(process.cwd(), schemaPath)}...`);

  await db.exec(sql);

  const { rows } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  );
  console.log(`✔ Tablas: ${rows.map((r) => r.table_name).join(", ")}`);

  const { rows: fn } = await db.query<{ ok: boolean }>(
    `select to_regprocedure('match_listings(uuid, double precision, integer)') is not null as ok`,
  );
  console.log(`✔ Función match_listings(): ${fn[0]?.ok ? "creada" : "NO CREADA"}`);

  const { rows: idx } = await db.query<{ indexname: string }>(
    `select indexname from pg_indexes
     where tablename = 'listings' and indexname = 'listings_embedding_hnsw'`,
  );
  console.log(
    idx.length
      ? "✔ Índice HNSW: creado"
      : "ℹ Índice HNSW no disponible en este motor — búsqueda secuencial (correcta para el MVP)",
  );

  console.log("\nListo. Siguiente paso: npm run db:seed");
}

run(main);
