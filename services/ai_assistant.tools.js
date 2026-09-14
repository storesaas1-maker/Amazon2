/**
 * ai_assistant.tools.js
 * ------------------------------------------------------------------
 * هذا الملف هو "بوابة" وصول الموديل الذكي إلى قاعدة البيانات.
 *
 * قاعدة أمنية أساسية:
 * الموديل لا يلمس Mongo مباشرة أبدًا. هو فقط يطلب استدعاء دالة
 * باسم محدد ومعاملات محددة (JSON Schema)، ونحن اللي نبني استعلام
 * Mongo يدويًا حقل-بحقل. الموديل لا يقدر أبدًا يمرر فلتر Mongo خام
 * ({...}) ولا اسم Collection يختاره بنفسه — ده اللي بيمنع أي محاولة
 * NoSQL injection أو محاولة الوصول لبيانات غير مصرح بيها.
 *
 * كل استعلام يستخدم "قائمة سماح" (whitelist projection) للحقول
 * المرتجعة، مش "قائمة منع" — يعني حتى لو حد ضاف حقل حساس جديد
 * لموديل المنتج مستقبلًا (تكلفة الشراء، المورد، ملاحظات داخلية...)
 * فهو تلقائيًا مش هيترجع أبدًا في رد المساعد الذكي.
 *
 * الـ Collections المسموح الوصول لها هنا فقط: products, section, store.
 * "store" هنا معناها فقط بيانات المتجر العامة (الاسم، الوصف، بيانات
 * التواصل) — مش إعدادات النظام أو حسابات المستخدمين. ممنوع تمامًا
 * استيراد أو استخدام أي موديل تاني (users, admins, orders...) من
 * داخل هذا الملف.
 * ------------------------------------------------------------------
 */

const products = require("../models/products");
const section = require("../models/section");
const store = require("../models/store");
const config = require("../config/ai_assistant.config");

// ====================================================================
// أدوات مساعدة للأمان
// ====================================================================

/**
 * تهريب (escape) الرموز الخاصة بالـ Regex حتى لا يقدر أي نص يدخله
 * العميل (أو الموديل) أن يُستخدم كتعبير نمطي خطير أو مكلف الأداء.
 */
function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampNumber(value, { min, max, fallback }) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
}

function safeString(value, maxLength = 120) {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// قائمة السماح الوحيدة للحقول اللي ممكن ترجع عن أي منتج.
// أي حقل تاني موجود في الموديل (سعر التكلفة، المورد، صاحب الإدخال...)
// لن يظهر أبدًا مهما كان اسمه، لأننا بنستخدم select() صريح.
const PRODUCT_PUBLIC_FIELDS =
    "name description price final_price discount quantity section image";

const SECTION_PUBLIC_FIELDS = "name description slug";

// حقول متجر عامة فقط (اسم/وصف/تواصل) — لاحظ إننا استبعدنا store_design
// عمدًا: ده كائن إعدادات تصميم داخلي (ألوان/تخطيط...) مالوش أي داعي
// يوصل للموديل الذكي، ومفيش أي حقل حساس هنا أصلًا.
const STORE_PUBLIC_FIELDS =
    "store_name store_description store_phone store_whatsApp_number store_GPS";

function toPublicStore(s) {
    if (!s) return null;
    return {
        name: safeString(s.store_name, 120),
        description: safeString(s.store_description, 300),
        phone: safeString(s.store_phone, 30),
        whatsapp: safeString(s.store_whatsApp_number, 30),
        location: safeString(s.store_GPS, 150),
    };
}

function toPublicProduct(p) {
    if (!p) return null;

    const inStock =
        typeof p.quantity === "number" ? p.quantity > 0 : undefined;

    return {
        name: safeString(p.name, 120) || "منتج",
        description: safeString(p.description, 220),
        price: p.price ?? null,
        final_price: p.final_price ?? p.price ?? null,
        discount: p.discount || 0,
        section: p.section && p.section.name ? safeString(p.section.name, 60) : null,
        in_stock: inStock,
    };
}

function toPublicSection(s) {
    if (!s) return null;
    return {
        name: safeString(s.name, 80),
        description: safeString(s.description, 200),
    };
}

// ====================================================================
// تعريفات الأدوات (Function/Tool schemas) — بصيغة OpenAI-compatible
// المتوافقة مع Groq API
// ====================================================================

const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "search_products",
            description:
                "ابحث في منتجات المتجر الحالية (اسم/وصف/سعر/قسم/توفر). " +
                "استخدم هذه الأداة دائمًا قبل الرد على أي سؤال عن منتج أو سعر " +
                "أو توفر، بدلًا من التخمين أو الاعتماد على الذاكرة.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "كلمة أو عبارة للبحث في اسم أو وصف المنتج. اتركه فارغًا لعرض منتجات عامة.",
                    },
                    section_name: {
                        type: "string",
                        description: "اسم القسم لتصفية المنتجات (اختياري).",
                    },
                    max_price: {
                        type: "number",
                        description: "أعلى سعر مقبول (اختياري).",
                    },
                    min_price: {
                        type: "number",
                        description: "أقل سعر مقبول (اختياري).",
                    },
                    in_stock_only: {
                        type: "boolean",
                        description: "أعرض فقط المنتجات المتوفرة بالمخزون (اختياري).",
                    },
                    limit: {
                        type: "number",
                        description: `أقصى عدد نتائج (الافتراضي والحد الأقصى ${config.AI_MAX_SEARCH_RESULTS}).`,
                    },
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_sections",
            description:
                "اجلب قائمة كل أقسام المتجر المتاحة حاليًا. استخدمها عند سؤال العميل عن الأقسام/الفئات.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_store_info",
            description:
                "اجلب معلومات المتجر العامة (الاسم، الوصف، رقم الهاتف، الواتساب، الموقع). " +
                "استخدمها عند سؤال العميل عن اسم المتجر أو طريقة التواصل معه أو موقعه.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
];

// أسماء الأدوات المسموح تنفيذها فعليًا — أي اسم غير موجود هنا
// (حتى لو الموديل اخترعه) يُرفض فورًا.
const ALLOWED_TOOL_NAMES = new Set(
    TOOL_DEFINITIONS.map(t => t.function.name)
);

// ====================================================================
// تنفيذ الأدوات الفعلي — الاستعلامات الآمنة على Mongo
// ====================================================================

async function executeSearchProducts(rawArgs) {
    const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

    const limit = clampNumber(args.limit, {
        min: 1,
        max: config.AI_MAX_SEARCH_RESULTS,
        fallback: config.AI_MAX_SEARCH_RESULTS,
    });

    // نبني الفلتر يدويًا حقل بحقل — الموديل لا يمرر فلتر Mongo أبدًا
    const filter = {};

    const query = safeString(args.query, 80);
    if (query) {
        const safePattern = escapeRegex(query);
        filter.$or = [
            { name: { $regex: safePattern, $options: "i" } },
            { description: { $regex: safePattern, $options: "i" } },
        ];
    }

    const minPrice = Number(args.min_price);
    const maxPrice = Number(args.max_price);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        filter.price = {};
        if (Number.isFinite(minPrice)) filter.price.$gte = Math.max(minPrice, 0);
        if (Number.isFinite(maxPrice)) filter.price.$lte = Math.max(maxPrice, 0);
    }

    if (args.in_stock_only === true) {
        filter.quantity = { $gt: 0 };
    }

    let query_ = products
        .find(filter)
        .select(PRODUCT_PUBLIC_FIELDS)
        .populate("section", "name")
        .limit(limit)
        .lean();

    let results = await query_;

    // تصفية إضافية باسم القسم بعد الـ populate (القسم اتخزن كـ ObjectId)
    const sectionName = safeString(args.section_name, 60).toLowerCase();
    if (sectionName) {
        results = results.filter(
            p =>
                p.section &&
                p.section.name &&
                String(p.section.name).toLowerCase().includes(sectionName)
        );
    }

    return {
        count: results.length,
        products: results.map(toPublicProduct),
    };
}

async function executeGetSections() {
    const results = await section
        .find({})
        .select(SECTION_PUBLIC_FIELDS)
        .limit(50)
        .lean();

    return {
        count: results.length,
        sections: results.map(toPublicSection),
    };
}

async function executeGetStoreInfo() {
    // مجموعة "store" عادة بتحتوي على وثيقة واحدة بس (إعدادات المتجر
    // العامة)، فبنجيبها بـ findOne بدل find، وبنفس مبدأ قائمة السماح
    // اللي بيمنع رجوع أي حقل غير مدرج صراحة في STORE_PUBLIC_FIELDS.
    const result = await store
        .findOne({})
        .select(STORE_PUBLIC_FIELDS)
        .lean();

    if (!result) {
        return { error: "لا توجد معلومات متجر مسجلة حاليًا." };
    }

    return { store: toPublicStore(result) };
}

/**
 * نقطة التنفيذ الموحّدة والوحيدة لأي "tool call" قادم من الموديل.
 * أي اسم أداة غير مُدرج في ALLOWED_TOOL_NAMES يُرفض برسالة خطأ
 * تُرجع للموديل نفسه (مش تنفيذ صامت) حتى يصحّح تصرفه.
 */
async function executeTool(name, rawArguments) {
    if (!ALLOWED_TOOL_NAMES.has(name)) {
        return { error: `الأداة "${name}" غير مسموح بها.` };
    }

    let args = {};
    try {
        args = rawArguments ? JSON.parse(rawArguments) : {};
    } catch (_) {
        args = {};
    }

    try {
        switch (name) {
            case "search_products":
                return await executeSearchProducts(args);
            case "get_sections":
                return await executeGetSections();
            case "get_store_info":
                return await executeGetStoreInfo();
            default:
                return { error: "أداة غير معروفة." };
        }
    } catch (error) {
        console.log(`[ai_assistant.tools] فشل تنفيذ ${name}:`, error.message);
        return { error: "حدث خطأ أثناء تنفيذ البحث في قاعدة البيانات." };
    }
}

module.exports = {
    TOOL_DEFINITIONS,
    ALLOWED_TOOL_NAMES,
    executeTool,
    // مُصدَّرة أيضًا لاستخدامها في الرد الاحتياطي (fallback) بنفس معايير الأمان
    executeSearchProducts,
    executeGetSections,
    executeGetStoreInfo,
    toPublicProduct,
    toPublicSection,
    toPublicStore,
};