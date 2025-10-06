# 部署检查清单 ✅

在正式部署前，请确认以下所有项目：

## 📋 部署前检查

### 代码准备
- [ ] 已安装所有依赖：`npm install`
- [ ] 本地测试通过：`npm run dev` 或 `netlify dev`
- [ ] 已提交所有代码到 Git（如果使用 Git 部署）
- [ ] 已删除测试/调试代码

### Netlify 配置
- [ ] `netlify.toml` 配置正确
- [ ] `package.json` 包含构建脚本
- [ ] Functions 目录结构正确（`netlify/functions/`）

### 必需文件清单
```
✅ index.html - 前端主页
✅ submit.html - 用户投稿页面
✅ admin.html - 管理员后台
✅ main.js - Three.js 主逻辑
✅ package.json - 依赖配置
✅ netlify.toml - Netlify 配置
✅ netlify/functions/poems.js - 读取已发布诗歌
✅ netlify/functions/submit-poem.js - 接收用户提交
✅ netlify/functions/get-submissions.js - 获取提交列表
✅ netlify/functions/approve-poem.js - 审核操作
✅ netlify/functions/save-poems.js - 手动保存（可选）
```

---

## 🚀 部署步骤

### 第一步：部署到 Netlify

**Git 自动部署（推荐）**
1. [ ] 推送代码到 GitHub/GitLab
2. [ ] 在 Netlify 导入项目
3. [ ] 确认构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. [ ] 点击 "Deploy site"

**手动部署**
1. [ ] 运行 `npm run build`
2. [ ] 确认 `dist` 文件夹生成
3. [ ] 拖拽 `dist` 到 Netlify 部署界面

### 第二步：配置环境变量（必需）

进入 **Site settings** → **Environment variables**，添加：

- [ ] `ADMIN_PASSWORD`（必需）
  - 值：设置一个强密码（至少 12 位）
  - 环境：全选（Production, Deploy previews, Branch deploys）
  
- [ ] `POEMS_JSON_URL`（可选）
  - 值：外部 JSON 数据源 URL
  - 环境：全选

- [ ] 保存后点击 **Deploys** → **Trigger deploy** 重新部署

### 第三步：功能测试

部署完成后，测试所有功能：

#### 前端展示（公开访问）
- [ ] 访问主页：`https://your-site.netlify.app/`
- [ ] 转筒正常显示和旋转
- [ ] 点击单词能显示完整诗句
- [ ] 左侧面板显示中英对照

#### 用户投稿（公开访问）
- [ ] 访问投稿页：`https://your-site.netlify.app/submit.html`
- [ ] 表单正常显示
- [ ] 填写并提交测试诗歌
- [ ] 收到成功提示

#### 管理员后台（需要密码）
- [ ] 访问管理后台：`https://your-site.netlify.app/admin.html`
- [ ] 使用 `ADMIN_PASSWORD` 登录成功
- [ ] 看到刚才提交的测试诗歌（在"待审核"标签）
- [ ] 点击 "✅ 通过并发布" 审核通过
- [ ] 刷新主页，能看到新发布的诗歌

#### API 测试
- [ ] `GET /.netlify/functions/poems` 返回已发布诗歌
- [ ] `POST /.netlify/functions/submit-poem` 能接收提交（无需密码）
- [ ] `GET /.netlify/functions/get-submissions` 需要密码才能访问
- [ ] `POST /.netlify/functions/approve-poem` 需要密码才能操作

---

## 🔐 安全检查

- [ ] 管理员密码足够强（至少 12 位，包含大小写字母、数字、符号）
- [ ] 环境变量已正确设置（不在代码中硬编码）
- [ ] `.env` 文件已加入 `.gitignore`（如果有）
- [ ] 管理员后台需要密码才能登录
- [ ] 审核操作需要密码验证

---

## 📊 性能检查

- [ ] 首屏加载时间 < 3 秒
- [ ] Three.js 渲染流畅（60 FPS）
- [ ] 图片/纹理已优化
- [ ] 已启用 Netlify CDN（自动）

---

## 📝 文档检查

- [ ] README.md 已更新项目信息
- [ ] QUICKSTART.md 快速开始指南完整
- [ ] 环境变量说明清晰
- [ ] API 文档准确

---

## 🎯 上线后操作

### 立即执行
1. [ ] 保存 Netlify 站点 URL
2. [ ] 保存管理员密码（使用密码管理器）
3. [ ] 测试所有页面功能
4. [ ] 删除测试数据

### 后续维护
- [ ] 定期检查用户提交（每日/每周）
- [ ] 及时审核诗歌
- [ ] 监控 Netlify 使用量（Functions 调用次数、Blob Store 存储）
- [ ] 定期备份已发布内容
- [ ] 查看 Netlify Functions 日志排查问题

---

## 🐛 故障排查

如果遇到问题，依次检查：

1. **环境变量**
   - 是否正确设置 `ADMIN_PASSWORD`
   - 是否触发重新部署

2. **构建日志**
   - Netlify Deploys → 查看构建日志
   - 是否有报错信息

3. **Functions 日志**
   - Netlify Functions → 点击函数名
   - 查看运行时错误

4. **浏览器控制台**
   - F12 打开开发者工具
   - 查看 Console 和 Network 标签

5. **Blob Store**
   - 确保已部署到 Netlify（本地无 Blob Store）
   - 检查存储用量（Site settings → Storage）

---

## ✅ 最终确认

部署完成后，确认以下所有项目都正常工作：

- [x] 前端正常显示和交互
- [x] 用户可以提交诗歌
- [x] 管理员可以登录后台
- [x] 审核通过的诗歌显示在前端
- [x] 所有 API 正常响应
- [x] 密码保护正常工作

**🎉 恭喜！你的 Library of Babel 已成功部署！**

---

## 📞 需要帮助？

遇到问题？检查以下资源：

- 📖 [README.md](./README.md) - 完整文档
- 🚀 [QUICKSTART.md](./QUICKSTART.md) - 快速开始指南
- 🌐 [Netlify 文档](https://docs.netlify.com/)
- 💬 在 GitHub Issues 提问

---

**最后更新**: 2025-10-06

