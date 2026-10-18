/**
 * Status Verification Endpoint
 * GET /api/status
 */
export default function handler(req, res) {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // Enforce GET method
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        success: false,
        error: "Method not allowed. Use GET."
      })
    );
  }

  const aiName = process.env.AI_NAME || "Tech with app ai";

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(
    JSON.stringify({
      success: true,
      status: "online",
      ai: aiName,
      provider: "OpenRouter",
      api: "Chat API"
    })
  );
}