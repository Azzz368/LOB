export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return new Response("Missing text", { status: 400 });
    }

    const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";
    const response = await fetch(`${backendBaseUrl.replace(/\/$/, "")}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source: body?.source || "netlify",
        client_ts: body?.client_ts,
      }),
    });

    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("capture-poem error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || "capture failed",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};
