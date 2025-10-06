# 问题排查与修复指南 🔧

## 问题：submit.html 和 admin.html 在 Netlify 上无法访问

### ✅ 解决方案

#### 步骤 1：删除错误的环境变量

1. 登录 Netlify 控制台
2. 进入你的站点 `libraryofbable.netlify.app`
3. **Site settings** → **Environment variables**
4. **删除** `POEMS_JSON_URL` 变量（或将其留空）
   - ❌ 错误值：`https://libraryofbable.netlify.app/poems.json`
   - ✅ 正确做法：**完全删除这个变量**

**为什么要删除？**
- 你的数据存储在 **Netlify Blob Store** 中，不需要外部 JSON
- `POEMS_JSON_URL` 只在你有**外部第三方数据源**时才需要设置
- 设置成自己的域名会造成循环引用和混乱

#### 步骤 2：重新部署

方法 A：通过 Git（推荐）
```bash
# 在本地项目目录
git add .
git commit -m "Fix vite config for multiple HTML pages"
git push
```
Netlify 会自动触发部署。

方法 B：手动触发
1. Netlify 控制台 → **Deploys**
2. 点击 **Trigger deploy** → **Deploy site**

#### 步骤 3：验证部署成功

等待部署完成（通常 1-3 分钟），然后访问：

- ✅ 主页：`https://libraryofbable.netlify.app/`
- ✅ 投稿页：`https://libraryofbable.netlify.app/submit.html`
- ✅ 管理后台：`https://libraryofbable.netlify.app/admin.html`

---

## 当前系统架构说明

### 数据流程

```
用户提交 (submit.html)
    ↓
/.netlify/functions/submit-poem
    ↓
保存到 Netlify Blob Store
    ↓
管理员登录 (admin.html)
    ↓
/.netlify/functions/get-submissions (读取)
/.netlify/functions/approve-poem (审核)
    ↓
更新 Blob Store (已发布列表)
    ↓
前端读取 (index.html)
    ↓
/.netlify/functions/poems (从 Blob Store 读取)
```

### 不需要外部 JSON 文件

所有数据都在 **Netlify Blob Store** 中：
- `submissions` - 用户提交列表
- `poems` - 已发布诗歌列表

### 环境变量配置

只需要一个环境变量：

| 变量名 | 用途 | 是否必需 |
|--------|------|---------|
| `ADMIN_PASSWORD` | 管理员后台密码 | ✅ 必需 |
| `POEMS_JSON_URL` | 外部数据源（如果有） | ❌ 不需要（删除） |

---

## 其他常见问题

### Q: 本地可以运行，但 Netlify 上不行？

**本地开发**（使用 `netlify dev`）：
- 所有文件直接从项目根目录提供
- Functions 在本地模拟运行

**Netlify 部署**：
- 需要通过 Vite 构建
- HTML 文件需要在 `vite.config.js` 中声明
- Functions 需要正确的环境变量

### Q: 如何查看部署日志？

1. Netlify 控制台 → **Deploys**
2. 点击最新的部署记录
3. 查看 **Deploy log**
4. 检查是否有构建错误

### Q: 如何查看 Functions 日志？

1. Netlify 控制台 → **Functions**
2. 点击函数名（如 `poems`, `submit-poem`）
3. 查看 **Function log**
4. 检查是否有运行时错误

### Q: 管理员登录失败？

检查：
1. 环境变量 `ADMIN_PASSWORD` 是否正确设置
2. 是否触发了重新部署（修改环境变量后必须重新部署）
3. 浏览器控制台是否有错误信息

### Q: 用户提交后看不到数据？

检查：
1. 管理员登录后台，查看"待审核"标签
2. 审核通过后，数据才会显示在前端
3. 查看 Functions 日志确认提交是否成功

### Q: Blob Store 连接失败？

**可能原因**：
- Blob Store 只在 Netlify 环境可用（本地不可用）
- 需要正确的 `SITE_ID` 和 `NETLIFY_TOKEN`（Netlify 自动提供）

**解决方法**：
- 确保已部署到 Netlify（不是本地运行）
- 确保 Functions 目录结构正确
- 查看 Functions 日志排查错误

---

## 验证清单

部署完成后，按顺序测试：

- [ ] 访问主页 `https://libraryofbable.netlify.app/` 正常显示
- [ ] 访问投稿页 `https://libraryofbable.netlify.app/submit.html` 正常显示
- [ ] 填写并提交一首测试诗歌
- [ ] 访问管理后台 `https://libraryofbable.netlify.app/admin.html`
- [ ] 使用 `ADMIN_PASSWORD` 登录成功
- [ ] 在"待审核"标签看到刚才提交的诗歌
- [ ] 点击"✅ 通过并发布"审核通过
- [ ] 刷新主页，看到新发布的诗歌

---

## 需要帮助？

如果问题依然存在，请检查：

1. **部署日志**：Deploys → 最新部署 → Deploy log
2. **Functions 日志**：Functions → 点击函数名 → Function log
3. **浏览器控制台**：F12 → Console 和 Network 标签
4. **环境变量**：Site settings → Environment variables

提供以上信息可以更快定位问题。

---

**最后更新**: 2025-10-06

