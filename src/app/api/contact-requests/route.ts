import { NextResponse } from "next/server";
import { ContactRequestInputSchema } from "@/lib/schemas";
import { requireCompany } from "@/lib/auth/guard";
import {
  createContactRequest,
  getListing,
  getListingOwner,
  listContactRequestsForCompany,
} from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * GET /api/contact-requests
 *
 * Bandeja de la empresa autenticada, en las dos direcciones. Los datos de
 * contacto de la contraparte sólo aparecen en las solicitudes ACEPTADAS.
 */
export async function GET() {
  try {
    const auth = await requireCompany();
    if ("response" in auth) return auth.response;

    return NextResponse.json({
      requests: await listContactRequestsForCompany(auth.company.id),
    });
  } catch (error) {
    console.error("[GET /api/contact-requests]", error);
    return NextResponse.json(
      { error: "No se han podido cargar las solicitudes." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/contact-requests
 *
 * El "descruce": una de las partes pide levantar el anonimato.
 *
 * Importante: esto NO revela ningún dato de contacto. Sólo registra la
 * solicitud en estado PENDING. Los datos de `companies` se liberan cuando la
 * otra parte la acepta — el doble consentimiento es lo que hace que la
 * plataforma sea usable por competidores directos.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCompany();
    if ("response" in auth) return auth.response;

    const parsed = ContactRequestInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Solicitud no válida.",
          issues: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { fromListingId, toListingId, similarity, message } = parsed.data;

    if (fromListingId === toListingId) {
      return NextResponse.json(
        { error: "No puedes solicitar contacto contigo mismo." },
        { status: 400 },
      );
    }

    // Sólo se puede solicitar EN NOMBRE DE una publicación propia. Sin esto,
    // cualquiera podía usar la publicación de un tercero como remitente y
    // provocar que revelara su identidad a quien no había elegido.
    const owner = await getListingOwner(fromListingId);
    if (owner !== auth.company.id) {
      return NextResponse.json({ error: "Esa publicación no es tuya." }, { status: 403 });
    }

    const [from, to] = await Promise.all([
      getListing(fromListingId),
      getListing(toListingId),
    ]);

    if (!from || !to) {
      return NextResponse.json(
        { error: "Alguna de las publicaciones no existe." },
        { status: 404 },
      );
    }
    if (from.type === to.type) {
      return NextResponse.json(
        { error: "Sólo se puede cruzar una OFERTA con una DEMANDA." },
        { status: 400 },
      );
    }

    const { row, alreadyExisted } = await createContactRequest({
      fromListingId,
      toListingId,
      similarity,
      message,
    });

    return NextResponse.json(
      {
        contactRequest: row,
        alreadyExisted,
        message: alreadyExisted
          ? "Ya habías solicitado contacto con esta publicación."
          : "Solicitud enviada. La otra parte decidirá si revela su identidad.",
      },
      { status: alreadyExisted ? 200 : 201 },
    );
  } catch (error) {
    console.error("[POST /api/contact-requests]", error);
    return NextResponse.json(
      {
        error: "No se ha podido registrar la solicitud.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
