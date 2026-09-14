import { request } from '../api.js';
import { onEvent } from '../socket-client.js';
import { productCard } from '../components/product-card.js';
import { mountSiteShell } from '../components/site-shell.js';
import { initSite, state } from './common.js';

// تثبيت الهيدر والفوتر
mountSiteShell({ active: 'home' });

// عناصر الأقسام المعتمدة في الصفحة الرئيسية
const featuredGrid = document.querySelector('#featured');
const topRatedGrid = document.querySelector('#top-rated-grid');

// دالة عرض هياكل التحميل (Skeleton Loaders)
function renderSkeletons(container, count = 4) {
  if (!container) return;
  container.innerHTML = Array(count)
    .fill(0)
    .map(
      () => `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
        <div class="skeleton-text price"></div>
      </div>`
    )
    .join('');
}

// دالة مساعدة لفك واستخراج المصفوفات بأمان مهما كان شكل استجابة السيرفر
function extractArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.products)) return res.products;
  if (Array.isArray(res?.data?.products)) return res.data.products;
  return [];
}

// دالة جلب وعرض المنتجات وتصفية المنتجات التي تمتلك مراجعات فقط
async function loadProducts() {
  renderSkeletons(topRatedGrid, 4);
  renderSkeletons(featuredGrid, 4);

  try {
    // جلب المنتجات والمراجعات بالتوازي لضمان توفر بيانات التعليقات دائماً
    const [productsRes, reviewsRes] = await Promise.allSettled([
      request('/api/get_products'),
      request('/api/get_product_reviews')
    ]);

    const rawProducts = productsRes.status === 'fulfilled' ? extractArray(productsRes.value) : [];
    const rawReviews = reviewsRes.status === 'fulfilled' ? extractArray(reviewsRes.value) : [];

    if (!rawProducts.length) {
      if (topRatedGrid) state(topRatedGrid, 'لا توجد منتجات مسجلة في المتجر حالياً.', 'empty');
      if (featuredGrid) state(featuredGrid, 'لا توجد منتجات متوفرة حالياً.', 'empty');
      return;
    }

    // دمج واحتساب المراجعات لكل منتج بدقة حتى لو لم تكن محسوبة في السيرفر
    const enrichedProducts = rawProducts.map((prod) => {
      const pid = String(prod._id || prod.id || '');
      const prodReviews = rawReviews.filter((r) => String(r.product_id) === pid);
      
      const reviewsCount = Number(prod.reviews_count ?? prodReviews.length);
      
      let avgRating = Number(prod.rating || 0);
      if (avgRating <= 0 && prodReviews.length > 0) {
        const sum = prodReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        avgRating = Number((sum / prodReviews.length).toFixed(1));
      }

      return {
        ...prod,
        rating: avgRating,
        reviews_count: reviewsCount
      };
    });

    // 1. قسم المنتجات الأعلى تقييماً (المنتجات التي عليها تعليقات ومراجعات حقيقية فقط)
    if (topRatedGrid) {
      const reviewedOnly = enrichedProducts
        // شرط صارم: استبعاد أي منتج لا يملك تعليقات فعلية
        .filter((p) => Number(p.reviews_count || 0) > 0 && Number(p.rating || 0) > 0)
        // الترتيب: بالأعلى تقييماً أولاً، وعند التساوي بالأكثر عدداً في التعليقات
        .sort((a, b) => {
          const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          return Number(b.reviews_count || 0) - Number(a.reviews_count || 0);
        });

      if (reviewedOnly.length > 0) {
        topRatedGrid.replaceChildren(...reviewedOnly.slice(0, 8).map(productCard));
      } else {
        state(topRatedGrid, 'لا توجد مراجعات أو تقييمات مسجلة على المنتجات حتى الآن.', 'empty');
      }
    }

    // 2. قسم أحدث المنتجات المضافة (New Arrivals / Featured)
    if (featuredGrid) {
      const latest = [...enrichedProducts].reverse().slice(0, 8);
      if (latest.length > 0) {
        featuredGrid.replaceChildren(...latest.map(productCard));
      } else {
        state(featuredGrid, 'لا توجد منتجات مضافة حديثاً.', 'empty');
      }
    }
  } catch (err) {
    console.error('Failed to load products:', err);
    if (topRatedGrid) state(topRatedGrid, 'تعذر تحميل المنتجات. يرجى المحاولة لاحقاً.', 'error');
    if (featuredGrid) state(featuredGrid, 'تعذر تحميل المنتجات. يرجى المحاولة لاحقاً.', 'error');
  }
}

// تهيئة الصفحة والاستماع للتحديثات اللحظية
initSite().then(() => {
  loadProducts();

  // تحديث الصفحة تلقائياً عند إضافة أو تعديل أو كتابة مراجعة جديدة
  onEvent('new_product', loadProducts);
  onEvent('update_product', loadProducts);
  onEvent('deleted_product', loadProducts);
  onEvent('new_review', loadProducts);
});