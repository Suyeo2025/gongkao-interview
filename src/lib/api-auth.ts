import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export interface AuthUser {
  userId: string;
  username: string;
  role: "admin" | "member";
}

const COOKIE_NAME = "gongkao_auth";

async function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

export async function getAuthUser(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("Unauthorized");

  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    if (!userId) throw new Error("Unauthorized");
    return {
      userId,
      username: (payload.username as string) || "",
      role: (payload.role as "admin" | "member") || "member",
    };
  } catch {
    throw new Error("Unauthorized");
  }
}

export async function getUserId(): Promise<string> {
  const user = await getAuthUser();
  return user.userId;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}
