import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const rows = await prisma.question.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(
      rows.map((r) => ({
        id: r.id,
        content: r.content,
        category: r.category,
        tags: JSON.parse(r.tags),
        source: r.source,
        sourceFile: r.sourceFile,
        derivedFrom: r.derivedFrom,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();

    // Support batch and single
    const items = Array.isArray(body) ? body : [body];
    const created = [];

    for (const item of items) {
      const q = await prisma.question.create({
        data: {
          id: item.id,
          userId,
          content: item.content,
          category: item.category || null,
          tags: JSON.stringify(item.tags || []),
          source: item.source || "manual",
          sourceFile: item.sourceFile || null,
          derivedFrom: item.derivedFrom || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        },
      });
      created.push(q.id);
    }

    return Response.json({ success: true, ids: created });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getUserId();
    const { id, ...data } = await req.json();
    await prisma.question.updateMany({
      where: { id, userId },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
        ...(data.source !== undefined && { source: data.source }),
      },
    });
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const { id } = await req.json();
    await prisma.question.deleteMany({ where: { id, userId } });
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
