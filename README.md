# Tech with app ai - Serverless Chatbot API

A high-performance, stateless AI Chatbot API built with pure Node.js (JavaScript ES Modules) designed for zero-config deployment on Vercel Serverless Functions. It integrates with OpenRouter's Unified API to deliver AI-generated completions over standard HTTP GET queries.

---

## 1. Project Structure

```text
├── api/
│   ├── q.js         # Main chatbot endpoint (GET /api/q?q=...)
│   └── status.js    # Health status endpoint (GET /api/status)
├── package.json     # Node.js project manifest (ES Modules)
├── vercel.json      # Vercel serverless routing and HTTP security headers
└── README.md        # Deployment and usage documentation