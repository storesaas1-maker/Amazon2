import { request, fetchAllProducts } from '../api.js';
import { onEvent } from '../socket-client.js';
import { productCard } from '../components/product-card.js';
import { mountSiteShell } from '../components/site-shell.js';
import { initSite, state } from './common.js';

// تثبيت الهيكل العام (الهيدر والفوتر)
mountSiteShell({ active: 'home' });

const topRatedContainer = document.querySelector('#top-rated-shelf-wrapper');
const sectionsContainer = document.querySelector('#sections-shelves-container');

// دالة مساعدة لفك واستخراج البيانات بأمان
function extractArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.products)) return res.products;
  if (Array.isArray(res?.data?.products)) return res.data.products;
  return [];
}

// دالة إنشاء حاوية سلايدر احترافية مع أزرار التنقل (يمين / شمال)
function createCarouselShelf({ title, subtitle, icon, link, products = [] }) {
  const shelf = document.createElement('section');
  shelf.className = 'marketplace-shelf';

  shelf.innerHTML = `
    <div class="shelf-header">
      <div class="shelf-title-wrap">
        <h2 class="shelf-title">
          <i class="${icon}" style="color: #FF9900; margin-inline-end: 8px;"></i>
          ${title}
        </h2>
        ${subtitle ? `<span class="shelf-subtitle">${subtitle}</span>` : ''}
      </div>
      ${link ? `<a class="shelf-view-all" href="${link}">عرض الكل (${products.length})</a>` : ''}
    </div>
    <div class="shelf-carousel-container">
      <button class="carousel-nav-btn btn-prev" aria-label="السابق" type="button">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
      <div class="shelf-carousel-track"></div>
      <button class="carousel-nav-btn btn-next" aria-label="التالي" type="button">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    </div>
  `;

  const track = shelf.querySelector('.shelf-carousel-track');
  const prevBtn = shelf.querySelector('.btn-prev');
  const nextBtn = shelf.querySelector('.btn-next');

  // إضافة بطاقات المنتجات (بحد أقصى 20 منتج)
  products.slice(0, 20).forEach((p) => {
    track.appendChild(productCard(p));
  });

  // تحكم أزرار السلايدر المتوافقة مع اتجاه اليمين واليسار (RTL)
  const scrollStep = 300 * 2; // تمرير منتجين في كل ضغطة
  nextBtn.onclick = () => track.scrollBy({ left: -scrollStep, behavior: 'smooth' });
  prevBtn.onclick = () => track.scrollBy({ left: scrollStep, behavior: 'smooth' });

  return shelf;
}

// دالة جلب وعرض الأقسام والمنتجات
async function loadHomeMarketplace() {
  if (topRatedContainer) topRatedContainer.innerHTML = '<div class="skeleton-card" style="height: 250px; width: 100%;"></div>';
  if (sectionsContainer) sectionsContainer.innerHTML = '<div class="skeleton-card" style="height: 350px; width: 100%;"></div>';

  try {
    // جلب المنتجات والأقسام بالتوازي
    const [prodsRes, secsRes] = await Promise.allSettled([
      fetchAllProducts(),
      request('/api/get_all_sections')
    ]);

    const rawProducts = prodsRes.status === 'fulfilled' ? extractArray(prodsRes.value) : [];
    const rawSections = secsRes.status === 'fulfilled' ? extractArray(secsRes.value) : [];

    if (!rawProducts.length) {
      if (topRatedContainer) topRatedContainer.innerHTML = '';
      if (sectionsContainer) state(sectionsContainer, 'لا توجد منتجات مسجلة في المتجر حالياً.', 'empty');
      return;
    }

    // احتساب المراجعات وتقييم كل منتج بدقة
    const enrichedProducts = rawProducts.map((prod) => {
      const reviewsArray = Array.isArray(prod.reviews) ? prod.reviews : [];
      const reviewsCount = reviewsArray.length || Number(prod.reviews_count || 0);

      let avgRating = Number(prod.rating || 0);
      if (reviewsCount > 0) {
        const withScore = reviewsArray.filter((r) => r && Number(r.rating) > 0);
        if (withScore.length > 0) {
          const sum = withScore.reduce((acc, r) => acc + Number(r.rating), 0);
          avgRating = Number((sum / withScore.length).toFixed(1));
        } else {
          avgRating = avgRating > 0 ? avgRating : 5.0;
        }
      }

      return {
        ...prod,
        rating: avgRating,
        reviews_count: reviewsCount
      };
    });

    // 1. حاوية: المنتجات الأكثر مراجعة وتقييماً (فقط التي فيها مراجعات حتى 20 منتج)
    if (topRatedContainer) {
      topRatedContainer.innerHTML = '';
      const reviewedOnly = enrichedProducts
        .filter((p) => Number(p.reviews_count || 0) > 0)
        .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)) || (Number(b.reviews_count || 0) - Number(a.reviews_count || 0)))
        .slice(0, 20);

      if (reviewedOnly.length > 0) {
        const topRatedShelf = createCarouselShelf({
          title: 'المنتجات الأكثر تقييماً ومراجعة — تجارب المشترين',
          subtitle: 'المنتجات الحاصلة على أعلى تقييمات ومراجعات حقيقية',
          icon: 'fa-solid fa-star',
          link: '/products.html?sort=top-rated',
          products: reviewedOnly
        });
        topRatedContainer.appendChild(topRatedShelf);
      }
    }

    // 2. حاويات الأقسام المتعددة (بحد أقصى 15 قسماً و 20 منتجاً للقسم)
    if (sectionsContainer) {
      sectionsContainer.innerHTML = '';

      // تحديد أقصى عدد 15 قسم
      const limitedSections = rawSections.slice(0, 15);

      let renderedCount = 0;

      limitedSections.forEach((sec) => {
        const secId = String(sec._id || sec.id || '');
        const secName = String(sec.name || sec.title || '').trim();

        // مطابقة منتجات هذا القسم
        const sectionProducts = enrichedProducts.filter((p) => {
          const pSec = p.section;
          if (!pSec) return false;
          if (typeof pSec === 'string' || typeof pSec === 'number') {
            return String(pSec) === secId || String(pSec) === secName;
          }
          if (typeof pSec === 'object') {
            return String(pSec._id || pSec.id) === secId || String(pSec.name) === secName;
          }
          return false;
        }).slice(0, 20); // حد أقصى 20 منتج للقسم

        // إذا كان القسم يحتوي على منتج واحد على الأقل يتم عرضه في سلايدر
        if (sectionProducts.length > 0) {
          renderedCount++;
          const shelfElement = createCarouselShelf({
            title: `قسم ${secName}`,
            subtitle: `أحدث وأفضل منتجات ${secName} بجودة أصلية`,
            icon: 'fa-solid fa-layer-group',
            link: `/products.html?section=${encodeURIComponent(secId || secName)}`,
            products: sectionProducts
          });
          sectionsContainer.appendChild(shelfElement);
        }
      });

      if (renderedCount === 0) {
        // في حال عدم وجود تصنيف بالأقسام، عرض جميع المنتجات في سلايدر عام
        const fallbackShelf = createCarouselShelf({
          title: 'جميع المنتجات المتوفرة',
          subtitle: 'تصفح أحدث السلع والأجهزة المتوفرة في المتجر',
          icon: 'fa-solid fa-boxes-stacked',
          link: '/products.html',
          products: enrichedProducts.slice(0, 20)
        });
        sectionsContainer.appendChild(fallbackShelf);
      }
    }
  } catch (err) {
    console.error('Error loading marketplace:', err);
    if (sectionsContainer) state(sectionsContainer, 'تعذر تحميل بيانات الأقسام.', 'error');
  }
}

// تشغيل الموقع والاستماع للتحديثات اللحظية
initSite().then(() => {
  loadHomeMarketplace();

  onEvent('new_product', loadHomeMarketplace);
  onEvent('update_product', loadHomeMarketplace);
  onEvent('deleted_product', loadHomeMarketplace);
  onEvent('new_review', loadHomeMarketplace);
  onEvent('new_section', loadHomeMarketplace);
});