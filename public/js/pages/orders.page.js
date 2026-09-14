import { request } from '../api.js';
import { checkAuth } from '../auth-guard.js';
import { statusBadge } from '../components/status-badge.js';
import { onEvent, joinRooms } from '../socket-client.js';
import { initSite, state, money } from './common.js';
import { mountSiteShell } from '../components/site-shell.js';
import { addItem } from '../cart-store.js';
import { toast } from '../toast.js';

mountSiteShell({ active: 'orders' });

const root = document.querySelector('#orders');
let allOrders = [];
let activeTab = 'all';

function getStatusStep(status) {
  switch (status) {
    case 'new':
    case 'pending':
    case 'pending_payment':
      return 1;
    case 'confirmed':
    case 'processing':
      return 2;
    case 'shipped':
    case 'out_for_delivery':
      return 3;
    case 'delivered':
    case 'completed':
      return 4;
    default:
      return 1;
  }
}

function getStatusTitle(status) {
  switch (status) {
    case 'new':
    case 'pending':
      return 'تم استلام طلبك وجارٍ المراجعة';
    case 'confirmed':
    case 'processing':
      return 'تم تأكيد طلبك وجارٍ تجهيزه وتغليفه في المستودع';
    case 'shipped':
    case 'out_for_delivery':
      return 'خرج للشحن والتوصيل مع مندوب متجري إكسبريس';
    case 'delivered':
    case 'completed':
      return 'تم تسليم الشحنة بنجاح';
    case 'cancelled':
      return 'تم إلغاء الطلب';
    default:
      return 'طلبك قيد المتابعة';
  }
}

function resolveProductImage(pData) {
  let img = pData?.image || '';
  if (img && !img.includes('photo-1592750475338-74b7b21085ab')) {
    return img;
  }
  const title = (pData?.name || '').toLowerCase();
  if (title.includes('تلاجة') || title.includes('تلاجه') || title.includes('ثلاجة') || title.includes('ثلاجه') || title.includes('refrigerator')) {
    return 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('شاشة') || title.includes('تلفزيون') || title.includes('tv')) {
    return 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('قهوة') || title.includes('اسبريسو') || title.includes('coffee')) {
    return 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('قلاية') || title.includes('fryer')) {
    return 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('مكنسة') || title.includes('vacuum')) {
    return 'https://images.unsplash.com/photo-1610492461128-4bc2794c4897?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('حذاء') || title.includes('شوز') || title.includes('shoes')) {
    return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('عطر') || title.includes('perfume')) {
    return 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('ساعة') || title.includes('watch')) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('لابتوب') || title.includes('كمبيوتر') || title.includes('laptop')) {
    return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('خلاط') || title.includes('blender')) {
    return 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80';
  }
  return img || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';
}

function showInvoiceModal(order) {
  const existing = document.querySelector('#invoice-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'invoice-modal';
  modal.className = 'invoice-modal-backdrop';

  const dateStr = order.created_at || order.createdAt
    ? new Date(order.created_at || order.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'اليوم';

  const items = Array.isArray(order.products) ? order.products : [];

  modal.innerHTML = `
    <div class="invoice-modal-dialog">
      <div class="invoice-modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-file-invoice-dollar" style="color: #FF9900; font-size: 20px;"></i>
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">فاتورة ضريبية رسمية • #${order.orderNumber || order._id}</h3>
        </div>
        <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #64748B;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="invoice-modal-body">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 14px; margin-bottom: 14px;">
          <div>
            <strong style="font-size: 15px; color: #0F172A;">متجري — منصة التسوق الشامل</strong>
            <p style="margin: 4px 0 0; color: #64748B;">الرقم الضريبي: 300984729100003</p>
            <p style="margin: 2px 0 0; color: #64748B;">تاريخ الفاتورة: ${dateStr}</p>
          </div>
          <div style="text-align: left;">
            <p style="margin: 0; font-weight: 700; color: #0F172A;">العميل: ${order.user_name || order.user?.name || 'عميل المتجر'}</p>
            <p style="margin: 2px 0 0; color: #64748B;">${order.user_email || ''}</p>
            <p style="margin: 2px 0 0; color: #067D62; font-weight: 700;">حالة الدفع: مكتمل بنجاح</p>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th style="text-align: center;">الكمية</th>
              <th style="text-align: left;">سعر الوحدة</th>
              <th style="text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((it) => {
                const img = resolveProductImage(it);
                const price = Number(it.price) || 0;
                const qty = Number(it.quantity) || 1;
                return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <img src="${img}" alt="" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; border: 1px solid #E2E8F0;" />
                      <span style="font-weight: 600;">${it.name || 'منتج أصلي'}</span>
                    </div>
                  </td>
                  <td style="text-align: center; font-weight: 700;">${qty}</td>
                  <td style="text-align: left;">${money(price)}</td>
                  <td style="text-align: left; font-weight: 700;">${money(price * qty)}</td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>

        <div style="margin-inline-start: auto; width: 240px; border-top: 1px solid #CBD5E1; padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748B;">المجموع الفرعي:</span>
            <span>${money(order.total_price)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748B;">مصاريف الشحن:</span>
            <span style="color: #067D62; font-weight: 700;">مجاناً</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #0F172A; border-top: 1px solid #E2E8F0; padding-top: 6px;">
            <span>المبلغ الإجمالي:</span>
            <span style="color: #B12704;">${money(order.total_price)}</span>
          </div>
        </div>
      </div>
      <div style="padding: 12px 24px; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: #64748B;">شكراً لتسوقك معنا في متجري</span>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="button btn-secondary btn-sm btn-print">
            <i class="fa-solid fa-print"></i> طباعة الفاتورة
          </button>
          <button type="button" class="button btn-accent btn-sm btn-close">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector('.btn-close-modal').onclick = closeModal;
  modal.querySelector('.btn-close').onclick = closeModal;
  modal.querySelector('.btn-print').onclick = () => window.print();
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

function renderOrders() {
  let filtered = allOrders;
  if (activeTab === 'in-progress') {
    filtered = allOrders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled'
    );
  } else if (activeTab === 'delivered') {
    filtered = allOrders.filter(
      (o) => o.status === 'delivered' || o.status === 'completed'
    );
  }

  if (!filtered.length) {
    root.replaceChildren();
    root.innerHTML = `
      <div class="empty-state-box" style="padding: 48px 24px; text-align: center; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px;">
        <div class="empty-state-icon" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;">
          <i class="fa-solid fa-box-open"></i>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #0F172A; margin-bottom: 8px;">
          ${activeTab === 'all' ? 'لا توجد لديك طلبات حتى الآن' : 'لا توجد طلبات في هذا القسم'}
        </h2>
        <p style="font-size: 14px; color: #64748B; max-width: 480px; margin: 0 auto 20px;">
          ${activeTab === 'all' ? 'عندما تطلب أي منتج من متجري، ستتمكن من تتبع مسار الشحن خطوة بخطوة والحصول على الفواتير هنا.' : 'يمكنك تصفح كل طلباتك من تبويب "كل الطلبات".'}
        </p>
        <div>
          <a class="button btn-accent" href="/products.html">تصفح المنتجات والتسوق الآن</a>
        </div>
      </div>
    `;
    return;
  }

  root.replaceChildren(
    ...filtered.map((o) => {
      const card = document.createElement('article');
      card.className = 'order-card';

      const dateRaw = o.created_at || o.createdAt;
      const dateStr = dateRaw
        ? new Date(dateRaw).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'مؤخراً';

      const step = getStatusStep(o.status);
      const statusTitle = getStatusTitle(o.status);
      const isDelivered = o.status === 'delivered' || o.status === 'completed';
      const isCancelled = o.status === 'cancelled';

      const items = Array.isArray(o.products) ? o.products : [];

      card.innerHTML = `
        <!-- Order Card Header -->
        <div class="order-card-header">
          <div class="order-header-meta">
            <div class="order-meta-col">
              <span class="order-meta-label">تاريخ الطلب</span>
              <span class="order-meta-val">${dateStr}</span>
            </div>
            <div class="order-meta-col">
              <span class="order-meta-label">المبلغ الإجمالي</span>
              <span class="order-meta-val" style="color: #B12704;">${money(o.total_price)}</span>
            </div>
            <div class="order-meta-col">
              <span class="order-meta-label">الشحن إلى</span>
              <span class="order-meta-val">${o.user_name || o.user?.name || 'عميل المتجر'}</span>
            </div>
          </div>
          <div class="order-header-right">
            <div class="order-meta-col" style="text-align: left;">
              <span class="order-meta-label">رقم الطلب</span>
              <span class="order-meta-val" style="font-family: monospace; direction: ltr;">
                #${o.orderNumber || o._id}
              </span>
            </div>
          </div>
        </div>

        <!-- Order Card Body -->
        <div class="order-card-body">
          <!-- Status Banner -->
          <div class="order-status-banner ${isDelivered ? 'is-delivered' : ''} ${isCancelled ? 'is-cancelled' : ''}">
            <div>
              <div class="order-status-title">
                <i class="fa-solid ${isDelivered ? 'fa-circle-check' : isCancelled ? 'fa-circle-xmark' : 'fa-truck-fast'}" style="color: ${isDelivered ? '#067D62' : isCancelled ? '#EF4444' : '#FF9900'};"></i>
                <span>${statusTitle}</span>
              </div>
              <div class="order-status-desc" style="margin-top: 4px;">
                ${isDelivered ? 'تم تسليم الطلب إلى باب منزلك مع ضمان الجودة والاستبدال.' : 'شحن سريع ومجاني مع إشعار بالرسائل القصيرة وتحديث لحظي.'}
              </div>
            </div>
            <div class="status-badge-slot"></div>
          </div>

          <!-- Progress Tracker (only if not cancelled) -->
          ${
            !isCancelled
              ? `
            <div class="order-tracker">
              <div class="tracker-steps">
                <div class="tracker-step ${step >= 1 ? 'is-active' : ''} ${step === 1 ? 'is-current' : ''}">
                  <div class="tracker-bullet"><i class="fa-solid fa-file-invoice"></i></div>
                  <span class="tracker-label">تم الطلب</span>
                </div>
                <div class="tracker-line ${step >= 2 ? 'is-active' : ''}"></div>
                <div class="tracker-step ${step >= 2 ? 'is-active' : ''} ${step === 2 ? 'is-current' : ''}">
                  <div class="tracker-bullet"><i class="fa-solid fa-boxes-packing"></i></div>
                  <span class="tracker-label">تجهيز وتغليف</span>
                </div>
                <div class="tracker-line ${step >= 3 ? 'is-active' : ''}"></div>
                <div class="tracker-step ${step >= 3 ? 'is-active' : ''} ${step === 3 ? 'is-current' : ''}">
                  <div class="tracker-bullet"><i class="fa-solid fa-truck"></i></div>
                  <span class="tracker-label">خرج للتوصيل</span>
                </div>
                <div class="tracker-line ${step >= 4 ? 'is-active' : ''}"></div>
                <div class="tracker-step ${step >= 4 ? 'is-active' : ''} ${step === 4 ? 'is-current' : ''}">
                  <div class="tracker-bullet"><i class="fa-solid fa-house-circle-check"></i></div>
                  <span class="tracker-label">تم التسليم</span>
                </div>
              </div>
            </div>
          `
              : ''
          }

          <!-- Order Items List with Genuine Images -->
          <div class="order-items-list">
            ${items
              .map((item) => {
                const pData = item.product || item;
                const realImg = resolveProductImage(pData);
                const pName = pData.name || item.name || 'منتج أصلي';
                const pId = pData._id || pData.id || item.id || '';
                const pPrice = pData.price || item.price || 0;
                const pQty = item.quantity || 1;

                return `
                <div class="order-product-row">
                  <div class="order-product-main">
                    <div class="order-product-thumb">
                      <img src="${realImg}" alt="${pName}" loading="lazy" />
                    </div>
                    <div class="order-product-info">
                      <a href="/product.html?id=${encodeURIComponent(pId)}" class="order-product-name">
                        ${pName}
                      </a>
                      <div class="order-product-meta">
                        <span>الكمية: <strong>${pQty}</strong></span>
                        <span>•</span>
                        <span>سعر الوحدة: <span class="order-product-price-badge">${money(pPrice)}</span></span>
                        <span>•</span>
                        <span>الإجمالي: <strong style="color: #0F172A;">${money(pPrice * pQty)}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Order Card Footer Strip -->
        <div class="order-card-footer">
          <div style="font-size: 13px; color: #64748B; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-shield-halved" style="color: #067D62;"></i>
            <span>مشترياتك مشمولة بضمان الجودة والإرجاع المجاني خلال 14 يوماً</span>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <a href="/ai-assistant.html" class="button btn-secondary btn-sm">
              <i class="fa-solid fa-headset"></i> مساعدة بشأن الشحنة
            </a>
            <button type="button" class="button btn-secondary btn-sm print-invoice-btn">
              <i class="fa-solid fa-file-invoice"></i> عرض الفاتورة
            </button>
          </div>
        </div>
      `;

      // Status badge
      const badgeSlot = card.querySelector('.status-badge-slot');
      if (badgeSlot) {
        badgeSlot.appendChild(statusBadge(o.status));
      }

      // Re-order button
      card.querySelectorAll('.buy-again-btn').forEach((btn) => {
        btn.onclick = () => {
          const pId = btn.getAttribute('data-pid');
          const pName = decodeURIComponent(btn.getAttribute('data-pname') || 'منتج');
          const pPrice = Number(btn.getAttribute('data-pprice')) || 0;
          const pImg = decodeURIComponent(btn.getAttribute('data-pimg') || '');
          addItem({ id: pId, _id: pId, name: pName, price: pPrice, image: pImg, quantity: 1 });
          toast(`تمت إضافة "${pName}" إلى سلة التسوق`, 'success');
        };
      });

      // View invoice modal
      const invoiceBtn = card.querySelector('.print-invoice-btn');
      if (invoiceBtn) {
        invoiceBtn.onclick = () => {
          showInvoiceModal(o);
        };
      }

      return card;
    })
  );
}

function setupTabs() {
  const tabAll = document.querySelector('#tab-all');
  const tabInProgress = document.querySelector('#tab-in-progress');
  const tabDelivered = document.querySelector('#tab-delivered');

  const updateTabUI = (activeBtn) => {
    [tabAll, tabInProgress, tabDelivered].forEach((btn) => {
      if (!btn) return;
      btn.style.fontWeight = 'normal';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderBottom = 'none';
    });
    if (activeBtn) {
      activeBtn.style.fontWeight = '700';
      activeBtn.style.color = 'var(--text-primary)';
      activeBtn.style.borderBottom = '3px solid var(--accent-hover)';
    }
  };

  if (tabAll) {
    tabAll.onclick = () => {
      activeTab = 'all';
      updateTabUI(tabAll);
      renderOrders();
    };
  }
  if (tabInProgress) {
    tabInProgress.onclick = () => {
      activeTab = 'in-progress';
      updateTabUI(tabInProgress);
      renderOrders();
    };
  }
  if (tabDelivered) {
    tabDelivered.onclick = () => {
      activeTab = 'delivered';
      updateTabUI(tabDelivered);
      renderOrders();
    };
  }
}

async function load() {
  state(root, 'جارٍ تحميل سجل طلباتك ومشترياتك...', 'loading');
  try {
    const res = await request('/api/get_user_orders');
    allOrders = res.data || [];
    renderOrders();
  } catch {
    state(root, 'تعذر تحميل سجل طلباتك حالياً. يرجى المحاولة لاحقاً.', 'error');
  }
}

initSite().then(async () => {
  const user = await checkAuth(['user', 'admin', 'super_admin']);
  if (user) {
    joinRooms(user.role);
    setupTabs();
    await load();
    onEvent('update_status', load);
    onEvent('new_order', load);
  }
});
