import { getCart } from '../cart-store.js';
import { currentUser } from '../auth-guard.js';
import { initTheme } from '../theme-engine.js';
import { joinRooms } from '../socket-client.js';

export async function initSite() {
  await initTheme();

  // Cart counter sync
  const updateCartCount = () => {
    const total = getCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
    document.querySelectorAll('[data-cart-count]').forEach((node) => {
      node.textContent = String(total);
    });
  };
  updateCartCount();
  window.addEventListener('cartchange', updateCartCount);

  // User auth state sync
  const user = await currentUser();
  if (user) joinRooms(user.role);

  // Sync account links & greetings
  document.querySelectorAll('[data-account]').forEach((n) => {
    n.textContent = user ? user.name : 'الحساب والقوائم';
  });

  document.querySelectorAll('[data-account-sub]').forEach((n) => {
    n.textContent = user ? `مرحباً، ${user.name}` : 'مرحباً، تسجيل الدخول';
  });

  document.querySelectorAll('[data-drawer-greeting]').forEach((n) => {
    n.textContent = user ? `مرحباً، ${user.name}` : 'مرحباً، سجل الدخول';
  });

  document.querySelectorAll('[data-drawer-account-text]').forEach((n) => {
    n.textContent = user ? 'تسجيل الخروج' : 'تسجيل الدخول';
  });

  document.querySelectorAll('[data-drawer-account-link]').forEach((n) => {
    if (user) {
      n.href = '#';
      n.onclick = async (e) => {
        e.preventDefault();
        // FIX: same root cause as site-shell.js's logout handler - the
        // auth cookie is httpOnly, so only a server-side clearCookie()
        // call can actually remove it. Clearing localStorage alone left
        // the user signed in after a "successful" logout.
        try {
          await fetch('/api/auth/log_out', { method: 'POST', credentials: 'include' });
        } catch (_) {
          // ignore network errors - fall through and redirect regardless
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
      };
    } else {
      n.href = '/login.html';
    }
  });

  // Account Flyout guest header vs logged in
  document.querySelectorAll('[data-flyout-guest]').forEach((n) => {
    n.style.display = user ? 'none' : 'block';
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.hidden = !user;
  }

  // Staff / Admin dashboard links
  const staff = user?.role === 'admin' || user?.role === 'super_admin';
  const staffTarget = user?.role === 'super_admin' ? '/super-admin.html' : '/admin.html';

  document.querySelectorAll('[data-staff-links]').forEach((container) => {
    if (staff) {
      container.innerHTML = `
        <a href="${staffTarget}" style="color: var(--accent-hover); font-weight: 700;">
          <i class="fa-solid fa-gauge-high" aria-hidden="true"></i> لوحة الإدارة والتحكم
        </a>`;
    } else {
      container.innerHTML = '';
    }
  });

  return user;
}

export const state = (target, text, kind = 'loading') => {
  if (!target) return;
  target.replaceChildren();
  const node = document.createElement('div');
  if (kind === 'loading') {
    node.className = 'empty-state-box';
    node.innerHTML = `
      <div class="empty-state-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
      <p style="font-size: 15px; font-weight: 600;">${text}</p>
    `;
  } else if (kind === 'empty') {
    node.className = 'empty-state-box';
    node.innerHTML = `
      <div class="empty-state-icon"><i class="fa-solid fa-box-open"></i></div>
      <h2>لا توجد عناصر</h2>
      <p>${text}</p>
    `;
  } else {
    node.className = 'empty-state-box';
    node.innerHTML = `
      <div class="empty-state-icon" style="color: var(--error);"><i class="fa-solid fa-circle-exclamation"></i></div>
      <h2>حدث خطأ</h2>
      <p>${text}</p>
    `;
  }
  target.append(node);
};

export const money = (value) => {
  const num = Number(value || 0);
  return `${num.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;
};
