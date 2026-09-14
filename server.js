require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const path = require("path");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const redis = require("./config/redis");

const app = express();

const PORT = process.env.PORT || 3000;

/*
 * =========================================
 * Trust proxy
 *
 * لازم عشان express-rate-limit ياخد الـ IP
 * الحقيقي للعميل لو السيرفر شغال ورا Nginx/
 * load balancer، وكمان عشان cookies آمنة
 * (secure) تشتغل صح ورا proxy بيعمل TLS
 * termination.
 * =========================================
 */

app.set("trust proxy", 1);


/*
 * =========================================
 * Security & performance middleware
 * =========================================
 */

app.use(
    helmet({
        // API + static HTML مبيحتاجوش CSP صارم افتراضي
        // دلوقتي عشان الصفحات بتحمّل سكريبتات من
        // نفس الدومين وممكن CDN؛ سيبناه متوقف عشان
        // منكسرش الصفحات الحالية، ويتفعل لاحقًا بعد
        // ما يتظبط الـ policy المناسب للمشروع.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);

app.use(compression());

/*
 * Rate limiting عام لكل الـ API
 * (بيحمي من DDoS بسيط / abuse من غير ما
 * يأثر على استخدام عادي للموقع)
 *
 * ⚠️ متوقف مؤقتًا عشان اختبار الحمل (artillery). لازم يترجع
 * قبل الرفع على البروڊكشن — من غيره الـ API مكشوف بالكامل
 * من غير أي حماية ضد abuse/DDoS بسيط.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 500, // 500 طلب لكل IP خلال 15 دقيقة
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "طلبات كتير جدًا من الجهاز ده، حاول تاني بعد شوية",
        data: []
    }
});

app.use("/api", generalLimiter);

/*
 * ملحوظة: تسجيل الدخول والتسجيل ليهم
 * rate limiters أخص وأشد بالفعل جوه
 * routes/log_in.router.js و
 * routes/register.router.js، فمفيش داعي
 * لتكرارهم هنا.
 */


/*
 * =========================================
 * Middleware
 * =========================================
 */

app.use(cookieParser());

app.use(express.urlencoded({
    extended: true
}));

app.use(express.json());


/*
 * =========================================
 * MongoDB
 * =========================================
 */

mongoose.connect(process.env.MONGO_URL, {
        // إعدادات connection pool.
        //
        // FIX (load-test): 10 هنا كان مقصود أصلاً لـ PM2 cluster mode
        // (كل worker بياخد pool صغير بيه عشان المجموع الكلي ميبقاش كبير
        // أوي). لكن لما السيرفر بيتشغل بعملية واحدة بس (node server.js
        // العادي، زي في اختبار الحمل ده) بقى ده سقف منخفض أوي لعدد
        // الاتصالات المتزامنة مع MongoDB - أي endpoint بيعمل أكتر من
        // استعلام واحد في نفس الوقت تحت حمل (زي /api/order اللي بيعمل
        // find + عدة findOneAndUpdate متوازية + save) بيتزاحم على نفس
        // الـ 10 اتصالات مع كل الطلبات التانية. رفعها هنا بيقلل الزحمة
        // دي في عملية واحدة. **مهم: لو رجعت تشغل PM2 cluster mode
        // (ecosystem.config.js: instances: 'max') لازم ترجع القيمة دي
        // لحاجة صغيرة زي 10 تاني**، عشان مجموع الاتصالات عبر كل
        // الـ workers مايتجاوزش حد الاتصالات المسموح بيه في خطة
        // MongoDB بتاعتك.
        maxPoolSize: 50,
        serverSelectionTimeoutMS: 10000
    })
    .then(() => {
        console.log("MongoDB conneted");
    })
    .catch((error) => {
        console.log("MongoDB disconneted");
        console.log(error);
    });

mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected - mongoose will try to reconnect automatically");
});

mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
});


/*
 * =========================================
 * HTTP Server
 * =========================================
 */

const server = http.createServer(app);


/*
 * =========================================
 * Socket.IO
 * =========================================
 */

const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    },
    // FIX: السيرفر شغال بـ PM2 cluster mode (ecosystem.config.js:
    // instances: 'max') من غير sticky sessions. كل polling request
    // هو HTTP request منفصل ممكن يتوجه لـ worker مختلف عن اللي عمل
    // الـ handshake، فالـ worker التاني مايعرفش الـ session ويرجع
    // "400 Bad Request" - وده بالظبط اللي كان بيظهر في الـ console
    // (sid جديد كل شوية + WebSocket بيتقفل قبل ما يكتمل). قصر النقل
    // على WebSocket بس بيحل المشكلة دي: الاتصال TCP واحد مستمر
    // بيتثبت على worker واحد من أول ما يتاسس، فمفيش أي حاجة محتاجة
    // توجيه متكرر. ده الحل الرسمي الموصى بيه من socket.io لما مفيش
    // sticky sessions متاحة قدام الـ cluster.
    transports: ["websocket"]
});


/*
 * =========================================
 * Redis adapter (مطلوب مع PM2 cluster mode)
 * =========================================
 * من غيره: أي broadcast زي req.io.to("users").emit(...) بيوصل بس
 * للعملاء المتصلين بنفس الـ worker اللي استقبل الـ HTTP request -
 * يعني معظم المستخدمين (المتصلين بـ workers تانية) مش هياخدوا
 * الإشعارات دي (منتج جديد، تحديث حالة أوردر، كوبون جديد... إلخ)
 * خالص، من غير أي error ظاهر. الـ adapter بيخلي كل الـ workers
 * يشتركوا في نفس pub/sub عبر Redis عشان الـ broadcast يوصل للكل.
 */

if (redis.isRedisConfigured()) {

    // ملحوظة مهمة: العميل الأساسي (redis.client) مظبوط بـ
    // enableOfflineQueue: false عشان عمليات الـ cache (get/set)
    // تفشل بسرعة بدل ما تعلّق. لكن عملاء الـ pub/sub بتوع
    // socket.io adapter عكس كده محتاجين الـ offline queue شغال:
    // .duplicate() بييجي بنفس الاتصال أصلًا (مش جاهز فورًا)،
    // وأمر الـ psubscribe بيتبعت فورًا من غير ما يستنى الاتصال
    // يخلص. لو الـ queue متقفل هيترفض فورًا برسالة
    // "Stream isn't writeable" وهيكرش السيرفر كله (ده بالظبط
    // السبب اللي كان بيوقّف السيرفر بعد ما يشتغل).
    const pubClient = redis.client.duplicate({
        enableOfflineQueue: true
    });

    const subClient = redis.client.duplicate({
        enableOfflineQueue: true
    });

    // من غير error listener على كل عميل، أي error عليهم
    // (Redis واقع، مشكلة شبكة...) هيبقى "unhandled error event"
    // وهيكرش الـ process كمان. نفس الحماية اللي عاملينها للعميل
    // الأساسي.
    pubClient.on("error", (err) => {
        console.error("[socket.io redis pub] error:", err.message);
    });

    subClient.on("error", (err) => {
        console.error("[socket.io redis sub] error:", err.message);
    });

    io.adapter(createAdapter(pubClient, subClient));

    console.log("[socket.io] Redis adapter enabled - broadcasts now reach all PM2 workers");

} else {

    console.warn(
        "[socket.io] REDIS_URL not set - real-time events (new_product, new_order, " +
        "update_status, ...) will only reach clients connected to THIS process. " +
        "That's fine for a single process, but BREAKS notifications once you run " +
        "with PM2 cluster mode / instances > 1. Set REDIS_URL before scaling."
    );

}


/*
 * =========================================
 * Make Socket.IO available in routes/controllers
 * =========================================
 */

app.use((req, res, next) => {
    req.io = io;
    next();
});


/*
 * =========================================
 * Socket.IO connection
 * =========================================
 */

io.on("connection", (socket) => {

    console.log("Socket connected:", socket.id);


    /*
     * Admin joins admins room
     */

    socket.on("join_admin", () => {

        socket.join("admins");

        console.log(
            `Admin joined admins room: ${socket.id}`
        );

    });

    socket.on("join_users", () => {

        socket.join("users");

        console.log(
            `User joined users room: ${socket.id}`
        );

    });


    /*
     * Socket disconnected
     */

    socket.on("disconnect", () => {

        console.log(
            "Socket disconnected:",
            socket.id
        );

    });

});


/*
 * =========================================
 * APIs
 * =========================================
 */

const register = require("./routes/register.router");

const register_super_admin = require("./routes/register_super_admin.router");

const log_in = require("./routes/log_in.router");

const log_out = require("./routes/log_out.router");

const auth_me_router = require("./routes/auth_me.router");

const get_products = require("./routes/get_products.router");

const get_user_orders = require("./routes/get_user_orders.router");

const get_product_reviews = require("./routes/get_product_reviews.router");

const order = require("./routes/order.router");

const post_review = require("./routes/post_review.router");

const get_all_orders = require("./routes/get_all_orders.router")

const get_all_users = require("./routes/get_all_users.router")

const get_all_sections = require("./routes/get_all_sections.router")

const add_section = require("./routes/add_section.router")

const add_product = require("./routes/add_product.router")

const add_coupon = require("./routes/add_coupon.router")

const upgrade_user_to_admin = require("./routes/upgrade_user_to_admin.router")

const update_produt = require("./routes/update_produt.router")

const update_section = require("./routes/update_section.router")

const update_status_of_order = require("./routes/update_status.router")

const delete_product = require("./routes/delete_product.router")

const delete_section = require("./routes/delete_section.router")

const delete_order = require("./routes/delete_order.router")

const update_admin_to_user = require("./routes/update_admin_to_user.router")

const store = require("./routes/store.router")

const get_store_settings = require("./routes/get_store_settings.router")

const ai_assistant = require("./routes/ai_assistant.router")

const add_problem = require("./routes/add_problem.router")

const get_problems = require("./routes/get_problems.router")

const get_cloudinary_config = require("./routes/get_cloudinary_config.router")

app.use(auth_me_router);

app.use(register);

app.use(log_in);

app.use(log_out);

app.use(get_products);

app.use(get_user_orders);

app.use(get_product_reviews);

app.use(order);

app.use(post_review);

app.use(register_super_admin);

app.use(get_all_orders);

app.use(get_all_users);

app.use(add_section);

app.use(get_all_sections);

app.use(get_problems);

app.use(add_product);

app.use(add_problem);

app.use(add_coupon);

app.use(upgrade_user_to_admin);

app.use(update_produt);

app.use(update_section);

app.use(update_status_of_order);

app.use(delete_product);

app.use(delete_section);

app.use(delete_order);

app.use(update_admin_to_user);

app.use(store);

app.use(get_store_settings);

app.use(ai_assistant);

app.use(get_cloudinary_config);

/*
 * =========================================
 * Static files
 * =========================================
 */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/*
 * =========================================
 * Pages
 * =========================================
 */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


app.get("/products", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "products.html"
        )
    );

});


app.get("/product", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "product.html"
        )
    );

});


app.get("/cart", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "cart.html"
        )
    );

});


app.get("/login", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "login.html"
        )
    );

});


/*
 * =========================================
 * Register page
 * =========================================
 */

app.get("/register", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "register.html"
        )
    );

});


/*
 * =========================================
 * Start Server
 * =========================================
 */

server.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});


/*
 * =========================================
 * Graceful shutdown
 *
 * مهم مع PM2 (خصوصًا في cluster mode وعند
 * كل reload/restart): نقفل الاتصالات المفتوحة
 * (HTTP، MongoDB، Redis) بشكل نظيف بدل ما
 * الـ process يتقفل فجأة ويسيب اتصالات معلّقة.
 * =========================================
 */

async function gracefulShutdown(signal) {

    console.log(`${signal} received: closing server gracefully...`);

    server.close(async () => {

        try {
            await mongoose.connection.close();
            console.log("MongoDB connection closed");
        } catch (err) {
            console.error("Error closing MongoDB connection:", err.message);
        }

        try {
            await redis.closeRedis();
            console.log("Redis connection closed");
        } catch (err) {
            console.error("Error closing Redis connection:", err.message);
        }

        process.exit(0);
    });

    // Safety net: لو حاجة علّقت الإغلاق، منديش الـ process يفضل شغال
    // للأبد (PM2 بيبعت SIGKILL بعد فترة على أي حال، بس ده بيخلي
    // الإغلاق متوقع أكتر).
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));