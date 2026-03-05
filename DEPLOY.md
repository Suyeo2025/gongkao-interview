# 登科录 — 服务器部署指南

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 59.110.164.112 |
| 用户 | root |
| SSH 密钥 | `~/Downloads/suyeo.pem`（权限必须为 600） |
| 项目路径 | `/www/wwwroot/gongkao-interview` |
| 域名 | https://qiqi.sunlawai.com |
| 进程管理 | PM2（进程名：`dengkelu`） |
| 反向代理 | Nginx → 127.0.0.1:3000 |
| Nginx 配置 | `/etc/nginx/sites-available/dengkelu` |
| SSL | Let's Encrypt (Certbot 自动管理) |
| Node 版本 | 建议 18+ |
| 数据库 | SQLite（Prisma + better-sqlite3），文件：`prisma/dev.db` |

## 前置准备

```bash
# 确保 PEM 权限正确（只需设置一次）
chmod 600 ~/Downloads/suyeo.pem

# 测试 SSH 连接
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 "echo ok"
```

## 部署流程

服务器在国内无法 `git pull`，部署方式为：**本地 → SCP 传文件 → 服务器构建重启**。

### 第一步：查看需要同步的文件

```bash
# 1. 查看服务器当前版本
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 \
  "cd /www/wwwroot/gongkao-interview && git log --oneline -1"
# 输出示例：c5a313a feat: 考试结束自动触发AI评估

# 2. 本地查看差异文件（用上面输出的 commit hash）
git diff --name-only c5a313a..HEAD
# 会列出所有需要同步的文件
```

### 第二步：上传文件到服务器

**方式一：批量上传（推荐）**

> 注意：不能用普通的 `scp` 批量命令，因为路径含 `[id]` 等特殊字符会导致静默失败。
> 必须用 `cat | ssh "cat >"` 管道方式，并用 `< /dev/null` 防止 ssh 吃掉 stdin。

```bash
# 将 <server_commit> 替换为第一步获取的 hash
PEM=~/Downloads/suyeo.pem
SRV="root@59.110.164.112"
BASE="/www/wwwroot/gongkao-interview"

git diff --name-only <server_commit>..HEAD \
  | grep -v '^\.' | grep -v '^DEPLOY.md$' \
  > /tmp/deploy_files.txt

while IFS= read -r f; do
  dir=$(dirname "$f")
  ssh -i "$PEM" "$SRV" "mkdir -p '$BASE/$dir'" < /dev/null 2>/dev/null
  cat "$f" | ssh -i "$PEM" "$SRV" "cat > '$BASE/$f'" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "OK: $f"
  else
    echo "FAIL: $f"
  fi
done < /tmp/deploy_files.txt
```

**方式二：单个文件**

```bash
# 普通路径文件用 scp
scp -i ~/Downloads/suyeo.pem \
  src/lib/prompt.ts \
  root@59.110.164.112:/www/wwwroot/gongkao-interview/src/lib/prompt.ts

# 含特殊字符的路径（如 [id]）用管道方式
cat "src/app/admin/users/[id]/page.tsx" | \
  ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 \
  "cat > '/www/wwwroot/gongkao-interview/src/app/admin/users/[id]/page.tsx'"
```

### 第三步：服务器构建并重启

**一键命令（适用于无新依赖、无 schema 变更的情况）：**

```bash
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 \
  "cd /www/wwwroot/gongkao-interview && npm run build && pm2 restart dengkelu"
```

**完整流程（有新依赖或 schema 变更时）：**

```bash
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112

cd /www/wwwroot/gongkao-interview

# 1. 安装依赖（package.json 有变动时必须执行）
npm install

# 2. 生成 Prisma Client（schema.prisma 有变动时必须执行）
npx prisma generate

# 3. 数据库迁移（schema.prisma 新增字段时执行）
npx prisma db push

# 4. 构建
npm run build

# 5. 重启
pm2 restart dengkelu

# 6. 验证
pm2 status
pm2 logs dengkelu --lines 20
```

### 第四步：验证部署

```bash
# 检查服务是否正常运行
pm2 status

# 查看最近日志，确认没有启动错误
pm2 logs dengkelu --lines 30

# 浏览器访问
# https://qiqi.sunlawai.com
```

## 常用运维命令

```bash
# SSH 登录
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112

# === PM2 进程管理 ===
pm2 status                    # 查看进程状态
pm2 restart dengkelu          # 重启应用
pm2 stop dengkelu             # 停止应用
pm2 logs dengkelu             # 实时日志
pm2 logs dengkelu --lines 50  # 最近50行日志

# === Nginx ===
cat /etc/nginx/sites-available/dengkelu  # 查看配置
nginx -t                                  # 测试配置语法
nginx -s reload                           # 重载配置

# === 数据库 ===
# 数据库文件位置：/www/wwwroot/gongkao-interview/prisma/dev.db
# 备份数据库
cp prisma/dev.db prisma/dev.db.bak.$(date +%Y%m%d)

# === 磁盘/内存 ===
df -h          # 磁盘使用
free -m        # 内存使用
```

## Nginx 配置要点

当前配置已包含**流式输出(SSE/Streaming)支持**：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 流式输出必须项
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
    proxy_read_timeout 300s;
}
```

> 修改 nginx 配置后：`nginx -t && nginx -s reload`

## 常见问题排查

### 构建失败
```bash
# 清除构建缓存重试
rm -rf .next
npm run build
```

### 应用启动后立即崩溃
```bash
# 查看错误日志
pm2 logs dengkelu --lines 50

# 常见原因：
# 1. .env 文件缺失或配置错误
# 2. 数据库文件损坏 → 从备份恢复
# 3. node_modules 不完整 → npm install
```

### API 返回 500
```bash
# 实时查看请求日志
pm2 logs dengkelu

# 常见原因：
# 1. Prisma Client 未生成 → npx prisma generate && npm run build && pm2 restart dengkelu
# 2. 数据库 schema 不匹配 → npx prisma db push
# 3. API Key 未配置（用户侧问题）
```

### 页面样式异常/功能缺失
```bash
# 可能是文件没传完整，验证关键文件：
head -1 src/lib/prompt.ts        # 检查提示词文件
ls public/fonts/ | wc -l         # KaTeX 字体文件数（应为 40）
ls src/components/ | wc -l       # 组件文件数
```

## 注意事项

- 服务器在国内，**不能 `git pull`**，只能通过 SCP/SSH 管道传文件
- 构建大约需要 30-60 秒
- **绝对不要覆盖的文件**：
  - `.env` — 服务器上单独维护，包含 AUTH_SECRET 和 DATABASE_URL
  - `prisma/dev.db` — 生产数据库，覆盖会丢失所有用户数据
- 新增 npm 依赖时，必须同时传 `package.json` 和 `package-lock.json`，然后在服务器执行 `npm install`
- 改了 `prisma/schema.prisma` 时，服务器需要执行 `npx prisma generate`（仅更新 Client）或 `npx prisma db push`（同步表结构）
- SCP 传文件时，路径含 `[` `]` 等特殊字符会静默失败，必须用 `cat | ssh "cat >"` 管道方式
