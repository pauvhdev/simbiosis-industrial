/**
 * Envoltorio común de los scripts de CLI.
 *
 * Cierra la base de datos antes de salir y deja que el proceso termine solo, sin
 * `process.exit(0)`. No es cosmético: PGlite corre sobre WASM con handles de
 * libuv abiertos, y matar el proceso con la instancia viva aborta en Windows con
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`.
 */
export async function run(main: () => Promise<void>): Promise<void> {
  try {
    await main();
    await closeDb();
  } catch (error) {
    console.error("\n✖ Error:\n", error);
    await closeDb();
    process.exitCode = 1;
  }
}

async function closeDb(): Promise<void> {
  try {
    const { getDb } = await import("../src/lib/db/index");
    await (await getDb()).close();
  } catch {
    // Si ni siquiera llegó a abrirse, no hay nada que cerrar.
  }
}
