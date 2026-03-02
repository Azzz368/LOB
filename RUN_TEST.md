# Local Test Environment (Entropy Loop)

## 1) Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

## 2) Start databases (optional)

This test client uses SQLite only, so no database services are required.
(You can still run `docker-compose up -d` if you need Postgres/Redis for other modules.)

## 3) Run the local test server

```bash
cd backend
uvicorn test_main:app --reload --port 8000
```

Then open:
- http://localhost:8000
- http://localhost:8000/admin.html

WebSocket endpoint:
- ws://localhost:8000/ws/visuals

Submit endpoint:
- POST http://localhost:8000/submit

Queue logs endpoint:
- GET http://localhost:8000/queue-logs
