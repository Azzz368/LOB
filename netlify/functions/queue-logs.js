import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "GET") {
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
    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN,
    });

    const logs = (await store.get("queue-logs", { type: "json" })) || [];
    const list = Array.isArray(logs) ? logs : [];

    const grouped = {};
    for (const log of list) {
      const date = (log.created_at || "").slice(0, 10);
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    }

    return new Response(JSON.stringify(grouped), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("Queue logs error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};
