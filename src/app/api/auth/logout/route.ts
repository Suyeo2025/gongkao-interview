import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  const headers = clearAuthCookie();
  return Response.json({ success: true }, { headers });
}
