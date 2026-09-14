
require("dotenv").config();

const AI_API_BASE_URL =
    process.env.AI_API_BASE_URL ||
    "https://api.groq.com/openai/v1/chat/completions";

const AI_API_KEY = process.env.AI_API_KEY || null;

const AI_MODEL = process.env.AI_MODEL || "openai/gpt-oss-20b";

const config = {
    AI_API_BASE_URL,
    AI_API_KEY,
    AI_MODEL,


    AI_TEMPERATURE: Number(process.env.AI_TEMPERATURE ?? 0.2),

    AI_MAX_OUTPUT_TOKENS: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 700),

    // مهلة كل طلب لمزوّد الـ AI (مللي ثانية)
    AI_REQUEST_TIMEOUT_MS: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000),

    // أقصى عدد محاولات إعادة عند فشل/تحديد معدل (rate limit)
    AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES ?? 4),

    // أقصى عدد "جولات" استخدام أدوات (tool calls) قبل إجبار الموديل
    // على الرد النهائي — يمنع أي حلقة لا نهائية أو استغلال مقصود.
    AI_MAX_TOOL_ROUNDS: Number(process.env.AI_MAX_TOOL_ROUNDS ?? 3),

    // أقصى عدد نتائج يرجعها أي بحث في المنتجات/الأقسام في المرة الواحدة
    AI_MAX_SEARCH_RESULTS: Math.min(
        Number(process.env.AI_MAX_SEARCH_RESULTS ?? 12),
        20
    ),

    MAX_USER_MESSAGE_LENGTH: 800,
    MAX_HISTORY_MESSAGES: 6,
    MAX_HISTORY_MESSAGE_LENGTH: 500,

    STORE_NAME: process.env.STORE_NAME || "المتجر",
    STORE_URL: process.env.STORE_URL || "http://localhost:3000",

    RATE_LIMIT_WINDOW_MS: Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? 60000),
    RATE_LIMIT_MAX_REQUESTS: Number(process.env.AI_RATE_LIMIT_MAX ?? 20),
};

if (!config.AI_API_KEY) {
    console.warn(
        "[ai_assistant.config] Warning: AI_API_KEY is not present in the environment." +
        "The smart assistant will operate in fallback mode only."
    );
}

module.exports = config;