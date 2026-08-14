import type { Db } from "./types";

/**
 * Driver para un Postgres remoto: Supabase, Neon, Railway o el que sea.
 *
 * Se conecta por cadena de conexión en lugar de por `supabase-js` a propósito:
 * así el MISMO código de consultas sirve para PGlite en local y para Supabase en
 * producción, y el SQL de `match_listings()` no se duplica en dos dialectos.
 *
 * En Supabase, usa la cadena del *connection pooler* (puerto 6543) si despliegas
 * en serverless; la directa (5432) agota conexiones rápido con funciones lambda.
 */
export async function createPostgresDb(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");

  const pool = new Pool({
    connectionString,
    // Supabase y Neon exigen TLS pero presentan certificados que Node no
    // valida contra su almacén por defecto.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
    max: 5,
  });

  return {
    driver: "postgres",
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
      const result = await pool.query(text, params as unknown[] | undefined);
      return { rows: result.rows as T[] };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}
