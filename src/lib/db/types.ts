/**
 * Interfaz mínima que deben cumplir los drivers de base de datos.
 *
 * Tanto PGlite (WASM, local) como `pg` (Postgres remoto: Supabase, Neon...)
 * exponen `query(text, params) -> { rows }`, así que el adaptador es trivial y
 * el resto de la aplicación no sabe con cuál de los dos está hablando.
 */
export interface Db {
  /** Consulta parametrizada ($1, $2, ...). */
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;

  /** Ejecuta un script SQL con múltiples sentencias (migraciones). */
  exec(sql: string): Promise<void>;

  /**
   * Cierra la conexión. Sólo lo usan los scripts de CLI: si el proceso termina
   * con PGlite todavía abierto, libuv aborta con una aserción en Windows.
   */
  close(): Promise<void>;

  /** Identificador del driver activo, para diagnóstico. */
  readonly driver: "pglite" | "postgres";
}
