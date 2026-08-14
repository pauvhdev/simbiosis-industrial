import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite y pg cargan binarios/WASM que no deben pasar por el bundler del servidor.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@electric-sql/pglite-pgvector",
    "pg",
    "unpdf",
  ],
};

export default nextConfig;
