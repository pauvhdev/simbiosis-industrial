"use client";

import { useCallback, useImperativeHandle, useState, type Ref } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Inbox,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContactRequestView } from "@/lib/types";

const STATUS_TEXT: Record<ContactRequestView["status"], string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
};

/**
 * Bandeja de descruces.
 *
 * Es la pantalla que cierra el ciclo: sin ella `contact_requests` se queda en
 * una tabla que nadie lee y las dos partes nunca llegan a hablar.
 */
export interface ContactRequestsHandle {
  /** Vuelve a pedir la bandeja. La usa el panel al abrir la pestaña. */
  refresh: () => void;
}

/**
 * Sin `useEffect` de carga, igual que el explorador: la bandeja inicial llega
 * renderizada del servidor y las recargas salen de eventos (abrir la pestaña,
 * aceptar o rechazar).
 */
export function ContactRequestsPanel({
  initialRequests,
  ref,
}: {
  initialRequests: ContactRequestView[];
  ref?: Ref<ContactRequestsHandle>;
}) {
  const [requests, setRequests] = useState<ContactRequestView[] | null>(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/contact-requests");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se han podido cargar las solicitudes.");
        return;
      }
      setRequests(data.requests);
      setError(null);
    } catch {
      setError("No se ha podido conectar con el servidor.");
    }
  }, []);

  useImperativeHandle(ref, () => ({ refresh: () => void load() }), [load]);

  async function decide(id: string, decision: "ACCEPT" | "REJECT") {
    setBusyId(id);
    try {
      const response = await fetch(`/api/contact-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se ha podido actualizar la solicitud.");
        return;
      }
      await load();
    } catch {
      setError("No se ha podido conectar con el servidor.");
    } finally {
      setBusyId(null);
    }
  }

  if (requests === null && !error) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
        Cargando…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
        {error}
      </p>
    );
  }

  if (!requests?.length) {
    return (
      <div className="py-12 text-center">
        <Inbox className="mx-auto size-8 text-[var(--muted-foreground)]" aria-hidden />
        <p className="mt-3 text-sm font-medium">Todavía no hay solicitudes</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Cuando pidas contacto desde una coincidencia, o alguien te lo pida a ti,
          aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <Card key={req.id}>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {req.direction === "RECIBIDA" ? (
                    <ArrowDownLeft className="size-3" aria-hidden />
                  ) : (
                    <ArrowUpRight className="size-3" aria-hidden />
                  )}
                  {req.direction === "RECIBIDA" ? "Recibida" : "Enviada"}
                </Badge>
                <Badge variant={req.counterpart.type === "OFERTA" ? "offer" : "demand"}>
                  {req.counterpart.type}
                </Badge>
                {req.counterpart.ler_code ? (
                  <Badge variant="mono">{req.counterpart.ler_code}</Badge>
                ) : null}
              </div>
              <Badge variant={req.status === "ACCEPTED" ? "offer" : "outline"}>
                {STATUS_TEXT[req.status]}
              </Badge>
            </div>

            <div>
              <p className="font-medium">{req.counterpart.title}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {req.counterpart.anonymous_location ?? "Ubicación no especificada"}
                {" · sobre tu publicación “"}
                {req.own.title}
                {"”"}
              </p>
            </div>

            {req.message ? (
              <p className="rounded-md bg-[var(--muted)] p-2.5 text-sm">{req.message}</p>
            ) : null}

            {req.status === "ACCEPTED" && req.revealed ? (
              <div className="rounded-md border border-[var(--offer)]/30 bg-[var(--offer-bg)] p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--offer)]">
                  <ShieldCheck className="size-4" aria-hidden />
                  Anonimato levantado por ambas partes
                </p>
                <p className="mt-1.5 text-sm font-medium">{req.revealed.name}</p>
                <a
                  href={`mailto:${req.revealed.email}`}
                  className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  <Mail className="size-3.5" aria-hidden />
                  {req.revealed.email}
                </a>
              </div>
            ) : null}

            {req.direction === "RECIBIDA" && req.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                <Button
                  size="sm"
                  disabled={busyId === req.id}
                  onClick={() => decide(req.id, "ACCEPT")}
                >
                  <Check className="size-3.5" aria-hidden />
                  Aceptar y revelar contacto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === req.id}
                  onClick={() => decide(req.id, "REJECT")}
                >
                  <X className="size-3.5" aria-hidden />
                  Rechazar
                </Button>
                <p className="w-full text-xs text-[var(--muted-foreground)]">
                  Al aceptar, cada parte ve los datos de la otra. Es simétrico: revelas lo
                  mismo que recibes.
                </p>
              </div>
            ) : null}

            {req.direction === "ENVIADA" && req.status === "PENDING" ? (
              <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
                A la espera de que la otra parte decida. No se ha revelado ningún dato.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
