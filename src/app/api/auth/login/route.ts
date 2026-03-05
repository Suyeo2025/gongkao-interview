import { prisma } from "@/lib/prisma";
import { createToken, setAuthCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return Response.json({ error: "账号或密码错误" }, { status: 401 });
    }

    const token = await createToken({
      userId: user.id,
      username: user.username,
      role: user.role as "admin" | "member",
    });

    const headers = setAuthCookie(token);

    return Response.json(
      {
        success: true,
        user: { id: user.id, username: user.username, role: user.role },
      },
      { headers }
    );
  } catch {
    return Response.json({ error: "登录失败" }, { status: 500 });
  }
}
