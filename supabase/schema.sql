-- =============================================================================
--  SIMBIOSIS INDUSTRIAL ANÓNIMA — Esquema de base de datos
-- =============================================================================
--  Este fichero es la única fuente de verdad del esquema y está escrito para
--  ejecutarse SIN CAMBIOS en dos destinos:
--
--    1. Supabase / Neon / cualquier Postgres gestionado  (producción)
--    2. PGlite — Postgres compilado a WASM, embebido      (desarrollo local, 0€)
--
--  Por eso NO se usa PostGIS: no está disponible en PGlite y para el MVP la
--  distancia entre dos puntos se resuelve con haversine en SQL puro sobre
--  (lat, lng). Ver nota al final para migrar a geography(Point,4326).
--
--  Es idempotente: se puede ejecutar tantas veces como haga falta.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensiones
-- -----------------------------------------------------------------------------
create extension if not exists vector;


-- -----------------------------------------------------------------------------
-- 2. Tipos enumerados
-- -----------------------------------------------------------------------------
do $$ begin
  create type listing_type as enum ('OFERTA', 'DEMANDA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('ACTIVE', 'MATCHED', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contact_request_status as enum ('PENDING', 'ACCEPTED', 'REJECTED');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 3. companies — datos identificativos. NUNCA se exponen en la capa pública.
-- -----------------------------------------------------------------------------
create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,          -- PRIVADO: sólo visible tras un match aceptado
  email         text not null unique,   -- PRIVADO, y es el identificador de acceso
  -- Hash scrypt en formato 'scrypt$<salt>$<clave>'. Nullable a propósito: las
  -- empresas que crea el seed no tienen credenciales y no deben poder entrar.
  password_hash text,
  created_at    timestamptz not null default now()
);

-- Para bases de datos creadas antes de que existiera la autenticación.
alter table companies add column if not exists password_hash text;


-- -----------------------------------------------------------------------------
-- 4. listings — publicaciones anónimas de oferta/demanda de subproductos
-- -----------------------------------------------------------------------------
create table if not exists listings (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,

  type                listing_type not null,

  -- Cara pública: anonimizada por el pipeline de IA.
  -- Ej: "15 Tn/mes de polímero sintético post-industrial"
  title               text not null,
  description         text,

  -- Ubicación difusa a propósito: zona industrial, nunca la dirección exacta.
  -- Ej: "Polígono Industrial, Zaragoza"
  anonymous_location  text,
  lat                 double precision,
  lng                 double precision,

  -- Lista Europea de Residuos. Ej: "02 03 04"
  ler_code            text,
  ler_description     text,

  -- Métricas químicas/físicas extraídas por la IA.
  -- Ej: {"humedad_pct": 62, "ph": 4.1, "granulometria_mm": "5-20"}
  properties          jsonb not null default '{}'::jsonb,

  quantity_ton_month  double precision,

  embedding           vector(1536),

  status              listing_status not null default 'ACTIVE',
  created_at          timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 5. contact_requests — el "descruce": una parte pide levantar el anonimato.
--    Los datos de contacto sólo se revelan cuando status = 'ACCEPTED'.
-- -----------------------------------------------------------------------------
create table if not exists contact_requests (
  id                  uuid primary key default gen_random_uuid(),
  from_listing_id     uuid not null references listings(id) on delete cascade,
  to_listing_id       uuid not null references listings(id) on delete cascade,
  similarity          double precision,
  message             text,
  status              contact_request_status not null default 'PENDING',
  created_at          timestamptz not null default now(),
  unique (from_listing_id, to_listing_id)
);


-- -----------------------------------------------------------------------------
-- 6. Índices
-- -----------------------------------------------------------------------------

-- Índice vectorial HNSW con distancia coseno (operador <=>).
-- Se envuelve en un bloque con captura de excepción porque algunas builds WASM
-- de pgvector no traen HNSW; en ese caso la búsqueda sigue funcionando por
-- escaneo secuencial, que para el volumen de un MVP es perfectamente válido.
do $$ begin
  create index if not exists listings_embedding_hnsw
    on listings using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);
exception when others then
  raise notice 'Índice HNSW no disponible (%). Se usará búsqueda secuencial.', sqlerrm;
end $$;

create index if not exists listings_type_status_idx on listings (type, status);
create index if not exists listings_ler_code_idx     on listings (ler_code);
create index if not exists listings_company_idx      on listings (company_id);
create index if not exists listings_created_at_idx   on listings (created_at desc);
create index if not exists listings_properties_gin   on listings using gin (properties);
create index if not exists contact_requests_to_idx   on contact_requests (to_listing_id);


-- -----------------------------------------------------------------------------
-- 7. match_listings() — búsqueda semántica cruzada
-- -----------------------------------------------------------------------------
--  Dado un listing, devuelve los candidatos del TIPO OPUESTO
--  ('OFERTA' busca 'DEMANDA' y viceversa) ordenados por similitud coseno.
--
--  similarity  = 1 - distancia_coseno  ->  rango [0, 1], 1 = idéntico
--  distance_km = haversine sobre (lat, lng), null si falta alguna coordenada
--
--  Uso desde Supabase JS:
--    supabase.rpc('match_listings', {
--      listing_id: '...', match_threshold: 0.5, match_count: 10
--    })
-- -----------------------------------------------------------------------------
create or replace function match_listings(
  listing_id      uuid,
  match_threshold double precision default 0.5,
  match_count     integer          default 10
)
returns table (
  id                 uuid,
  type               listing_type,
  title              text,
  description        text,
  anonymous_location text,
  lat                double precision,
  lng                double precision,
  ler_code           text,
  ler_description    text,
  properties         jsonb,
  quantity_ton_month double precision,
  status             listing_status,
  created_at         timestamptz,
  similarity         double precision,
  distance_km        double precision
)
language plpgsql
stable
as $$
declare
  src listings%rowtype;
begin
  select * into src from listings l where l.id = listing_id;

  -- Sin origen o sin embedding no hay nada que cruzar.
  if not found or src.embedding is null then
    return;
  end if;

  return query
  select
    l.id,
    l.type,
    l.title,
    l.description,
    l.anonymous_location,
    l.lat,
    l.lng,
    l.ler_code,
    l.ler_description,
    l.properties,
    l.quantity_ton_month,
    l.status,
    l.created_at,
    (1 - (l.embedding <=> src.embedding))::double precision as similarity,
    case
      when l.lat is null or l.lng is null or src.lat is null or src.lng is null
        then null
      else (
        6371 * 2 * asin(sqrt(
            power(sin(radians(l.lat - src.lat) / 2), 2)
          + cos(radians(src.lat)) * cos(radians(l.lat))
          * power(sin(radians(l.lng - src.lng) / 2), 2)
        ))
      )::double precision
    end as distance_km
  from listings l
  where l.type       <> src.type          -- OFERTA <-> DEMANDA
    and l.company_id <> src.company_id    -- nunca contra uno mismo
    and l.status      = 'ACTIVE'
    and l.embedding is not null
    and (1 - (l.embedding <=> src.embedding)) >= match_threshold
  order by l.embedding <=> src.embedding  -- usa el índice HNSW
  limit match_count;
end;
$$;


-- -----------------------------------------------------------------------------
-- 8. Seguridad a nivel de fila (sólo relevante en Supabase)
-- -----------------------------------------------------------------------------
--  Se activa RLS y NO se crea ninguna policy para los roles anon/authenticated:
--  el resultado es que la clave pública anon no puede leer nada. Todo el acceso
--  pasa por el servidor (service_role o conexión directa), que es quien decide
--  qué campos son públicos. Así el anonimato no depende del cliente.
-- -----------------------------------------------------------------------------
do $$ begin
  alter table companies        enable row level security;
  alter table listings         enable row level security;
  alter table contact_requests enable row level security;
exception when others then
  raise notice 'RLS no aplicado (%).', sqlerrm;
end $$;


-- =============================================================================
--  NOTA — migración a PostGIS cuando se despliegue en Supabase
-- =============================================================================
--  Supabase sí trae PostGIS. Para pasar a geometría real:
--
--    create extension if not exists postgis;
--    alter table listings add column geo geography(Point, 4326);
--    update listings set geo = st_point(lng, lat)::geography
--      where lat is not null and lng is not null;
--    create index listings_geo_idx on listings using gist (geo);
--
--  y en match_listings() sustituir el bloque haversine por:
--    st_distance(l.geo, src.geo) / 1000
--
--  El haversine actual da el mismo resultado con error < 0.5 %, suficiente
--  para el radio logístico que maneja este MVP.
-- =============================================================================
