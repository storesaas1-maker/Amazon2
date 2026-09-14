/**
 * local-mongo.js
 * ------------------------------------------------------------------
 * يشغّل MongoDB محلي حقيقي على جهازك (باستخدام mongodb-memory-server
 * الموجودة أصلاً في devDependencies بتاعة package.json - مفيش حاجة
 * تتحمّل زيادة، هي بتنزّل نسخة MongoDB فعلية أول مرة بس وبعدين
 * بتبقى محفوظة على الجهاز).
 *
 * الهدف: تشغيل الـ load test (artillery) ضد MongoDB على نفس
 * الجهاز، بدل الاتصال بـ Atlas عبر الإنترنت - عشان تشيل تأثير
 * الشبكة/الـ cluster المشترك تمامًا من نتيجة الاختبار.
 *
 * طريقة الاستخدام:
 *   1. node local-mongo.js
 *   2. هيطبعلك سطر زي:
 *        MONGO_URL=mongodb://127.0.0.1:XXXXX/store
 *      انسخه وحطه في ملف .env بتاعك (بدل سطر MONGO_URL الحالي -
 *      اللي بيشاور على Atlas - أو علّق عليه بـ # مؤقتًا).
 *   3. سيب التيرمنال ده شغال (لا تقفله).
 *   4. في تيرمنال تاني: node server.js
 *   5. في تيرمنال تالت: node create-load-test-users.js (لو أول مرة
 *      على الداتابيز المحلية دي) ثم npx artillery run artillery.yml
 *   6. لما تخلص، ارجع لهنا واعمل Ctrl+C عشان يقفل نضيف.
 *
 * ملحوظة: البيانات هنا مؤقتة (in-memory) - هتتمسح لما تقفل السكريبت.
 * ده مقصود ومناسب لاختبار الحمل (بيانات نضيفة كل مرة)، مش
 * للاستخدام كـ database دائمة.
 * ------------------------------------------------------------------
 */

const { MongoMemoryServer } = require("mongodb-memory-server");

async function main() {

    console.log("Starting local MongoDB instance...");

    const mongod = await MongoMemoryServer.create({
        instance: {
            dbName: "store",
            port: 27117 // ثابت عشان يبقى سهل تحطه في .env، هيتغير تلقائي لو مشغول
        }
    });

    const uri = mongod.getUri("store");

    console.log("");
    console.log("Local MongoDB is ready.");
    console.log("");
    console.log("Copy this into your .env file (replacing MONGO_URL):");
    console.log("");
    console.log(`MONGO_URL=${uri}`);
    console.log("");
    console.log("Keep this process running. Press Ctrl+C to stop and wipe the data.");

    async function shutdown() {
        console.log("\nStopping local MongoDB...");
        await mongod.stop();
        process.exit(0);
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((error) => {
    console.error("Failed to start local MongoDB:", error);
    process.exit(1);
});