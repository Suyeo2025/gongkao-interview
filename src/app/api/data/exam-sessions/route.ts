import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const rows = await prisma.examSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    await prisma.examSession.upsert({
      where: { id: body.id },
      update: { data: JSON.stringify(body) },
      create: { id: body.id, userId, data: JSON.stringify(body) },
    });
    return Response.json({ success: true, id: body.id });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    await prisma.examSession.updateMany({
      where: { id: body.id, userId },
      data: { data: JSON.stringify(body) },
    });
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
