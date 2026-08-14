/**
 * Catálogo LER (Lista Europea de Residuos, Decisión 2014/955/UE).
 *
 * Es un subconjunto curado de los capítulos con más tráfico en simbiosis
 * industrial, no la lista completa (que tiene ~840 códigos). Cumple tres papeles:
 *
 *  1. Se inyecta en el prompt del LLM como lista cerrada de candidatos, para que
 *     clasifique eligiendo en lugar de inventar un código con formato válido
 *     pero inexistente.
 *  2. Es el clasificador completo cuando se corre en modo `local` (sin API key),
 *     por coincidencia ponderada de palabras clave.
 *  3. Aporta el `label`: el nombre comercial corto del material. Las
 *     descripciones oficiales del LER son inservibles como título — cuatro
 *     códigos distintos comparten literalmente "materiales inadecuados para el
 *     consumo o la elaboración", así que usarlas colapsaría materiales que no
 *     tienen nada que ver.
 */

export interface LerEntry {
  code: string;
  /** Descripción oficial del LER. */
  description: string;
  /** Nombre comercial corto, el que se usa en los títulos. */
  label: string;
  /** Términos que IDENTIFICAN el material. Peso completo. */
  keywords: string[];
  /**
   * Términos de proceso, sector o contexto. Peso reducido: "mecanizado" aparece
   * tanto en una viruta de acero como en una de aluminio, así que no puede
   * decidir por sí solo entre 12 01 01 y 12 01 03.
   */
  context?: string[];
}

export const LER_CATALOG: LerEntry[] = [
  // --- 02  Agricultura, horticultura, pesca, alimentación -------------------
  {
    code: "02 01 03",
    description: "Residuos de tejidos vegetales",
    label: "subproducto vegetal",
    keywords: [
      "poda",
      "vegetal",
      "hoja",
      "tallo",
      "paja",
      "rastrojo",
      "cascarilla",
      "biomasa vegetal",
    ],
  },
  {
    code: "02 01 06",
    description:
      "Heces de animales, orina y estiércol, efluentes recogidos selectivamente",
    label: "purín y estiércol",
    keywords: ["purin", "purines", "estiercol", "gallinaza", "deyeccion"],
    context: ["ganadero"],
  },
  {
    code: "02 02 03",
    description:
      "Materiales inadecuados para el consumo o la elaboración (cárnica y pescado)",
    label: "subproducto cárnico",
    keywords: ["carnico", "despojo", "pescado", "visceras", "sangre", "grasa animal"],
    context: ["matadero"],
  },
  {
    code: "02 03 04",
    description:
      "Materiales inadecuados para el consumo o la elaboración (frutas y hortalizas)",
    label: "subproducto de fruta y hortaliza",
    keywords: [
      "fruta",
      "hortaliza",
      "verdura",
      "citrico",
      "naranja",
      "tomate",
      "orujo",
      "pulpa",
      "destrio",
    ],
    context: ["zumo"],
  },
  {
    code: "02 03 05",
    description: "Lodos del tratamiento in situ de efluentes (vegetal)",
    label: "lodo vegetal",
    keywords: ["lodo vegetal", "fango vegetal"],
    context: ["depuradora industrial", "efluente vegetal"],
  },
  {
    code: "02 05 01",
    description:
      "Materiales inadecuados para el consumo o la elaboración (industria láctea)",
    label: "suero lácteo",
    keywords: ["lacteo", "suero", "lactosuero", "leche", "queso", "nata", "requeson"],
  },
  {
    code: "02 06 01",
    description:
      "Materiales inadecuados para el consumo o la elaboración (panadería y pastelería)",
    label: "subproducto de panificación",
    keywords: ["pan", "harina", "masa", "bolleria", "galleta"],
    context: ["panaderia", "reposteria"],
  },
  {
    code: "02 07 04",
    description:
      "Materiales inadecuados para el consumo o la elaboración (bebidas alcohólicas)",
    label: "bagazo y subproducto de bebidas",
    keywords: ["cerveza", "bagazo", "vinaza", "vino", "malta", "lia", "levadura"],
    context: ["bodega", "destileria"],
  },

  // --- 03  Madera, papel, cartón --------------------------------------------
  {
    code: "03 01 05",
    description:
      "Serrín, virutas, recortes, madera y tableros que no contienen sustancias peligrosas",
    label: "serrín y viruta de madera",
    keywords: ["serrin", "madera", "tablero", "mdf", "astilla", "viruta de madera"],
    context: ["aserradero", "viruta"],
  },
  {
    code: "03 03 01",
    description: "Residuos de corteza y madera (industria papelera)",
    label: "corteza y fibra celulósica",
    keywords: ["corteza", "pasta de papel", "celulosa"],
    context: ["papelera"],
  },
  {
    code: "03 03 11",
    description: "Lodos del tratamiento in situ de efluentes (papel y cartón)",
    label: "lodo papelero",
    keywords: ["lodo papelero", "fango papelero", "rechazo de pulper"],
  },

  // --- 04  Cuero y textil ----------------------------------------------------
  {
    code: "04 01 08",
    description: "Residuos de piel curtida que contienen cromo",
    label: "recorte de piel curtida",
    keywords: ["piel", "cuero", "serraje"],
    context: ["curtido", "cromo"],
  },
  {
    code: "04 02 22",
    description: "Residuos de fibras textiles procesadas",
    label: "fibra textil",
    keywords: ["textil", "algodon", "tejido", "retal", "fibra textil"],
    context: ["hilatura", "confeccion"],
  },

  // --- 07 / 12  Plásticos, polímeros, metales --------------------------------
  {
    code: "07 02 13",
    description: "Residuos de plástico (fabricación de plásticos y cauchos)",
    label: "polímero termoplástico",
    keywords: [
      "plastico",
      "polimero",
      "polietileno",
      "polipropileno",
      "pet",
      "hdpe",
      "ldpe",
      "abs",
      "pvc",
      "granza",
    ],
    context: ["purga", "colada"],
  },
  {
    code: "12 01 01",
    description: "Limaduras y virutas de metales férreos",
    label: "viruta de metal férreo",
    keywords: ["acero", "hierro", "ferreo", "limadura", "viruta de acero"],
    context: ["mecanizado"],
  },
  {
    code: "12 01 03",
    description: "Limaduras y virutas de metales no férreos",
    label: "viruta de metal no férreo",
    keywords: ["aluminio", "cobre", "laton", "bronce", "zinc", "no ferreo"],
    context: ["mecanizado"],
  },
  {
    code: "12 01 05",
    description: "Virutas y rebabas de materiales plásticos",
    label: "viruta de plástico",
    keywords: ["rebaba", "viruta de plastico", "triturado plastico"],
    context: ["mecanizado plastico"],
  },

  // --- 10  Procesos térmicos -------------------------------------------------
  {
    code: "10 01 01",
    description: "Cenizas de hogar, escorias y polvo de caldera",
    label: "ceniza de combustión",
    keywords: ["ceniza", "polvo de caldera"],
    context: ["caldera", "combustion"],
  },
  {
    code: "10 02 01",
    description: "Residuos del tratamiento de escorias (siderurgia)",
    label: "escoria siderúrgica",
    keywords: ["escoria", "escoria siderurgica"],
    context: ["siderurgia", "horno alto", "fundicion"],
  },
  {
    code: "10 12 08",
    description:
      "Residuos de cerámica, ladrillos, tejas y materiales de construcción cocidos",
    label: "residuo cerámico",
    keywords: ["ceramica", "ladrillo", "teja", "gres", "porcelana", "chamota"],
  },
  {
    code: "10 13 14",
    description: "Residuos de hormigón y lodos de hormigón",
    label: "residuo de hormigón",
    keywords: ["hormigon", "cemento", "lodo de hormigon"],
    context: ["prefabricado"],
  },

  // --- 15  Envases -----------------------------------------------------------
  {
    code: "15 01 01",
    description: "Envases de papel y cartón",
    label: "papel y cartón de embalaje",
    keywords: ["carton", "papel"],
    context: ["caja", "embalaje de carton"],
  },
  {
    code: "15 01 02",
    description: "Envases de plástico",
    label: "envase de plástico",
    keywords: ["envase de plastico", "film", "bidon", "garrafa", "big bag"],
    context: ["flejes"],
  },
  {
    code: "15 01 03",
    description: "Envases de madera",
    label: "palet y envase de madera",
    keywords: ["palet", "pallet", "caja de madera", "envase de madera"],
  },
  {
    code: "15 01 04",
    description: "Envases metálicos",
    label: "envase metálico",
    keywords: ["lata", "envase metalico", "bidon metalico", "hojalata"],
  },
  {
    code: "15 01 07",
    description: "Envases de vidrio",
    label: "calcín de vidrio",
    keywords: ["vidrio", "calcin", "casco de vidrio"],
    context: ["botella"],
  },

  // --- 16 / 17  Neumáticos y construcción ------------------------------------
  {
    code: "16 01 03",
    description: "Neumáticos fuera de uso",
    label: "neumático fuera de uso",
    keywords: ["neumatico", "nfu", "caucho"],
    context: ["rueda"],
  },
  {
    code: "17 01 01",
    description: "Hormigón (residuos de construcción y demolición)",
    label: "árido de demolición",
    keywords: ["rcd", "escombro", "arido reciclado"],
    context: ["demolicion"],
  },
  {
    code: "17 04 05",
    description: "Hierro y acero",
    label: "chatarra férrica",
    keywords: ["chatarra", "chapa", "ferralla", "perfil de acero"],
  },

  // --- 19 / 20  Gestión de residuos y municipales ----------------------------
  {
    code: "19 05 03",
    description: "Compost fuera de especificación",
    label: "compost fuera de especificación",
    keywords: ["compost", "enmienda organica"],
    context: ["compostaje"],
  },
  {
    code: "19 06 06",
    description: "Digestato de la digestión anaerobia de residuos animales y vegetales",
    label: "digestato",
    keywords: ["digestato"],
    context: ["biogas", "digestion anaerobia", "metanizacion"],
  },
  {
    code: "19 08 05",
    description: "Lodos del tratamiento de aguas residuales urbanas",
    label: "lodo de depuradora",
    keywords: ["lodo edar", "fango de depuradora", "edar"],
    context: ["aguas residuales"],
  },
  {
    code: "19 09 02",
    description: "Lodos de la clarificación del agua",
    label: "lodo de clarificación",
    keywords: ["lodo de clarificacion"],
    context: ["potabilizadora", "etap"],
  },
  {
    code: "19 12 04",
    description: "Plástico y caucho (tratamiento mecánico de residuos)",
    label: "plástico y caucho triturado",
    keywords: ["plastico mezclado", "rechazo plastico", "caucho triturado"],
  },
  {
    code: "19 12 07",
    description: "Madera (tratamiento mecánico de residuos)",
    label: "madera triturada",
    keywords: ["madera triturada", "astilla reciclada"],
  },
  {
    code: "20 01 08",
    description: "Residuos biodegradables de cocinas y restaurantes",
    label: "residuo alimentario",
    keywords: ["sobrante alimentario", "foodwaste"],
    context: ["cocina", "restauracion", "catering"],
  },
  {
    code: "20 01 25",
    description: "Aceites y grasas comestibles",
    label: "aceite vegetal usado",
    keywords: ["aceite vegetal usado", "aceite de fritura", "grasa comestible", "avu"],
  },
  {
    code: "20 02 01",
    description: "Residuos biodegradables (parques y jardines)",
    label: "restos de poda",
    keywords: ["restos de poda", "cesped"],
    context: ["jardineria", "verde urbano"],
  },
];

/** Código genérico cuando no hay ninguna señal. Preferible a inventarse uno. */
export const LER_UNKNOWN: LerEntry = {
  code: "19 12 12",
  description: "Otros residuos de tratamiento mecánico de residuos",
  label: "subproducto industrial sin clasificar",
  keywords: [],
};

/** Índice código -> entrada, para enriquecer resultados. */
export const LER_BY_CODE = new Map([...LER_CATALOG, LER_UNKNOWN].map((e) => [e.code, e]));

/** Lista compacta que se inyecta en el prompt del LLM. */
export function lerCatalogPrompt(): string {
  return LER_CATALOG.map((e) => `${e.code} — ${e.description} [${e.label}]`).join("\n");
}

/** `true` si el código existe en el catálogo. */
export function isKnownLerCode(code: string | null | undefined): boolean {
  return !!code && LER_BY_CODE.has(code.trim());
}

/** Nombre comercial corto de un código, o null si no se conoce. */
export function lerLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return LER_BY_CODE.get(code.trim())?.label ?? null;
}
