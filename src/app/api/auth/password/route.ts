import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// Member self-service password change
export async function PUT(req: Request) {
  try {
    const authUser = await getAuthUser();
    const { oldPassword, newPassword } = await req.json();

    if (!newPassword || newPassword.length < 4) {
      return Response.json({ error: "新密码至少4个字符" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    // Verify old password
    if (!await bcrypt.compare(oldPassword, user.passwordHash)) {
      return Response.json({ error: "原密码错误" }, { status: 401 });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: authUser.userId },
      data: { passwordHash: hash },
    });

    return Response.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    return Response.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
