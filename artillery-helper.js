// بيولّد IP عشوائي شكله حقيقي (مش من رينجات محجوزة زي 10.x أو 192.168.x)
// عشان نتجنب أي تعامل خاص من express-rate-limit أو أي مكتبة تانية بتفرّق
// بين IPs عامة وخاصة.
function randomPublicLookingIp() {
    const octet = () => Math.floor(Math.random() * 223) + 1; // 1..223 يتفادى رينجات محجوزة زي 224+ وصفر
    return `${octet()}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

// ✅ اتضاف: بيدي كل virtual user IP مختلف (بيتحط في هيدر X-Forwarded-For).
// السيرفر عامل app.set("trust proxy", 1) فهو بيثق في الهيدر ده لتحديد
// req.ip. من غيره، كل الـ virtual users بيبقوا شايفين نفس الـ IP
// (localhost)، فأي rate limiter شغال على أساس IP (زي limiter اللوج
// إن اللي بيسمح بـ 4 محاولات بس كل 30 دقيقة) هيتفعّل على أول 4 يوزرز
// بس ويرفض الباقي كلهم، حتى لو كانوا مستخدمين مختلفين فعليًا.
function setVirtualUserIp(context, events, done) {
    context.vars.vuserIp = randomPublicLookingIp();
    return done();
}

// يولّد بيانات حساب جديد مرة واحدة لكل virtual user، ويخزنها في context.vars
// عشان تتستخدم في أكتر من خطوة (register ثم login) بنفس القيم بالظبط.
function generateSignupData(context, events, done) {
  const rand = Math.random().toString(36).substring(2, 10);

  context.vars.newEmail = `loadtest_${rand}@test.com`;
  context.vars.newPassword = "Test@12345";

  // رقم عشوائي مصري الشكل (01 + 9 أرقام) لتفادي فشل التحقق من نوع الحقل
  const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
  context.vars.newPhone = `01${randomDigits}`;
  context.vars.newWhatsapp = context.vars.newPhone;

  return done();
}

module.exports = { generateSignupData, setVirtualUserIp };