"use client";

import { useCallback, useImperativeHandle, useState, type Ref } from "react";
import { Loader2, RefreshCw, SearchX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ListingCard } from "@/components/listing-card";
import { MatchCard } from "@/components/match-card";
import { cn } from "@/lib/utils";
import type { PublicListing, ScoredMatch } from "@/lib/types";

type Filter = "TODAS" | "OFERTA" | "DEMANDA";

export interface ExploreHandle {
  /** Vuelve a pedir el catálogo. La usa el panel al publicar algo nuevo. */
  refresh: () => void;
}

interface ExploreMatchesProps {
  /** Catálogo renderizado en el servidor: el primer pintado ya trae datos. */
  initialListings: PublicListing[];
  /** Explorar es público; pedir contacto exige sesión. */
  authenticated: boolean;
  /** Sólo se puede pedir contacto en nombre de una publicación propia. */
  ownListingIds: string[];
  ref?: Ref<ExploreHandle>;
}

/**
 * No hay `useEffect` de carga inicial a propósito.
 *
 * Los datos del primer render vienen del servidor y las recargas se disparan
 * desde manejadores de evento (el botón, o el panel al publicar). Además de
 * evitar el render en cascada que marca `react-hooks/set-state-in-effect`, así
 * la primera pintura ya muestra el catálogo en vez de un spinner.
 */
export function ExploreMatches({
  initialListings,
  authenticated,
  ownListingIds,
  ref,
}: ExploreMatchesProps) {
  // Mientras sea null manda el servidor; al recargar en cliente pasa a mandar esto.
  const [refreshed, setRefreshed] = useState<PublicListing[] | null>(null);
  const [filter, setFilter] = useState<Filter>("TODAS");
  const [loadingListings, setLoadingListings] = useState(false);

  const [selected, setSelected] = useState<PublicListing | null>(null);
  const [matches, setMatches] = useState<ScoredMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listings = refreshed ?? initialListings;

  const refresh = useCallback(() => {
    setLoadingListings(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch("/api/listings?limit=100", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se han podido cargar.");
        setRefreshed(data.listings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de red.");
      } finally {
        setLoadingListings(false);
      }
    })();
  }, []);

  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  const loadMatches = useCallback((listing: PublicListing) => {
    setSelected(listing);
    setLoadingMatches(true);
    setMatches([]);
    setError(null);

    void (async () => {
      try {
        // Umbral bajo a propósito: en simbiosis industrial un cruce con afinidad
        // media puede seguir siendo un negocio, y esconderlo no ayuda a nadie.
        const res = await fetch(
          `/api/listings/${listing.id}/matches?threshold=0.1&limit=12`,
          {
            cache: "no-store",
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se han podido calcular.");
        setMatches(data.matches);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de red.");
      } finally {
        setLoadingMatches(false);
      }
    })();
  }, []);

  const visible = listings.filter((l) => filter === "TODAS" || l.type === filter);

  // El servidor lo rechaza igualmente (401/403); esto sólo evita que el botón
  // invite a algo que va a fallar y explica por qué.
  const requestBlockedReason = !authenticated
    ? "Entra con tu cuenta para solicitar contacto."
    : selected && !ownListingIds.includes(selected.id)
      ? "Para pedir contacto, busca desde una de tus publicaciones."
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Columna izquierda: catálogo anónimo */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-[var(--muted)] p-1">
            {(["TODAS", "OFERTA", "DEMANDA"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === option
                    ? "bg-[var(--card)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {option === "TODAS"
                  ? "Todas"
                  : option === "OFERTA"
                    ? "Ofertas"
                    : "Demandas"}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loadingListings}
          >
            <RefreshCw className={cn(loadingListings && "animate-spin")} aria-hidden />
            Actualizar
          </Button>
        </div>

        {visible.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No hay publicaciones todavía. Crea una en la otra pestaña, o ejecuta{" "}
              <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-xs">
                npm run db:seed
              </code>{" "}
              para cargar datos de ejemplo.
            </p>
          </Card>
        ) : (
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            {visible.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                selected={selected?.id === listing.id}
                onSelect={loadMatches}
                actionHint="Ver coincidencias →"
              />
            ))}
          </div>
        )}
      </div>

      {/* Columna derecha: coincidencias */}
      <div className="space-y-4">
        {!selected ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Sparkles className="size-8 text-[var(--muted-foreground)]" aria-hidden />
              <div>
                <p className="font-medium">Selecciona una publicación</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Se buscarán empresas compatibles del tipo opuesto por similitud
                  semántica y proximidad geográfica.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-[var(--muted)]/40">
              <CardHeader className="pb-3">
                <CardDescription>Buscando contraparte para</CardDescription>
                <CardTitle className="text-base">{selected.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Cruzando contra{" "}
                  <strong className="font-medium">
                    {selected.type === "OFERTA" ? "demandas" : "ofertas"}
                  </strong>{" "}
                  activas.
                </p>
              </CardContent>
            </Card>

            {loadingMatches ? (
              <Card className="p-8">
                <p className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Calculando
                  afinidad...
                </p>
              </Card>
            ) : matches.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <SearchX
                    className="size-7 text-[var(--muted-foreground)]"
                    aria-hidden
                  />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Ninguna publicación del tipo opuesto supera el umbral de similitud.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    sourceListingId={selected.id}
                    requestBlockedReason={requestBlockedReason}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {error ? (
          <p className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
