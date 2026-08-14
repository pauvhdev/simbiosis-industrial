"use client";

import { useState } from "react";
import { Check, Handshake, Loader2, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PropertiesList } from "@/components/properties-list";
import { cn, formatDistance, formatTons } from "@/lib/utils";
import type { ScoredMatch } from "@/lib/types";

function toneFor(affinity: number) {
  if (affinity >= 70) return { label: "Compatibilidad alta", bar: "var(--offer)" };
  if (affinity >= 45) return { label: "Compatibilidad media", bar: "var(--demand)" };
  return { label: "Compatibilidad baja", bar: "var(--muted-foreground)" };
}

interface MatchCardProps {
  match: ScoredMatch;
  sourceListingId: string;
}

export function MatchCard({ match, sourceListingId }: MatchCardProps) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  const tone = toneFor(match.affinity);
  const isOffer = match.type === "OFERTA";

  async function requestContact() {
    setState("sending");
    setFeedback(null);
    try {
      const res = await fetch("/api/contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromListingId: sourceListingId,
          toListingId: match.id,
          similarity: match.similarity,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setFeedback(data.error ?? "No se ha podido enviar la solicitud.");
        return;
      }
      setState("sent");
      setFeedback(data.message ?? null);
    } catch (error) {
      setState("error");
      setFeedback(error instanceof Error ? error.message : "Error de red.");
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isOffer ? "offer" : "demand"}>
              {isOffer ? "OFERTA" : "DEMANDA"}
            </Badge>
            {match.ler_code ? (
              <Badge variant="mono" title={match.ler_description ?? undefined}>
                LER {match.ler_code}
              </Badge>
            ) : null}
          </div>

          <h3 className="mt-2.5 text-sm font-semibold leading-snug">{match.title}</h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1">
              <Package className="size-3.5" aria-hidden />
              <span className="tabular">{formatTons(match.quantity_ton_month)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {match.anonymous_location ?? "Ubicación no especificada"}
              <span className="tabular">· {formatDistance(match.distance_km)}</span>
            </span>
          </div>
        </div>

        {/* Medidor de afinidad. El desglose va en el title para que el número no
            sea una caja negra: se puede auditar de dónde sale. */}
        <div
          className="shrink-0 text-right"
          title={
            `Coseno crudo: ${match.breakdown.rawSimilarity.toFixed(3)}\n` +
            `Calibrado: ${(match.breakdown.calibrated * 100).toFixed(0)} %\n` +
            `Factor proximidad: ${match.breakdown.proximityFactor.toFixed(2)}\n` +
            `Coherencia LER: ${match.breakdown.lerFactor.toFixed(2)}`
          }
        >
          <div
            className="tabular text-2xl font-bold leading-none"
            style={{ color: tone.bar }}
          >
            {match.affinity}
            <span className="text-sm font-semibold">%</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            afinidad
          </div>
          <div className="mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${match.affinity}%`, backgroundColor: tone.bar }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <PropertiesList properties={match.properties} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <span className="text-xs text-[var(--muted-foreground)]">{tone.label}</span>

        <Button
          size="sm"
          variant={state === "sent" ? "secondary" : "default"}
          onClick={requestContact}
          disabled={state === "sending" || state === "sent"}
        >
          {state === "sending" ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Enviando
            </>
          ) : state === "sent" ? (
            <>
              <Check aria-hidden /> Solicitado
            </>
          ) : (
            <>
              <Handshake aria-hidden /> Solicitar contacto
            </>
          )}
        </Button>
      </div>

      {feedback ? (
        <p
          className={cn(
            "mt-2 text-xs",
            state === "error"
              ? "text-[var(--destructive)]"
              : "text-[var(--muted-foreground)]",
          )}
        >
          {feedback}
        </p>
      ) : null}
    </Card>
  );
}
