/**
 * Shared UI glue used on every page: toast messages + header account state.
 */
function showToast(message, { type = "info", duration = 3200 } = {}) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("error", type === "error");
  toast.classList.add("show");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

/**
 * Populates the header's account cell based on GET /api/auth/me, and keeps
 * it interactive (open/close on click, not just hover, so it works on
 * touch devices too).
 *
 * Works whether the endpoint returns {data:{name}}, {user:{name}}, or
 * just {success:true} with no profile fields — degrades gracefully.
 */
async function syncAccountHeader() {
  const cell = document.querySelector(".header-cell.account");
  const line1 = document.querySelector("[data-account-line1]");
  const line2 = document.querySelector("[data-account-line2]");
  const menu = document.querySelector("[data-account-menu]");
  if (!cell || !line1 || !line2 || !menu) return;

  // Make the cell a real toggle control instead of a hover-only div, so the
  // menu works with click/tap and is properly announced to screen readers.
  cell.setAttribute("role", "button");
  cell.setAttribute("tabindex", "0");
  cell.setAttribute("aria-haspopup", "true");
  cell.setAttribute("aria-expanded", "false");

  function closeMenu() {
    cell.setAttribute("aria-expanded", "false");
  }
  function toggleMenu(e) {
    e.stopPropagation();
    const isOpen = cell.getAttribute("aria-expanded") === "true";
    cell.setAttribute("aria-expanded", isOpen ? "false" : "true");
  }
  cell.addEventListener("click", toggleMenu);
  cell.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleMenu(e);
    }
    if (e.key === "Escape") closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (!cell.contains(e.target)) closeMenu();
  });

  // Don't assert "guest" or "signed in" before we actually know — show a
  // neutral loading state first so the header never flashes the wrong thing.
  cell.classList.add("is-loading");
  line1.textContent = "Hello,";
  line2.textContent = "Loading…";

  try {
    const res = await Api.me();
    const profile = (res && (res.data || res.user)) || {};
    const name = typeof profile === "object" ? profile.name : null;

    cell.classList.remove("is-loading");
    cell.classList.add("is-signed-in");
    line1.textContent = "Hello,";
    line2.textContent = name ? name.split(" ")[0] : "Account";
    menu.innerHTML = `
      <p>${name ? `Signed in as <strong>${escapeHtml(name)}</strong>` : "You're signed in."}</p>
      <a class="menu-link" href="/order.html">Your orders</a>
      <a class="menu-link" href="/cart.html">Your lists</a>
    `;
    return true;
  } catch (_) {
    // Not signed in (401) or /api/auth/me unreachable — show guest state.
    cell.classList.remove("is-loading", "is-signed-in");
    line1.textContent = "Hello, sign in";
    line2.textContent = "Account & Lists";
    menu.innerHTML = `
      <a class="menu-cta" href="/login.html">Sign in</a>
      <p>New here?</p>
      <a class="menu-link" href="/register.html">Create an account</a>
    `;
    return false;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", syncAccountHeader);

const Cart = (() => {
  const key = "marketplace-cart";
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch (_) { return []; } };
  const write = (items) => { localStorage.setItem(key, JSON.stringify(items)); updateCount(); };
  const count = () => read().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  function updateCount() { document.querySelectorAll(".cart-count").forEach(el => el.textContent = count()); }
  function add(product) {
    const items = read(); const found = items.find(item => item._id === product._id);
    if (found) found.quantity += 1; else items.push({ ...product, quantity: 1 });
    write(items);
  }
  return { read, write, count, add, updateCount };
})();
document.addEventListener("DOMContentLoaded", Cart.updateCount);
