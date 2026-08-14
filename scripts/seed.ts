/**
 * Carga datos de demostración.
 *
 *   npm run db:seed
 *
 * Los datos NO se insertan a mano: pasan por el mismo pipeline que el endpoint
 * (extracción estructurada -> embedding -> geolocalización). Así el seed sirve
 * además como prueba de humo de todo el flujo de IA, y los vectores que quedan
 * en la base son exactamente los que produciría el formulario.
 *
 * Están pensados en PARES complementarios (una oferta y una demanda que deberían
 * encontrarse) mezclados con ruido, para poder juzgar si el matchmaking funciona.
 */
import { loadEnv } from "./env";
import { run } from "./run";

loadEnv();

interface SeedListing {
  type: "OFERTA" | "DEMANDA";
  companyName: string;
  companyEmail: string;
  location: string;
  description: string;
}

const SEED: SeedListing[] = [
  // --- Par 1: lactosuero ------------------------------------------------------
  {
    type: "OFERTA",
    companyName: "Quesos del Moncayo S.L.",
    companyEmail: "produccion@quesosmoncayo.example",
    location: "Polígono Malpica, Zaragoza",
    description:
      "Generamos lactosuero dulce procedente de la elaboración de queso de pasta prensada. " +
      "Volumen constante de 320 toneladas al mes. Humedad 93%, pH 6.4, proteína 0.9%, " +
      "materia orgánica 6.2%. Se retira refrigerado en cisterna. Disponible todo el año.",
  },
  {
    type: "DEMANDA",
    companyName: "Piensos Altoaragón S.A.",
    companyEmail: "compras@piensosaltoaragon.example",
    location: "Monzón, Huesca",
    description:
      "Buscamos suero lácteo líquido para incorporar como ingrediente proteico en pienso " +
      "de porcino. Necesitamos entre 200 y 400 toneladas mensuales. Requisito: pH entre 5 y 7, " +
      "proteína mínima 0.7%. Recogemos con cisterna propia.",
  },

  // --- Par 2: polipropileno ---------------------------------------------------
  {
    type: "OFERTA",
    companyName: "Inyectados Vallès S.L.",
    companyEmail: "calidad@inyectadosvalles.example",
    location: "Polígono Can Roqueta, Sabadell, Barcelona",
    description:
      "Purga y coladas de polipropileno copolímero de inyección, material post-industrial " +
      "limpio y monomaterial. 42 Tn/mes. Índice de fluidez 12 g/10min, densidad 905 kg/m3. " +
      "Se entrega en big bag de 1000 kg, triturado a granulometría 8 mm.",
  },
  {
    type: "DEMANDA",
    companyName: "Recuperaciones Camp S.L.",
    companyEmail: "materiaprima@recuperacionescamp.example",
    location: "Polígono Riu Clar, Tarragona",
    description:
      "Compramos plástico post-industrial de polipropileno para producir granza reciclada. " +
      "Admitimos hasta 60 toneladas al mes. Necesitamos material monomaterial sin contaminar, " +
      "índice de fluidez entre 8 y 20 g/10min. Preferible ya triturado.",
  },

  // --- Par 3: biomasa oleícola ------------------------------------------------
  {
    type: "OFERTA",
    companyName: "Almazara San Isidro S.C.",
    companyEmail: "gerencia@almazarasanisidro.example",
    location: "Polígono Los Olivares, Jaén",
    description:
      "Orujo graso húmedo de almazara de dos fases, campaña de noviembre a marzo. " +
      "1.800 toneladas al año. Humedad 62%, materia orgánica 88%, poder calorífico 4.2 MJ/kg, " +
      "pH 4.8. Retirada en camión bañera desde la propia almazara.",
  },
  {
    type: "DEMANDA",
    companyName: "Cogeneración Guadalquivir S.A.",
    companyEmail: "abastecimiento@cogenguadalquivir.example",
    location: "Polígono Las Quemadas, Córdoba",
    description:
      "Necesitamos biomasa residual para caldera de valorización energética. Consumo objetivo " +
      "150 toneladas al mes. Buscamos subproducto vegetal con poder calorífico superior a 3.5 MJ/kg " +
      "y humedad por debajo del 65%. Aceptamos orujo, hueso de aceituna o cascarilla.",
  },

  // --- Par 4: madera ----------------------------------------------------------
  {
    type: "OFERTA",
    companyName: "Aserraderos del Bierzo S.L.",
    companyEmail: "logistica@aserraderosbierzo.example",
    location: "Ponferrada, León",
    description:
      "Serrín y viruta de pino sin tratar procedente de aserradero. 95 Tn/mes de forma estable. " +
      "Humedad 14%, granulometría 2-6 mm, cenizas 0.6%, poder calorífico 17.5 MJ/kg. " +
      "Material limpio, sin colas ni barnices. Cargamos en piso móvil.",
  },
  {
    type: "DEMANDA",
    companyName: "Pellets de Castilla S.L.",
    companyEmail: "compras@pelletscastilla.example",
    location: "Polígono San Cristóbal, Valladolid",
    description:
      "Compramos serrín de madera virgen para fabricación de pellet certificado ENplus. " +
      "Requerimos 120 toneladas al mes. Humedad máxima 20%, contenido en cenizas inferior al 1%, " +
      "sin madera tratada ni tableros. Granulometría preferida por debajo de 8 mm.",
  },

  // --- Par 5: bagazo cervecero ------------------------------------------------
  {
    type: "OFERTA",
    companyName: "Cervecera Independiente de Madrid S.L.",
    companyEmail: "planta@cerveceraindependiente.example",
    location: "Polígono Ventorro del Cano, Madrid",
    description:
      "Bagazo de malta procedente del proceso de maceración. Generamos 65 toneladas al mes. " +
      "Humedad 78%, proteína 24% sobre materia seca, pH 5.1. Producto fresco, hay que retirarlo " +
      "en menos de 48 horas. Disponemos de muelle de carga y contenedor estanco.",
  },
  {
    type: "DEMANDA",
    companyName: "Ganadería Integral Toledana S.C.",
    companyEmail: "nutricion@ganaderiatoledana.example",
    location: "Illescas, Toledo",
    description:
      "Buscamos subproducto de cereal o malta para alimentación de vacuno de leche. " +
      "Consumimos 50 toneladas mensuales. Necesitamos proteína superior al 20% sobre seco " +
      "y humedad inferior al 82%. Recogida propia dentro de un radio de 100 km.",
  },

  // --- Par 6: aluminio --------------------------------------------------------
  {
    type: "OFERTA",
    companyName: "Mecanizados Nervión S.A.",
    companyEmail: "produccion@mecanizadosnervion.example",
    location: "Polígono Asua-Erletxes, Barakaldo, Bizkaia",
    description:
      "Virutas y recortes de aluminio de la serie 6000 procedentes de mecanizado CNC. " +
      "18 Tn/mes. Material clasificado por aleación, con taladrina escurrida. Densidad aparente " +
      "310 kg/m3. Se sirve en contenedor metálico de 1,5 m3.",
  },
  {
    type: "DEMANDA",
    companyName: "Fundiciones Araba S.L.",
    companyEmail: "materiaprima@fundicionesaraba.example",
    location: "Polígono Júndiz, Vitoria-Gasteiz",
    description:
      "Necesitamos chatarra de aluminio no férreo clasificada para horno de fusión. " +
      "Capacidad de compra de 40 toneladas al mes. Imprescindible aleación identificada " +
      "y bajo contenido en aceite. Retiramos con camión propio.",
  },

  // --- Ruido: publicaciones que NO deberían cruzarse con las anteriores --------
  {
    type: "OFERTA",
    companyName: "Vidrios del Sur S.A.",
    companyEmail: "planta@vidriosdelsur.example",
    location: "Polígono La Isla, Dos Hermanas, Sevilla",
    description:
      "Calcín de vidrio sódico-cálcico procedente de rechazo de línea de envase. " +
      "220 toneladas al mes. Granulometría 3-15 mm, libre de cerámica y metales. " +
      "Se entrega a granel en bañera.",
  },
  {
    type: "DEMANDA",
    companyName: "Cerámicas Onda S.L.",
    companyEmail: "compras@ceramicasonda.example",
    location: "Onda, Castellón",
    description:
      "Buscamos chamota y residuo cerámico cocido molido para incorporar como desgrasante " +
      "en pasta de gres. Consumo de 80 toneladas mensuales. Granulometría por debajo de 2 mm " +
      "y ausencia total de yeso.",
  },
];

async function main() {
  const { extractListing } = await import("../src/lib/ai/extract");
  const { buildEmbeddingText, embedText } = await import("../src/lib/ai/embed");
  const { resolveLocation, anonymizeLocation } = await import("../src/lib/geo");
  const { toPropertiesJson } = await import("../src/lib/schemas");
  const { insertListing, upsertCompany } = await import("../src/lib/db/queries");
  const { getDb } = await import("../src/lib/db/index");
  const { providerConfig, resolveProviderId } = await import("../src/lib/ai/provider");

  const db = await getDb();
  const provider = providerConfig(resolveProviderId());

  console.log(`→ Driver de BD : ${db.driver}`);
  console.log(`→ Proveedor IA : ${provider.label}  [${provider.cost}]`);
  console.log(`→ Insertando ${SEED.length} publicaciones...\n`);

  let created = 0;

  for (const item of SEED) {
    const sourceText = `${item.description}\n\nUbicación declarada: ${item.location}`;

    const { extraction, usedFallback } = await extractListing({
      text: sourceText,
      type: item.type,
    });
    const embeddingText = buildEmbeddingText(extraction);
    const { embedding } = await embedText(embeddingText);

    const geo = resolveLocation(item.location);
    const companyId = await upsertCompany(item.companyName, item.companyEmail);

    await insertListing({
      companyId,
      type: item.type,
      title: extraction.title,
      description: embeddingText,
      anonymousLocation: anonymizeLocation(item.location, geo),
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      lerCode: extraction.ler_code,
      lerDescription: extraction.ler_description,
      properties: toPropertiesJson(extraction.properties),
      quantityTonMonth: extraction.quantity_ton_month,
      embedding,
    });

    created++;
    const qty =
      extraction.quantity_ton_month !== null
        ? `${extraction.quantity_ton_month} Tn/mes`
        : "sin cantidad";
    console.log(
      `  ${item.type.padEnd(7)} LER ${extraction.ler_code}  ${qty.padEnd(16)} ${extraction.title}` +
        (usedFallback ? "   (fallback local)" : ""),
    );
  }

  console.log(`\n✔ ${created} publicaciones creadas.`);

  // Prueba de humo del matchmaking: se cruza la primera oferta y se comprueba
  // que su pareja complementaria sale entre los primeros resultados.
  const { rows } = await db.query<{ id: string; title: string }>(
    `select id, title from listings where type = 'OFERTA' order by created_at asc limit 1`,
  );

  if (rows[0]) {
    const { matchListings } = await import("../src/lib/db/queries");
    const matches = await matchListings(rows[0].id, 0.05, 3);
    console.log(`\n→ Comprobación de matchmaking para: "${rows[0].title}"`);
    if (matches.length === 0) {
      console.log("  (sin coincidencias por encima del umbral)");
    }
    for (const m of matches) {
      console.log(
        `  coseno ${m.similarity.toFixed(3)}  ${m.distance_km !== null ? `${Math.round(m.distance_km)} km`.padEnd(8) : "  ?  km"}  ${m.title}`,
      );
    }
  }

  console.log("\nListo. Arranca con: npm run dev");
}

run(main);
