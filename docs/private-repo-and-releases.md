# 源码私有 + 公开更新（方案 A）

## 架构

| 仓库 | 可见性 | 用途 |
|------|--------|------|
| `Ryancheese/RyanMusic` | **Private** | 源码、CI、开发 |
| `Ryancheese/RyanMusic-Releases` | **Public** | 安装包、应用内更新 |

客户端更新 API 指向公开仓：

`https://api.github.com/repos/Ryancheese/RyanMusic-Releases/releases/latest`

## 一次性配置

### 1. 确认公开 Releases 仓已存在

<https://github.com/Ryancheese/RyanMusic-Releases>

### 2. 创建 Personal Access Token

**推荐 Classic PAT**（跨仓发 Release 最省事）：

GitHub → Settings → Developer settings → **Personal access tokens (classic)** → Generate new token：

- 勾选 **`repo`**（或至少 **`public_repo`**，因 Releases 仓为 Public）
- 复制 token（只显示一次）

若用 **Fine-grained token**，必须同时满足：

- Repository access：仅 `RyanMusic-Releases`
- Permissions：`Contents` → **Read and write**
- 且 token 所属账号对该仓有 **Write** 权限

常见失败：`403 Resource not accessible by personal access token` → 权限不足或未勾选目标仓库。

### 3. 写入私有源码仓 Secret

私有仓 `RyanMusic` → Settings → Secrets and variables → Actions → New repository secret：

- Name: `RELEASES_REPO_TOKEN`
- Value: 上一步的 token

### 4. 将源码仓设为 Private

Settings → General → Danger Zone → **Change repository visibility → Make private**

### 5. 重新授权 Vercel（若使用）

Vercel 项目需重新连接 GitHub，并授予访问私有仓权限。

## 发版流程（不变）

```bash
git tag v1.8.69
git push origin v1.8.69
```

CI 会在 **公开** `RyanMusic-Releases` 创建/更新同名 Release，并上传 DMG / EXE / APK。

## 用户侧

- 下载：<https://github.com/Ryancheese/RyanMusic-Releases/releases>
- 应用内更新：自动读公开仓，**不受源码私有影响**
- `curl install.sh` / 源码 clone：**需仓库权限**，普通用户请直接下安装包
