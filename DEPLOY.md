# 登科录 — 服务器部署指南

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 59.110.164.112 |
| 用户 | root |
| SSH 密钥 | `~/Downloads/suyeo.pem` |
| 项目路径 | `/www/wwwroot/gongkao-interview` |
| 域名 | https://qiqi.sunlawai.com |
| 进程管理 | PM2（进程名：`dengkelu`） |
| 反向代理 | Nginx → 127.0.0.1:3000 |
| Nginx 配置 | `/etc/nginx/sites-available/dengkelu` |
| SSL | Let's Encrypt (Certbot 自动管理) |

## 快速部署（日常更新）

因为服务器在国内，无法 `git pull`，需要通过 SCP 传文件。

### 1. 查看本地有哪些文件改了

```bash
# 对比本地最新和服务器版本的差异
# 先看服务器当前的 commit
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 \
  "cd /www/wwwroot/gongkao-interview && git log --oneline -1"

# 本地查看差异文件（把 <server_commit> 替换为上面的 hash）
git diff --name-only <server_commit>..HEAD
```

### 2. 传输文件到服务器

```bash
# 单个文件
scp -i ~/Downloads/suyeo.pem \
  src/components/Header.tsx \
  root@59.110.164.112:/www/wwwroot/gongkao-interview/src/components/Header.tsx

# 批量传输（把所有改动文件传过去）
git diff --name-only <server_commit>..HEAD | while read f; do
  ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 \
    "mkdir -p \$(dirname /www/wwwroot/gongkao-interview/$f)"
  scp -i ~/Downloads/suyeo.pem \
    "$f" \
    "root@59.110.164.112:/www/wwwroot/gongkao-interview/$f"
done
```

### 3. 服务器上构建并重启

```bash
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112

# 进入项目目录
cd /www/wwwroot/gongkao-interview

# 如果有新增依赖
npm install

# 如果改了数据库 schema
npx prisma generate

# 构建
npm run build

# 重启
pm2 restart dengkelu

# 查看状态
pm2 status
```

### 一键脚本（SSH 后直接构建重启）

```bash
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112 \
  "cd /www/wwwroot/gongkao-interview && npm run build && pm2 restart dengkelu"
```

## 常用运维命令

```bash
# SSH 登录
ssh -i ~/Downloads/suyeo.pem root@59.110.164.112

# 查看应用日志
pm2 logs dengkelu

# 查看应用状态
pm2 status

# 重启应用
pm2 restart dengkelu

# 查看 nginx 配置
cat /etc/nginx/sites-available/dengkelu

# 测试 nginx 配置
nginx -t

# 重载 nginx
nginx -s reload
```

## Nginx 配置要点

当前配置已包含**流式输出(SSE/Streaming)支持**：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    # ...headers...

    # 流式输出必须项
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
    proxy_read_timeout 300s;
}
```

> 如果修改了 nginx 配置，记得 `nginx -t && nginx -s reload`。

## 注意事项

- 服务器在国内，**不能 `git pull`**，只能 SCP 传文件
- 构建大约需要 30 秒
- `.env` 文件在服务器上单独维护，不要覆盖
- `prisma/dev.db` 是 SQLite 数据库文件，**不要覆盖**
- 如果新增了 npm 依赖，传文件后需要先 `npm install`
- 如果改了 `prisma/schema.prisma`，需要 `npx prisma generate` 再构建
