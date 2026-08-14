# Simbiosis Industrial Anónima

Plataforma B2B de matchmaking de subproductos industriales. Una empresa publica lo
que le sobra (o lo que necesita) y la IA le encuentra la contraparte **sin que
ninguna de las dos revele quién es** hasta que las dos aceptan.

El pipeline: texto libre o ficha técnica en PDF → extracción estructurada →
código LER → embedding de 1536 dimensiones → búsqueda vectorial cruzada en
Postgres con `pgvector`, ponderada por distancia logística.

---

## Arranque

```bash
npm install && npm run db:migrate && npm run db:seed && npm run dev
```

Eso es todo. **No hace falta ninguna API key, ninguna cuenta y ninguna tarjeta.**
Arranca en <http://localhost:3000> con 14 publicaciones de ejemplo en pares
complementarios, para poder juzgar el matchmaking desde el primer minuto.

---

## Las dos decisiones de coste

El enunciado pedía Supabase + `gpt-4o-mini` + `text-embedding-3-small`. Ambas
cosas se soportan y son una variable de entorno de distancia, pero **ninguna es
el arranque por defecto**, porque las dos exigen dar de alta una cuenta y una de
ellas cobra por uso.

### Base de datos — el mismo SQL en los dos sitios

|           | Por defecto                                                            | Producción                           |
| --------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Motor     | **PGlite** — Postgres compilado a WASM, embebido en el proceso de Node | Supabase / Neon / cualquier Postgres |
| Datos     | `./.data/pglite`                                                       | remoto                               |
| Coste     | 0 € · 0 cuentas · 0 Docker                                             | free tier                            |
| Se activa | por defecto                                                            | poniendo `DATABASE_URL`              |

`supabase/schema.sql` se aplica **sin un solo cambio** en los dos. PGlite es
Postgres de verdad: soporta `pgvector`, el índice HNSW, `plpgsql` y RLS. Verificado:

```
✔ Tablas: companies, contact_requests, listings
✔ Función match_listings(): creada
✔ Índice HNSW: creado
```

Para migrar a Supabase basta con poner `DATABASE_URL` y relanzar `npm run db:migrate`.

> Se usa una cadena de conexión en lugar de `supabase-js` a propósito: así el
> código de consultas es uno solo para local y para producción, y el SQL de
> `match_listings()` no se duplica en dos dialectos.

### IA — tres motores, uno gratis de verdad

| `AI_PROVIDER`           | Modelos                                     | Coste             | Necesita                |
| ----------------------- | ------------------------------------------- | ----------------- | ----------------------- |
| `local` _(por defecto)_ | reglas + embeddings hasheados               | **0 €**           | nada                    |
| `google`                | `gemini-2.5-flash` + `gemini-embedding-001` | **0 €** con cuota | key gratis, sin tarjeta |
| `openai`                | `gpt-4o-mini` + `text-embedding-3-small`    | de pago           | tarjeta                 |

El modo `local` **no es un mock**. Clasifica el LER por coincidencia ponderada
sobre un catálogo curado, extrae métricas con reglas específicas, normaliza
cantidades a Tn/mes desde cualquier unidad, y genera embeddings deterministas de
1536 dimensiones por _hashing trick_ con signo. Captura solapamiento léxico real:
en el conjunto de ejemplo, la pareja verdadera saca coseno **0,935** y el mejor
falso positivo se queda en **0,477**.

Lo que no hace es razonar. No entiende un texto que no use el vocabulario que
conoce, ni infiere lo que no está escrito. Para eso está el LLM: se activa
poniendo la key, y si el LLM falla (cuota, red, key inválida) **el motor local
recoge la llamada** y la publicación no se pierde — la respuesta de la API lo
indica en `meta.usedLocalFallback`.

```bash
# Gemini: key gratuita en https://aistudio.google.com/apikey
AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

El esquema fija `vector(1536)` en los tres casos: OpenAI lo da nativo y a Gemini
se le trunca por MRL con `outputDimensionality`. Así los vectores siguen siendo
comparables si se cambia de proveedor a mitad de camino... salvo entre familias
de modelos distintas, en cuyo caso hay que regenerar los embeddings.

---

## Arquitectura

```
src/
├── app/
│   ├── page.tsx                             Panel con las dos pestañas
│   └── api/
│       ├── listings/create/route.ts         ← el endpoint de IA
│       ├── listings/route.ts                Catálogo público
│       ├── listings/[id]/matches/route.ts   Coincidencias + afinidad
│       ├── contact-requests/route.ts        Solicitud de descruce
│       └── status/route.ts                  Qué motor está activo
├── lib/
│   ├── ai/
│   │   ├── provider.ts     Selector openai | google | local
│   │   ├── extract.ts      generateObject + Zod, con red de seguridad
│   │   ├── embed.ts        embed() + texto canónico a vectorizar
│   │   └── local.ts        Motor de coste cero
│   ├── db/
│   │   ├── index.ts        Selector de driver
│   │   ├── pglite.ts       Driver embebido
│   │   ├── postgres.ts     Driver remoto
│   │   └── queries.ts      Consultas de dominio
│   ├── ler.ts              Catálogo LER curado
│   ├── geo.ts              Gazetteer español + haversine
│   ├── affinity.ts         Coseno → porcentaje de afinidad
│   └── schemas.ts          Zod: extracción y entradas de API
└── components/             UI (Shadcn + Tailwind v4)
supabase/schema.sql         Esquema completo
scripts/                    Migración, seed, comprobaciones
```

### El endpoint de IA — `POST /api/listings/create`

Acepta `application/json` o `multipart/form-data` con un PDF adjunto.

1. **Reúne** el texto: descripción libre + texto del PDF (`unpdf`, sin binarios nativos).
2. **Extrae** con `generateObject` y un esquema Zod: título anónimo, código LER,
   propiedades técnicas, cantidad en Tn/mes, y un aviso de si el original
   contenía datos identificativos.
3. **Vectoriza** con `embed`.
4. **Geolocaliza** la zona a coordenadas difusas.
5. **Persiste** la empresa (privada) y la publicación (pública) por separado.

Dos detalles que no son obvios:

**`properties` es un array de tuplas, no un `z.record()`.** El modo _structured
outputs_ de OpenAI rechaza objetos con `additionalProperties: true`, así que un
record libre falla en ejecución. Se convierte a JSONB después.

**Se vectoriza la ficha estructurada, no el texto original.** Una oferta escrita
como _"nos sobran 15 t de suero"_ y una demanda como _"compramos lactosuero para
pienso"_ tienen que caer **juntas** en el espacio vectorial: es su
complementariedad lo que buscamos. Vectorizar el texto crudo las separaría justo
por el verbo. Como efecto secundario, ningún dato identificativo del original
entra en el vector.

### El cruce — `match_listings()`

Todo ocurre dentro de Postgres: filtrado por tipo opuesto, distancia coseno con
el índice HNSW, haversine sobre `(lat, lng)` y `LIMIT`. Traerse los vectores a
Node para compararlos allí es el error clásico: no pasa de unos cientos de filas.

```sql
select * from match_listings('<uuid>', 0.15, 12);
```

No se usa PostGIS porque no existe en PGlite. El haversine en SQL puro da el
mismo resultado con error < 0,5 %, y el fichero incluye la migración comentada a
`geography(Point,4326)` para cuando el proyecto viva en Supabase.

### El porcentaje de afinidad

Enseñar el coseno crudo sería honesto pero inútil: dos textos industriales sin
relación ya sacan ~0,15, y un cruce excelente se queda en ~0,60. Nadie lee "60 %"
como "la mejor coincidencia posible". El número se construye en dos pasos:

1. **Calibrar** el tramo útil `[floor, ceiling]` del proveedor a `[0, 1]`.
2. **Modular** de forma **multiplicativa** y acotada a `[0.78, 1.0]` por
   proximidad (decaimiento exponencial, escala 250 km) y coherencia LER.

Se multiplica en vez de sumar pesos para que **la compatibilidad del material
siga mandando**: un cruce semántico flojo al lado de casa no debe adelantar a uno
excelente a 200 km. El desglose completo viaja en la respuesta y se muestra al
pasar el ratón sobre el porcentaje — el número no es una caja negra.

### Cómo se sostiene el anonimato

- `companies` (razón social, email) y `listings` (lo público) son tablas
  separadas, unidas sólo por una FK.
- Las consultas de `queries.ts` seleccionan una lista **explícita** de columnas
  que no incluye `company_id` ni `embedding`. No se filtra en el frontend.
- La ubicación se degrada a propósito a nivel de localidad. Geocodificar a nivel
  de calle sería un fallo de privacidad, no una mejora — por eso se usa un
  gazetteer local en vez de una API de geocoding.
- `contact_requests` sólo registra la intención. Los datos se liberarían con
  doble consentimiento: es lo que hace la plataforma usable entre competidores.
- RLS activado sin policies públicas: la clave `anon` de Supabase no lee nada,
  todo el acceso pasa por el servidor.

---

## Comandos

| Comando              | Qué hace                                                |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Servidor de desarrollo                                  |
| `npm run build`      | Build de producción                                     |
| `npm run db:migrate` | Aplica `supabase/schema.sql` (idempotente)              |
| `npm run db:seed`    | 14 publicaciones de ejemplo + prueba de humo del cruce  |
| `npm run db:reset`   | Vacía los datos sin tocar el esquema                    |
| `npm run check`      | Comprueba el motor local de extracción                  |
| `npm run sample:pdf` | Genera `samples/ficha-tecnica-ejemplo.pdf`              |
| `npm run typecheck`  | `tsc --noEmit`                                          |
| `npm run lint`       | ESLint (`lint:fix` para autocorregir)                   |
| `npm run format`     | Prettier (`format:check` para sólo comprobar)           |
| **`npm run verify`** | Todo lo anterior en cadena — lo mismo que ejecuta la CI |

> ESLint está fijado a la **9.x**. La 10 rompe contra el `eslint-plugin-react` que
> empaqueta `eslint-config-next@16`, aunque su `peerDependency` diga `>=9`.

`npm run check` no es decorativo. El motor local son reglas, y las reglas se
rompen **en silencio**: un regex que deja de casar no lanza ningún error, sólo
devuelve un campo vacío. Los casos fijan el comportamiento verificado a mano,
incluidos cuatro fallos reales encontrados durante el desarrollo:

- `1.800 t/año` se leía como `1,8 t/mes` — el punto español de miles interpretado
  como decimal, y el periodo "al año" que nunca casaba.
- El aluminio se clasificaba como metal **férreo**: "mecanizado" (proceso) pesaba
  más que "aluminio" (material).
- `Densidad ......... 905` no se extraía: los puntos de relleno de las fichas
  técnicas desbordaban el hueco máximo del regex.
- `grasa` casaba dentro de "des**grasa**nte" y se llevaba un número de otra frase.

### Integración continua

`.github/workflows/ci.yml` ejecuta tipos, lint, formato, las comprobaciones del
motor local, **el esquema completo con datos de ejemplo** y el build. La parte de
base de datos corre de verdad —`pgvector`, índice HNSW y `match_listings()`—
contra PGlite, sin ningún servicio externo ni ninguna API key: sin variables de
entorno el proyecto usa el driver embebido y el motor local.

---

## Probar la ruta del PDF

```bash
npm run sample:pdf
```

Genera una ficha técnica sintética en `samples/`. Súbela en el formulario: de
ella salen 42 Tn/mes, el LER `07 02 13` y seis propiedades técnicas.

Los PDF escaneados (imagen pura, sin capa de texto) se detectan y se rechazan con
un mensaje claro en vez de mandar texto vacío al modelo. Para esos haría falta
OCR, fuera del alcance de este MVP.

---

## Despliegue

`DATABASE_URL` apuntando a Supabase o Neon, y las variables del proveedor de IA.
PGlite escribe en disco, así que **no sirve en serverless**: en Vercel hay que
usar el driver remoto.

En Supabase, usa la cadena del _connection pooler_ (puerto 6543), no la directa
(5432): las funciones serverless agotan las conexiones directas enseguida.

---

## Límites conocidos

- **Sin autenticación.** Cualquiera puede pedir contacto en nombre de cualquier
  publicación. Es un MVP para validar el matchmaking, no para producción.
- **`contact_requests` no tiene flujo de aceptación.** La tabla y los estados
  están, pero la pantalla para aceptar y revelar los datos no.
- **El gazetteer cubre España** a nivel de capital de provincia y polos
  industriales. Fuera de ahí no hay componente geográfica en el cruce (la
  publicación se guarda igual, sólo sin coordenadas).
- **Los embeddings del modo local son léxicos, no semánticos.** Encuentran
  vocabulario compartido, no significado compartido. Con una API key el
  comportamiento mejora de forma notable.
- **El catálogo LER es un subconjunto** de ~38 códigos de los ~840 de la lista
  completa. Cubre los flujos habituales de simbiosis industrial.
