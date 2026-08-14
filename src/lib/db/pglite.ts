import fs from "node:fs";
import path from "node:path";
import type { Db } from "./types";

/**
 * Driver embebido: Postgres real compilado a WASM, corriendo dentro del proceso
 * de Node y persistiendo en ./.data/pglite.
 *
 * Coste 0, cero cuentas, cero Docker, y habla el mismo SQL (incluido pgvector)
 * que Supabase, así que `supabase/schema.sql` se aplica tal cual.
 *
 * Limitación conocida: un único proceso puede abrir el directorio a la vez.
 * Por eso la instancia se cachea en `globalThis` — si no, el hot reload de
 * `next dev` crearía una instancia nueva por recarga y bloquearía el directorio.
 */
export async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // A partir de PGlite 0.5, pgvector vive en su propio paquete: antes estaba en
  // el subpath "@electric-sql/pglite/vector", que ya no existe.
  const { vector } = await import("@electric-sql/pglite-pgvector");

  const dataDir =
    process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");

  // PGlite hace `mkdirSync` sin `recursive`, así que revienta si el directorio
  // padre no existe. En un clon limpio `.data/` no está (va en .gitignore).
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });

  const pg = await PGlite.create(dataDir, {
    extensions: { vector },
  });

  return {
    driver: "pglite",
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
      const result = await pg.query<T>(text, params as unknown[] | undefined);
      return { rows: result.rows };
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}
