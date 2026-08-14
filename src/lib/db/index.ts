import type { Db } from "./types";

export type { Db } from "./types";

/**
 * Selector de driver.
 *
 *   DATABASE_URL definida  -> Postgres remoto (Supabase / Neon / ...)
 *   DATABASE_URL vacía     -> PGlite embebido en ./.data/pglite  (por defecto)
 *
 * Cambiar de uno a otro es sólo poner o quitar una variable de entorno: el
 * esquema y todas las consultas son idénticos.
 */
async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const { createPostgresDb } = await import("./postgres");
    return createPostgresDb(url);
  }

  const { createPgliteDb } = await import("./pglite");
  return createPgliteDb();
}

// El hot reload de Next reevalúa los módulos en cada cambio. Sin esta caché en
// globalThis, PGlite intentaría abrir dos veces el mismo directorio de datos.
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}
