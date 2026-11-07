import { getDb } from "./index";
import { toVectorLiteral } from "../ai/embed";
import type {
  ContactRequestView,
  ListingType,
  MatchRow,
  PropertiesJson,
  PublicListing,
  SessionCompany,
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

// -----------------------------------------------------------------------------
// Autenticación
// -----------------------------------------------------------------------------

export interface CompanyAuthRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
}

/**
 * Alta de empresa. Devuelve null si el email ya está registrado.
 *
 * `do nothing` en vez de `do update`: una empresa existente NO debe poder ser
 * pisada por quien acierte su email. Es la diferencia entre registrarse y
 * apropiarse de una cuenta ajena.
 */
export async function registerCompany(
  name: string,
  email: string,
  passwordHash: string,
): Promise<{ id: string } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ id: string }>(
    `insert into companies (name, email, password_hash)
     values ($1, $2, $3)
     on conflict (email) do nothing
     returning id`,
    [name.trim(), email.trim().toLowerCase(), passwordHash],
  );
  return rows[0] ?? null;
}

export async function getCompanyAuthByEmail(
  email: string,
): Promise<CompanyAuthRow | null> {
  const db = await getDb();
  const { rows } = await db.query<CompanyAuthRow>(
    `select id, name, email, password_hash from companies where email = $1`,
    [email.trim().toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function getSessionCompany(id: string): Promise<SessionCompany | null> {
  const db = await getDb();
  const { rows } = await db.query<SessionCompany>(
    `select id, name, email from companies where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// -----------------------------------------------------------------------------
// Propiedad de las publicaciones
// -----------------------------------------------------------------------------

/** Id de la empresa dueña de una publicación, o null si no existe. */
export async function getListingOwner(listingId: string): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query<{ company_id: string }>(
    `select company_id from listings where id = $1`,
    [listingId],
  );
  return rows[0]?.company_id ?? null;
}

export async function listListingsForCompany(
  companyId: string,
): Promise<PublicListing[]> {
  const db = await getDb();
  const { rows } = await db.query<PublicListing>(
    `select ${PUBLIC_COLUMNS} from listings
     where company_id = $1
     order by created_at desc`,
    [companyId],
  );
  return rows;
}

// -----------------------------------------------------------------------------
// Bandeja de solicitudes de descruce
// -----------------------------------------------------------------------------

interface ContactRequestJoinRow {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  similarity: number | null;
  message: string | null;
  created_at: string;
  direction: "RECIBIDA" | "ENVIADA";
  own_id: string;
  own_title: string;
  own_type: ListingType;
  cp_id: string;
  cp_title: string;
  cp_type: ListingType;
  cp_location: string | null;
  cp_ler: string | null;
  revealed_name: string | null;
  revealed_email: string | null;
}

/**
 * Todas las solicitudes en las que participa la empresa, en las dos direcciones.
 *
 * El `case` sobre `status` es lo que sostiene el doble consentimiento: mientras
 * la solicitud no esté ACEPTADA, la consulta no proyecta el nombre ni el email
 * de la contraparte, así que esos datos no llegan a salir de Postgres.
 */
export async function listContactRequestsForCompany(
  companyId: string,
): Promise<ContactRequestView[]> {
  const db = await getDb();
  const { rows } = await db.query<ContactRequestJoinRow>(
    `select
       cr.id,
       cr.status,
       cr.similarity,
       cr.message,
       cr.created_at,
       case when tl.company_id = $1 then 'RECIBIDA' else 'ENVIADA' end as direction,

       case when tl.company_id = $1 then tl.id    else fl.id    end as own_id,
       case when tl.company_id = $1 then tl.title else fl.title end as own_title,
       case when tl.company_id = $1 then tl.type  else fl.type  end as own_type,

       case when tl.company_id = $1 then fl.id                 else tl.id                 end as cp_id,
       case when tl.company_id = $1 then fl.title              else tl.title              end as cp_title,
       case when tl.company_id = $1 then fl.type               else tl.type               end as cp_type,
       case when tl.company_id = $1 then fl.anonymous_location else tl.anonymous_location end as cp_location,
       case when tl.company_id = $1 then fl.ler_code           else tl.ler_code           end as cp_ler,

       case when cr.status = 'ACCEPTED'
            then case when tl.company_id = $1 then fc.name else tc.name end
       end as revealed_name,
       case when cr.status = 'ACCEPTED'
            then case when tl.company_id = $1 then fc.email else tc.email end
       end as revealed_email

     from contact_requests cr
     join listings  fl on fl.id = cr.from_listing_id
     join listings  tl on tl.id = cr.to_listing_id
     join companies fc on fc.id = fl.company_id
     join companies tc on tc.id = tl.company_id
     where fl.company_id = $1 or tl.company_id = $1
     order by cr.created_at desc`,
    [companyId],
  );

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    status: r.status,
    similarity: r.similarity,
    message: r.message,
    created_at: r.created_at,
    own: { id: r.own_id, title: r.own_title, type: r.own_type },
    counterpart: {
      id: r.cp_id,
      title: r.cp_title,
      type: r.cp_type,
      anonymous_location: r.cp_location,
      ler_code: r.cp_ler,
    },
    revealed:
      r.revealed_name && r.revealed_email
        ? { name: r.revealed_name, email: r.revealed_email }
        : null,
  }));
}

/**
 * Acepta o rechaza una solicitud.
 *
 * La autorización va DENTRO del UPDATE, no en una comprobación previa: sólo se
 * modifica la fila si `to_listing_id` pertenece a quien llama y sigue PENDING.
 * Hacerlo en dos pasos (leer, comprobar, escribir) abriría una carrera entre la
 * comprobación y la escritura.
 */
export async function decideContactRequest(
  requestId: string,
  companyId: string,
  decision: "ACCEPT" | "REJECT",
): Promise<{ id: string; status: string } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ id: string; status: string }>(
    `update contact_requests cr
     set status = $3::contact_request_status
     from listings tl
     where cr.id = $1
       and tl.id = cr.to_listing_id
       and tl.company_id = $2
       and cr.status = 'PENDING'
     returning cr.id, cr.status::text as status`,
    [requestId, companyId, decision === "ACCEPT" ? "ACCEPTED" : "REJECTED"],
  );
  return rows[0] ?? null;
}
