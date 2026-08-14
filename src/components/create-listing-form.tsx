"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ListingCard } from "@/components/listing-card";
import { cn } from "@/lib/utils";
import type { ListingType, PublicListing } from "@/lib/types";

interface CreateResponse {
  listing: PublicListing;
  meta: {
    provider: string;
    providerLabel: string;
    usedLocalFallback: boolean;
    fallbackReason: string | null;
    confidence: number;
    containsIdentifyingInfo: boolean;
    pdf: { pages: number; name: string } | null;
    geocoded: boolean;
  };
}

const EXAMPLE = `Generamos lactosuero dulce procedente de la elaboración de queso de pasta prensada. Volumen constante de 320 toneladas al mes. Humedad 93%, pH 6.4, proteína 0.9%. Se retira refrigerado en cisterna. Disponible todo el año.`;

export function CreateListingForm({
  onCreated,
}: {
  onCreated?: (listing: PublicListing) => void;
}) {
  const [type, setType] = useState<ListingType>("OFERTA");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      // Con PDF hace falta multipart; sin él, JSON basta y es más barato.
      const body = new FormData();
      body.set("type", type);
      body.set("description", description);
      body.set("location", location);
      body.set("companyName", companyName);
      body.set("companyEmail", companyEmail);
      if (pdf) body.set("pdf", pdf);

      const res = await fetch("/api/listings/create", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        const issues = Array.isArray(data.issues)
          ? ` (${data.issues.map((i: { field: string; message: string }) => `${i.field}: ${i.message}`).join("; ")})`
          : "";
        setError(`${data.error ?? "Error desconocido."}${issues}`);
        return;
      }

      setResult(data);
      setDescription("");
      setPdf(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onCreated?.(data.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Crear publicación</CardTitle>
          <CardDescription>
            Describe el subproducto con tus palabras o adjunta la ficha técnica. La IA
            extrae las métricas, asigna el código LER y redacta un título anónimo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tipo */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tipo de publicación</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["OFERTA", "DEMANDA"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    aria-pressed={type === option}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      type === option
                        ? "border-[var(--ring)] bg-[var(--accent)]"
                        : "border-[var(--border)] hover:bg-[var(--muted)]",
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {option === "OFERTA" ? "Oferta" : "Demanda"}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                      {option === "OFERTA"
                        ? "Genero este subproducto"
                        : "Necesito este material"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Descripción */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Descripción del material</Label>
                <button
                  type="button"
                  onClick={() => setDescription(EXAMPLE)}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Usar ejemplo
                </button>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                placeholder="Ej: Generamos 42 Tn/mes de purga de polipropileno copolímero, material limpio y monomaterial. Índice de fluidez 12 g/10min, densidad 905 kg/m3..."
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Cuanto más concreto seas con volumen y propiedades, mejor será el cruce.
              </p>
            </div>

            {/* PDF */}
            <div className="space-y-2">
              <Label htmlFor="pdf">Ficha técnica en PDF (opcional)</Label>
              {pdf ? (
                <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                    <FileText className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{pdf.name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                      {(pdf.size / 1024).toFixed(0)} KB
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPdf(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Quitar el PDF"
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ) : (
                <Input
                  id="pdf"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                  className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:bg-[var(--secondary)] file:px-2 file:py-1"
                />
              )}
            </div>

            {/* Ubicación */}
            <div className="space-y-2">
              <Label htmlFor="location">Zona industrial</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Polígono Industrial, Zaragoza"
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Sólo se publica la localidad. No indiques calle ni número.
              </p>
            </div>

            {/* Datos privados */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 p-4">
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium">
                <ShieldCheck className="size-4 text-[var(--primary)]" aria-hidden />
                Datos privados — no se publican nunca
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Empresa</Label>
                  <Input
                    id="companyName"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Razón social"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email de contacto</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    required
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Sólo se revelan si aceptas una solicitud de contacto.
              </p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Procesando con IA...
                </>
              ) : (
                <>
                  <Sparkles aria-hidden /> Analizar y publicar
                </>
              )}
            </Button>

            {error ? (
              <p className="flex items-start gap-2 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Resultado del pipeline */}
      <div className="space-y-4">
        {result ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ficha generada</CardTitle>
                <CardDescription>
                  Esto es exactamente lo que verán las demás empresas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ListingCard listing={result.listing} />

                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-foreground)]">Motor</dt>
                    <dd className="text-right font-medium">
                      {result.meta.providerLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-foreground)]">Confianza</dt>
                    <dd className="tabular font-medium">
                      {Math.round(result.meta.confidence * 100)} %
                    </dd>
                  </div>
                  {result.meta.pdf ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted-foreground)]">PDF procesado</dt>
                      <dd className="text-right font-medium">
                        {result.meta.pdf.name} · {result.meta.pdf.pages} pág.
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-foreground)]">Geolocalizado</dt>
                    <dd className="font-medium">{result.meta.geocoded ? "Sí" : "No"}</dd>
                  </div>
                </dl>

                {result.meta.containsIdentifyingInfo ? (
                  <p className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-xs">
                    <ShieldCheck
                      className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
                      aria-hidden
                    />
                    El texto original contenía datos identificativos. Se han omitido del
                    título público.
                  </p>
                ) : null}

                {result.meta.usedLocalFallback ? (
                  <p className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-xs">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    El proveedor de IA falló y se ha resuelto con el motor local.
                    {result.meta.fallbackReason ? (
                      <span className="block opacity-70">
                        {result.meta.fallbackReason}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                <p className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)]">
                  <ArrowRight className="size-3.5" aria-hidden />
                  Ve a «Explorar / Matchmaking» para ver sus coincidencias.
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Qué hace la IA con tu texto</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {[
                  [
                    "Anonimiza",
                    "Redacta un título comercial sin razón social, marcas ni direcciones.",
                  ],
                  [
                    "Clasifica",
                    "Asigna un código LER real elegido de un catálogo cerrado.",
                  ],
                  [
                    "Extrae",
                    "Saca humedad, pH, granulometría, densidad… de tu texto o del PDF.",
                  ],
                  ["Normaliza", "Convierte cualquier unidad a toneladas al mes."],
                  [
                    "Vectoriza",
                    "Genera un embedding de 1536 dimensiones para el cruce semántico.",
                  ],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <Badge
                      variant="outline"
                      className="mt-0.5 size-5 justify-center p-0 tabular"
                    >
                      {i + 1}
                    </Badge>
                    <span>
                      <strong className="font-medium">{title}.</strong>{" "}
                      <span className="text-[var(--muted-foreground)]">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
