import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            history: true,
            questions: true,
            examPapers: true,
            examSessions: true,
            mentorEvals: true,
          },
        },
      },
    });
    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }
    return Response.json(user);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, string> = {};
    if (body.role) data.role = body.role;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12);

    await prisma.user.update({ where: { id }, data });
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await params;
    if (id === currentUser.userId) {
      return Response.json({ error: "不能删除自己的账号" }, { status: 400 });
    }
    await prisma.user.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}
