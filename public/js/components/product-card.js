import { addItem } from '../cart-store.js';
import { toast } from '../toast.js';

const money = (n) =>
  `${Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;

export function productCard(product) {
  const node = document.createElement('article');
  node.className = 'product-card';

  const hasPrice = Number.isFinite(Number(product.final_price ?? product.price));
  const price =
    product.final_price ??
    Number(product.price) * (1 - Number(product.discount || 0) / 100);
  const pid = String(product._id || product.id || '');
  const discount = Number(product.discount || 0);
  const name = String(product.name || '').trim();

  const sectionName =
    product.section && typeof product.section === 'object'
      ? product.section.name || 'عام'
      : product.section || 'عام';

  // Real review stats from server
  const ratingScore = Number(product.rating || 0);
  const reviewCount = Number(product.reviews_count || 0);

  const renderStars = (score) => {
    const full = Math.floor(score);
    const hasHalf = score - full >= 0.3 && score - full < 0.8;
    const roundedFull = score - full >= 0.8 ? full + 1 : full;
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= (hasHalf ? full : roundedFull)) {
        starsHtml += '<i class="fa-solid fa-star"></i>';
      } else if (hasHalf && i === full + 1) {
        starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
      } else {
        starsHtml += '<i class="fa-regular fa-star" style="color: #d1d5db;"></i>';
      }
    }
    return starsHtml;
  };

  const ratingBlock = reviewCount > 0 ? `
    <div class="card-rating">
      <div class="rating-stars" aria-label="تقييم ${ratingScore.toFixed(1)} من 5">
        ${renderStars(ratingScore)}
      </div>
      <span class="rating-score">${ratingScore.toFixed(1)}</span>
      <span class="rating-count">(${reviewCount})</span>
    </div>
  ` : `
    <div class="card-rating" style="color: var(--text-muted); font-size: 12px;">
      <span class="badge badge-neutral" style="font-size: 11px; padding: 2px 8px;">
        <i class="fa-regular fa-star"></i> جديد • بدون تقييمات
      </span>
    </div>
  `;

  node.innerHTML = `
    <div class="card-top-badges">
      <span class="badge badge-neutral">${sectionName}</span>
      ${discount > 0 ? `<span class="badge badge-discount">خصم ${discount}%</span>` : ``}
    </div>

    <a class="product-image-wrap" href="/product.html?id=${encodeURIComponent(pid)}" aria-label="عرض تفاصيل ${name || 'المنتج'}">
      <img 
        class="product-image" 
        src="${product.image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=60'}" 
        alt="${name || 'صورة المنتج'}" 
        loading="lazy" 
      />
    </a>

    <a href="/product.html?id=${encodeURIComponent(pid)}" style="text-decoration: none;">
      <h3 class="product-title">${name || 'منتج أصلي متميز'}</h3>
    </a>

    ${ratingBlock}

    <div class="card-price-box">
      <div>
        <span class="price-main">${hasPrice ? money(price) : 'السعر غير متوفر'}</span>
        ${discount > 0 && Number.isFinite(Number(product.price)) ? `<del class="price-old">${money(product.price)}</del>` : ''}
      </div>
    </div>

    <div class="card-shipping">
      <i class="fa-solid fa-truck-fast"></i>
      <span>توصيل مجاني وسريع • غداً</span>
    </div>

    <button class="card-add-btn" type="button"${hasPrice ? '' : ' disabled'} aria-label="أضف إلى السلة">
      <i class="fa-solid fa-cart-shopping"></i>
      <span>${hasPrice ? 'أضف إلى السلة' : 'غير متاح'}</span>
    </button>
  `;

  const addBtn = node.querySelector('.card-add-btn');
  if (addBtn) {
    addBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!hasPrice) return;
      addItem(product);
      toast('تمت إضافة المنتج إلى سلة المشتريات بنجاح', 'success');
    };
  }

  return node;
}
