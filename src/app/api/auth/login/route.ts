import { NextResponse } from "next/server";
import { LoginInputSchema } from "@/lib/schemas";
import { burnTimingBudget, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { getCompanyAuthByEmail } from "@/lib/db/queries";

export const runtime = "nodejs";

/** Mismo mensaje para email inexistente y contraseña incorrecta. */
const INVALID = "Email o contraseña incorrectos.";

export async function POST(request: Request) {
  try {
    const parsed = LoginInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const company = await getCompanyAuthByEmail(email);

    // Si el email no existe, o es una empresa del seed (sin contraseña), se gasta
    // igualmente el tiempo de un scrypt. Responder rápido aquí convertiría el
    // login en un oráculo para saber qué emails están registrados.
    if (!company?.password_hash) {
      await burnTimingBudget();
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    if (!(await verifyPassword(password, company.password_hash))) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    await setSessionCookie(company.id);

    return NextResponse.json({
      company: { id: company.id, name: company.name, email: company.email },
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { error: "No se ha podido iniciar sesión." },
      { status: 500 },
    );
  }
}
