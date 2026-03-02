# Library of Babel - 

📝 LICENSE

MIT License
**主视觉入口**: https://entropybabel.art  
**投稿入口**: https://entropybabel.art/submit.html  

## 本地开发：语言侦测与入库

后端服务位于 `backend/`，提供 `/ingest` 接口负责语言识别与入库。

### 1) 启动数据库与缓存

```bash
docker-compose up -d
```

### 2) 安装后端依赖并启动服务

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### 3) 调用示例

```bash
curl -X POST http://localhost:8000/ingest \
	-H "Content-Type: application/json" \
	-d '{"text":"Leaning into the afternoons I cast my sad nets.","source":"local"}'
```

### 4) 环境变量

请参考根目录 `.env.example`，最少需要配置 `DATABASE_URL` 与 `REDIS_URL`。

## 导出 Netlify Blobs 到本地 JSON（用于首次测试）

需要在环境里提供 `SITE_ID` 和 `NETLIFY_TOKEN`（可在 Netlify Site settings 里找到/创建）。

```bash
npm run export:blobs
```

导出结果会写入 `data/netlify-submissions.json` 与 `data/netlify-poems.json`，
便于后续对词性拆解/重组流程进行离线测试。
