import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    return Response.json(row ? JSON.parse(row.data) : {});
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    await prisma.userSettings.upsert({
      where: { userId },
      update: { data: JSON.stringify(body) },
      create: { userId, data: JSON.stringify(body) },
    });
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
