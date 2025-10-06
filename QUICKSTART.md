# 快速开始指南

## 📦 立即部署到 Netlify（5 分钟完成）

### 步骤 1：准备代码
```bash
# 克隆或下载本项目
cd LibraryofBabel/test1

# 安装依赖
npm install
```

### 步骤 2：部署到 Netlify

**选项 A：通过 GitHub（推荐）**
1. 将代码推送到 GitHub
2. 访问 https://app.netlify.com
3. 点击 "Add new site" → "Import an existing project"
4. 选择你的 GitHub 仓库
5. 点击 "Deploy site"（构建设置自动读取）

**选项 B：拖拽部署**
```bash
npm run build
# 将 dist 文件夹拖拽到 Netlify 部署界面
```

### 步骤 3：配置环境变量（必需）

1. 进入 Netlify 站点设置
2. **Site settings** → **Environment variables**
3. 点击 **Add a variable**
4. 添加：
   ```
   Key: ADMIN_PASSWORD
   Value: 你的管理员密码（至少12位）
   Environments: 全选（Production, Deploy previews, Branch deploys）
   ```
5. 保存后点击 **Deploys** → **Trigger deploy** 重新部署

### 步骤 4：开始使用

部署完成后，你会得到一个域名，例如：`https://your-site.netlify.app`

访问：
- **前端展示**：`https://your-site.netlify.app/`
- **用户投稿**：`https://your-site.netlify.app/submit.html`
- **管理后台**：`https://your-site.netlify.app/admin.html`（密码：你设置的 ADMIN_PASSWORD）

---

## 🎯 典型工作流程

### 作为管理员：

1. **首次登录**
   - 访问 `https://your-site.netlify.app/admin.html`
   - 输入你设置的 `ADMIN_PASSWORD`
   - 登录成功

2. **查看用户提交**
   - 点击 "⏳ 待审核" 标签
   - 查看用户提交的诗歌内容
   - 阅读诗句、作者、翻译等信息

3. **审核诗歌**
   - 点击 **✅ 通过并发布**：诗歌立即显示在前端
   - 点击 **❌ 拒绝**：标记为已拒绝（不会显示）

4. **管理已发布内容**
   - 点击 "✅ 已通过" 查看所有已发布诗歌
   - 点击 "❌ 已拒绝" 查看被拒绝的提交
   - 点击 "📋 全部" 查看所有记录

### 作为用户：

1. **投稿诗歌**
   - 访问 `https://your-site.netlify.app/submit.html`
   - 选择语言（英文/中文/双语）
   - 填写作者和诗句
   - （可选）添加中文翻译
   - （可选）留下你的名字和邮箱
   - 点击 **提交诗歌**

2. **等待审核**
   - 提交成功后会看到确认消息
   - 管理员审核通过后，诗歌会出现在主页

3. **欣赏诗歌**
   - 访问主页 `https://your-site.netlify.app/`
   - 鼠标悬停在转筒上暂停旋转
   - 点击任意单词查看完整诗句

---

## 🔧 本地开发

### 使用 Netlify CLI（推荐）
```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 启动本地开发服务器（支持 Functions）
netlify dev
```

访问：
- http://localhost:8888/
- http://localhost:8888/submit.html
- http://localhost:8888/admin.html

### 仅前端开发
```bash
npm run dev
```
访问 http://localhost:5173/（但 Netlify Functions 不可用）

---

## 💡 提示与技巧

### 修改密码
1. 在 Netlify 站点设置中更新 `ADMIN_PASSWORD` 环境变量
2. 触发重新部署

### 自定义域名
1. Netlify 站点设置 → **Domain management**
2. 添加自定义域名（例如：poems.yoursite.com）
3. 按提示配置 DNS

### 备份数据
数据存储在 Netlify Blob Store 中，建议：
- 定期导出已发布诗歌（通过 API）
- 保存重要的用户提交记录

### 查看日志
Netlify 站点设置 → **Functions** → 点击函数名 → 查看日志

---

## ⚠️ 常见错误处理

### "Unauthorized" 错误
**原因**：环境变量未设置或密码错误  
**解决**：检查 Netlify 环境变量 `ADMIN_PASSWORD`，确保已重新部署

### "Method not allowed" 错误
**原因**：本地开发未使用 Netlify CLI  
**解决**：使用 `netlify dev` 代替 `npm run dev`

### 前端看不到更新
**原因**：浏览器缓存  
**解决**：强制刷新（Ctrl+Shift+R / Cmd+Shift+R）

### Blob Store 连接失败
**原因**：Netlify 环境变量缺失  
**解决**：确保已正确部署到 Netlify（Blob Store 仅在 Netlify 环境可用）

---

## 📞 需要帮助？

- 查看完整文档：[README.md](./README.md)
- 提交问题：在 GitHub Issues 中反馈
- 查看 Netlify Functions 日志排查问题

---

**祝你使用愉快！📚✨**

