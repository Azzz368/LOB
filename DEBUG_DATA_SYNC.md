# 数据同步调试指南

## 🔍 验证用户提交的诗歌是否正确同步

### 步骤 1：提交诗歌

1. 访问 `https://entropybabel.art/submit.html`
2. 填写表单：
   - 作者：`Test Author`
   - 来源：`Test Source`
   - 诗句：
     ```
     This is a test line one
     This is a test line two
     ```
   - 翻译（可选）：
     ```
     This is a test line one → 这是测试行一
     This is a test line two → 这是测试行二
     ```
3. 提交

### 步骤 2：管理员审核

1. 访问 `https://entropybabel.art/admin.html`
2. 登录
3. 找到刚提交的诗歌
4. **点击 "Approve" 按钮**
5. 确认看到成功消息

### 步骤 3：验证 API 返回

访问：`https://entropybabel.art/.netlify/functions/poems`

**期望看到**：
```json
{
  "poems": [
    {
      "author": "Pablo Neruda",
      "lines": ["...原始诗句..."]
    },
    {
      "author": "Test Author",
      "source": "Test Source",
      "lines": [
        "This is a test line one",
        "This is a test line two"
      ],
      "translations": {
        "This is a test line one": "这是测试行一",
        "This is a test line two": "这是测试行二"
      },
      "language": "en",
      "publishedAt": "2025-..."
    }
  ],
  "updatedAt": "2025-..."
}
```

### 步骤 4：验证主页数据同步

访问 `https://entropybabel.art/`

#### 4.1 打开控制台（F12 → Console）

**应该看到的日志**：
```
Fetching poems from: /.netlify/functions/poems
Loaded poems: 2
Appending poems to source: 2
Processing poem 1: Pablo Neruda (X lines)
Processing poem 2: Test Author (2 lines)
Added translation: "This is a test line one" -> "这是测试行一"
Added translation: "This is a test line two" -> "这是测试行二"
Adding 2 new lines to poem text
Poem text updated. Total lines in poemLines: XX
Total translations: XX
```

#### 4.2 按 R 键手动刷新

控制台应该显示：
```
=== Manual refresh triggered ===
Refreshed poems from API: 2
Resetting all data structures...
Appending poems to source: 2
Processing poem 1: Pablo Neruda (X lines)
Processing poem 2: Test Author (2 lines)
...
=== Refresh complete ===
Total lines in currentPoemText: XX
Total lines in poemLines: XX
Total translations: XX
```

#### 4.3 验证转筒文本

在控制台执行：
```javascript
// 1. 检查 currentPoemText 是否包含测试诗句
console.log('Contains test line?', currentPoemText.includes('This is a test line one'));

// 2. 检查 poemLines 数组
console.log('poemLines includes test?', poemLines.some(l => l.includes('test')));

// 3. 检查 translationMap
console.log('Translation exists?', translationMap['This is a test line one']);

// 4. 检查 wordBoxes（转筒上的单词）
console.log('wordBoxes with "test":', wordBoxes.filter(b => b.text.toLowerCase().includes('test')));
```

**期望结果**：
- `currentPoemText.includes('This is a test line one')` → `true`
- `poemLines.some(l => l.includes('test'))` → `true`
- `translationMap['This is a test line one']` → `"这是测试行一"`
- `wordBoxes.filter(...)` → 应该找到包含 "test" 的单词

### 步骤 5：验证搜索功能

1. 在搜索框输入 `test`
2. 转筒应该停止
3. 包含 "test" 的单词应该高亮（黑色）
4. 其他单词应该淡化（灰色）

在控制台执行：
```javascript
// 触发搜索
searchInput.value = 'test';
searchInput.dispatchEvent(new Event('input'));

// 检查匹配结果
console.log('Matched words:', wordBoxes.filter(b => b.text.toLowerCase().includes('test')));
```

### 步骤 6：验证点击功能

1. 在转筒上找到单词 "test"
2. 点击它
3. 左侧面板应该显示完整句子：`This is a test line one`
4. 应该同时显示中文翻译：`这是测试行一`

---

## 🐛 常见问题排查

### 问题 1：控制台没有 "Processing poem" 日志

**原因**：数据未从 API 加载

**检查**：
1. API 是否返回正确数据（访问 `/.netlify/functions/poems`）
2. 控制台是否有网络错误
3. 是否看到 "Loaded poems: X" 日志

### 问题 2：日志显示 "No lines added from remote data"

**原因**：poems 数组为空或格式错误

**检查**：
```javascript
// 手动获取并检查
fetch('/.netlify/functions/poems')
  .then(r => r.json())
  .then(data => {
    console.log('API Data:', data);
    console.log('First poem:', data.poems[0]);
    console.log('Has lines?', Array.isArray(data.poems[0]?.lines));
  });
```

### 问题 3：搜索找不到新诗句

**原因**：wordBoxes 未更新

**检查**：
1. 按 R 键强制刷新
2. 控制台执行：
   ```javascript
   console.log('Total words on cylinder:', wordBoxes.length);
   console.log('Sample words:', wordBoxes.slice(0, 10).map(b => b.text));
   ```
3. 确认 `rebuildTextTextureAndMapping()` 被调用

### 问题 4：点击单词不显示翻译

**原因**：translationMap 未更新

**检查**：
```javascript
// 查看所有翻译
console.log('All translations:', Object.keys(translationMap));

// 查看特定翻译
console.log('Test translation:', translationMap['This is a test line one']);
```

### 问题 5：左侧面板显示但转筒没有

**原因**：面板和转筒使用不同数据源

**检查**：
1. 面板使用：API 数据 (`updateSidePanel`)
2. 转筒使用：`currentPoemText` 和 `wordBoxes`
3. 确认 `appendPoemsToSource` 被调用

---

## 🔧 强制完全刷新

如果数据不同步，执行以下步骤：

1. **清除浏览器缓存**：Ctrl+Shift+Delete
2. **硬刷新页面**：Ctrl+Shift+R
3. **按 R 键**：触发手动重新加载
4. **检查控制台**：查看所有日志输出

---

## 💡 调试命令

在控制台执行这些命令来检查状态：

```javascript
// 1. 查看当前文本长度
console.log('currentPoemText length:', currentPoemText?.length);

// 2. 查看总行数
console.log('poemLines count:', poemLines.length);

// 3. 查看翻译数量
console.log('translations count:', Object.keys(translationMap).length);

// 4. 查看转筒单词数量
console.log('wordBoxes count:', wordBoxes.length);

// 5. 搜索特定内容
const keyword = 'test';
console.log(`Lines with "${keyword}":`, 
  poemLines.filter(l => l.toLowerCase().includes(keyword))
);

// 6. 查看左侧面板内容
console.log('Side panel HTML:', sidePanel.innerHTML);

// 7. 手动触发数据加载
fetch('/.netlify/functions/poems')
  .then(r => r.json())
  .then(data => {
    console.log('Manual API fetch:', data);
    appendPoemsToSource(data);
    updateSidePanel(data);
  });
```

---

**最后更新**: 2025-10-07

