import { AlertTriangle } from "lucide-react";
import { Dashboard } from "@/components/dashboard";
import { SiteHeader } from "@/components/site-header";
import { listListings, statsOverview } from "@/lib/db/queries";
import { getDb } from "@/lib/db";
import { providerConfig, resolveProviderId } from "@/lib/ai/provider";
import type { AppStatus, PublicListing, Stats } from "@/lib/types";

// Sin esto, `next build` intentaría prerenderizar la página y abriría PGlite en
// tiempo de compilación.
export const dynamic = "force-dynamic";

async function loadInitialData(): Promise<{
  status: AppStatus | null;
  stats: Stats | null;
  listings: PublicListing[];
  error: string | null;
}> {
  const provider = providerConfig(resolveProviderId());

  try {
    const db = await getDb();
    // El catálogo se carga aquí, no desde un efecto en el cliente: la primera
    // pintura ya llega con datos y el explorador no necesita `useEffect`.
    const [stats, listings] = await Promise.all([
      statsOverview(),
      listListings({ limit: 100 }),
    ]);

    return {
      status: {
        db: { driver: db.driver, schemaReady: true },
        ai: { id: provider.id, label: provider.label, cost: provider.cost },
      },
      stats,
      listings,
      error: null,
    };
  } catch (error) {
    // Lo más probable con diferencia es que falte aplicar el esquema. Se dice
    // qué comando lo arregla en vez de dejar un 500 opaco.
    return {
      status: {
        db: { driver: "sin conectar", schemaReady: false },
        ai: { id: provider.id, label: provider.label, cost: provider.cost },
      },
      stats: null,
      listings: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function HomePage() {
  const { status, stats, listings, error } = await loadInitialData();

  return (
    <div className="min-h-screen">
      <SiteHeader status={status} stats={stats} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error ? (
          <div className="mb-6 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-4">
            <p className="flex items-start gap-2 text-sm font-medium text-[var(--destructive)]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              La base de datos no responde.
            </p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Si es la primera vez que arrancas el proyecto, aplica el esquema:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-[var(--muted)] p-2 font-mono text-xs">
              npm run db:migrate &amp;&amp; npm run db:seed
            </pre>
            <p className="mt-2 font-mono text-xs opacity-70">{error}</p>
          </div>
        ) : null}

        <Dashboard initialListings={listings} />

        <footer className="mt-12 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted-foreground)]">
          <p>
            El anonimato es estructural: las tablas públicas no contienen razón social ni
            contacto, y los datos de la empresa sólo se liberan cuando ambas partes
            aceptan el cruce.
          </p>
        </footer>
      </main>
    </div>
  );
}
