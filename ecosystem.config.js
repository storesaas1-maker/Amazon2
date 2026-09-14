// PM2 cluster mode: يشغل أكتر من worker process على نفس السيرفر.
// مهم: لازم يكون REDIS_URL متظبط في الـ environment قبل التشغيل
// بـ instances > 1، عشان كل الـ workers يشتركوا في نفس الكاش
// (Redis). من غير REDIS_URL هيرجع كل worker يستخدم كاش محلي منفصل
// وده ممكن يسبب تضارب في البيانات المعروضة بين الطلبات.
module.exports = {
  apps: [{
    name: 'store-app',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};