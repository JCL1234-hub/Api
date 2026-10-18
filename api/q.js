/**
 * Configuration Resolver
 * Reads all runtime configs from process.env with safe production defaults.
 */
function getConfig() {
  const aiName = process.env.AI_NAME || "Tech with app ai";
  const defaultPrompt = `You are ${aiName}, a helpful AI assistant. Respond clearly, concisely, and accurately.`;

  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    aiName: aiName,
    model: process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free",
    systemPrompt: process.env.SYSTEM_PROMPT || defaultPrompt,
    maxTokens: parseInt(process.env.MAX_TOKENS, 10) || 1000,
    temperature: !isNaN(parseFloat(process.env.TEMPERATURE))
      ? parseFloat(process.env.TEMPERATURE)
      : 0.7,
    timeoutMs: 25000 // 25 seconds timeout for serverless lifecycle
  };
}

/**
 * Standardized JSON Response Helper
 */
function sendResponse(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(data));
}

/**
 * Main Vercel Serverless Function Handler
 */
export default async function handler(req, res) {
  // 1. CORS Preflight Support
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // 2. Reject unsupported HTTP methods
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendResponse(res, 405, {
      success: false,
      error: "Invalid request. Method not allowed. Use GET."
    });
  }

  // 3. Extract and parse query parameters securely
  let question;
  try {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const url = new URL(req.url, `${protocol}://${host}`);
    question = url.searchParams.get("q");
  } catch (err) {
    return sendResponse(res, 400, {
      success: false,
      error: "Invalid request."
    });
  }

  // 4. Validate presence of the question parameter
  if (question === null || question === undefined) {
    return sendResponse(res, 400, {
      success: false,
      error: "Please provide a question using the q parameter."
    });
  }

  // Normalize Unicode text (handles Bengali, Arabic, emojis, etc.)
  const trimmedQuestion = question.normalize("NFC").trim();

  // Reject empty question strings
  if (trimmedQuestion.length === 0) {
    return sendResponse(res, 400, {
      success: false,
      error: "Please provide a question using the q parameter."
    });
  }

  // Enforce 4,000 character upper limit
  if (trimmedQuestion.length > 4000) {
    return sendResponse(res, 400, {
      success: false,
      error: "Question exceeds maximum limit of 4000 characters."
    });
  }

  // 5. Check and resolve server configuration
  const config = getConfig();

  if (!config.apiKey) {
    // Hidden from public responses; logged server-side only
    console.error("Critical Configuration Error: OPENROUTER_API_KEY environment variable is not defined.");
    return sendResponse(res, 500, {
      success: false,
      error: "AI service configuration error."
    });
  }

  // 6. Execute Request to OpenRouter
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.com",
        "X-Title": config.aiName
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: config.systemPrompt
          },
          {
            role: "user",
            content: trimmedQuestion
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Rate Limited by OpenRouter
    if (response.status === 429) {
      return sendResponse(res, 429, {
        success: false,
        error: "Rate limit exceeded. Please try again shortly."
      });
    }

    // Upstream OpenRouter Failure
    if (!response.ok) {
      console.error(`OpenRouter returned HTTP status ${response.status}`);
      return sendResponse(res, 502, {
        success: false,
        error: "AI service is temporarily unavailable."
      });
    }

    // Parse JSON response safely
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("Failed to parse upstream response JSON:", parseError);
      return sendResponse(res, 502, {
        success: false,
        error: "AI service is temporarily unavailable."
      });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string") {
      console.error("OpenRouter payload missing choices[0].message.content:", data);
      return sendResponse(res, 502, {
        success: false,
        error: "AI service returned an invalid response."
      });
    }

    // 7. Successful Response
    return sendResponse(res, 200, {
      success: true,
      ai: config.aiName,
      question: trimmedQuestion,
      answer: answer.trim(),
      model: config.model
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return sendResponse(res, 504, {
        success: false,
        error: "Request timed out while waiting for AI response."
      });
    }

    console.error("Network or internal error encountered:", error.message);
    return sendResponse(res, 503, {
      success: false,
      error: "AI service is temporarily unavailable."
    });
  }
}
