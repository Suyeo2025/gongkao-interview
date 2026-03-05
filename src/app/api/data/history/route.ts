import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const rows = await prisma.historyEntry.findMany({
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
    const id = body.question?.id || body.id || crypto.randomUUID();
    await prisma.historyEntry.upsert({
      where: { id },
      update: { data: JSON.stringify(body) },
      create: { id, userId, data: JSON.stringify(body) },
    });
    return Response.json({ success: true, id });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { id } = await req.json();
    if (id) {
      await prisma.historyEntry.deleteMany({ where: { id, userId } });
    } else {
      await prisma.historyEntry.deleteMany({ where: { userId } });
    }
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
