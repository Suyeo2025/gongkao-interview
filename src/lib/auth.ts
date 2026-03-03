import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "gongkao_auth";

const DEFAULT_SECRET = "UriM4dBv+Mhmd8i/EboKr5vuzDVa76my+K/f4PCju4U=";

function getSecret() {
  const secret = process.env.AUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export function setAuthCookie(token: string) {
  return {
    "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
  };
}

export function clearAuthCookie() {
  return {
    "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  };
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export { COOKIE_NAME };
