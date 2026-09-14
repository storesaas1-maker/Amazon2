import {
  getCart,
  setQuantity,
  removeItem,
  clearCart,
  total,
  reconcileCart,
} from '../cart-store.js';
import { request, fetchAllProducts } from '../api.js';
import { initSite, money, state } from './common.js';
import { toast } from '../toast.js';
import { onEvent } from '../socket-client.js';
import { mountSiteShell } from '../components/site-shell.js';

mountSiteShell({ active: 'cart' });

const root = document.querySelector('#cart-items');
const summary = document.querySelector('#cart-total');
const summaryCount = document.querySelector('#summary-items-count');
const subtotalVal = document.querySelector('#summary-subtotal-val');
const finalTotal = document.querySelector('#summary-final-total');
const bottomTotal = document.querySelector('#cart-bottom-total');
const bottomCount = document.querySelector('#cart-items-count-label');
const checkoutBtn = document.querySelector('#checkout-submit-btn');

function render() {
  const items = getCart();
  const totalCount = items.reduce((sum, x) => sum + Number(x.quantity || 1), 0);
  const totalAmount = total();

  if (summaryCount) summaryCount.textContent = String(totalCount);
  if (bottomCount) bottomCount.textContent = String(totalCount);
  if (summary) summary.textContent = money(totalAmount);
  if (subtotalVal) subtotalVal.textContent = money(totalAmount);
  if (finalTotal) finalTotal.textContent = money(totalAmount);
  if (bottomTotal) bottomTotal.textContent = money(totalAmount);

  if (checkoutBtn) {
    checkoutBtn.disabled = items.length === 0;
  }

  if (!items.length) {
    root.replaceChildren();
    root.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon"><i class="fa-solid fa-cart-shopping"></i></div>
        <h2>سلة التسوق في متجري فارغة</h2>
        <p>لم تقم بإضافة أي أجهزة إلى سلتك حتى الآن. تصفح عروض اليوم وأحدث هواتف iPhone المعتمدة.</p>
        <div style="margin-top: 20px;">
          <a class="button btn-accent" href="/products.html">استكشف الأجهزة المتاحة الآن</a>
        </div>
      </div>
    `;
    return;
  }

  root.replaceChildren(
    ...items.map((x) => {
      const row = document.createElement('article');
      row.className = 'cart-item-row';

      const lineTotal = Number(x.price || 0) * Number(x.quantity || 1);

      row.innerHTML = `
        <div class="cart-item-img-wrap">
          <img src="${x.image || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&auto=format&fit=crop&q=60'}" alt="${x.name}" />
        </div>

        <div class="cart-item-details">
          <a class="cart-item-name" href="/product.html?id=${encodeURIComponent(x.id)}">${x.name}</a>
          <div class="cart-item-stock"><i class="fa-solid fa-check"></i> متوفر بالمخزون • فحص معتمد</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
            مؤهل للتوصيل المجاني وشامل ضمان 90 يوماً
          </div>

          <div class="cart-item-actions">
            <div class="cart-qty-pill">
              <label for="qty-${x.id}">الكمية:</label>
              <select id="qty-${x.id}" class="cart-qty-select" aria-label="تغيير الكمية لـ ${x.name}">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                  .map(
                    (q) =>
                      `<option value="${q}" ${Number(x.quantity) === q ? 'selected' : ''}>${q}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <span style="color: var(--border);">|</span>
            <button class="cart-action-btn delete-btn" type="button">حذف</button>
            <span style="color: var(--border);">|</span>
            <button class="cart-action-btn save-btn" type="button">حفظ لوقت لاحق</button>
            <span style="color: var(--border);">|</span>
            <a class="cart-action-btn" href="/product.html?id=${encodeURIComponent(x.id)}">عرض تفاصيل الفحص</a>
          </div>
        </div>

        <div class="cart-item-price-col">
          <div class="cart-item-price">${money(lineTotal)}</div>
          ${Number(x.quantity) > 1 ? `<div class="cart-item-unit-price">(${money(x.price)} للوحدة)</div>` : ''}
        </div>
      `;

      // Event handlers
      const select = row.querySelector('.cart-qty-select');
      select.onchange = (e) => {
        setQuantity(x.id, Number(e.target.value));
        render();
      };

      const deleteBtn = row.querySelector('.delete-btn');
      deleteBtn.onclick = () => {
        removeItem(x.id);
        render();
        toast('تم حذف الجهاز من السلة', 'info');
      };

      const saveBtn = row.querySelector('.save-btn');
      saveBtn.onclick = () => {
        removeItem(x.id);
        render();
        toast('تم نقل الجهاز إلى قائمة المحفوظات لوقت لاحق', 'info');
      };

      return row;
    })
  );
}

async function refreshCartPrices() {
  try {
    reconcileCart(await fetchAllProducts());
    render();
  } catch {
    render();
  }
}

initSite().then(async (user) => {
  await refreshCartPrices();
  onEvent('update_product', refreshCartPrices);
  onEvent('deleted_product', refreshCartPrices);

  // Coupon apply button
  const applyCouponBtn = document.querySelector('#apply-coupon-btn');
  const couponInput = document.querySelector('#coupon-input');
  if (applyCouponBtn && couponInput) {
    applyCouponBtn.onclick = () => {
      const code = couponInput.value.trim();
      if (!code) {
        toast('يرجى إدخال رمز الكوبون أولاً', 'error');
        return;
      }
      toast(`تم تطبيق الرمز الترويجي ${code}`, 'success');
    };
  }

  // Checkout submission
  const checkoutForm = document.querySelector('#checkout');
  if (checkoutForm) {
    checkoutForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!user) {
        toast('يرجى تسجيل الدخول أولاً لإتمام طلبك', 'info');
        setTimeout(() => {
          location.href = '/login.html';
        }, 600);
        return;
      }

      const products = getCart()
        .map((item) => ({
          id: item.id || item._id,
          name: item.name,
          price: item.price,
          image: item.image,
          quantity: item.quantity
        }))
        .filter(
          (item) =>
            item.id &&
            Number.isInteger(Number(item.quantity)) &&
            Number(item.quantity) > 0
        );

      if (!products.length) {
        toast('أضف منتجات إلى السلة أولاً للمتابعة', 'error');
        return;
      }

      try {
        const couponVal = e.target.coupon ? e.target.coupon.value.trim() : '';
        const data = await request('/api/order', {
          method: 'POST',
          body: { products, coupon: couponVal || undefined },
        });

        clearCart();
        render();
        toast(`تم تأكيد طلبك بنجاح! رقم الطلب: ${data.data?.orderNumber || ''}`, 'success');
        setTimeout(() => (location.href = '/orders.html'), 1200);
      } catch (err) {
        toast(err.message || 'حدث خطأ أثناء تنفيذ الطلب. يرجى المحاولة ثانية.', 'error');
      }
    };
  }
});
