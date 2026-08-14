import type { PropertiesJson } from "@/lib/types";

const LABELS: Record<string, string> = {
  humedad: "Humedad",
  ph: "pH",
  granulometria: "Granulometría",
  densidad: "Densidad",
  poder_calorifico: "P. calorífico",
  materia_organica: "M. orgánica",
  cenizas: "Cenizas",
  proteina: "Proteína",
  grasa: "Grasa",
  temperatura: "Temperatura",
  nitrogeno: "Nitrógeno",
  fosforo: "Fósforo",
  solidos_totales: "Sólidos totales",
  dqo: "DQO",
  indice_fluidez: "Índice de fluidez",
};

function humanize(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Métricas químicas/físicas extraídas por la IA, en formato compacto. */
export function PropertiesList({ properties }: { properties: PropertiesJson }) {
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {entries.map(([key, prop]) => (
        <div key={key} className="flex items-baseline gap-1">
          <dt className="text-[var(--muted-foreground)]">{humanize(key)}</dt>
          <dd className="tabular font-medium">
            {prop.value}
            {prop.unit ? <span className="ml-0.5 font-normal">{prop.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
