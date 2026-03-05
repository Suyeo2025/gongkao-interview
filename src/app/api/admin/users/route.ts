import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
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
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(users);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { username, password, role } = await req.json();

    if (!username || !password) {
      return Response.json({ error: "用户名和密码必填" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return Response.json({ error: "用户名已存在" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hash,
        role: role || "member",
      },
    });

    return Response.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}
