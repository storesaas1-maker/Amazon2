/**
 * config/redis.js
 * ------------------------------------------------------------------
 * Optional shared Redis client used by utils/cache.js as a shared
 * cache between PM2 cluster workers.
 *
 * Behaviour:
 *  - REDIS_URL set      -> connect to Redis, used as the shared cache.
 *  - REDIS_URL not set  -> client stays null. utils/cache.js falls
 *                          back to a local, per-process node-cache.
 *                          That fallback is only safe for a single
 *                          process (no PM2 cluster mode, no multiple
 *                          instances/dynos).
 *
 * If Redis IS configured but becomes unreachable at runtime, we do
 * NOT silently switch to the local cache: with several PM2 workers
 * that would let each worker cache different data and disagree with
 * each other. Instead utils/cache.js treats every failed Redis call
 * as a cache miss and lets callers fall through to MongoDB, which
 * stays correct even if slower until Redis comes back.
 * ------------------------------------------------------------------
 */

require("dotenv").config();

const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL;

let client = null;

if (REDIS_URL) {

    client = new Redis(REDIS_URL, {
        // Don't let a stuck Redis hang API requests forever - fail
        // fast so callers can fall back to MongoDB instead.
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,

        // FIX (root cause of the mass ETIMEDOUT on get_products /
        // get_store_settings / get_all_sections in the load test):
        // ioredis's default connectTimeout is 10000ms, and by default
        // it QUEUES commands issued while the connection isn't ready
        // (enableOfflineQueue: true) instead of rejecting them right
        // away. That meant every cache.get()/cache.set() call issued
        // while Redis was still connecting/reconnecting sat waiting
        // for up to ~10s before failing - which is exactly the p99/
        // p999 (~9999ms) and timeout spike seen only on the three
        // cache-backed endpoints. A short connectTimeout plus
        // disabling the offline queue makes any command fail
        // immediately when Redis isn't ready, instead of hanging.
        connectTimeout: 2000,
        enableOfflineQueue: false,

        // FIX (load-test root cause on get_products / get_store_settings /
        // get_all_sections / post_review / add_problem - the exact set of
        // endpoints that go through utils/cache.js): connectTimeout above
        // only bounds the initial handshake. Once the client IS connected
        // and "ready", ioredis has NO default limit on how long it will
        // wait for a reply to an individual command (GET/SET/SCAN/DEL) -
        // if the Redis server itself is slow or overloaded under
        // concurrent load (shared/free-tier instance, network latency,
        // etc.), those commands can hang far longer than the few ms they
        // normally take, and isRedisReady() would still report "ready"
        // the whole time since the connection itself never drops. That
        // hang was invisible to utils/cache.js's try/catch (nothing
        // failed, it just never returned), so the request sat waiting
        // until artillery's own client-side timeout (10s) gave up on it -
        // matching the p99/p999 (~9600-9999ms) seen only on the
        // cache-backed endpoints. commandTimeout makes any single command
        // that takes longer than this throw instead of hanging forever,
        // which utils/cache.js already treats as a cache miss and falls
        // through to MongoDB for - exactly the same safe behavior it
        // already has for a hard connection failure.
        commandTimeout: 1500,

        // Exponential-ish backoff between reconnect attempts, capped
        // at 5s, so a dead Redis doesn't spam reconnect attempts.
        retryStrategy(times) {
            return Math.min(times * 200, 5000);
        },

        reconnectOnError() {
            return true;
        }
    });

    client.on("connect", () => {
        console.log("[redis] connecting...");
    });

    client.on("ready", () => {
        console.log("[redis] connected and ready (shared cache active)");
    });

    client.on("error", (err) => {
        // ioredis emits this repeatedly while down - keep it short.
        console.error("[redis] error:", err.message);
    });

    client.on("close", () => {
        console.warn("[redis] connection closed");
    });

    client.on("reconnecting", (delay) => {
        console.warn(`[redis] reconnecting in ${delay}ms`);
    });

} else {

    console.warn(
        "[redis] REDIS_URL not set - using per-process in-memory cache (node-cache) instead. " +
        "This is NOT safe if you run more than one process/worker at the same time " +
        "(PM2 cluster mode with instances > 1, multiple Railway instances, etc.), " +
        "since each worker would keep its own separate cache and could serve stale/ " +
        "inconsistent data. Set REDIS_URL before scaling beyond a single worker."
    );

}

function isRedisConfigured() {
    return client !== null;
}

function isRedisReady() {
    return client !== null && client.status === "ready";
}

async function closeRedis() {
    if (client) {
        try {
            await client.quit();
        } catch (err) {
            client.disconnect();
        }
    }
}

module.exports = {
    client,
    isRedisConfigured,
    isRedisReady,
    closeRedis
};