(function () {
  const grid = document.querySelector("[data-catalog-grid]"), search = document.querySelector("[data-catalog-search]"), section = document.querySelector("[data-section-filter]"); let products = [];
  const esc = escapeHtml, price = p => Number(p.price || 0).toFixed(2);
  function render() {
    const query = search.value.toLowerCase(), group = section.value;
    const shown = products.filter(p => (!query || `${p.name} ${p.description || ""}`.toLowerCase().includes(query)) && (!group || p.section === group));
    document.querySelector("[data-result-count]").textContent = `${shown.length} item${shown.length === 1 ? "" : "s"}`;
    grid.innerHTML = shown.length ? shown.map(p => `<article class="product-card"><a class="product-thumb" href="/product.html?id=${encodeURIComponent(p._id)}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name || "Product")}">` : `<span class="product-initial">${esc((p.name || "?")[0])}</span>`}</a><a class="product-name product-link" href="/product.html?id=${encodeURIComponent(p._id)}">${esc(p.name || "Untitled product")}</a><p class="product-section">${esc(p.section || "Market pick")}</p><p class="product-price"><span class="currency">$</span><span class="whole">${price(p).split(".")[0]}</span><span class="cents">${price(p).split(".")[1]}</span></p><button class="btn-primary add-btn" data-id="${esc(p._id)}">Add to cart</button></article>`).join("") : `<div class="state-block"><p class="state-title">No matches in this aisle</p><p>Try another search or clear the category filter.</p></div>`;
    grid.querySelectorAll("[data-id]").forEach(button => button.onclick = () => { Cart.add(products.find(p => p._id === button.dataset.id)); showToast("Added to your cart"); });
  }
  async function load() { grid.innerHTML = `<div class="state-block">Loading the shelves…</div>`; try { products = (await Api.getProducts()).data || []; const groups = [...new Set(products.map(p => p.section).filter(Boolean))]; section.innerHTML = `<option value="">All departments</option>${groups.map(g => `<option>${esc(g)}</option>`).join("")}`; render(); } catch (err) { grid.innerHTML = `<div class="state-block"><p class="state-title">The shelves are unavailable</p><p>${esc(err.message)} Refresh to try again.</p></div>`; } }
  search.addEventListener("input", render); section.addEventListener("change", render); load();
})();
