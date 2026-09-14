import { toast } from './toast.js';
export async function request(path, { method = 'GET', body, silent = false } = {}) {
  const options = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
  let response, data;
  try { response = await fetch(path, options); data = await response.json().catch(() => ({})); }
  catch { if (!silent) toast('تعذر الاتصال بالخادم', 'error'); throw new Error('Network error'); }
  if (!response.ok || data.success === false || data.authenticated === false) { const error = new Error(data.message || 'تعذر إتمام الطلب'); error.status = response.status; if (!silent) toast(error.message, 'error'); throw error; }
  return data;
}

// /api/get_products مُقسَّم لصفحات (50 كحد أقصى للصفحة)، وليس كل المنتجات في نداء واحد.
// هذه الدالة تجمع كل الصفحات في مصفوفة واحدة، مع حد أقصى أمان لعدد الصفحات
// حتى لا تتكرر الحلقة إلى ما لا نهاية في حال وجود خلل غير متوقع في بيانات الـ pagination.
export async function fetchAllProducts({ maxPages = 200 } = {}) {
  const limit = 50;
  let page = 1;
  let all = [];

  while (page <= maxPages) {
    const res = await request(`/api/get_products?page=${page}&limit=${limit}`);
    const batch = Array.isArray(res?.data) ? res.data : [];
    all = all.concat(batch);

    const pagination = res?.pagination;
    if (!pagination || !pagination.hasNextPage) break;
    page += 1;
  }

  return all;
}

// /api/admin/get_all_orders مُقسَّم لصفحات أيضًا (الخادم يحدّ limit بـ 50 حتى
// لو طُلب limit=10000)، فطلب limit=10000 مرة واحدة كان يرجّع أول 50 طلب فقط
// بصمت. هذه الدالة تجمع كل الصفحات فعليًا لإحصائيات دقيقة (الإيرادات، عدد
// الطلبات بكل حالة...الخ).
export async function fetchAllOrders({ maxPages = 500, silent = true } = {}) {
  const limit = 50;
  let page = 1;
  let all = [];

  while (page <= maxPages) {
    const res = await request(`/api/admin/get_all_orders?page=${page}&limit=${limit}`, { silent });
    const batch = Array.isArray(res?.data) ? res.data : [];
    all = all.concat(batch);

    const pagination = res?.pagination;
    if (!pagination || !pagination.hasNextPage) break;
    page += 1;
  }

  return all;
}
