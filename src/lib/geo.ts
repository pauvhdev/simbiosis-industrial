/**
 * Geolocalización sin API de pago.
 *
 * En vez de llamar a un servicio de geocoding (todos con cuota o tarjeta), se
 * resuelve contra un gazetteer local de capitales de provincia y polos
 * industriales españoles. Para este caso de uso es lo correcto además de gratis:
 * la plataforma es ANÓNIMA, así que la ubicación tiene que ser deliberadamente
 * difusa. Geocodificar a nivel de calle sería un fallo de privacidad, no una
 * mejora.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Etiqueta normalizada que se muestra públicamente. */
  label: string;
}

interface GazetteerEntry {
  names: string[];
  lat: number;
  lng: number;
  label: string;
}

const GAZETTEER: GazetteerEntry[] = [
  {
    names: ["madrid", "getafe", "alcala de henares", "mostoles"],
    lat: 40.4168,
    lng: -3.7038,
    label: "Madrid",
  },
  {
    names: ["barcelona", "hospitalet", "badalona", "terrassa", "sabadell"],
    lat: 41.3874,
    lng: 2.1686,
    label: "Barcelona",
  },
  {
    names: ["valencia", "paterna", "sagunto", "torrent"],
    lat: 39.4699,
    lng: -0.3763,
    label: "Valencia",
  },
  {
    names: ["sevilla", "dos hermanas", "alcala de guadaira"],
    lat: 37.3891,
    lng: -5.9845,
    label: "Sevilla",
  },
  {
    names: ["zaragoza", "plaza", "utebo"],
    lat: 41.6488,
    lng: -0.8891,
    label: "Zaragoza",
  },
  { names: ["malaga", "marbella"], lat: 36.7213, lng: -4.4214, label: "Málaga" },
  {
    names: ["murcia", "alcantarilla", "molina de segura"],
    lat: 37.9922,
    lng: -1.1307,
    label: "Murcia",
  },
  {
    names: ["palma", "mallorca", "baleares"],
    lat: 39.5696,
    lng: 2.6502,
    label: "Palma de Mallorca",
  },
  {
    names: ["bilbao", "vizcaya", "bizkaia", "barakaldo"],
    lat: 43.263,
    lng: -2.935,
    label: "Bilbao",
  },
  { names: ["alicante", "elche", "elx"], lat: 38.3452, lng: -0.481, label: "Alicante" },
  { names: ["cordoba"], lat: 37.8882, lng: -4.7794, label: "Córdoba" },
  { names: ["valladolid"], lat: 41.6523, lng: -4.7245, label: "Valladolid" },
  { names: ["vigo", "pontevedra"], lat: 42.2406, lng: -8.7207, label: "Vigo" },
  {
    names: ["gijon", "aviles", "asturias", "oviedo"],
    lat: 43.5322,
    lng: -5.6611,
    label: "Gijón",
  },
  {
    names: ["vitoria", "gasteiz", "alava", "araba"],
    lat: 42.8467,
    lng: -2.6716,
    label: "Vitoria-Gasteiz",
  },
  { names: ["granada"], lat: 37.1773, lng: -3.5986, label: "Granada" },
  {
    names: ["a coruna", "la coruna", "coruna"],
    lat: 43.3623,
    lng: -8.4115,
    label: "A Coruña",
  },
  { names: ["elda", "petrer"], lat: 38.4776, lng: -0.7917, label: "Elda" },
  {
    names: ["tarragona", "reus", "camp de tarragona"],
    lat: 41.1189,
    lng: 1.2445,
    label: "Tarragona",
  },
  { names: ["lleida", "lerida"], lat: 41.6176, lng: 0.62, label: "Lleida" },
  { names: ["girona", "gerona", "figueres"], lat: 41.9794, lng: 2.8214, label: "Girona" },
  {
    names: ["castellon", "castello", "vila-real", "onda"],
    lat: 39.9864,
    lng: -0.0513,
    label: "Castellón",
  },
  {
    names: ["pamplona", "navarra", "iruna"],
    lat: 42.8125,
    lng: -1.6458,
    label: "Pamplona",
  },
  {
    names: ["santander", "cantabria", "torrelavega"],
    lat: 43.4623,
    lng: -3.8099,
    label: "Santander",
  },
  {
    names: ["logrono", "la rioja", "rioja"],
    lat: 42.4627,
    lng: -2.445,
    label: "Logroño",
  },
  { names: ["burgos", "miranda de ebro"], lat: 42.3439, lng: -3.6969, label: "Burgos" },
  { names: ["salamanca"], lat: 40.9701, lng: -5.6635, label: "Salamanca" },
  { names: ["leon", "ponferrada"], lat: 42.5987, lng: -5.5671, label: "León" },
  { names: ["albacete"], lat: 38.9943, lng: -1.8585, label: "Albacete" },
  { names: ["toledo", "illescas"], lat: 39.8628, lng: -4.0273, label: "Toledo" },
  {
    names: ["guadalajara", "azuqueca"],
    lat: 40.6296,
    lng: -3.1667,
    label: "Guadalajara",
  },
  {
    names: ["ciudad real", "puertollano"],
    lat: 38.9848,
    lng: -3.9273,
    label: "Ciudad Real",
  },
  { names: ["caceres", "extremadura"], lat: 39.4753, lng: -6.3724, label: "Cáceres" },
  { names: ["badajoz", "merida"], lat: 38.8794, lng: -6.9707, label: "Badajoz" },
  { names: ["huelva"], lat: 37.2614, lng: -6.9447, label: "Huelva" },
  { names: ["cadiz", "jerez", "algeciras"], lat: 36.5271, lng: -6.2886, label: "Cádiz" },
  { names: ["almeria", "el ejido"], lat: 36.8381, lng: -2.4597, label: "Almería" },
  { names: ["jaen", "linares"], lat: 37.7796, lng: -3.7849, label: "Jaén" },
  { names: ["huesca", "monzon"], lat: 42.1401, lng: -0.4089, label: "Huesca" },
  { names: ["teruel"], lat: 40.3456, lng: -1.1065, label: "Teruel" },
  {
    names: ["san sebastian", "donostia", "guipuzcoa", "gipuzkoa", "irun"],
    lat: 43.3183,
    lng: -1.9812,
    label: "San Sebastián",
  },
  { names: ["ourense", "orense"], lat: 42.3358, lng: -7.8639, label: "Ourense" },
  { names: ["lugo"], lat: 43.0121, lng: -7.5559, label: "Lugo" },
  {
    names: ["santiago", "compostela"],
    lat: 42.8782,
    lng: -8.5448,
    label: "Santiago de Compostela",
  },
  { names: ["zamora"], lat: 41.5033, lng: -5.7446, label: "Zamora" },
  { names: ["palencia"], lat: 42.0096, lng: -4.5288, label: "Palencia" },
  { names: ["segovia"], lat: 40.9429, lng: -4.1088, label: "Segovia" },
  { names: ["avila"], lat: 40.6566, lng: -4.6818, label: "Ávila" },
  { names: ["soria"], lat: 41.7665, lng: -2.479, label: "Soria" },
  { names: ["cuenca"], lat: 40.0704, lng: -2.1374, label: "Cuenca" },
  {
    names: ["las palmas", "gran canaria", "canarias"],
    lat: 28.1235,
    lng: -15.4363,
    label: "Las Palmas",
  },
  {
    names: ["tenerife", "santa cruz de tenerife"],
    lat: 28.4636,
    lng: -16.2518,
    label: "Santa Cruz de Tenerife",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita las tildes ya descompuestas por NFD
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resuelve un texto libre de ubicación a coordenadas.
 * Devuelve `null` si no reconoce ningún topónimo — la publicación se guarda
 * igualmente, sólo que sin componente geográfica en el matching.
 */
export function resolveLocation(input: string): GeoPoint | null {
  const haystack = normalize(input);
  if (!haystack) return null;

  let best: { entry: GazetteerEntry; score: number } | null = null;

  for (const entry of GAZETTEER) {
    for (const name of entry.names) {
      // Coincidencia por palabra completa para que "leon" no case dentro de
      // "leonés" ni "lugo" dentro de "lugar".
      const re = new RegExp(`(^|\\s)${name.replace(/\s/g, "\\s")}($|\\s)`);
      if (re.test(haystack)) {
        const score = name.length; // el topónimo más específico gana
        if (!best || score > best.score) best = { entry, score };
      }
    }
  }

  if (!best) return null;
  return { lat: best.entry.lat, lng: best.entry.lng, label: best.entry.label };
}

/**
 * Normaliza el texto de ubicación a la forma pública anónima.
 * "nave 3, pol. malpica, zaragoza" -> "Polígono industrial, Zaragoza"
 */
export function anonymizeLocation(input: string, geo: GeoPoint | null): string {
  if (geo) return `Polígono industrial, ${geo.label}`;
  const cleaned = input.trim();
  return cleaned ? `Zona industrial, ${cleaned}` : "Ubicación no especificada";
}

/** Distancia en kilómetros entre dos puntos (haversine). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
