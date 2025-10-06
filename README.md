# Library of Babel - 诗歌转筒项目

一个基于 Three.js 的交互式诗歌展示项目，配备用户投稿系统和管理员审核后台。

## ✨ 功能特性

### 前端展示
- 🎨 3D 旋转转筒展示诗歌文本
- 🖱️ 点击单词显示完整诗句（中英双语）
- 🔄 自动每日更新（午夜后首次访问）

### 用户投稿
- 📝 公开投稿表单：任何人都可以提交诗歌
- 🌐 支持英文、中文、双语诗歌
- ✉️ 可选留下联系方式

### 管理员后台
- 🔐 密码保护的管理界面
- 👀 查看所有用户提交
- ✅ 审核通过/拒绝功能
- 📊 实时统计数据
- 💾 数据存储在 Netlify Blob Store（无需外部数据库）

## 📦 技术栈

- **前端**: Three.js + Vite
- **后端**: Netlify Functions
- **存储**: Netlify Blob Store
- **部署**: Netlify

## 🚀 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发

```bash
npm run dev
```

访问页面：
- 前端展示：`http://localhost:5173`
- 用户投稿：`http://localhost:5173/submit.html`
- 管理后台：`http://localhost:5173/admin.html`

### 3. 部署到 Netlify

#### 方法 A：通过 Git 自动部署（推荐）

1. 将代码推送到 GitHub/GitLab
2. 登录 [Netlify](https://app.netlify.com)
3. 点击 "Add new site" → "Import an existing project"
4. 连接你的 Git 仓库
5. 构建设置会自动从 `netlify.toml` 读取
6. 点击 "Deploy site"

#### 方法 B：手动部署

```bash
npm run build
# 然后将 dist 文件夹拖拽到 Netlify 的部署界面
```

### 4. 配置环境变量（必需）

部署完成后，在 Netlify 控制台配置环境变量：

1. 进入你的站点（例如：`libraryofbable.netlify.app`）
2. 点击 **Site settings** → **Environment variables**
3. 添加以下变量：

| 变量名 | 说明 | 示例值 | 是否必需 |
|--------|------|--------|---------|
| `ADMIN_PASSWORD` | 管理员后台密码 | `your-secure-password-123` | **必需** |
| `POEMS_JSON_URL` | （可选）外部 JSON 数据源 | `https://example.com/poems.json` | 可选 |

4. 点击 **Deploys** → **Trigger deploy** 重新部署使环境变量生效

## 📖 使用指南

### 系统架构

```
用户投稿 (submit.html)
    ↓
提交到 Netlify Function (submit-poem.js)
    ↓
保存到 Blob Store (状态: pending)
    ↓
管理员登录后台 (admin.html)
    ↓
审核通过 → 发布到前端展示
审核拒绝 → 标记为已拒绝
    ↓
前端自动读取已发布内容 (poems.js)
```

### 1. 前端访问

访问你的 Netlify 域名（例如：`https://libraryofbable.netlify.app`）：

- **鼠标悬停**转筒：暂停旋转，高亮单词
- **点击单词**：在左侧面板显示完整诗句（中英对照）
- **悬停顶部/底部**：转筒上下滚动

### 2. 用户投稿

访问 `https://你的域名.netlify.app/submit.html`：

1. 选择诗歌语言（英文/中文/双语）
2. 填写作者和诗句内容
3. （可选）添加中文翻译对照
4. （可选）留下你的名字和邮箱
5. 点击 **提交诗歌**
6. 等待管理员审核

### 3. 管理员后台

访问 `https://你的域名.netlify.app/admin.html`：

1. 输入你在环境变量中设置的 `ADMIN_PASSWORD`
2. 点击 **登录**
3. 查看提交列表：
   - **⏳ 待审核**：新提交的诗歌
   - **✅ 已通过**：已发布到前端
   - **❌ 已拒绝**：未通过审核
   - **📋 全部**：所有提交记录
4. 审核操作：
   - 点击 **✅ 通过并发布**：诗歌将立即显示在前端
   - 点击 **❌ 拒绝**：标记为已拒绝
5. 点击 **🔄 刷新列表** 查看最新提交

### 数据格式

#### 用户提交格式

```json
{
  "author": "Pablo Neruda",
  "language": "en",
  "lines": [
    "Leaning into the afternoons I cast my sad nets",
    "towards your oceanic eyes."
  ],
  "translations": {
    "Leaning into the afternoons I cast my sad nets": "倚身在暮色里，我朝你海洋般的双眼投掷我哀伤的网。"
  },
  "submitterName": "张三",
  "submitterEmail": "user@example.com",
  "status": "pending"
}
```

#### 已发布诗歌格式

```json
{
  "poems": [
    {
      "author": "Pablo Neruda",
      "language": "en",
      "lines": [
        "Leaning into the afternoons I cast my sad nets towards your oceanic eyes."
      ],
      "translations": {
        "Leaning into the afternoons I cast my sad nets towards your oceanic eyes.": "倚身在暮色里，我朝你海洋般的双眼投掷我哀伤的网。"
      },
      "publishedAt": "2025-10-06T12:00:00.000Z"
    }
  ],
  "updatedAt": "2025-10-06T12:00:00.000Z"
}
```

## 🔧 API 说明

### GET `/.netlify/functions/poems`

获取所有已发布的诗歌（前端自动调用）

**权限**：公开访问

**响应示例**：
```json
{
  "poems": [...],
  "updatedAt": "2025-10-06T12:00:00.000Z"
}
```

### POST `/.netlify/functions/submit-poem`

用户提交诗歌

**权限**：公开访问

**请求体**：
```json
{
  "author": "作者名",
  "lines": ["诗句1", "诗句2"],
  "language": "en",
  "translations": {},
  "submitterName": "投稿人",
  "submitterEmail": "email@example.com"
}
```

### GET `/.netlify/functions/get-submissions`

获取所有提交记录（管理员专用）

**权限**：需要 Bearer Token

**请求头**：
```
Authorization: Bearer your-admin-password
```

### POST `/.netlify/functions/approve-poem`

审核诗歌（管理员专用）

**权限**：需要 Bearer Token

**请求体**：
```json
{
  "submissionId": "submission_xxx",
  "action": "approve" // 或 "reject"
}
```

## 📁 项目结构

```
LibraryofBabel/
├── index.html              # 前端主页面
├── submit.html             # 用户投稿页面
├── admin.html              # 管理员审核后台
├── main.js                 # Three.js 主逻辑
├── package.json            # 依赖配置
├── netlify.toml            # Netlify 构建配置
├── netlify/
│   └── functions/
│       ├── poems.js        # 读取已发布诗歌
│       ├── submit-poem.js  # 接收用户提交
│       ├── get-submissions.js  # 获取提交列表（需密码）
│       ├── approve-poem.js     # 审核操作（需密码）
│       └── save-poems.js       # 手动保存（已弃用）
├── models/                 # 3D 模型（可选）
└── textures/               # 纹理贴图（可选）
```

## 🔐 安全说明

- ✅ 用户投稿页面：**公开访问**，任何人都可以提交
- 🔒 管理员后台：**密码保护**，需要 `ADMIN_PASSWORD` 环境变量
- ✅ 前端展示 API：**公开访问**，自动读取已发布内容
- 🔒 审核 API：**需要密码验证**，防止未授权操作

**安全建议**：
- 设置强密码（至少 12 位，包含大小写字母、数字、符号）
- 不要在代码中硬编码密码
- 定期更换管理员密码
- 启用 Netlify 的访问日志监控异常登录

## 🐛 常见问题

### Q: 用户提交失败，提示 "Method not allowed"？
A: 确保已部署到 Netlify，本地开发需使用 `netlify dev` 而非 `npm run dev`。

### Q: 管理员登录失败？
A: 检查环境变量 `ADMIN_PASSWORD` 是否正确设置，并重新部署站点。

### Q: 通过审核后前端看不到更新？
A: 清除浏览器缓存或强制刷新（Ctrl+Shift+R / Cmd+Shift+R）。

### Q: 本地开发如何测试 Netlify Functions？
A: 使用 Netlify CLI：
```bash
npm install -g netlify-cli
netlify dev
```

### Q: Blob Store 存储有大小限制吗？
A: Netlify 免费版提供 100MB Blob Store 存储空间，足够存储大量诗歌文本。

### Q: 如何批量导入诗歌？
A: 可以直接在管理后台通过审核用户提交，或使用 `save-poems.js` API 批量导入（需要管理员密码）。

## 🎯 功能路线图

- [ ] 邮件通知投稿人审核结果
- [ ] 支持图片/音频附件
- [ ] 多语言界面（英文/中文切换）
- [ ] 诗歌搜索功能
- [ ] 导出/导入功能
- [ ] 用户注册与个人中心

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**在线演示**: https://libraryofbable.netlify.app  
**用户投稿**: https://libraryofbable.netlify.app/submit.html  
**管理后台**: https://libraryofbable.netlify.app/admin.html
