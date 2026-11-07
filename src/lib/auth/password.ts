/**
 * Hash de contraseñas con `node:crypto`. Sin dependencias externas.
 *
 * Se usa scrypt y no bcrypt/argon2 porque los dos vienen como módulo nativo:
 * obligarían a compilar en la instalación y romperían el arranque de un solo
 * comando. scrypt está en el runtime de Node desde la 10 y es una función de
 * derivación con coste de memoria, que es justo lo que se le pide aquí.
 *
 * Formato almacenado:  scrypt$<N>$<salt base64url>$<clave base64url>
 * El coste va dentro del hash para poder subirlo más adelante sin invalidar
 * las contraseñas ya guardadas.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const COST = 16384; // 2^14
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function params(N: number) {
  // maxmem por defecto (32 MB) se queda corto para N=16384 con r=8.
  return { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
}

/**
 * Normaliza a NFKC antes de derivar. Sin esto, una contraseña con tildes
 * hasheada en macOS (que compone en NFD) no validaría en Linux.
 */
function prepare(plain: string): string {
  return plain.normalize("NFKC");
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(prepare(plain), salt, KEY_LENGTH, params(COST));
  return ["scrypt", COST, salt.toString("base64url"), key.toString("base64url")].join(
    "$",
  );
}

export async function verifyPassword(
  plain: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;

  const [scheme, costRaw, saltRaw, keyRaw] = stored.split("$");
  if (scheme !== "scrypt" || !costRaw || !saltRaw || !keyRaw) return false;

  const cost = Number.parseInt(costRaw, 10);
  if (!Number.isInteger(cost) || cost < 1024) return false;

  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(keyRaw, "base64url");

  let actual: Buffer;
  try {
    actual = await scrypt(prepare(plain), salt, expected.length, params(cost));
  } catch {
    return false;
  }

  // timingSafeEqual lanza si las longitudes no coinciden, así que hay que
  // comprobarlo antes — y esa comprobación no filtra nada útil: la longitud del
  // hash es fija y pública.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Hash de un valor que nunca coincidirá, para gastar el mismo tiempo cuando el
 * email no existe. Sin esto, un atacante distingue "email no registrado" de
 * "contraseña incorrecta" midiendo lo que tarda la respuesta.
 */
let dummyHash: Promise<string> | null = null;

export function burnTimingBudget(): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyHash.then((h) => verifyPassword("contraseña incorrecta", h));
}
