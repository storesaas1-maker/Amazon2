/**
 * ai_assistant.ai-client.js
 * ------------------------------------------------------------------
 * كل ما يخص التواصل الفعلي مع مزوّد الـ AI:
 * - طابور تنفيذ (queue) لمنع تعدد الطلبات في نفس اللحظة.
 * - إعادة محاولة ذكية عند rate limit / أخطاء سيرفر / timeout.
 * - حلقة استخدام الأدوات (tool-calling loop) اللي بتخلي الموديل
 *   يقدر "يبحث" في المنتجات والأقسام أثناء توليد الرد، بدل ما
 *   نحقن كل البيانات مقدمًا في الرسالة الأولى.
 * ------------------------------------------------------------------
 */

const config = require("../config/ai_assistant.config");
const { TOOL_DEFINITIONS, executeTool } = require("./ai_assistant.tools");

// ====================================================================
// طابور تنفيذ طلب واحد في نفس الوقت (يقلل جدًا من rate limit)
// ====================================================================

let aiRequestRunning = false;
const aiWaitingQueue = [];

function runAIRequest(task) {
    return new Promise((resolve, reject) => {
        aiWaitingQueue.push({ task, resolve, reject });
        processAIQueue();
    });
}

async function processAIQueue() {
    if (aiRequestRunning) return;

    const item = aiWaitingQueue.shift();
    if (!item) return;

    aiRequestRunning = true;
    try {
        const result = await item.task();
        item.resolve(result);
    } catch (error) {
        item.reject(error);
    } finally {
        aiRequestRunning = false;
        setTimeout(processAIQueue, 100);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * قيم HTTP headers لازم تكون ASCII/Latin-1 فقط (مواصفة الـ Fetch API).
 * لو STORE_NAME أو STORE_URL متحطين بحروف عربية، الطلب كان بيفشل بالكامل
 * برسالة "Cannot convert argument to a ByteString...". هنا بنشيل أي حرف
 * غير ASCII بدل ما نخلي القيمة تكسر الطلب.
 */
function toAsciiHeaderValue(value, fallback) {
    const cleaned = String(value || "").replace(/[^\x20-\x7E]/g, "").trim();
    return cleaned || fallback;
}

function getRetryDelay(errorText, attempt) {
    const match = String(errorText || "").match(/try again in\s+([\d.]+)s/i);

    if (match) {
        const seconds = parseFloat(match[1]);
        if (Number.isFinite(seconds) && seconds > 0) {
            return Math.min((seconds + 1) * 1000, 30000);
        }
    }

    const delays = [2000, 5000, 10000, 20000];
    return delays[Math.min(attempt, delays.length - 1)];
}

// ====================================================================
// استدعاء واحد لمزوّد الـ AI مع Retry
// ====================================================================

async function callAIOnce(messages) {
    let lastError = null;

    for (let attempt = 0; attempt < config.AI_MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            config.AI_REQUEST_TIMEOUT_MS
        );

        try {
            const response = await fetch(config.AI_API_BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.AI_API_KEY}`,
                    "HTTP-Referer": toAsciiHeaderValue(config.STORE_URL, "http://localhost:3000"),
                    "X-Title": `${toAsciiHeaderValue(config.STORE_NAME, "Store")} AI Assistant`,
                },
                body: JSON.stringify({
                    model: config.AI_MODEL,
                    messages,
                    tools: TOOL_DEFINITIONS,
                    tool_choice: "auto",
                    temperature: config.AI_TEMPERATURE,
                    max_tokens: config.AI_MAX_OUTPUT_TOKENS,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);
            const responseText = await response.text();

            if (response.ok) {
                try {
                    return JSON.parse(responseText);
                } catch (_) {
                    throw new Error("Invalid AI JSON response");
                }
            }

            const isRateLimited =
                response.status === 429 ||
                responseText.includes("rate_limit_exceeded") ||
                responseText.includes("Rate limit reached");

            const isServerError = [500, 502, 503, 504].includes(response.status);

            if (isRateLimited || isServerError) {
                const delay = getRetryDelay(responseText, attempt);
                console.log(
                    `[ai_assistant.ai-client] ${
                        isRateLimited ? "Rate limit" : "Server error " + response.status
                    }. Retry ${attempt + 1}/${config.AI_MAX_RETRIES} after ${delay}ms`
                );
                lastError = new Error(`AI provider error ${response.status}`);
                await sleep(delay);
                continue;
            }

            console.log("[ai_assistant.ai-client] Unrecoverable provider error:", responseText);
            throw new Error(`AI provider returned ${response.status}`);
        } catch (error) {
            clearTimeout(timeout);
            lastError = error;

            const isRetryable =
                error.name === "AbortError" ||
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.code === "ECONNREFUSED" ||
                error.message?.includes("fetch failed");

            if (isRetryable) {
                const delay = getRetryDelay("", attempt);
                console.log(
                    `[ai_assistant.ai-client] Network error. Retry ${attempt + 1}/${config.AI_MAX_RETRIES}`
                );
                await sleep(delay);
                continue;
            }

            break;
        }
    }

    throw lastError || new Error("AI request failed");
}

// ====================================================================
// حلقة المحادثة الكاملة مع دعم استخدام الأدوات (tool calling)
// ====================================================================
//
// الفكرة: بدل ما نحقن كل المنتجات والأقسام في الرسالة الأولى (وده
// غير عملي ولا يتوسّع مع نمو المتجر)، الموديل بيقدر دلوقتي "يطلب"
// بحث فعلي في قاعدة البيانات وقت الحاجة، ونحن ننفّذ البحث بأمان
// (عبر ai_assistant.tools.js) ونرجّع له النتائج، ثم يكمل توليد الرد.
//
async function runConversation(initialMessages) {
    const messages = [...initialMessages];

    for (let round = 0; round < config.AI_MAX_TOOL_ROUNDS; round++) {
        const result = await runAIRequest(() => callAIOnce(messages));

        const choice = result?.choices?.[0];
        const message = choice?.message;

        if (!message) {
            throw new Error("AI returned empty response");
        }

        const toolCalls = message.tool_calls;

        // لا توجد أداة مطلوبة => هذا هو الرد النهائي
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
            const reply = typeof message.content === "string" ? message.content.trim() : "";
            if (!reply) {
                throw new Error("AI returned empty response");
            }
            return { reply, usedTools: round > 0 };
        }

        // نضيف رسالة الموديل (اللي فيها طلب الأداة) للسياق
        messages.push(message);

        // ننفذ كل الأدوات المطلوبة بأمان، وترجع نتيجة كل واحدة كرسالة "tool"
        for (const call of toolCalls) {
            const toolResult = await executeTool(
                call.function?.name,
                call.function?.arguments
            );

            messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
            });
        }
        // نكمل اللفة التالية ليقرأ الموديل نتائج الأدوات ويكمل
    }

    // لو الموديل فضل يطلب أدوات أكتر من الحد المسموح، نجبره على رد نهائي
    // نصّي بدون أدوات في محاولة أخيرة
    const finalAttempt = await runAIRequest(() =>
        callAIOnce([
            ...messages,
            {
                role: "user",
                content:
                    "من فضلك أعطني الآن ردًا نهائيًا مختصرًا بناءً على المعلومات المتوفرة لديك فقط.",
            },
        ])
    );

    const finalReply = finalAttempt?.choices?.[0]?.message?.content?.trim();

    if (!finalReply) {
        throw new Error("AI returned empty response after tool rounds");
    }

    return { reply: finalReply, usedTools: true };
}

module.exports = {
    runConversation,
};