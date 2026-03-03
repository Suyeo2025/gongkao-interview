import { createToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;

    if (!validUsername || !validPassword) {
      return Response.json(
        { error: "服务器未配置认证信息" },
        { status: 500 }
      );
    }

    if (username !== validUsername || password !== validPassword) {
      return Response.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const token = await createToken();
    const headers = setAuthCookie(token);

    return Response.json(
      { success: true },
      { headers }
    );
  } catch {
    return Response.json(
      { error: "登录失败" },
      { status: 500 }
    );
  }
}
