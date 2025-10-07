# 🔍 诗歌不显示问题 - 完整排查指南

## 问题：在 admin.html 审核通过后，主页仍然看不到新诗歌

---

## ⚡ 立即检查清单

### 1️⃣ 打开浏览器控制台（必须！）

访问 `https://libraryofbable.netlify.app/`

按 **F12** 打开开发者工具 → **Console** 标签

#### ✅ 应该看到的日志：
```
Fetching poems from: /.netlify/functions/poems
Loaded poems: X
```

#### ❌ 如果看到错误：
```
REMOTE_ENDPOINT not configured
```
→ **原因**：API 配置未生效，需要重新部署

```
No poems received from API
```
→ **原因**：API 返回空数据或格式错误

```
Failed to fetch
```
→ **原因**：网络错误或 Function 未部署

---

### 2️⃣ 直接测试 API（关键步骤！）

在浏览器打开：
```
https://libraryofbable.netlify.app/.netlify/functions/poems
```

#### ✅ 期望返回（包含你审核的诗歌）：
```json
{
  "poems": [
    {
      "author": "你提交的作者",
      "lines": ["你的诗句1", "你的诗句2"],
      "translations": {...},
      "language": "en",
      "publishedAt": "2025-..."
    }
  ],
  "updatedAt": "2025-10-07T..."
}
```

#### ❌ 如果只返回兜底数据（Pablo Neruda）：
```json
{
  "poems": [
    {
      "author": "Pablo Neruda",
      "lines": ["Leaning into the afternoons..."]
    }
  ]
}
```

**这说明 Blob Store 为空或未读取到审核通过的数据！**

---

### 3️⃣ 验证 Netlify 部署状态

#### 检查最新部署

1. 登录 [Netlify](https://app.netlify.com)
2. 进入你的站点 `libraryofbable`
3. 点击 **Deploys** 标签

**关键信息**：
- ✅ 最新部署状态：**Published**（绿色）
- ✅ 部署时间：应该是你推送代码后的时间
- ⚠️ 如果状态是 **Failed**：点击查看构建日志

#### 检查 Functions 部署

1. 在 Netlify 站点页面
2. 点击 **Functions** 标签
3. 确认以下 Functions 存在：
   - ✅ `poems`
   - ✅ `submit-poem`
   - ✅ `get-submissions`
   - ✅ `approve-poem`

如果缺少任何一个，说明 Functions 未正确部署。

---

### 4️⃣ 检查环境变量

1. Netlify 站点 → **Site settings** → **Environment variables**
2. 确认只有以下变量：
   - ✅ `ADMIN_PASSWORD`（你的管理员密码）
   - ❌ **删除** `POEMS_JSON_URL`（如果存在）

**重要**：修改环境变量后必须重新部署！

---

## 🔄 完整审核流程验证

### Step 1: 提交诗歌

访问 `https://libraryofbable.netlify.app/submit.html`

1. 填写表单并提交
2. 看到成功消息："Submission successful..."
3. **打开控制台（F12）→ Network 标签**
4. 找到 `submit-poem` 请求
5. 点击查看 Response：

```json
{
  "success": true,
  "message": "Submission received",
  "id": "submission_xxxxx"
}
```

### Step 2: 管理员审核

访问 `https://libraryofbable.netlify.app/admin.html`

1. 输入密码登录
2. **打开控制台（F12）→ Network 标签**
3. 找到 `get-submissions` 请求
4. 点击查看 Response，确认你的提交在列表中：

```json
{
  "submissions": [
    {
      "id": "submission_xxxxx",
      "status": "pending",
      "author": "...",
      "lines": [...]
    }
  ],
  "stats": {...}
}
```

5. 在 "Pending" 标签找到你的提交
6. **点击 "Approve" 按钮**
7. 看到成功消息："Poem approved and published successfully"
8. **打开控制台（F12）→ Network 标签**
9. 找到 `approve-poem` 请求
10. 点击查看 Response：

```json
{
  "success": true,
  "message": "Poem approved and published",
  "poem": {
    "author": "...",
    "lines": [...],
    "publishedAt": "2025-..."
  }
}
```

### Step 3: 验证 API 更新

**立即**访问：
```
https://libraryofbable.netlify.app/.netlify/functions/poems
```

**刷新几次**（Ctrl+R），查看返回数据：
- `poems` 数组长度应该增加
- 应该包含你刚审核的诗歌

### Step 4: 主页刷新

访问 `https://libraryofbable.netlify.app/`

1. **硬刷新**：Ctrl+Shift+R（清除缓存）
2. **按 R 键**：手动触发重新加载
3. **打开控制台（F12）**：
   ```
   Fetching poems from: /.netlify/functions/poems
   Loaded poems: X  ← 这个数字应该增加
   ```

---

## 🐛 常见问题与解决方案

### ❌ 问题 1：API 一直返回兜底数据（Pablo Neruda）

**原因**：Blob Store 为空或读取失败

**解决方案**：

1. **检查 Functions 日志**：
   - Netlify → Functions → `poems`
   - 点击 "Function log"
   - 查找错误信息：`Blob Store read error`

2. **检查 approve-poem Function 日志**：
   - Netlify → Functions → `approve-poem`
   - 查看是否有写入错误

3. **验证审核流程**：
   - 确认点击了 "Approve" 按钮（不是只查看）
   - 确认看到成功消息
   - 检查 Network 标签确认请求成功

### ❌ 问题 2：控制台显示 "REMOTE_ENDPOINT not configured"

**原因**：`index.html` 未注入 API 配置或未正确部署

**解决方案**：

1. **确认 index.html 包含**：
   ```html
   <script>
     window.__POEM_API_BASE__ = '/.netlify/functions';
   </script>
   ```

2. **重新部署**：
   ```bash
   git add index.html
   git commit -m "Ensure API config"
   git push
   ```

3. **等待部署完成**（1-3分钟）

4. **硬刷新主页**（Ctrl+Shift+R）

### ❌ 问题 3：部署成功但代码未更新

**原因**：浏览器缓存或 Netlify CDN 缓存

**解决方案**：

1. **清除浏览器缓存**：
   - Chrome: Ctrl+Shift+Delete → 清除缓存
   - 或使用无痕模式（Ctrl+Shift+N）

2. **清除 Netlify CDN 缓存**：
   - Netlify → Post processing
   - Asset optimization → Clear cache

3. **硬刷新**：Ctrl+Shift+R

### ❌ 问题 4：Functions 未部署

**原因**：构建失败或配置错误

**解决方案**：

1. **检查构建日志**：
   - Netlify → Deploys → 最新部署
   - 查看 "Deploy log"
   - 查找错误信息

2. **检查 vite.config.js**：
   ```javascript
   import { defineConfig } from 'vite';
   import { resolve } from 'path';

   export default defineConfig({
     build: {
       rollupOptions: {
         input: {
           main: resolve(__dirname, 'index.html'),
           submit: resolve(__dirname, 'submit.html'),
           admin: resolve(__dirname, 'admin.html')
         }
       }
     }
   });
   ```

3. **检查 netlify.toml**：
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [functions]
     directory = "netlify/functions"
   ```

4. **重新部署**：
   ```bash
   git add .
   git commit -m "Fix build config"
   git push
   ```

### ❌ 问题 5：Blob Store 权限错误

**原因**：环境变量缺失或权限不足

**解决方案**：

Netlify 会自动提供这些变量，但如果出现错误：

1. **检查 Functions 日志**是否有 `SITE_ID` 或 `NETLIFY_TOKEN` 相关错误

2. **确认站点已启用 Blob Store**：
   - Netlify → Integrations
   - 查找 Blob Store（应该是默认启用的）

3. **联系 Netlify 支持**（罕见情况）

---

## 🎯 标准排查流程

按此顺序逐一检查，直到找到问题：

1. ✅ **控制台日志** → 查看是否有错误
2. ✅ **API 直接访问** → 确认数据是否在后端
3. ✅ **Netlify 部署状态** → 确认最新代码已部署
4. ✅ **环境变量** → 确认配置正确
5. ✅ **Functions 日志** → 查看后端错误
6. ✅ **审核流程** → 重新提交并审核一次
7. ✅ **清除缓存** → 硬刷新浏览器

---

## 💡 快速测试命令

在主页控制台（F12 → Console）执行：

```javascript
// 1. 检查 API 配置
console.log('API Base:', window.__POEM_API_BASE__);

// 2. 手动获取诗歌
fetch('/.netlify/functions/poems')
  .then(r => r.json())
  .then(data => console.log('API 返回:', data));

// 3. 触发手动刷新
// 按 R 键
```

---

## 📞 仍然无法解决？

提供以下信息以便诊断：

1. **控制台截图**（F12 → Console 标签）
2. **API 返回数据**（访问 `/.netlify/functions/poems` 的结果）
3. **Netlify 部署状态**（最新部署的状态和时间）
4. **Functions 日志**（如有错误信息）
5. **审核流程截图**（admin.html 中点击 Approve 后的响应）

---

**最后更新**: 2025-10-07

