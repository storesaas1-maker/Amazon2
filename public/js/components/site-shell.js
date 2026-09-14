import { request, fetchAllProducts } from '../api.js';

let cachedProducts = null;
let cachedSections = null;

async function getSearchData() {
  if (!cachedProducts) {
    try {
      cachedProducts = await fetchAllProducts();
    } catch {
      cachedProducts = [];
    }
  }
  if (!cachedSections) {
    try {
      const res = await request('/api/get_all_sections', { silent: true });
      cachedSections = res.data || [];
    } catch {
      cachedSections = [];
    }
  }
  return { products: cachedProducts, sections: cachedSections };
}

export function mountSiteShell({ active = 'home' } = {}) {
  const header = document.querySelector('[data-site-header]');
  const footer = document.querySelector('[data-site-footer]');

  if (header) {
    header.className = 'site-header';
    header.innerHTML = `
      <!-- Desktop Top Header -->
      <div class="header-top">
        <div class="container">
          <!-- Brand Logo -->
          <a class="header-brand" href="/index.html" id="site-logo">
            <i class="fa-solid fa-bag-shopping brand-badge" aria-hidden="true"></i>
            <span data-store-name>متجري</span>
            <span class="brand-tld">.com</span>
          </a>

          <!-- Deliver To Location -->
          <div class="header-deliver-to" id="header-deliver-info" title="موقع التوصيل المعتمد">
            <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
            <div>
              <span class="sub-text">التوصيل إلى</span>
              <span class="main-text">مصر • سريع ومجاني</span>
            </div>
          </div>

          <!-- Large Central Search Bar -->
          <div class="header-search">
            <form class="header-search-form" action="/products.html" method="GET" role="search" id="desktop-search-form">
              <div class="search-category-select">
                <select name="section" id="header-category-select" aria-label="فئات البحث">
                  <option value="">كل الأقسام</option>
                </select>
              </div>
              <div class="search-input-wrap">
                <input 
                  type="search" 
                  name="q" 
                  id="header-search-input" 
                  placeholder="ابحث في آلاف الأجهزة والمنتجات..." 
                  autocomplete="off"
                  aria-label="بحث في المنتجات"
                />
                <div class="search-suggestions" id="header-search-suggestions" hidden></div>
              </div>
              <button type="submit" class="search-submit-btn" aria-label="تنفيذ البحث" id="desktop-search-btn">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              </button>
            </form>
          </div>

          <!-- Right Action Items -->
          <div class="header-actions">
            <!-- Account & Lists Menu -->
            <div class="header-account-wrap" id="header-account-wrapper">
              <a class="header-nav-item" href="/login.html" data-account-link id="header-account-nav">
                <span class="sub-label" data-account-sub>مرحباً، تسجيل الدخول</span>
                <span class="main-label" data-account-main>
                  <span data-account>الحساب والقوائم</span>
                  <i class="fa-solid fa-caret-down" aria-hidden="true"></i>
                </span>
              </a>

              <div class="account-flyout" id="account-flyout">
                <div class="flyout-auth-header" data-flyout-guest>
                  <a href="/login.html" class="button btn-accent btn-sm">تسجيل الدخول</a>
                  <p class="flyout-signup-prompt">عميل جديد؟ <a href="/register.html">ابدأ من هنا</a></p>
                </div>

                <div class="flyout-col">
                  <h4>قوائمك وتصفحك</h4>
                  <a href="/cart.html"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> سلة المشتريات</a>
                  <a href="/products.html"><i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i> كل الأقسام والمنتجات</a>
                  <a href="/products.html?deal=1"><i class="fa-solid fa-bolt" aria-hidden="true"></i> عروض وتخفيضات اليوم</a>
                </div>

                <div class="flyout-col" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                  <h4>حسابك وإعداداتك</h4>
                  <a href="/orders.html"><i class="fa-solid fa-box-open" aria-hidden="true"></i> طلباتي ومشترياتي</a>
                  <a href="/ai-assistant.html"><i class="fa-solid fa-robot" aria-hidden="true"></i> المساعد الذكي AI</a>
                  <div data-staff-links></div>
                  <button type="button" class="flyout-logout-btn" id="logout-btn" hidden>
                    <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> تسجيل الخروج
                  </button>
                </div>
              </div>
            </div>

            <!-- Returns & Orders -->
            <a class="header-nav-item" href="/orders.html" id="header-orders-nav">
              <span class="sub-label">المشتريات</span>
              <span class="main-label">& الطلبات</span>
            </a>

            <!-- Cart Pill / Icon with Counter -->
            <a class="header-nav-item header-cart-link" href="/cart.html" id="header-cart-nav" aria-label="عرض سلة التسوق">
              <div class="cart-icon-wrap">
                <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
                <span class="cart-count-badge" data-cart-count>0</span>
              </div>
              <span class="main-label cart-label">السلة</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Mobile Top Bar -->
      <div class="mobile-header-top">
        <button class="subnav-all-btn" type="button" id="mobile-drawer-toggle" aria-label="فتح القائمة الرئيسية">
          <i class="fa-solid fa-bars" aria-hidden="true"></i>
        </button>

        <a class="header-brand" href="/index.html">
          <i class="fa-solid fa-bag-shopping brand-badge" aria-hidden="true"></i>
          <span data-store-name>متجري</span>
        </a>

        <div style="display:flex; align-items:center; gap: 8px;">
          <a class="header-nav-item" href="/orders.html" aria-label="الطلبات">
            <i class="fa-solid fa-box-open" style="font-size: 18px;" aria-hidden="true"></i>
          </a>
          <a class="header-nav-item header-cart-link" href="/cart.html" aria-label="السلة">
            <div class="cart-icon-wrap">
              <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
              <span class="cart-count-badge" data-cart-count>0</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Mobile Search Form -->
      <div class="mobile-header-search">
        <form class="header-search-form" action="/products.html" method="GET" role="search">
          <div class="search-input-wrap">
            <input 
              type="search" 
              name="q" 
              placeholder="ابحث في آلاف الأجهزة والمنتجات..." 
              autocomplete="off"
              aria-label="بحث في المنتجات"
            />
          </div>
          <button type="submit" class="search-submit-btn" aria-label="تنفيذ البحث">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          </button>
        </form>
      </div>

      <!-- Second Navigation Bar (#232F3E) -->
      <nav class="header-subnav" aria-label="أقسام الموقع">
        <div class="container">
          <!-- All Categories Hamburger Button -->
          <button class="subnav-all-btn" type="button" id="subnav-drawer-toggle" aria-label="فتح كل الأقسام">
            <i class="fa-solid fa-bars" aria-hidden="true"></i>
            <span>كل الأقسام</span>
          </button>

          <!-- Navigation Links -->
          <div class="subnav-links" id="subnav-links-bar">
            <a class="subnav-link ${active === 'deals' ? 'is-active' : ''}" href="/products.html?deal=1">
              <i class="fa-solid fa-bolt" style="color: var(--accent); margin-inline-end: 4px;" aria-hidden="true"></i>
              عروض وتخفيضات اليوم
            </a>
            <a class="subnav-link ${active === 'shop' ? 'is-active' : ''}" href="/products.html">جميع المنتجات</a>
            <span id="subnav-dynamic-categories"></span>
            <a class="subnav-link" href="/products.html?sort=top-rated">الأعلى تقييماً</a>
            <a class="subnav-link" href="/products.html?sort=price-desc">الأكثر طلباً</a>
            <a class="subnav-link ${active === 'ai' ? 'is-active' : ''}" href="/ai-assistant.html">المساعد الذكي</a>
          </div>

          <div class="subnav-promo">
            <i class="fa-solid fa-truck-fast" aria-hidden="true"></i>
            <span data-banner>توصيل مجاني سريع وضمان استبدال معتمد لكافة المحافظات</span>
          </div>
        </div>
      </nav>

      <!-- Off-Canvas Sidebar Drawer for Categories & Navigation -->
      <div class="drawer-backdrop" id="sidebar-drawer-backdrop" aria-hidden="true">
        <div class="sidebar-drawer" role="dialog" aria-modal="true" aria-label="قائمة الأقسام والتنقل">
          <div class="drawer-header">
            <div class="drawer-user-info">
              <i class="fa-solid fa-circle-user" aria-hidden="true"></i>
              <span data-drawer-greeting>مرحباً، سجل الدخول</span>
            </div>
            <button class="drawer-close-btn" id="drawer-close-btn" type="button" aria-label="إغلاق القائمة">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <div class="drawer-body">
            <div class="drawer-section">
              <h3 class="drawer-section-title">التسوق حسب القسم</h3>
              <div id="drawer-categories-list">
                <a class="drawer-link-item" href="/products.html">
                  <span>كل المنتجات المتاحة</span>
                  <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                </a>
              </div>
            </div>

            <div class="drawer-section">
              <h3 class="drawer-section-title">العروض والبرامج</h3>
              <a class="drawer-link-item" href="/products.html?deal=1">
                <span>عروض اليوم والتخفيضات</span>
                <i class="fa-solid fa-bolt" style="color: var(--accent);" aria-hidden="true"></i>
              </a>
              <a class="drawer-link-item" href="/products.html?sort=top-rated">
                <span>المنتجات الأعلى تقييماً</span>
                <i class="fa-solid fa-star" style="color: #FF9900;" aria-hidden="true"></i>
              </a>
              <a class="drawer-link-item" href="/products.html?sort=price-desc">
                <span>المنتجات الأكثر مبيعاً</span>
                <i class="fa-solid fa-fire" style="color: #E67A00;" aria-hidden="true"></i>
              </a>
              <a class="drawer-link-item" href="/ai-assistant.html">
                <span>استشارة المساعد الذكي AI</span>
                <i class="fa-solid fa-robot" style="color: var(--link);" aria-hidden="true"></i>
              </a>
            </div>

            <div class="drawer-section">
              <h3 class="drawer-section-title">المساعدة والإعدادات</h3>
              <a class="drawer-link-item" href="/orders.html">
                <span>طلباتك وشحناتك</span>
                <i class="fa-solid fa-box-open" aria-hidden="true"></i>
              </a>
              <a class="drawer-link-item" href="/cart.html">
                <span>سلة المشتريات</span>
                <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
              </a>
              <a class="drawer-link-item" href="/login.html" data-drawer-account-link>
                <span data-drawer-account-text>تسجيل الدخول</span>
                <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize Drawer toggling
    const backdrop = header.querySelector('#sidebar-drawer-backdrop');
    const openBtns = header.querySelectorAll('#subnav-drawer-toggle, #mobile-drawer-toggle');
    const closeBtn = header.querySelector('#drawer-close-btn');

    const openDrawer = () => {
      backdrop?.classList.add('is-open');
      backdrop?.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    const closeDrawer = () => {
      backdrop?.classList.remove('is-open');
      backdrop?.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    openBtns.forEach((btn) => btn.addEventListener('click', openDrawer));
    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeDrawer();
    });

    // Populate category dropdown, subnav shortcuts, and drawer
    // FIX: the subnav category shortcuts used to be hardcoded to fake
    // ids (section=sec_1/sec_2/sec_4) that never match real MongoDB
    // ObjectIds returned by /api/get_all_sections, so those links
    // always led to an empty "no products found" page. They're now
    // built from the store's actual sections, exactly like the drawer
    // list below already does correctly.
    getSearchData().then(({ sections }) => {
      const select = header.querySelector('#header-category-select');
      const drawerCats = header.querySelector('#drawer-categories-list');
      const subnavDynamic = header.querySelector('#subnav-dynamic-categories');

      if (select && sections.length) {
        sections.forEach((sec) => {
          const opt = document.createElement('option');
          opt.value = sec._id || sec.name;
          opt.textContent = sec.name;
          select.appendChild(opt);
        });
      }

      if (subnavDynamic && sections.length) {
        subnavDynamic.innerHTML = sections
          .slice(0, 5)
          .map(
            (sec) => `
          <a class="subnav-link" href="/products.html?section=${encodeURIComponent(sec._id || sec.name)}">${sec.name}</a>`
          )
          .join('');
      }

      if (drawerCats && sections.length) {
        drawerCats.innerHTML = sections
          .map(
            (sec) => `
          <a class="drawer-link-item" href="/products.html?section=${encodeURIComponent(sec._id || sec.name)}">
            <span>${sec.name}</span>
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
          </a>`
          )
          .join('');
      }
    });

    // Live search autocomplete suggestions
    const searchInput = header.querySelector('#header-search-input');
    const suggestionsBox = header.querySelector('#header-search-suggestions');

    if (searchInput && suggestionsBox) {
      searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 2) {
          suggestionsBox.hidden = true;
          suggestionsBox.innerHTML = '';
          return;
        }

        const { products } = await getSearchData();
        const matches = products.filter(
          (p) =>
            (p.name || '').toLowerCase().includes(query) ||
            (p.section?.name && p.section.name.toLowerCase().includes(query)) ||
            (p.description && p.description.toLowerCase().includes(query))
        ).slice(0, 6);

        if (!matches.length) {
          suggestionsBox.hidden = true;
          return;
        }

        suggestionsBox.innerHTML = matches
          .map(
            (p) => `
          <a class="search-suggestion-item" href="/product.html?id=${encodeURIComponent(p._id)}">
            <div class="suggestion-query">
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <span>${p.name}</span>
            </div>
            ${p.section?.name ? `<span class="suggestion-category">${p.section.name}</span>` : ''}
          </a>`
          )
          .join('');
        suggestionsBox.hidden = false;
      });

      // Close suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
          suggestionsBox.hidden = true;
        }
      });
    }

    // Logout button handler in flyout
    const logoutBtn = header.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        // FIX: the session cookie is httpOnly, so it can never be cleared
        // from client-side JS (that's the point of httpOnly). Removing
        // localStorage keys did nothing to the real cookie, so the user
        // stayed signed in after "logging out". A server-side endpoint
        // now clears the cookie; we still clean up the unrelated
        // localStorage keys and reload afterwards either way.
        try {
          await fetch('/api/auth/log_out', { method: 'POST', credentials: 'include' });
        } catch (_) {
          // ignore network errors - fall through and reload regardless
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
      });
    }
  }

  // ------------------------------------------------------------------------
  // Structured Multi-Column Footer (Sec 27)
  // ------------------------------------------------------------------------
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `
      <!-- Back to top button -->
      <div class="footer-back-to-top" id="footer-back-to-top" role="button" tabindex="0">
        <i class="fa-solid fa-chevron-up" aria-hidden="true" style="margin-inline-end: 6px;"></i>
        الرجوع إلى أعلى الصفحة
      </div>

      <!-- Main footer links grid -->
      <div class="footer-main">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-col">
              <h4>التعرف علينا</h4>
              <ul class="footer-links-list">
                <li><a href="/index.html">معلومات عن متجري</a></li>
                <li><a href="/products.html">كتالوج المنتجات والأقسام</a></li>
                <li><a href="/ai-assistant.html">مساعد التسوق الذكي AI</a></li>
                <li><a href="/index.html#trust">معايير الجودة والأصالة</a></li>
                <li><a href="/products.html?deal=1">عروض وتخفيضات الأسبوع</a></li>
              </ul>
            </div>

            <div class="footer-col">
              <h4>تسوق معنا</h4>
              <ul class="footer-links-list">
                <li><a href="/products.html">جميع الأقسام والمنتجات</a></li>
                <li><a href="/products.html?sort=price-desc">المنتجات الأكثر طلباً</a></li>
                <li><a href="/products.html?sort=top-rated">المنتجات الأعلى تقييماً</a></li>
                <li><a href="/products.html?deal=1">عروض وتخفيضات اليوم</a></li>
                <li><a href="/cart.html">سلة التسوق والمشتريات</a></li>
              </ul>
            </div>

            <div class="footer-col">
              <h4>حسابك وخدماتك</h4>
              <ul class="footer-links-list">
                <li><a href="/login.html">حسابك الشخصي</a></li>
                <li><a href="/orders.html">متابعة شحناتك وطلباتك</a></li>
                <li><a href="/cart.html">إدارة مشترياتك</a></li>
                <li><a href="/register.html">إنشاء حساب تاجر أو عميل</a></li>
              </ul>
            </div>

            <div class="footer-col">
              <h4>المساعدة والسياسات</h4>
              <ul class="footer-links-list">
                <li><a href="/ai-assistant.html">خدمة العملاء والدعم الفني</a></li>
                <li><a href="#">سياسة الإرجاع خلال 14 يوماً</a></li>
                <li><a href="#">شروط وأحكام الضمان 90 يوماً</a></li>
                <li><a href="#">الشحن والتوصيل المجاني المعتمد</a></li>
                <li><a href="#">إشعار الخصوصية والأمان</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Brand and Legal Strip -->
      <div class="footer-brand-strip">
        <div class="container">
          <div class="footer-legal-links">
            <a href="#">شروط الاستخدام والبيع</a>
            <a href="#">إشعار الخصوصية</a>
            <a href="#">ملفات تعريف الارتباط (Cookies)</a>
            <a href="#">الإعلانات القائمة على الاهتمامات</a>
          </div>
          <div class="footer-copyright">
            © 2026 متجري.كوم (Matgari Inc.) — جميع الحقوق محفوظة ومنصة تسوق معتمدة.
          </div>
        </div>
      </div>
    `;

    // Back to top scroll handler
    const backToTop = footer.querySelector('#footer-back-to-top');
    backToTop?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
