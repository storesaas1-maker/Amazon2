const express = require("express");
const rateLimit = require("express-rate-limit");

const ai_assistant = require("../controller/ai_assistant.controller");
const config = require("../config/ai_assistant.config");

const router = express.Router();

/**
 * حد لعدد الطلبات لكل IP على مسار المساعد الذكي فقط.
 * ده مهم جدًا لأن كل طلب هنا بيكلف استدعاء AI حقيقي (وربما فلوس)،
 * فلازم نمنع أي إساءة استخدام أو استنزاف (abuse) من عنوان واحد.
 *
 * ملاحظة: يتطلب تثبيت المكتبة أولًا:
 *   npm install express-rate-limit
 */
const aiAssistantRateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "طلبات كثيرة جدًا خلال فترة قصيرة. من فضلك حاول مرة أخرى بعد قليل.",
        data: [],
    },
});

// نقطة عامة — أي زائر (مسجل دخول أو لأ) ممكن يستخدم المساعد الذكي.
// المسار مقصور فقط على المنتجات والأقسام؛ لا وصول لأي بيانات مستخدمين
// أو إعدادات نظام من هنا (راجع ai_assistant.tools.js).
router.post("/api/ai_assistant", aiAssistantRateLimiter, ai_assistant);

module.exports = router;