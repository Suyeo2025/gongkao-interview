import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: userId } = await params;
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "all";

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    switch (type) {
      case "settings": {
        const row = await prisma.userSettings.findUnique({
          where: { userId },
        });
        return Response.json(row ? JSON.parse(row.data) : {});
      }
      case "history": {
        const rows = await prisma.historyEntry.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        return Response.json(
          rows.map((r) => ({
            _id: r.id,
            _createdAt: r.createdAt,
            ...JSON.parse(r.data),
          }))
        );
      }
      case "questions": {
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
            createdAt: r.createdAt.toISOString(),
          }))
        );
      }
      case "exam-papers": {
        const rows = await prisma.examPaper.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        return Response.json(
          rows.map((r) => ({
            _id: r.id,
            _createdAt: r.createdAt,
            ...JSON.parse(r.data),
          }))
        );
      }
      case "exam-sessions": {
        const rows = await prisma.examSession.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        return Response.json(
          rows.map((r) => ({
            _id: r.id,
            _createdAt: r.createdAt,
            ...JSON.parse(r.data),
          }))
        );
      }
      case "mentor-evals": {
        const rows = await prisma.mentorEval.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        return Response.json(
          rows.map((r) => ({
            _id: r.id,
            _createdAt: r.createdAt,
            ...JSON.parse(r.data),
          }))
        );
      }
      case "all": {
        const [settings, ...counts] = await Promise.all([
          prisma.userSettings.findUnique({ where: { userId } }),
          prisma.historyEntry.count({ where: { userId } }),
          prisma.question.count({ where: { userId } }),
          prisma.examPaper.count({ where: { userId } }),
          prisma.examSession.count({ where: { userId } }),
          prisma.mentorEval.count({ where: { userId } }),
        ]);
        return Response.json({
          settings: settings ? JSON.parse(settings.data) : {},
          counts: {
            history: counts[0],
            questions: counts[1],
            examPapers: counts[2],
            examSessions: counts[3],
            mentorEvals: counts[4],
          },
        });
      }
      default:
        return Response.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: userId } = await params;
    const { type, data } = await req.json();

    if (type === "settings") {
      await prisma.userSettings.upsert({
        where: { userId },
        update: { data: JSON.stringify(data) },
        create: { userId, data: JSON.stringify(data) },
      });
      return Response.json({ success: true });
    }
    return Response.json({ error: "Only settings can be updated" }, { status: 400 });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: userId } = await params;
    const { type, id } = await req.json();

    const deleteMap: Record<string, () => Promise<unknown>> = {
      history: () => prisma.historyEntry.deleteMany({ where: { id, userId } }),
      questions: () => prisma.question.deleteMany({ where: { id, userId } }),
      "exam-papers": () => prisma.examPaper.deleteMany({ where: { id, userId } }),
      "exam-sessions": () => prisma.examSession.deleteMany({ where: { id, userId } }),
      "mentor-evals": () => prisma.mentorEval.deleteMany({ where: { id, userId } }),
    };

    const handler = deleteMap[type];
    if (!handler) {
      return Response.json({ error: "Invalid type" }, { status: 400 });
    }

    await handler();
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}
