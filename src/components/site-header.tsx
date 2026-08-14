import { Database, EyeOff, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppStatus, Stats } from "@/lib/types";

export function SiteHeader({
  status,
  stats,
}: {
  status: AppStatus | null;
  stats: Stats | null;
}) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                <EyeOff className="size-4" aria-hidden />
              </span>
              <h1 className="text-xl font-bold tracking-tight">
                Simbiosis Industrial Anónima
              </h1>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted-foreground)]">
              Publica subproductos, residuos y mermas sin revelar quién eres. La IA
              clasifica el material, le asigna un código LER y encuentra la contraparte
              por similitud semántica y cercanía.
            </p>
          </div>

          {stats ? (
            <dl className="flex gap-5 text-right">
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Ofertas</dt>
                <dd className="tabular text-xl font-bold text-[var(--offer)]">
                  {stats.offers}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Demandas</dt>
                <dd className="tabular text-xl font-bold text-[var(--demand)]">
                  {stats.demands}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground)]">Contactos</dt>
                <dd className="tabular text-xl font-bold">{stats.contacts}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        {/* Qué motor está activo en cada momento, para que no haya duda de si se
            está llamando a un LLM o al motor local sin coste. */}
        {status ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <Cpu className="size-3" aria-hidden />
              {status.ai.label}
              <span className="opacity-70">· {status.ai.cost}</span>
            </Badge>
            <Badge variant="outline">
              <Database className="size-3" aria-hidden />
              {status.db.driver === "pglite"
                ? "PGlite (Postgres embebido)"
                : "Postgres remoto"}
              {status.db.schemaReady ? null : (
                <span className="text-[var(--destructive)]">· esquema sin aplicar</span>
              )}
            </Badge>
          </div>
        ) : null}
      </div>
    </header>
  );
}
