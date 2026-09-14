import { request, fetchAllProducts } from '../api.js';
import { addItem } from '../cart-store.js';
import { toast } from '../toast.js';
import { mountSiteShell } from '../components/site-shell.js';
import { initSite, money, state } from './common.js';
import { onEvent } from '../socket-client.js';

mountSiteShell({ active: 'shop' });

const id = new URLSearchParams(location.search).get('id');
const root = document.querySelector('#product-detail-container');
const reviewsList = document.querySelector('#reviews-list');
const breadcrumbName = document.querySelector('#breadcrumb-product-name');

// Overview elements
const overviewScoreEl = document.querySelector('#overview-rating-score');
const overviewStarsEl = document.querySelector('#overview-stars');
const overviewCountEl = document.querySelector('#overview-review-count');
const overviewBarsEl = document.querySelector('#overview-rating-bars');

function renderStarsHtml(score) {
  const full = Math.floor(score);
  const hasHalf = score - full >= 0.3 && score - full < 0.8;
  const roundedFull = score - full >= 0.8 ? full + 1 : full;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= (hasHalf ? full : roundedFull)) {
      html += '<i class="fa-solid fa-star"></i>';
    } else if (hasHalf && i === full + 1) {
      html += '<i class="fa-solid fa-star-half-stroke"></i>';
    } else {
      html += '<i class="fa-regular fa-star" style="color: #d1d5db;"></i>';
    }
  }
  return html;
}

function updateReviewSummary(items) {
  const total = items ? items.length : 0;
  let avgScore = 0;

  if (total > 0) {
    const sum = items.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    avgScore = Number((sum / total).toFixed(1));
  }

  // Update Overview card
  if (overviewScoreEl) {
    overviewScoreEl.textContent = total > 0 ? avgScore.toFixed(1) : '0.0';
  }
  if (overviewStarsEl) {
    overviewStarsEl.innerHTML = renderStarsHtml(avgScore);
  }
  if (overviewCountEl) {
    overviewCountEl.textContent =
      total > 0
        ? `استناداً إلى ${total} تقييم عميل موثق`
        : 'لا توجد مراجعات أو تقييمات مسجلة بعد';
  }

  if (overviewBarsEl) {
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (total > 0) {
      items.forEach((r) => {
        const star = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
        starCounts[star] = (starCounts[star] || 0) + 1;
      });
    }

    const labels = {
      5: '5 نجوم',
      4: '4 نجوم',
      3: '3 نجوم',
      2: '2 نجمتان',
      1: '1 نجمة'
    };

    overviewBarsEl.innerHTML = [5, 4, 3, 2, 1]
      .map((num) => {
        const count = starCounts[num] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return `
          <div class="rating-bar-row">
            <span>${labels[num]}</span>
            <div class="rating-bar-track"><div class="rating-bar-fill" style="width: ${pct}%;"></div></div>
            <span>${pct}%</span>
          </div>
        `;
      })
      .join('');
  }

  // Update Center column rating line
  const centerStars = document.querySelector('#center-rating-stars');
  const centerScore = document.querySelector('#center-rating-score');
  const centerCount = document.querySelector('#center-rating-count');

  if (centerStars) centerStars.innerHTML = renderStarsHtml(avgScore);
  if (centerScore) centerScore.textContent = total > 0 ? avgScore.toFixed(1) : 'جديد';
  if (centerCount) {
    centerCount.textContent = total > 0 ? `(${total} تقييم مشترٍ موثق)` : '(كن أول من يقيّم المنتج)';
  }
}

function reviewList(items) {
  if (!reviewsList) return;
  if (!items || !items.length) {
    reviewsList.innerHTML = `
      <div style="padding: 28px; text-align: center; color: var(--text-secondary); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);">
        <i class="fa-regular fa-comment-dots" style="font-size: 32px; margin-bottom: 10px; display: block; color: var(--text-muted);"></i>
        <strong>لا توجد مراجعات أو تعليقات لهذا المنتج بعد.</strong>
        <p style="font-size: 13px; margin-top: 4px; color: var(--text-muted);">كن أول عميل يشارك رأيه وتجربته عبر النموذج أعلاه!</p>
      </div>`;
    return;
  }

  reviewsList.replaceChildren(
    ...items.map((r) => {
      const d = document.createElement('article');
      d.className = 'review-item';
      const rating = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
      const dateStr = r.created_at
        ? new Date(r.created_at).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'حديثاً';

      d.innerHTML = `
        <div class="review-author" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-user" style="font-size: 24px; color: var(--primary);"></i>
            <span style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${r.user_name || 'عميل موثق في متجري'}</span>
          </div>
          <span style="font-size: 12px; color: var(--text-muted);">${dateStr}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div class="rating-stars" style="font-size: 13px;">
            ${renderStarsHtml(rating)}
          </div>
          <span style="font-size: 12px; font-weight: 700; color: var(--text-primary);">${rating} من 5</span>
          <div class="review-badge-verified" style="margin-inline-start: 6px;">
            <i class="fa-solid fa-check" style="font-size: 11px;"></i> شراء موثق ومؤكد
          </div>
        </div>
        <p class="review-content" style="font-size: 14px; line-height: 1.6; color: var(--text-primary);">${r.content || ''}</p>
      `;
      return d;
    })
  );
}

async function load() {
  if (!id) {
    state(root, 'معرّف المنتج مفقود في الرابط.', 'error');
    return;
  }

  state(root, 'جارٍ تحميل تفاصيل المنتج والمواصفات...', 'loading');

  try {
    const products = await fetchAllProducts();
    const p = products.find((x) => String(x._id) === String(id) || String(x.id) === String(id));
    if (!p) throw new Error('Product not found');

    if (breadcrumbName) breadcrumbName.textContent = p.name;
    document.title = `${p.name} — متجري`;

    const price = p.final_price ?? p.price;
    const hasDiscount = Number(p.discount || 0) > 0;
    const sectionName = p.section?.name || 'المنتجات العامة';
    const sectionId = p.section?._id || '';

    const mainImg =
      p.image ||
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

    const galleryImages = [
      mainImg,
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'
    ];

    root.replaceChildren();
    root.innerHTML = `
      <div class="product-detail-layout">
        <!-- 1. Left Gallery Column -->
        <div class="product-gallery">
          <div class="gallery-primary-box" id="gallery-main-container">
            <img id="primary-gallery-img" src="${mainImg}" alt="${p.name}" />
          </div>
          <div class="gallery-thumbs-row" id="gallery-thumbs">
            ${galleryImages
              .map(
                (src, idx) => `
              <div class="gallery-thumb ${idx === 0 ? 'is-active' : ''}" data-src="${src}">
                <img src="${src}" alt="زاوية ${idx + 1}" />
              </div>`
              )
              .join('')}
          </div>
          <div style="margin-top: 14px; text-align: center;">
            <span class="badge badge-certified" style="padding: 6px 12px; font-size: 13px;">
              <i class="fa-solid fa-shield-halved"></i> منتج أصلي 100% معتمد
            </span>
          </div>
        </div>

        <!-- 2. Center Product Details Column -->
        <div class="product-info-col">
          <h1 class="product-detail-title">${p.name}</h1>
          <div class="product-brand-line">
            القسم: <a href="/products.html?section=${encodeURIComponent(sectionId)}">${sectionName}</a>
            • الضمان والجودة: <strong>منتج أصلي معتمد 100%</strong>
          </div>

          <div class="product-detail-rating">
            <div class="rating-stars" id="center-rating-stars">
              ${renderStarsHtml(Number(p.rating || 0))}
            </div>
            <span class="rating-score" id="center-rating-score">${Number(p.rating || 0) > 0 ? Number(p.rating).toFixed(1) : 'جديد'}</span>
            <a href="#reviews-section" id="center-rating-count" style="font-size: 13px; color: var(--link); margin-inline-start: 6px;">
              ${Number(p.reviews_count || 0) > 0 ? `(${p.reviews_count} تقييم مشترٍ موثق)` : '(كن أول من يقيّم المنتج)'}
            </a>
          </div>

          <div class="product-detail-price-box">
            <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px;">
              <span class="detail-price-big">${money(price)}</span>
              ${
                hasDiscount
                  ? `<del class="detail-price-old">${money(p.price)}</del>
                     <span class="badge badge-discount">وفر ${p.discount}%</span>`
                  : ''
              }
            </div>
            <div class="detail-vat-note">جميع الأسعار تشمل ضريبة القيمة المضافة والشحن المجاني السريع لكافة المحافظات.</div>
          </div>

          <!-- Quality & Guarantees Checklist -->
          <div class="inspection-box">
            <h4><i class="fa-solid fa-clipboard-check"></i> مميزات وضمانات الجودة المعتمدة:</h4>
            <ul class="inspection-grid">
              <li><i class="fa-solid fa-check"></i> منتج أصلي معتمد 100% مطابق للمواصفات</li>
              <li><i class="fa-solid fa-check"></i> تغليف محكم وآمن ومفحوص قبل خروج الشحنة</li>
              <li><i class="fa-solid fa-check"></i> شحن سريع وتوصيل آمن لباب المنزل خلال 24–48 ساعة</li>
              <li><i class="fa-solid fa-check"></i> ضمان استبدال واسترجاع مجاني خلال 14 يوماً</li>
              <li><i class="fa-solid fa-check"></i> فواتير رسمية ودعم فني وخدمة عملاء متواصلة</li>
              <li><i class="fa-solid fa-check"></i> طرق دفع متعددة وآمنة مع إمكانية الدفع عند الاستلام</li>
            </ul>
          </div>

          <!-- Specifications Table -->
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">المواصفات والتفاصيل:</h3>
          <table class="specs-table">
            <tbody>
              <tr>
                <th>التصنيف / القسم</th>
                <td>${sectionName}</td>
              </tr>
              <tr>
                <th>كود المنتج</th>
                <td><code>${p._id}</code></td>
              </tr>
              <tr>
                <th>حالة المنتج</th>
                <td>جديد بالكرتونة الأصلية معتمد 100%</td>
              </tr>
              <tr>
                <th>التوفر بالمخزن</th>
                <td>${
                  // FIX: this used to show "متوفر للشحن الفوري" (available
                  // for instant shipping) whenever quantity was NOT > 0 -
                  // i.e. it claimed an out-of-stock product was ready to
                  // ship, and only showed the "in warehouse" message for
                  // items that actually had stock. The condition was
                  // inverted; corrected so a real zero/negative quantity
                  // is shown as out of stock.
                  Number(p.quantity) > 0
                    ? `متوفر في المستودع (${p.quantity} وحدة جاهزة للشحن)`
                    : 'غير متوفر حالياً في المخزون'
                }</td>
              </tr>
              <tr>
                <th>الضمان المعتمد</th>
                <td>ضمان رسمي معتمد شامل الاستبدال والصيانة</td>
              </tr>
              <tr>
                <th>الشحن والتسليم</th>
                <td>توصيل مجاني وسريع لكافة المحافظات</td>
              </tr>
            </tbody>
          </table>

          <!-- Description / About this item -->
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">نبذة ومواصفات المنتج:</h3>
          <div style="font-size: 14px; line-height: 1.7; color: var(--text-primary); margin-bottom: 16px;">
            ${p.description || 'منتج أصلي عالي الجودة تم اختياره وفحصه بعناية ليلبي أعلى معايير الجودة والكفاءة مع ضمان شامل.'}
          </div>
        </div>

        <!-- 3. Right Purchase Buy Box -->
        <div class="product-buy-box">
          <div class="buy-box-price">${money(price)}</div>

          <div class="buy-box-delivery">
            <i class="fa-solid fa-truck-fast" style="color: var(--success); margin-inline-end: 4px;"></i>
            <strong>توصيل مجاني</strong> خلال 24–48 ساعة.<br />
            الطلب متاح للتسليم المباشر إلى بابك.
          </div>

          <div class="buy-box-stock">
            ${
              // FIX: this line was hardcoded to always say "in stock"
              // regardless of the product's actual quantity, so a
              // sold-out product still displayed a green "in stock"
              // checkmark and let the customer add it to cart or "buy
              // now" - a request that would only fail later at
              // checkout with a generic stock error.
              Number(p.quantity) > 0
                ? '<i class="fa-solid fa-circle-check"></i> متوفر في المخزون'
                : '<i class="fa-solid fa-circle-xmark" style="color: var(--error, #dc2626);"></i> نفد المخزون حالياً'
            }
          </div>

          <div class="buy-box-qty">
            <label for="buy-box-qty-select" style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">الكمية:</label>
            <select id="buy-box-qty-select" aria-label="اختر الكمية" ${Number(p.quantity) > 0 ? '' : 'disabled'}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          <div class="buy-box-actions">
            <button class="button btn-accent btn-block" id="detail-add-cart-btn" type="button" ${Number(p.quantity) > 0 ? '' : 'disabled'}>
              <i class="fa-solid fa-cart-shopping"></i> ${Number(p.quantity) > 0 ? 'أضف إلى السلة' : 'غير متوفر حالياً'}
            </button>
            <button class="button btn-buynow btn-block" id="detail-buy-now-btn" type="button" ${Number(p.quantity) > 0 ? '' : 'disabled'}>
              <i class="fa-solid fa-bolt"></i> اشتري الآن
            </button>
          </div>

          <div class="buy-box-guarantees">
            <span><i class="fa-solid fa-lock"></i> معاملة شراء آمنة ومشفرة 100%</span>
            <span><i class="fa-solid fa-box"></i> شحن بواسطة: <strong>متجري إكسبريس</strong></span>
            <span><i class="fa-solid fa-shop"></i> يباع من: <strong>متجري المعتمد</strong></span>
            <span><i class="fa-solid fa-arrow-rotate-left"></i> قابل للإرجاع خلال 14 يوماً مع ضمان شامل</span>
          </div>
        </div>
      </div>
    `;

    // Gallery thumbnail clicks
    const mainImgEl = root.querySelector('#primary-gallery-img');
    const thumbEls = root.querySelectorAll('.gallery-thumb');
    thumbEls.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        thumbEls.forEach((t) => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        const newSrc = thumb.getAttribute('data-src');
        if (mainImgEl && newSrc) {
          mainImgEl.src = newSrc;
        }
      });
    });

    // Add to Cart handler
    const qtySelect = root.querySelector('#buy-box-qty-select');
    root.querySelector('#detail-add-cart-btn').onclick = () => {
      const qty = Number(qtySelect?.value || 1);
      addItem(p, qty);
      toast(`تمت إضافة ${p.name} إلى السلة (${qty} قطعة)`, 'success');
    };

    // Buy Now handler
    root.querySelector('#detail-buy-now-btn').onclick = () => {
      const qty = Number(qtySelect?.value || 1);
      addItem(p, qty);
      window.location.href = '/cart.html';
    };

    // Fetch and render reviews
    await fetchAndRenderReviews();
  } catch (err) {
    state(root, 'تعذر تحميل بيانات ومواصفات المنتج أو أنه غير متوفر حالياً.', 'error');
  }
}

async function fetchAndRenderReviews() {
  try {
    const res = await request(`/api/get_product_reviews?product_id=${encodeURIComponent(id)}`);
    const reviews = res.data || [];
    reviewList(reviews);
    updateReviewSummary(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    reviewList([]);
    updateReviewSummary([]);
  }
}

initSite().then(async (user) => {
  await load();

  const form = document.querySelector('#review-form');
  const starBtns = document.querySelectorAll('.star-option');
  const ratingInput = document.querySelector('#review-rating-value');
  const ratingLabel = document.querySelector('#star-picker-label');
  const nameField = document.querySelector('#review-name-field');
  const nameInput = document.querySelector('input[name="user_name"]');

  const ratingDescriptions = {
    1: '1 نجمة (سيء)',
    2: '2 نجمتان (مقبول)',
    3: '3 نجوم (جيد)',
    4: '4 نجوم (جيد جداً)',
    5: '5 نجوم (ممتاز)'
  };

  // If user is logged in, autofill name
  if (user && nameInput) {
    nameInput.value = user.name || '';
    if (nameField) {
      nameField.innerHTML = `
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
          كتابة المراجعة كـ: <strong style="color: var(--text-primary);">${user.name || user.email}</strong>
        </div>
      `;
    }
  }

  // Star Rating Picker interactive logic
  function setStarRating(rating) {
    if (ratingInput) ratingInput.value = rating;
    if (ratingLabel) ratingLabel.textContent = ratingDescriptions[rating] || `${rating} نجوم`;

    starBtns.forEach((btn) => {
      const val = Number(btn.getAttribute('data-val'));
      if (val <= rating) {
        btn.classList.remove('fa-regular');
        btn.classList.add('fa-solid');
        btn.style.color = '#f59e0b';
      } else {
        btn.classList.remove('fa-solid');
        btn.classList.add('fa-regular');
        btn.style.color = '#d1d5db';
      }
    });
  }

  starBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-val')) || 5;
      setStarRating(val);
    });
  });

  // Handle Review Submission
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('#submit-review-btn');
      const reviewText = form.review_text?.value?.trim();
      const rating = Number(ratingInput?.value) || 5;
      const userName = user?.name || form.user_name?.value?.trim() || 'عميل موثق';

      if (!reviewText) {
        toast('يرجى كتابة نص المراجعة أو التعليق', 'error');
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ النشر...';
        }

        const res = await request('/api/post_review', {
          method: 'POST',
          body: {
            product_id: id,
            review_text: reviewText,
            rating,
            user_name: userName
          }
        });

        if (res && res.success) {
          toast('تم نشر مراجعتك وتقييمك بنجاح!', 'success');
          form.review_text.value = '';
          setStarRating(5);
          await fetchAndRenderReviews();
        } else {
          toast(res?.message || 'تعذر حفظ المراجعة', 'error');
        }
      } catch (err) {
        toast('حدث خطأ أثناء إرسال المراجعة. حاول مرة أخرى.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> نشر المراجعة والتقييم';
        }
      }
    };
  }

  // Real-time review listener
  onEvent('new_review', (e) => {
    if (String(e.product_id) === String(id)) {
      fetchAndRenderReviews();
    }
  });
});
