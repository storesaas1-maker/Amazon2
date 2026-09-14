const NodeCache = require("node-cache");
const redis = require("../config/redis");

// ==============================
// Shared cache (Redis) with local fallback (node-cache)
// ==============================
// إذا كان REDIS_URL موجود في الـ Environment Variables، كل عمليات
// الكاش بتتوجه لـ Redis، اللي بيبقى shared بين كل PM2 workers (وبين
// أكتر من instance لو حصل scale-out). حذف/تحديث مفتاح في Redis
// بيبقى مرئي فورًا لكل الـ workers، فمش محتاجين ننسخ الداتا بين
// الـ workers ولا نستخدم Pub/Sub: مفيش نسخة محلية للكاش يحتاج
// نبلغها إنها بقت قديمة، لأن كل worker بيقرا من نفس المصدر (Redis)
// في كل مرة.
//
// لو REDIS_URL مش موجود، بيتم استخدام node-cache المحلي القديم
// كـ fallback بالظبط زي ما كان قبل كده - مناسب فقط لما السيرفر شغال
// على process/instance واحد.
//
// لو Redis مُفعّل بس اتقطع فجأة، إحنا عمدًا مش بنرجع لـ node-cache
// المحلي، عشان كده هيخلي كل worker يخزن نسخة مختلفة ويحصل تضارب.
// بدل كده، أي عملية Redis تفشل بتترجم لـ "cache miss" والكود اللي
// بينادي عليها بيكمل عادي من MongoDB لحد ما Redis يرجع.
//
// FIX (root cause of the mass ETIMEDOUT seen in the load test on
// /api/get_products, /api/get_store_settings و /api/get_all_sections):
// الكود القديم هنا كان بيتحقق من isRedisConfigured() بس (يعني "فيه
// كائن Redis client اتعمل له new")، مش من إنه فعلاً متصل وجاهز. لما
// Redis بيكون لسه بيتصل / بيعمل reconnect، isRedisConfigured() برضه
// بيرجع true، فكان الكود بينادي redis.client.get()/.set() فعليًا -
// واللي مع الإعدادات الافتراضية لـ ioredis (enableOfflineQueue) كان
// بيفضل معلّق (queued) جوه العميل لحد ما الاتصال يخلص أو الـ
// connectTimeout يخلص (كان 10 ثواني بالظبط زي أعلى قيم p99/p999 في
// التقرير). دلوقتي بنتأكد من isRedisReady() الأول: لو Redis مش جاهز
// فعليًا، بنعتبرها cache miss على طول من غير ما ننده على الـ client
// خالص - يعني من غير أي تأخير - وبرضه من غير ما نلجأ لـ node-cache
// المحلي (عشان نفضل ملتزمين بنفس القرار اللي فوق: مش هنسيب كل
// worker يخزن نسخة مختلفة لما Redis يكون هو المفروض المصدر المشترك).
const NAMESPACE = "cache:";

const DEFAULT_TTL_SECONDS = 300; // 5 دقائق (زي الإعداد الأصلي)

const localCache = new NodeCache({
    stdTTL: DEFAULT_TTL_SECONDS,
    checkperiod: 60,      // بيدور كل 60 ثانية على الـ keys المنتهية ويمسحها
    useClones: false      // أداء أفضل، بس خلي بالك متعدلش الـ object اللي بيرجعلك من get() مباشرة
});

function namespacedKey(key) {
    return `${NAMESPACE}${key}`;
}

/**
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function get(key) {

    if (redis.isRedisConfigured()) {

        // FIX: fail fast instead of letting a not-yet-ready client
        // hang the request - see note above.
        if (!redis.isRedisReady()) {
            return null;
        }

        try {
            const raw = await redis.client.get(namespacedKey(key));
            return raw === null ? null : JSON.parse(raw);
        } catch (err) {
            console.error("cache.get (redis) error:", err.message);
            // Redis غير متاح حاليًا: نعتبرها cache miss ونسيب الكود
            // اللي بينادي يكمل من MongoDB بدل ما ننهار.
            return null;
        }
    }

    try {
        const value = localCache.get(key);
        return value === undefined ? null : value;
    } catch (err) {
        console.error("cache.get (local) error:", err.message);
        return null; // لو حصل أي خطأ، نرجع null عشان الكود يكمل من الداتابيز عادي
    }
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {

    if (redis.isRedisConfigured()) {

        // FIX: same fail-fast reasoning as in get() above.
        if (!redis.isRedisReady()) {
            return false;
        }

        try {
            await redis.client.set(
                namespacedKey(key),
                JSON.stringify(value),
                "EX",
                ttlSeconds
            );
            return true;
        } catch (err) {
            console.error("cache.set (redis) error:", err.message);
            return false;
        }
    }

    try {
        localCache.set(key, value, ttlSeconds);
        return true;
    } catch (err) {
        console.error("cache.set (local) error:", err.message);
        return false;
    }
}

/**
 * مسح مفتاح واحد (مفيد بعد تعديل/حذف منتج معين)
 * @param {string} key
 */
async function del(key) {

    if (redis.isRedisConfigured()) {

        // FIX: same fail-fast reasoning as in get() above.
        if (!redis.isRedisReady()) {
            return;
        }

        try {
            await redis.client.del(namespacedKey(key));
        } catch (err) {
            console.error("cache.del (redis) error:", err.message);
        }
        return;
    }

    try {
        localCache.del(key);
    } catch (err) {
        console.error("cache.del (local) error:", err.message);
    }
}

/**
 * مسح كل المفاتيح اللي بتبدأ بـ prefix معين
 * (مفيد بعد إضافة/تعديل منتج عشان نمسح كل صفحات "products:page=*")
 * @param {string} prefix
 */
async function delByPrefix(prefix) {

    if (redis.isRedisConfigured()) {

        // FIX: same fail-fast reasoning as in get() above.
        if (!redis.isRedisReady()) {
            return;
        }

        try {
            const pattern = `${namespacedKey(prefix)}*`;
            let cursor = "0";

            // SCAN بدل KEYS عشان ميعملش block لـ Redis مع كمية
            // مفاتيح كبيرة (SCAN بيمشي على دفعات صغيرة وآمنة).
            do {
                const [nextCursor, keys] = await redis.client.scan(
                    cursor,
                    "MATCH",
                    pattern,
                    "COUNT",
                    100
                );

                cursor = nextCursor;

                if (keys.length) {
                    await redis.client.del(...keys);
                }
            } while (cursor !== "0");
        } catch (err) {
            console.error("cache.delByPrefix (redis) error:", err.message);
        }
        return;
    }

    try {
        const matchingKeys = localCache
            .keys()
            .filter((key) => key.startsWith(prefix));

        if (matchingKeys.length) {
            localCache.del(matchingKeys);
        }
    } catch (err) {
        console.error("cache.delByPrefix (local) error:", err.message);
    }
}

/**
 * مسح الكاش بالكامل (كل المفاتيح اللي احنا خزناها بس، مش الـ Redis
 * instance كله - آمن حتى لو الـ instance ده متشارك مع حاجة تانية)
 */
async function flushAll() {
    await delByPrefix("");
}

module.exports = {
    get,
    set,
    del,
    delByPrefix,
    flushAll,
    client: redis.client
};