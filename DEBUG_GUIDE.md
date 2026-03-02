# 调试指南 - 诗歌不显示问题

## 🔍 问题：提交的诗歌不显示

### 快速检查步骤

#### 1. 打开浏览器控制台（F12）

访问 `https://entropybabel.art/`，按 F12 打开开发者工具，查看 Console 标签页。

**期望看到的日志**：
```
Fetching poems from: /.netlify/functions/poems
Loaded poems: X
```

**如果看到**：
- `REMOTE_ENDPOINT not configured` → API 未配置（检查 index.html）
- `No poems received from API` → API 返回空数据
- 网络错误 → Functions 未正常工作

#### 2. 检查 API 是否正常

直接访问：`https://entropybabel.art/.netlify/functions/poems`

**期望返回**：
```json
{
  "poems": [
    {
      "author": "...",
      "lines": ["...", "..."],
      "translations": {...}
    }
  ],
  "updatedAt": "2025-..."
}
```

**如果返回兜底数据（Pablo Neruda）**：
- 说明 Blob Store 为空或未读取到数据
- 需要检查审核流程

#### 3. 验证审核流程

1. 访问 `https://entropybabel.art/submit.html`
2. 提交一首测试诗歌
3. 访问 `https://entropybabel.art/admin.html`
4. 登录并查看"Pending"标签
5. **必须点击"Approve"按钮**才会发布
6. 刷新主页（或按 R 键）查看

---

## ✅ 解决方案

### 方案 A：手动刷新（立即生效）

在主页按键盘 **R 键**，会立即重新加载 API 数据。

控制台会显示：
```
Manual refresh triggered
Refreshed poems: X
```

### 方案 B：等待自动刷新

- **首次加载**：页面打开时自动加载
- **每日刷新**：午夜后首次访问时自动更新
- **强制刷新**：Ctrl+Shift+R 清除缓存

### 方案 C：检查 Netlify Blob Store

1. Netlify 控制台 → 你的站点
2. **Functions** → 点击 `poems`
3. 查看 **Function log** 是否有错误
4. 检查 **Storage** → **Blobs** 使用情况

---

## 🐛 常见问题

### Q: 我审核通过了，但主页看不到？

**检查清单**：
1. ✅ 在 admin.html 点击了"Approve"按钮（不是只查看）
2. ✅ 看到"Poem approved and published successfully"消息
3. ✅ 刷新主页或按 R 键
4. ✅ 清除浏览器缓存（Ctrl+Shift+R）

**验证**：
- 访问 `/.netlify/functions/poems`
- 检查返回的 `poems` 数组长度是否增加
- 检查是否包含你刚审核的诗歌

### Q: API 一直返回兜底数据（Pablo Neruda）？

**原因**：Blob Store 为空或读取失败

**解决**：
1. 确认已在 admin.html 审核通过至少一首诗
2. 检查 Netlify Functions 日志是否有 Blob Store 错误
3. 确认环境变量 `ADMIN_PASSWORD` 已设置
4. 删除 `POEMS_JSON_URL` 环境变量（如果设置了）

### Q: 控制台显示 "REMOTE_ENDPOINT not configured"？

**原因**：index.html 未注入 API 配置

**检查**：
```html
<!-- index.html 应该包含 -->
<script>
  window.__POEM_API_BASE__ = '/.netlify/functions';
</script>
```

### Q: 审核通过后要等24小时吗？

**不需要！** 审核通过后立即生效：
- 点击"Approve"→ 数据写入 Blob Store
- 刷新主页 → API 读取最新数据
- 转筒更新 → 新诗歌显示

**如果没有立即显示**：
1. 按 R 键手动刷新
2. 清除浏览器缓存（Ctrl+Shift+R）
3. 检查 API 返回数据

---

## 📊 数据流程图

```
用户提交 (submit.html)
    ↓
submit-poem.js
    ↓
Blob Store ["submissions"]
    ↓
管理员审核 (admin.html)
    ↓
approve-poem.js (action: approve)
    ↓
Blob Store ["poems"] ← 写入新诗歌
    ↓
主页加载 (index.html)
    ↓
poems.js ← 读取 Blob Store ["poems"]
    ↓
main.js ← fetchRemotePoems()
    ↓
appendPoemsToSource()
    ↓
转筒显示新诗歌 ✅
```

---

## 🔧 高级调试

### 查看 Blob Store 内容

在 Netlify Functions 中临时添加调试端点：

```javascript
// netlify/functions/debug-blobs.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore({
    name: "poems-data",
    siteID: process.env.SITE_ID,
    token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN
  });
  
  const submissions = await store.get("submissions", { type: "json" });
  const poems = await store.get("poems", { type: "json" });
  
  return new Response(JSON.stringify({
    submissions: submissions || [],
    poems: poems || { poems: [] }
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

访问 `/.netlify/functions/debug-blobs` 查看所有数据。

### 清空 Blob Store（重置）

如果需要重新开始：

1. 删除所有待审核的提交
2. 重新部署站点
3. Blob Store 会自动清空

---

## 💡 提示

- **按 R 键**：立即刷新诗歌（无需重新加载页面）
- **查看控制台**：所有 API 请求都有日志输出
- **检查 Network**：F12 → Network 标签查看 API 响应
- **Functions 日志**：Netlify 控制台查看后端日志

---

**最后更新**: 2025-10-06

