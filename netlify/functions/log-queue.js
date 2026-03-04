import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization");
  const adminPassword =
    process.env.ADMIN_PASSWORD || process.env.NETLIFY_ADMIN_PASSWORD || "admin123";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.substring(7);
  if (token !== adminPassword) {
    return new Response("Invalid password", { status: 403 });
  }

  try {
    const entry = await req.json();
    if (!entry || !entry.event_type || !entry.message || !entry.created_at) {
      return new Response("Missing required fields", { status: 400 });
    }

    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN,
    });

    const existing = (await store.get("queue-logs", { type: "json" })) || [];
    const logs = Array.isArray(existing) ? existing : [];
    logs.unshift(entry);

    const maxLogs = Number(process.env.NETLIFY_LOG_MAX || 500);
    const trimmed = logs.slice(0, maxLogs);

    await store.setJSON("queue-logs", trimmed);

    return new Response(JSON.stringify({ success: true, count: trimmed.length }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("Log queue error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};
