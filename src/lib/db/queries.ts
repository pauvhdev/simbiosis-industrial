import { getDb } from "./index";
import { toVectorLiteral } from "../ai/embed";
import type {
  ListingType,
  MatchRow,
  PropertiesJson,
  PublicListing,
  Stats,
} from "../types";

export type { ListingType, ListingStatus, MatchRow, PublicListing } from "../types";

/**
 * Columnas que salen hacia la capa pública.
 *
 * Ni `company_id` ni `embedding` están en la lista, y ninguna consulta de este
 * módulo los selecciona. El anonimato se garantiza en el borde de la base de
 * datos, no confiando en que el frontend no los pinte.
 */
const PUBLIC_COLUMNS = `
  id, type, title, description, anonymous_location, lat, lng,
  ler_code, ler_description, properties, quantity_ton_month, status, created_at
`;

// -----------------------------------------------------------------------------
// companies
// -----------------------------------------------------------------------------

export async function upsertCompany(name: string, email: string): Promise<string> {
  const db = await getDb();
  const { rows } = await db.query<{ id: string }>(
    `insert into companies (name, email)
     values ($1, $2)
     on conflict (email) do update set name = excluded.name
     returning id`,
    [name.trim(), email.trim().toLowerCase()],
  );
  return rows[0].id;
}

// -----------------------------------------------------------------------------
// listings
// -----------------------------------------------------------------------------

export interface InsertListingParams {
  companyId: string;
  type: ListingType;
  title: string;
  description: string | null;
  anonymousLocation: string | null;
  lat: number | null;
  lng: number | null;
  lerCode: string | null;
  lerDescription: string | null;
  properties: PropertiesJson;
  quantityTonMonth: number | null;
  embedding: number[];
}

export async function insertListing(p: InsertListingParams): Promise<PublicListing> {
  const db = await getDb();
  const { rows } = await db.query<PublicListing>(
    `insert into listings (
       company_id, type, title, description, anonymous_location, lat, lng,
       ler_code, ler_description, properties, quantity_ton_month, embedding
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::vector
     )
     returning ${PUBLIC_COLUMNS}`,
    [
      p.companyId,
      p.type,
      p.title,
      p.description,
      p.anonymousLocation,
      p.lat,
      p.lng,
      p.lerCode,
      p.lerDescription,
      JSON.stringify(p.properties),
      p.quantityTonMonth,
      toVectorLiteral(p.embedding),
    ],
  );
  return rows[0];
}

export async function listListings(
  opts: {
    type?: ListingType;
    limit?: number;
  } = {},
): Promise<PublicListing[]> {
  const db = await getDb();
  const limit = Math.min(opts.limit ?? 50, 200);

  if (opts.type) {
    const { rows } = await db.query<PublicListing>(
      `select ${PUBLIC_COLUMNS} from listings
       where status = 'ACTIVE' and type = $1
       order by created_at desc limit $2`,
      [opts.type, limit],
    );
    return rows;
  }

  const { rows } = await db.query<PublicListing>(
    `select ${PUBLIC_COLUMNS} from listings
     where status = 'ACTIVE'
     order by created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function getListing(id: string): Promise<PublicListing | null> {
  const db = await getDb();
  const { rows } = await db.query<PublicListing>(
    `select ${PUBLIC_COLUMNS} from listings where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Llama a la función SQL `match_listings()`.
 *
 * Todo el cruce vectorial ocurre dentro de Postgres: filtrado por tipo opuesto,
 * orden por distancia coseno usando el índice HNSW y `limit`. Traerse los
 * vectores a Node para compararlos aquí sería el error clásico — no escala más
 * allá de unos cientos de filas.
 */
export async function matchListings(
  listingId: string,
  matchThreshold = 0.15,
  matchCount = 12,
): Promise<MatchRow[]> {
  const db = await getDb();
  const { rows } = await db.query<MatchRow>(
    `select * from match_listings($1::uuid, $2::double precision, $3::integer)`,
    [listingId, matchThreshold, matchCount],
  );
  return rows;
}

// -----------------------------------------------------------------------------
// contact_requests
// -----------------------------------------------------------------------------

export interface ContactRequestRow {
  id: string;
  from_listing_id: string;
  to_listing_id: string;
  similarity: number | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  created_at: string;
}

export async function createContactRequest(p: {
  fromListingId: string;
  toListingId: string;
  similarity?: number;
  message?: string;
}): Promise<{ row: ContactRequestRow; alreadyExisted: boolean }> {
  const db = await getDb();

  // `do update` en lugar de `do nothing` para que RETURNING siempre devuelva la
  // fila: con `do nothing` un duplicado devuelve 0 filas y habría que hacer un
  // segundo SELECT.
  const { rows } = await db.query<ContactRequestRow & { inserted: boolean }>(
    `insert into contact_requests (from_listing_id, to_listing_id, similarity, message)
     values ($1, $2, $3, $4)
     on conflict (from_listing_id, to_listing_id)
       do update set message = coalesce(nullif(excluded.message, ''), contact_requests.message)
     returning *, (xmax = 0) as inserted`,
    [p.fromListingId, p.toListingId, p.similarity ?? null, p.message ?? null],
  );

  const { inserted, ...row } = rows[0];
  return { row, alreadyExisted: !inserted };
}

export async function listContactRequestsFor(
  listingId: string,
): Promise<ContactRequestRow[]> {
  const db = await getDb();
  const { rows } = await db.query<ContactRequestRow>(
    `select * from contact_requests
     where to_listing_id = $1 or from_listing_id = $1
     order by created_at desc`,
    [listingId],
  );
  return rows;
}

/** Conteo rápido para la cabecera del panel. */
export async function statsOverview(): Promise<Stats> {
  const db = await getDb();
  const { rows } = await db.query<{ offers: string; demands: string; contacts: string }>(
    `select
       (select count(*) from listings where type = 'OFERTA' and status = 'ACTIVE')  as offers,
       (select count(*) from listings where type = 'DEMANDA' and status = 'ACTIVE') as demands,
       (select count(*) from contact_requests)                                      as contacts`,
  );
  return {
    offers: Number(rows[0]?.offers ?? 0),
    demands: Number(rows[0]?.demands ?? 0),
    contacts: Number(rows[0]?.contacts ?? 0),
  };
}
