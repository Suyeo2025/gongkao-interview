import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const url = new URL(req.url);
    const answerId = url.searchParams.get("answerId");

    const where = answerId ? { userId, answerId } : { userId };
    const rows = await prisma.mentorEval.findMany({
      where,
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
    const entry = await prisma.mentorEval.create({
      data: {
        userId,
        answerId: body.answerId || "",
        data: JSON.stringify(body),
      },
    });
    return Response.json({ success: true, id: entry.id });
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
      await prisma.mentorEval.deleteMany({ where: { id, userId } });
    }
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
