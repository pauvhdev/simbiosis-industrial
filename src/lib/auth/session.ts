/**
 * Sesiones sin dependencias: cookie firmada con HMAC-SHA256.
 *
 * Se eligió una sesión SIN ESTADO (nada en base de datos) porque para este MVP
 * la única operación que hace falta es "quién es el que llama", y una tabla de
 * sesiones añadiría escrituras en cada petición y limpieza de caducadas a
 * cambio de nada. El precio es que no se puede revocar una sesión concreta
 * antes de que expire; rotar AUTH_SECRET invalida todas de golpe.
 *
 * La cookie NO cifra, sólo firma: el id de empresa viaja legible pero no se
 * puede falsificar. No se pone nada sensible dentro.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "si_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

let cachedSecret: string | null = null;

/**
 * Resuelve el secreto de firma.
 *
 *   AUTH_SECRET definida  -> se usa (obligatorio en producción)
 *   sin definir, en dev   -> se genera uno y se guarda en .data/auth-secret
 *
 * Lo segundo mantiene la propiedad de "arranca sin configurar nada": un secreto
 * aleatorio en memoria cerraría la sesión en cada recarga del servidor.
 */
function getSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET es obligatoria en producción. Genera una con: openssl rand -base64 32",
    );
  }

  const file = path.join(process.cwd(), ".data", "auth-secret");
  try {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
    if (cachedSecret) return cachedSecret;
  } catch {
    // No existe todavía: se crea justo abajo.
  }

  const generated = randomBytes(32).toString("base64url");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, generated, { mode: 0o600 });
  cachedSecret = generated;
  return cachedSecret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(companyId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: companyId,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Devuelve el id de empresa si el token es válido y no ha caducado. */
export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(sign(payload), "base64url");

  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims?.sub !== "string" || typeof claims?.exp !== "number") return null;
    if (claims.exp * 1000 < Date.now()) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

/** Id de la empresa autenticada, o null. Para usar dentro de route handlers. */
export async function getSessionCompanyId(): Promise<string | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(companyId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(companyId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
