import { NextResponse } from "next/server";
import { RegisterInputSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { registerCompany } from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * POST /api/auth/register  { companyName, email, password }
 *
 * Da de alta la empresa y abre sesión. El nombre y el email quedan en
 * `companies`, que es la tabla privada: nada de esto aparece jamás en una
 * publicación.
 */
export async function POST(request: Request) {
  try {
    const parsed = RegisterInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos no válidos.",
          issues: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { companyName, email, password } = parsed.data;
    const created = await registerCompany(
      companyName,
      email,
      await hashPassword(password),
    );

    if (!created) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email." },
        { status: 409 },
      );
    }

    await setSessionCookie(created.id);

    return NextResponse.json(
      { company: { id: created.id, name: companyName, email: email.toLowerCase() } },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { error: "No se ha podido crear la cuenta." },
      { status: 500 },
    );
  }
}
