import { request, fetchAllProducts } from '../api.js';
import { productCard } from '../components/product-card.js';
import { mountSiteShell } from '../components/site-shell.js';
import { initSite, state } from './common.js';
import { onEvent } from '../socket-client.js';

mountSiteShell({ active: 'shop' });

const list = document.querySelector('#products');
const form = document.querySelector('#filters');
const sentinel = document.querySelector('#scroll-sentinel');
const resultsSummary = document.querySelector('#results-count-summary');
const chipsBar = document.querySelector('#active-filter-chips');
const sortSelect = document.querySelector('#catalog-sort-select');

let products = [];
let sections = [];
let currentPage = 1;
const productsPerPage = 20;
let totalPages = 1;
let productsLoading = false;

// --------------------------------------------------------------------------
// Parse URL Query Params on Load
// --------------------------------------------------------------------------
const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get('q') || '';
const initialSection = urlParams.get('section') || '';
const initialSort = urlParams.get('sort') || '';
const initialDeal = urlParams.get('deal') || '';

if (initialQuery) {
  document.querySelector('#filter-q-input').value = initialQuery;
}
if (initialSort) {
  document.querySelector('#filter-sort-input').value = initialSort;
  if (sortSelect) sortSelect.value = initialSort;
}
if (initialDeal) {
  document.querySelector('#filter-discount-input').value = '10';
  const dealRadio = form?.querySelector('input[name="discount_radio"][value="10"]');
  if (dealRadio) dealRadio.checked = true;
}

// --------------------------------------------------------------------------
// Render Products with Filtering & Sorting
// --------------------------------------------------------------------------
function render() {
  if (!form || !list) return;

  const query = new FormData(form);
  const q = String(query.get('q') || '').toLowerCase().trim();
  const section = query.get('section');
  const min = Number(query.get('min') || 0);
  const max = Number(query.get('max') || Infinity);
  const sort = query.get('sort') || (sortSelect ? sortSelect.value : '');
  const ratingFilterVal = query.get('min_rating') || '';
  const minDiscount = Number(query.get('discount_min') || 0);

  // Filter products
  let filtered = products.filter((p) => {
    const matchesSearch =
      !q ||
      `${p.name || ''} ${p.description || ''}`.toLowerCase().includes(q);

    const productSectionId =
      p.section && typeof p.section === 'object' ? p.section._id : p.section;
    const matchesSection = !section || productSectionId === section;

    const price = Number(p.final_price ?? p.price);
    const matchesMinPrice = price >= min;
    const matchesMaxPrice = price <= max;

    const discount = Number(p.discount || 0);
    const matchesDiscount = discount >= minDiscount;

    // Real review stats without fake fallbacks
    const prodReviewsCount = Number(p.reviews_count || 0);
    const prodRating = Number(p.rating || 0);
    let matchesRating = true;

    if (ratingFilterVal === 'has-reviews') {
      matchesRating = prodReviewsCount > 0;
    } else if (ratingFilterVal) {
      const minRating = Number(ratingFilterVal);
      matchesRating = prodReviewsCount > 0 && prodRating >= minRating;
    }

    return (
      matchesSearch &&
      matchesSection &&
      matchesMinPrice &&
      matchesMaxPrice &&
      matchesDiscount &&
      matchesRating
    );
  });

  // Sort products
  if (sort === 'price-asc') {
    filtered.sort(
      (a, b) => Number(a.final_price ?? a.price) - Number(b.final_price ?? b.price)
    );
  } else if (sort === 'price-desc') {
    filtered.sort(
      (a, b) => Number(b.final_price ?? b.price) - Number(a.final_price ?? a.price)
    );
  } else if (sort === 'discount') {
    filtered.sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0));
  } else if (sort === 'rating' || sort === 'top-rated') {
    // Top rated: products with highest rating score first, breaking ties with reviews count
    filtered.sort((a, b) => {
      const diffRating = Number(b.rating || 0) - Number(a.rating || 0);
      if (Math.abs(diffRating) > 0.01) return diffRating;
      return Number(b.reviews_count || 0) - Number(a.reviews_count || 0);
    });
  } else if (sort === 'most-reviews') {
    // Most reviews: products with most reviews/comments first, breaking ties with rating
    filtered.sort((a, b) => {
      const diffCount = Number(b.reviews_count || 0) - Number(a.reviews_count || 0);
      if (diffCount !== 0) return diffCount;
      return Number(b.rating || 0) - Number(a.rating || 0);
    });
  } else if (sort === 'bestseller') {
    filtered.sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0));
  }

  // Update Result Count Summary
  if (resultsSummary) {
    const activeSecObj = sections.find((s) => s._id === section);
    const title = activeSecObj ? activeSecObj.name : q ? `"${q}"` : 'جميع المنتجات';
    resultsSummary.innerHTML = `عرض <strong>${filtered.length}</strong> منتج لـ <strong>${title}</strong>`;
  }

  // Render Filter Chips
  renderChips({ q, section, min, max, ratingFilterVal, minDiscount });

  // Render Grid
  list.replaceChildren();
  if (filtered.length === 0) {
    state(
      list,
      'لا توجد منتجات مطابقة لاختياراتك الحالية. جرّب إزالة بعض الفلاتر.',
      'empty'
    );
    if (sentinel) sentinel.textContent = '';
  } else {
    list.append(...filtered.map(productCard));
    if (sentinel) sentinel.textContent = 'تم عرض كافة المنتجات المطابقة.';
  }
}

// --------------------------------------------------------------------------
// Active Filter Chips
// --------------------------------------------------------------------------
function renderChips({ q, section, min, max, ratingFilterVal, minDiscount }) {
  if (!chipsBar) return;
  const chips = [];

  if (q) {
    chips.push({
      label: `بحث: ${q}`,
      clear: () => {
        document.querySelector('#filter-q-input').value = '';
      },
    });
  }

  if (section) {
    const sObj = sections.find((s) => s._id === section);
    chips.push({
      label: `القسم: ${sObj?.name || section}`,
      clear: () => {
        const rad = form.querySelector('input[name="section"][value=""]');
        if (rad) rad.checked = true;
      },
    });
  }

  if (min > 0 || max < Infinity) {
    chips.push({
      label: `السعر: ${min.toLocaleString('ar-EG')} - ${max === Infinity ? 'الكل' : max.toLocaleString('ar-EG')} ج.م`,
      clear: () => {
        document.querySelector('#price-min').value = '';
        document.querySelector('#price-max').value = '';
        const allPreset = form.querySelector('input[name="price_preset"][value="all"]');
        if (allPreset) allPreset.checked = true;
      },
    });
  }

  if (ratingFilterVal === 'has-reviews') {
    chips.push({
      label: 'المنتجات المقيّمة فقط',
      clear: () => {
        document.querySelector('#filter-rating-input').value = '';
        form.querySelectorAll('input[name="rating_radio"]').forEach((r) => (r.checked = r.value === ''));
      },
    });
  } else if (ratingFilterVal) {
    chips.push({
      label: `${ratingFilterVal} نجوم وأعلى`,
      clear: () => {
        document.querySelector('#filter-rating-input').value = '';
        form.querySelectorAll('input[name="rating_radio"]').forEach((r) => (r.checked = r.value === ''));
      },
    });
  }

  if (minDiscount > 0) {
    chips.push({
      label: `خصم ${minDiscount}% أو أكثر`,
      clear: () => {
        document.querySelector('#filter-discount-input').value = '';
        form.querySelectorAll('input[name="discount_radio"]').forEach((r) => (r.checked = false));
      },
    });
  }

  if (chips.length === 0) {
    chipsBar.hidden = true;
    chipsBar.innerHTML = '';
    return;
  }

  chipsBar.hidden = false;
  chipsBar.innerHTML = chips
    .map(
      (c, idx) => `
    <span class="filter-chip" data-chip-idx="${idx}">
      <span>${c.label}</span>
      <i class="fa-solid fa-xmark filter-chip-remove" role="button" aria-label="إزالة الفلتر"></i>
    </span>`
    )
    .join('');

  chipsBar.querySelectorAll('.filter-chip').forEach((chipEl, idx) => {
    chipEl.querySelector('.filter-chip-remove').onclick = () => {
      chips[idx].clear();
      render();
    };
  });
}

// --------------------------------------------------------------------------
// Load Sections and Populate Sidebar
// --------------------------------------------------------------------------
async function loadSections() {
  try {
    const res = await request('/api/get_all_sections');
    sections = res.data || [];
  } catch {
    sections = [];
  }

  const container = document.querySelector('#sidebar-categories-list');
  if (container) {
    const selectedSec = initialSection;
    const items = [
      `
      <label class="filter-item-label">
        <input type="radio" name="section" value="" ${!selectedSec ? 'checked' : ''} />
        <span>جميع الأقسام</span>
      </label>
    `,
      ...sections.map(
        (s) => `
      <label class="filter-item-label">
        <input type="radio" name="section" value="${s._id}" ${selectedSec === s._id ? 'checked' : ''} />
        <span>${s.name}</span>
      </label>
    `
      ),
    ];
    container.innerHTML = items.join('');
  }
}

// --------------------------------------------------------------------------
// Compute per-product rating / review count
// --------------------------------------------------------------------------
// FIX: this page's filter/sort logic (rating filter, "top-rated",
// "most-reviews") and product-card.js both read `product.rating` /
// `product.reviews_count` directly, but the backend never computes or
// returns those aggregate fields on a product - only a raw `reviews`
// array exists (see models/products.js). Every product therefore had
// `rating`/`reviews_count` permanently undefined, so the rating filter
// silently matched nothing, "top-rated"/"most-reviews" sorting was a
// no-op, and every product card on this page showed 0 stars / 0
// reviews even for products with real reviews. index.page.js already
// solved this the same way for the homepage; replicating that fix here
// so the catalog page and its cards are consistent with it.
function enrichWithRating(product) {
  const reviewsArray = Array.isArray(product.reviews) ? product.reviews : [];
  const reviewsCount = reviewsArray.length;

  let avgRating = 0;
  if (reviewsCount > 0) {
    const withScore = reviewsArray.filter((r) => r && Number(r.rating) > 0);
    if (withScore.length > 0) {
      const sum = withScore.reduce((acc, r) => acc + Number(r.rating), 0);
      avgRating = Number((sum / withScore.length).toFixed(1));
    } else {
      avgRating = 5.0;
    }
  }

  return { ...product, rating: avgRating, reviews_count: reviewsCount };
}

// --------------------------------------------------------------------------
// Load Products
// --------------------------------------------------------------------------
async function loadProducts() {
  if (productsLoading) return;
  productsLoading = true;
  state(list, 'جارٍ تحميل المنتجات...', 'loading');

  try {
    products = (await fetchAllProducts()).map(enrichWithRating);
    render();
  } catch {
    state(list, 'تعذر تحميل المنتجات من الخادم.', 'error');
  } finally {
    productsLoading = false;
  }
}

// --------------------------------------------------------------------------
// Wire Events and Filters
// --------------------------------------------------------------------------
function setupEvents() {
  // Sorting select
  if (sortSelect) {
    sortSelect.onchange = (e) => {
      document.querySelector('#filter-sort-input').value = e.target.value;
      render();
    };
  }

  // Live input changes in form
  form.onchange = (e) => {
    // Handle price presets
    if (e.target.name === 'price_preset') {
      const val = e.target.value;
      const minInput = document.querySelector('#price-min');
      const maxInput = document.querySelector('#price-max');
      if (val === 'all') {
        minInput.value = '';
        maxInput.value = '';
      } else {
        const [pMin, pMax] = val.split('-');
        minInput.value = pMin || '';
        maxInput.value = pMax === '999999' ? '' : pMax || '';
      }
    }

    // Handle rating radio
    if (e.target.name === 'rating_radio') {
      document.querySelector('#filter-rating-input').value = e.target.value;
    }

    // Handle discount radio
    if (e.target.name === 'discount_radio') {
      document.querySelector('#filter-discount-input').value = e.target.value;
    }

    render();
  };

  // Price apply button
  const applyPriceBtn = document.querySelector('#apply-price-btn');
  if (applyPriceBtn) {
    applyPriceBtn.onclick = () => {
      // Uncheck preset radios if custom values entered
      const allRadio = form.querySelector('input[name="price_preset"][value="all"]');
      if (allRadio) allRadio.checked = false;
      render();
    };
  }

  // Clear all filters button
  const clearBtn = document.querySelector('#clear-filters-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      form.reset();
      document.querySelector('#filter-q-input').value = '';
      document.querySelector('#filter-sort-input').value = '';
      document.querySelector('#filter-rating-input').value = '';
      document.querySelector('#filter-discount-input').value = '';
      if (sortSelect) sortSelect.value = '';
      render();
    };
  }

  // Mobile Filter Drawer Toggle
  const openMobileBtn = document.querySelector('#open-mobile-filters-btn');
  const closeMobileBtn = document.querySelector('#close-mobile-filters-btn');
  const sidebar = document.querySelector('#catalog-sidebar');

  if (openMobileBtn && sidebar) {
    openMobileBtn.onclick = () => {
      sidebar.classList.add('is-open');
      if (closeMobileBtn) closeMobileBtn.style.display = 'block';
    };
  }
  if (closeMobileBtn && sidebar) {
    closeMobileBtn.onclick = () => {
      sidebar.classList.remove('is-open');
      closeMobileBtn.style.display = 'none';
    };
  }
}

// --------------------------------------------------------------------------
// Start Page
// --------------------------------------------------------------------------
initSite().then(async () => {
  await loadSections();
  await loadProducts();
  setupEvents();

  // Real-time synchronization
  onEvent('new_review', () => {
    loadProducts();
  });
  onEvent('new_product', () => {
    loadProducts();
  });
  onEvent('update_product', () => {
    loadProducts();
  });
  onEvent('deleted_product', () => {
    loadProducts();
  });
});
