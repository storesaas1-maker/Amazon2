import { request, fetchAllOrders } from "../api.js";
import { checkAuth } from "../auth-guard.js";
import { joinRooms, onEvent } from "../socket-client.js";
import { confirm, promptDialog } from "../components/modal.js";
import { toast } from "../toast.js";
import { money, state } from "./common.js";

// ======================================================
// إعدادات Cloudinary — بتتقرا حصرياً من /api/get_cloudinary_config
// اللي بيرجّع القيم من متغيرات البيئة (.env) على السيرفر. مفيش أي قيم
// افتراضية مكتوبة هنا في الكود عن قصد: لو الـ .env فاضي أو الراوت فشل،
// الرفع هيتقفل تماماً بدل ما يشتغل بحساب/بريست ثابت مكتوب في الفرونت.
// ======================================================
let cloudinaryConfig = null;

async function loadCloudinaryConfig() {
  try {
    const res = await request("/api/get_cloudinary_config", { silent: true });
    if (res && res.data && res.data.cloudName && res.data.uploadPreset) {
      cloudinaryConfig = {
        cloudName: res.data.cloudName,
        uploadPreset: res.data.uploadPreset,
        uploadUrl: res.data.uploadUrl || `https://api.cloudinary.com/v1_1/${res.data.cloudName}/image/upload`
      };
    }
  } catch (e) {
    cloudinaryConfig = null;
  }

  if (!cloudinaryConfig) {
    console.error("تعذر تحميل إعدادات Cloudinary من السيرفر (.env) — رفع الصور معطّل حالياً");
  }
}

const isSuper = document.body.dataset.dashboard === "super";

let user;
let orders = [];

const statuses = [
  "new",
  "processing",
  "delivered",
  "cancelled"
];

// ======================================================
// متغيرات تقسيم الطلبات (Orders Pagination)
// ======================================================
let ordersPage = 1;
const ordersPerPage = 10;
let ordersTotalPages = 1;
let ordersTotalCount = 0;
let ordersLoading = false;
let ordersScrollReady = false;

// ======================================================
// متغيرات تقسيم المنتجات (Products Pagination)
// ======================================================
let products = [];
let sections = [];
let productsPage = 1;
const productsPerPage = 20;
let productsTotalPages = 1;
let productsLoading = false;
let productsScrollReady = false;

// ======================================================
// دوال مساعدة عامة (Helpers)
// ======================================================
function id(x) {
  return x?._id || x?.id;
}

function text(tag, value) {
  const n = document.createElement(tag);
  n.textContent = value ?? "";
  return n;
}

function uploadFileToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!cloudinaryConfig) {
      reject(new Error("خدمة رفع الصور غير مهيأة على السيرفر حالياً (تأكد من إعدادات Cloudinary في .env)"));
      return;
    }

    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", cloudinaryConfig.uploadPreset);

    xhr.open("POST", cloudinaryConfig.uploadUrl, true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url || data.url);
        } catch (err) {
          reject(new Error("فشل قراءة رد Cloudinary"));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error?.message || `فشل الرفع (${xhr.status})`));
        } catch (err) {
          reject(new Error(`خطأ في خادم Cloudinary (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("حدث خطأ في الاتصال بالشبكة أثناء رفع الصورة."));

    xhr.send(formData);
  });
}

// ======================================================
// حماية الصلاحيات وبدء التشغيل (Guard & Init)
// ======================================================
async function guard() {
  user = await checkAuth(
    isSuper
      ? ["super_admin"]
      : ["admin", "super_admin"]
  );

  if (!user) return;

  joinRooms(user.role);

  const userName = document.querySelector("[data-user-name]");
  if (userName) {
    userName.textContent = user.name || "المدير العام";
  }

  await loadCloudinaryConfig();
  setupTabs();
  setupInstantImageUpload();
  setupEditModal();

  // تحميل البيانات الحقيقية
  await loadOrders(1, false);
  await loadOverviewStats();

  // أحداث السوكيت الحية
  onEvent("new_order", async () => {
    await reloadOrdersKeepCount();
    await loadOverviewStats();
  });

  onEvent("deleted_order", async () => {
    await reloadOrdersKeepCount();
    await loadOverviewStats();
  });

  onEvent("update_product", async () => {
    await loadProducts(1, false);
    await loadOverviewStats();
  });

  onEvent("update_section", async () => {
    await loadProducts(1, false);
    await loadSections();
  });

  onEvent("new_problem", async () => {
    await loadProblems();
  });
}

// ======================================================
// دالة حساب وعرض الإحصائيات الحقيقية الشاملة
// ======================================================
window.loadOverviewStats = async function loadOverviewStats() {
  try {
    // 1. جلب كافة الطلبات (عبر كل الصفحات) لحساب الإحصائيات والأرباح بدقة
    const allOrders = await fetchAllOrders();

    const newOrders = allOrders.filter((o) => o.status === "new").length;
    const processingOrders = allOrders.filter((o) => o.status === "processing").length;
    const deliveredOrders = allOrders.filter((o) => o.status === "delivered").length;
    const cancelledOrders = allOrders.filter((o) => o.status === "cancelled").length;

    // حساب إجمالي الأرباح من الطلبات المستلمة (Delivered)
    const totalRevenue = allOrders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

    // تحديث عناصر الطلبات والأرباح في الـ DOM
    const elRevenue = document.querySelector("#metric-revenue");
    const elOrdersTotal = document.querySelector("#metric-orders-total");
    const elOrdersNew = document.querySelector("#metric-orders-new");
    const elOrdersProcessing = document.querySelector("#metric-orders-processing");
    const elOrdersDelivered = document.querySelector("#metric-orders-delivered");
    const elOrdersCancelled = document.querySelector("#metric-orders-cancelled");

    if (elRevenue) elRevenue.textContent = money(totalRevenue);
    if (elOrdersTotal) elOrdersTotal.textContent = allOrders.length;
    if (elOrdersNew) elOrdersNew.textContent = newOrders;
    if (elOrdersProcessing) elOrdersProcessing.textContent = processingOrders;
    if (elOrdersDelivered) elOrdersDelivered.textContent = deliveredOrders;
    if (elOrdersCancelled) elOrdersCancelled.textContent = cancelledOrders;

    // 2. جلب وتحديث المستخدمين الحقيقيين (استبعاد المدراء)
    const usersRes = await request("/api/admin/get_all_users", { silent: true });
    const allUsers = usersRes?.data || [];
    const realCustomers = allUsers.filter((u) => u.role !== "admin" && u.role !== "super_admin").length;

    const elUsersReal = document.querySelector("#metric-users-real");
    const elUsersTotal = document.querySelector("#metric-users-total");
    if (elUsersReal) elUsersReal.textContent = realCustomers;
    if (elUsersTotal) elUsersTotal.textContent = allUsers.length;

    // 3. تحديث عدد المنتجات
    const prodRes = await request("/api/get_products?page=1&limit=1", { silent: true });
    const totalProducts = prodRes?.pagination?.totalProducts || prodRes?.data?.length || 0;
    const elProdTotal = document.querySelector("#metric-products-total");
    if (elProdTotal) elProdTotal.textContent = totalProducts;

  } catch (err) {
    console.error("Load overview stats error:", err);
  }
};

// ======================================================
// التبديل بين التبويبات (Tabs Switching)
// ======================================================
function setupTabs() {
  const tabButtons = document.querySelectorAll("[data-tab]");
  tabButtons.forEach((button) => {
    button.onclick = () => {
      tabButtons.forEach((b) => {
        b.classList.remove("bg-[#FF9900]", "text-slate-950", "shadow-md", "shadow-amber-500/10");
        b.classList.add("text-slate-300");
      });

      button.classList.add("bg-[#FF9900]", "text-slate-950", "shadow-md", "shadow-amber-500/10");
      button.classList.remove("text-slate-300");

      document.querySelectorAll(".tab").forEach((node) => {
        node.classList.remove("active");
      });

      const target = document.querySelector(`#${button.dataset.tab}`);
      if (target) {
        target.classList.add("active");
        if (button.dataset.tab === "overview-tab") {
          loadOverviewStats();
        }
        if (button.dataset.tab === "problems-tab") {
          loadProblems();
        }
      }
    };
  });
}

// ======================================================
// نظام الرفع الفوري التلقائي للصور (Instant Image Upload)
// ======================================================
function setupInstantImageUpload() {
  const dropZone = document.querySelector("#product-drop-zone");
  const fileInput = document.querySelector("#product-image-file");
  const urlInput = document.querySelector("#product-image-url");
  const previewImg = document.querySelector("#product-preview-img");
  const placeholder = document.querySelector("#product-preview-placeholder");
  const statusText = document.querySelector("#product-image-status");
  const progressContainer = document.querySelector("#product-progress-container");
  const progressBar = document.querySelector("#product-progress-bar");
  const progressText = document.querySelector("#product-progress-text");
  const progressPercent = document.querySelector("#product-progress-percent");

  if (dropZone && fileInput) {
    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    };

    ["dragleave", "dragend"].forEach((type) => {
      dropZone.addEventListener(type, () => dropZone.classList.remove("drag-over"));
    });

    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadAndProcessFile(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadAndProcessFile(e.target.files[0]);
      }
    };
  }

  async function uploadAndProcessFile(file) {
    if (!file.type.startsWith("image/")) {
      toast("يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)", "error");
      return;
    }

    if (previewImg) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.classList.remove("hidden");
      if (placeholder) placeholder.classList.add("hidden");
    }

    if (progressContainer) progressContainer.classList.remove("hidden");
    if (progressBar) progressBar.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0%";
    if (progressText) progressText.textContent = `جاري رفع (${file.name}) إلى Cloudinary...`;

    if (statusText) {
      statusText.textContent = "جاري رفع الصورة سحابياً...";
      statusText.className = "text-[10px] text-amber-600 font-bold block";
    }

    try {
      const secureUrl = await uploadFileToCloudinary(file, (percent) => {
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
      });

      if (urlInput) urlInput.value = secureUrl;

      if (statusText) {
        statusText.textContent = "✓ تم رفع الصورة بنجاح وتوليد الرابط";
        statusText.className = "text-[10px] text-emerald-600 font-bold block";
      }

      toast("تم رفع الصورة إلى Cloudinary بنجاح", "success");
    } catch (err) {
      console.error("Instant upload error:", err);
      toast(err.message || "فشل رفع الصورة إلى السحابة", "error");
      if (statusText) {
        statusText.textContent = "فشل رفع الصورة، يرجى المحاولة مرة أخرى";
        statusText.className = "text-[10px] text-rose-600 font-bold block";
      }
    } finally {
      setTimeout(() => {
        if (progressContainer) progressContainer.classList.add("hidden");
      }, 1500);
    }
  }

  if (urlInput) {
    urlInput.oninput = (e) => {
      const url = e.target.value.trim();
      if (url) {
        if (previewImg) {
          previewImg.src = url;
          previewImg.classList.remove("hidden");
          if (placeholder) placeholder.classList.add("hidden");
        }
        if (statusText) {
          statusText.textContent = "تم إدخال رابط مباشر";
          statusText.className = "text-[10px] text-emerald-600 font-bold block";
        }
      } else {
        if (previewImg) {
          previewImg.src = "";
          previewImg.classList.add("hidden");
          if (placeholder) placeholder.classList.remove("hidden");
        }
        if (statusText) {
          statusText.textContent = "لم يتم اختيار صورة بعد";
          statusText.className = "text-[10px] text-slate-400";
        }
      }
    };
  }
}

// ======================================================
// إدارة الطلبات وعرضها (Orders Management)
// ======================================================
async function loadOrders(page = 1, append = false) {
  if (ordersLoading) return;

  const root = document.querySelector("#orders-list");
  if (!root) return;

  ordersLoading = true;

  if (!append) {
    orders = [];
    ordersPage = 1;
    ordersTotalPages = 1;
    state(root, "جارٍ تحميل الطلبات…");
  }

  try {
    const response = await request(
      `/api/admin/get_all_orders?page=${page}&limit=${ordersPerPage}`
    );

    const newOrders = response.data || [];
    orders = append ? [...orders, ...newOrders] : newOrders;
    ordersPage = page;

    if (response.pagination) {
      ordersTotalPages = Number(response.pagination.totalPages) || 1;
      ordersTotalCount = Number(response.pagination.totalOrders) || orders.length;
    } else {
      ordersTotalPages = newOrders.length >= ordersPerPage ? page + 1 : page;
      ordersTotalCount = orders.length;
    }

    if (append) {
      root.append(...newOrders.map(orderRow));
    } else {
      root.replaceChildren(...orders.map(orderRow));
    }

    if (!orders.length) {
      state(root, "لا توجد طلبات حتى الآن.", "empty");
    }

    updateOrdersPagination();
  } catch (error) {
    console.error("Load orders error:", error);
    if (append) {
      updateOrdersPagination("تعذر تحميل المزيد من الطلبات.");
    } else {
      state(root, "تعذر تحميل قائمة الطلبات.", "error");
    }
  } finally {
    ordersLoading = false;
  }
}

async function reloadOrdersKeepCount() {
  const root = document.querySelector("#orders-list");
  if (!root) return;

  const currentCount = Math.max(orders.length, ordersPerPage);
  const pageSize = 50; // الحد الأقصى المسموح به من الخادم لكل صفحة

  try {
    let collected = [];
    let page = 1;
    let pagination = null;

    while (collected.length < currentCount) {
      const response = await request(
        `/api/admin/get_all_orders?page=${page}&limit=${pageSize}`
      );
      const batch = response.data || [];
      collected = collected.concat(batch);
      pagination = response.pagination || null;

      if (!pagination || !pagination.hasNextPage) break;
      page += 1;
    }

    orders = collected.slice(0, currentCount);

    if (pagination) {
      ordersTotalCount = Number(pagination.totalOrders) || orders.length;
      ordersTotalPages = Math.ceil(ordersTotalCount / ordersPerPage) || 1;
    } else {
      ordersTotalCount = orders.length;
      ordersTotalPages = 1;
    }

    root.replaceChildren(...orders.map(orderRow));

    if (!orders.length) {
      state(root, "لا توجد طلبات حتى الآن.", "empty");
    }

    updateOrdersPagination();
  } catch (err) {
    console.error("Reload orders keep count error:", err);
  }
}

function ensureOrdersSentinel() {
  let pagination = document.querySelector("#orders-pagination");
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = "orders-pagination";
    pagination.className = "py-4 text-center text-xs font-bold text-slate-500";

    const root = document.querySelector("#orders-list");
    const anchor = root?.closest("table") || root;
    if (anchor) anchor.after(pagination);
  }
  return pagination;
}

function updateOrdersPagination(customText) {
  const pagination = ensureOrdersSentinel();
  pagination.replaceChildren();

  const info = document.createElement("span");
  const hasMore = orders.length < ordersTotalCount;

  info.textContent = customText
    ? customText
    : hasMore
    ? `تم تحميل ${orders.length} من أصل ${ordersTotalCount} طلب (قم بالتمرير لتحميل المزيد...)`
    : orders.length
    ? `تم عرض كافة الطلبات بنجاح (${ordersTotalCount})`
    : "";

  pagination.append(info);
  setupOrdersInfiniteScroll();
}

function setupOrdersInfiniteScroll() {
  if (ordersScrollReady) return;

  const sentinel = ensureOrdersSentinel();
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && !ordersLoading && orders.length < ordersTotalCount) {
        const nextPage = Math.floor(orders.length / ordersPerPage) + 1;
        loadOrders(nextPage, true);
      }
    },
    { rootMargin: "400px" }
  );

  observer.observe(sentinel);
  ordersScrollReady = true;
}

function orderRow(o) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs";

  // 1. رقم الطلب
  const tdNum = document.createElement("td");
  tdNum.className = "py-4 px-6 font-bold text-slate-900";
  tdNum.textContent = o.orderNumber || id(o)?.slice(-6) || "—";

  // 2. العميل
  const tdUser = document.createElement("td");
  tdUser.className = "py-4 px-6 text-slate-700 font-medium";
  tdUser.textContent = o.user_name || o.user?.name || "عميل مسجل";

  // 3. بيانات الاتصال
  const tdContact = document.createElement("td");
  tdContact.className = "py-4 px-6 space-y-1.5";

  const phone = o.phone_number || o.user?.phone;
  if (phone) {
    const phoneLink = document.createElement("a");
    phoneLink.href = `tel:${phone}`;
    phoneLink.className = "flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-mono transition-colors";
    phoneLink.innerHTML = `<i class="fa-solid fa-phone text-slate-400 text-[10px]"></i><span>${phone}</span>`;
    tdContact.append(phoneLink);
  }

  const wa = o.whatsApp_number || o.whatsapp_number;
  if (wa) {
    const cleanWa = String(wa).replace(/\D/g, "");
    const waLink = document.createElement("a");
    waLink.href = `https://wa.me/${cleanWa}`;
    waLink.target = "_blank";
    waLink.rel = "noopener noreferrer";
    waLink.className = "inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-bold transition-colors";
    waLink.innerHTML = `<i class="fa-brands fa-whatsapp text-emerald-500"></i><span>${wa}</span>`;
    tdContact.append(waLink);
  }

  if (!phone && !wa) {
    tdContact.textContent = "—";
    tdContact.className = "py-4 px-6 text-slate-400";
  }

  // 4. رابط الموقع
  const tdGps = document.createElement("td");
  tdGps.className = "py-4 px-6 text-center";

  const gpsUrl = o.GPS_URL || o.gps_url || o.gps;
  if (gpsUrl) {
    const fullGpsUrl = gpsUrl.startsWith("http") ? gpsUrl : `https://${gpsUrl}`;
    const gpsBtn = document.createElement("a");
    gpsBtn.href = fullGpsUrl;
    gpsBtn.target = "_blank";
    gpsBtn.rel = "noopener noreferrer";
    gpsBtn.className = "inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-lg border border-amber-200 transition-all";
    gpsBtn.innerHTML = '<i class="fa-solid fa-location-dot text-rose-500"></i> <span>الموقع</span>';
    tdGps.append(gpsBtn);
  } else {
    tdGps.textContent = "—";
    tdGps.className = "py-4 px-6 text-center text-slate-400";
  }

  // 5. الإجمالي
  const tdPrice = document.createElement("td");
  tdPrice.className = "py-4 px-6 font-black text-emerald-700 text-sm";
  tdPrice.textContent = money(o.total_price);

  // 6. حالة الطلب
  const statusCell = document.createElement("td");
  statusCell.className = "py-4 px-6";

  const select = document.createElement("select");
  select.className = "bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer";

  statuses.forEach((status) => {
    let label = status;
    if (status === "new") label = "جديد";
    if (status === "processing") label = "قيد التنفيذ";
    if (status === "delivered") label = "تم التوصيل";
    if (status === "cancelled") label = "ملغي";

    select.add(new Option(label, status, status === o.status, status === o.status));
  });

  select.onchange = async () => {
    const previousStatus = o.status;
    const newStatus = select.value;

    try {
      await request("/api/admin/update_status_of_order", {
        method: "PUT",
        body: {
          order_id: id(o),
          status_order: newStatus
        }
      });
      o.status = newStatus;
      toast("تم تحديث حالة الطلب بنجاح", "success");
      loadOverviewStats(); // تحديث الأرباح والإحصائيات فوراً
    } catch (error) {
      console.error("Update order status error:", error);
      select.value = previousStatus;
      toast("تعذر تحديث حالة الطلب", "error");
    }
  };

  statusCell.append(select);

  // 7. إجراءات
  const actions = document.createElement("td");
  actions.className = "py-4 px-6 text-center";

  const del = document.createElement("button");
  del.className = "w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 inline-flex items-center justify-center text-xs transition-all";
  del.innerHTML = '<i class="fa-solid fa-trash"></i>';
  del.title = "حذف الطلب";

  del.onclick = async () => {
    if (await confirm("هل أنت متأكد من رغبتك في حذف هذا الطلب نهائياً؟")) {
      try {
        await request("/api/admin/delete_order", {
          method: "DELETE",
          body: { order_id: id(o) }
        });
        
        tr.remove();
        orders = orders.filter((item) => id(item) !== id(o));
        ordersTotalCount = Math.max(0, ordersTotalCount - 1);

        toast("تم حذف الطلب بنجاح", "success");
        updateOrdersPagination();
        loadOverviewStats(); // تحديث الإحصائيات
      } catch (error) {
        console.error("Delete order error:", error);
        toast("تعذر حذف الطلب", "error");
      }
    }
  };

  actions.append(del);

  tr.append(tdNum, tdUser, tdContact, tdGps, tdPrice, statusCell, actions);
  return tr;
}

// ======================================================
// إدارة المنتجات (Products Management)
// ======================================================
async function loadProducts(page = 1, append = false) {
  if (productsLoading) return;

  const root = document.querySelector("#products-list");
  if (!root) return;

  productsLoading = true;

  if (!append) {
    products = [];
    productsPage = 1;
    productsTotalPages = 1;
    state(root, "جارٍ تحميل المنتجات…");
  }

  try {
    const response = await request(
      `/api/get_products?page=${page}&limit=${productsPerPage}`
    );

    const newProducts = response.data || [];
    products = append ? [...products, ...newProducts] : newProducts;
    productsPage = page;

    if (response.pagination) {
      productsTotalPages = Number(response.pagination.totalPages) || 1;
    } else {
      productsTotalPages = newProducts.length >= productsPerPage ? page + 1 : page;
    }

    renderProducts();
    await loadSections();
    updateProductsPagination();
  } catch (error) {
    console.error("Load products error:", error);
    state(root, "تعذر تحميل المنتجات.", "error");
  } finally {
    productsLoading = false;
  }
}

function renderProducts() {
  const root = document.querySelector("#products-list");
  if (!root) return;

  if (!products.length) {
    state(root, "لا توجد منتجات مسجلة حالياً.", "empty");
    updateProductsPagination();
    return;
  }

  root.replaceChildren(
    ...products.map((p) => {
      const card = document.createElement("article");
      card.className = "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group";

      const imgWrap = document.createElement("div");
      imgWrap.className = "w-full aspect-square bg-slate-50 rounded-xl overflow-hidden mb-3 border border-slate-100 flex items-center justify-center relative";

      const img = document.createElement("img");
      img.src = p.image || "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500";
      img.alt = p.name || "صورة المنتج";
      img.loading = "lazy";
      img.className = "w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300";
      img.onerror = () => {
        img.src = "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500";
      };

      imgWrap.append(img);

      if (p.discount > 0) {
        const discountBadge = document.createElement("span");
        discountBadge.className = "absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow";
        discountBadge.textContent = `خصم ${p.discount}%`;
        imgWrap.append(discountBadge);
      }

      const details = document.createElement("div");
      details.className = "space-y-1.5 flex-1";

      const sectionName = text("span", p.section?.name || "عام");
      sectionName.className = "text-[11px] font-bold text-amber-600 block";

      const name = text("h4", p.name || "منتج بدون اسم");
      name.className = "font-black text-slate-900 text-sm line-clamp-1";

      const desc = text("p", p.description || "");
      desc.className = "text-xs text-slate-500 line-clamp-2 leading-relaxed";

      const priceBox = document.createElement("div");
      priceBox.className = "pt-2 flex items-baseline justify-between";

      const finalPrice = text("strong", money(p.final_price ?? p.price));
      finalPrice.className = "text-base font-black text-slate-900";

      const stockTag = text(
        "span",
        Number(p.quantity) > 0 ? `المتوفر: ${p.quantity}` : "نفد المخزون"
      );
      stockTag.className = `text-[11px] font-bold ${
        Number(p.quantity) > 0 ? "text-emerald-600" : "text-rose-600"
      }`;

      priceBox.append(finalPrice, stockTag);
      details.append(sectionName, name, desc, priceBox);

      const actions = document.createElement("div");
      actions.className = "pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 mt-3";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all";
      editBtn.innerHTML = '<i class="fa-solid fa-pen"></i><span>تعديل</span>';
      editBtn.onclick = () => openEditModal(p);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all";
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i><span>حذف</span>';
      delBtn.onclick = () => deleteProduct(p);

      actions.append(editBtn, delBtn);

      card.append(imgWrap, details, actions);
      return card;
    })
  );
}

function ensureProductsSentinel() {
  let pagination = document.querySelector("#products-pagination");
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = "products-pagination";
    pagination.className = "py-4 text-center text-xs font-bold text-slate-500 col-span-full";

    const root = document.querySelector("#products-list");
    if (root) root.after(pagination);
  }
  return pagination;
}

function updateProductsPagination() {
  const pagination = ensureProductsSentinel();
  pagination.replaceChildren();

  const info = document.createElement("span");
  const hasMore = productsPage < productsTotalPages;

  info.textContent = hasMore
    ? `تم تحميل ${products.length} منتج (قم بالتمرير لتحميل المزيد...)`
    : products.length
    ? `تم تحميل كافة المنتجات (${products.length})`
    : "";

  pagination.append(info);
  setupProductsInfiniteScroll();
}

function setupProductsInfiniteScroll() {
  if (productsScrollReady) return;

  const sentinel = ensureProductsSentinel();
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && !productsLoading && productsPage < productsTotalPages) {
        loadProducts(productsPage + 1, true);
      }
    },
    { rootMargin: "400px" }
  );

  observer.observe(sentinel);
  productsScrollReady = true;
}

// ======================================================
// نافذة تعديل المنتج (Edit Product Modal)
// ======================================================
function setupEditModal() {
  const modal = document.querySelector("#edit-product-modal");
  const closeBtn = document.querySelector("#close-edit-modal-btn");
  const cancelBtn = document.querySelector("#cancel-edit-btn");
  const editFile = document.querySelector("#edit-image-file");
  const editUrl = document.querySelector("#edit-product-image");
  const form = document.querySelector("#edit-product-form");
  const editProgressContainer = document.querySelector("#edit-progress-container");
  const editProgressBar = document.querySelector("#edit-progress-bar");

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (editFile) {
    editFile.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (!file.type.startsWith("image/")) {
          toast("يرجى اختيار ملف صورة صالح", "error");
          return;
        }

        if (editProgressContainer) editProgressContainer.classList.remove("hidden");
        if (editProgressBar) editProgressBar.style.width = "0%";

        try {
          const secureUrl = await uploadFileToCloudinary(file, (percent) => {
            if (editProgressBar) editProgressBar.style.width = `${percent}%`;
          });

          if (editUrl) editUrl.value = secureUrl;
          toast("تم رفع وتحديث صورة التعديل بنجاح", "success");
        } catch (err) {
          console.error("Edit upload error:", err);
          toast("فشل رفع الصورة في نافذة التعديل", "error");
        } finally {
          setTimeout(() => {
            if (editProgressContainer) editProgressContainer.classList.add("hidden");
          }, 1500);
        }
      }
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();

      const saveBtn = document.querySelector("#save-edit-btn");
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "جارٍ الحفظ...";
      }

      const pId = document.querySelector("#edit-product-id")?.value;
      const name = document.querySelector("#edit-product-name")?.value.trim();
      const section = document.querySelector("#edit-product-section")?.value;
      const price = Number(document.querySelector("#edit-product-price")?.value);
      const discount = Number(document.querySelector("#edit-product-discount")?.value || 0);
      const quantity = Number(document.querySelector("#edit-product-quantity")?.value);
      const description = document.querySelector("#edit-product-description")?.value.trim();
      const image = document.querySelector("#edit-product-image")?.value.trim();

      if (!image) {
        toast("يرجى رفع صورة للمنتج أو وضع رابط صالح", "error");
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "حفظ التعديلات";
        }
        return;
      }

      try {
        await request("/api/admin/update_product", {
          method: "PUT",
          body: {
            product_id: pId,
            product_name: name,
            product_description: description,
            product_price: price,
            product_discount: discount,
            image: image,
            quantity: quantity,
            section: section
          }
        });

        toast("تم تعديل بيانات المنتج بنجاح", "success");
        closeModal();
        await loadProducts(1, false);
      } catch (error) {
        console.error("Edit product submit error:", error);
        toast(error.message || "تعذر تعديل المنتج", "error");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "حفظ التعديلات";
        }
      }
    };
  }
}

function openEditModal(product) {
  const modal = document.querySelector("#edit-product-modal");
  if (!modal) return;

  document.querySelector("#edit-product-id").value = id(product);
  document.querySelector("#edit-product-name").value = product.name || "";
  document.querySelector("#edit-product-price").value = product.price ?? "";
  document.querySelector("#edit-product-discount").value = product.discount ?? 0;
  document.querySelector("#edit-product-quantity").value = product.quantity ?? 1;
  document.querySelector("#edit-product-description").value = product.description || "";
  document.querySelector("#edit-product-image").value = product.image || "";

  const selectSection = document.querySelector("#edit-product-section");
  if (selectSection) {
    selectSection.replaceChildren(
      ...sections.map(
        (s) =>
          new Option(
            s.name,
            s._id,
            s._id === (product.section?._id || product.section),
            s._id === (product.section?._id || product.section)
          )
      )
    );
  }

  modal.classList.remove("hidden");
}

async function deleteProduct(product) {
  const productId = id(product);
  if (!productId) return;

  const accepted = await confirm(`هل أنت متأكد من حذف المنتج "${product.name}"؟`);
  if (!accepted) return;

  try {
    await request("/api/admin/delete_product", {
      method: "DELETE",
      body: { product_id: productId }
    });

    toast("تم حذف المنتج بنجاح", "success");
    await loadProducts(1, false);
    loadOverviewStats();
  } catch (error) {
    console.error("Delete product error:", error);
    toast("تعذر حذف المنتج", "error");
  }
}

// ======================================================
// إدارة الأقسام (Sections Management)
// ======================================================
async function loadSections() {
  try {
    const response = await request("/api/get_all_sections");
    sections = response.data || [];

    const select = document.querySelector("#product-section");
    if (select) {
      select.replaceChildren(
        ...sections.map((s) => new Option(s.name, s._id))
      );
    }

    const sectionsList = document.querySelector("#sections-list");
    if (!sectionsList) return;

    if (!sections.length) {
      sectionsList.innerHTML = `<p class="text-xs text-slate-400 py-2 col-span-full">لا توجد أقسام مسجلة حتى الآن.</p>`;
      return;
    }

    sectionsList.replaceChildren(
      ...sections.map((sectionItem) => {
        const card = document.createElement("div");
        card.className = "bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm";

        const name = text("span", sectionItem.name);
        name.className = "font-bold text-xs text-slate-800";

        const actions = document.createElement("div");
        actions.className = "flex items-center gap-1.5";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center text-[11px] transition-all";
        edit.innerHTML = '<i class="fa-solid fa-pen"></i>';
        edit.onclick = async () => editSection(sectionItem);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "w-7 h-7 rounded-lg bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center text-[11px] transition-all";
        del.innerHTML = '<i class="fa-solid fa-trash"></i>';
        del.onclick = async () => deleteSection(sectionItem);

        actions.append(edit, del);
        card.append(name, actions);
        return card;
      })
    );
  } catch (error) {
    console.error("Load sections error:", error);
  }
}

async function editSection(sectionItem) {
  const sectionId = id(sectionItem);
  if (!sectionId) return;

  const newName = await promptDialog("اكتب اسم القسم الجديد:", sectionItem.name || "");
  if (newName === null) return;

  const cleanName = newName.trim();
  if (!cleanName) {
    toast("اسم القسم مطلوب", "error");
    return;
  }

  try {
    await request("/api/admin/update_section", {
      method: "PUT",
      body: {
        section_id: sectionId,
        section_name: cleanName
      }
    });

    toast("تم تعديل القسم بنجاح", "success");
    await loadProducts(1, false);
    await loadSections();
  } catch (error) {
    console.error("Edit section error:", error);
    toast("تعذر تعديل القسم", "error");
  }
}

async function deleteSection(sectionItem) {
  const sectionId = id(sectionItem);
  if (!sectionId) return;

  const accepted = await confirm(`هل أنت متأكد من رغبتك في حذف قسم "${sectionItem.name}"؟`);
  if (!accepted) return;

  try {
    await request("/api/admin/delete_section", {
      method: "DELETE",
      body: { section_id: sectionId }
    });

    toast("تم حذف القسم بنجاح", "success");
    await loadProducts(1, false);
    await loadSections();
  } catch (error) {
    console.error("Delete section error:", error);
    toast("تعذر حذف القسم", "error");
  }
}

// ======================================================
// مشاكل العملاء وبلاغات الدعم (Customer Problems / Support Tickets)
// GET /api/get_problems — محمي بـ auth_super_admin
// ======================================================
async function loadProblems() {
  const root = document.querySelector("#problems-list");
  if (!root) return;

  state(root, "جارٍ تحميل مشاكل العملاء…");

  try {
    const response = await request("/api/get_problems");
    const problems = response.data || [];

    if (!problems.length) {
      state(root, "لا توجد بلاغات مسجلة حتى الآن.", "empty");
      return;
    }

    root.replaceChildren(...problems.map(problemRow));
  } catch (error) {
    console.error("Load problems error:", error);
    state(root, "تعذر تحميل مشاكل العملاء.", "error");
  }
}

function problemRow(p) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs align-top";

  // 1. تفاصيل المشكلة
  const tdProblem = document.createElement("td");
  tdProblem.className = "py-4 px-6 text-slate-700 whitespace-pre-line max-w-md";
  tdProblem.textContent = p.problem || "—";

  // 2. رقم الطلب
  const tdOrder = text("td", p.order_number || "—");
  tdOrder.className = "py-4 px-6 font-bold text-slate-900 whitespace-nowrap";

  // 3. بيانات الاتصال
  const tdContact = document.createElement("td");
  tdContact.className = "py-4 px-6 space-y-1.5";

  const phone = p.phone_number;
  if (phone) {
    const phoneLink = document.createElement("a");
    phoneLink.href = `tel:${phone}`;
    phoneLink.className = "flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-mono transition-colors";
    phoneLink.innerHTML = `<i class="fa-solid fa-phone text-slate-400 text-[10px]"></i><span>${phone}</span>`;
    tdContact.append(phoneLink);
  }

  const wa = p.whatsApp_number;
  if (wa) {
    const cleanWa = String(wa).replace(/\D/g, "");
    const waLink = document.createElement("a");
    waLink.href = `https://wa.me/${cleanWa}`;
    waLink.target = "_blank";
    waLink.rel = "noopener noreferrer";
    waLink.className = "inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-bold transition-colors";
    waLink.innerHTML = `<i class="fa-brands fa-whatsapp text-emerald-500"></i><span>${wa}</span>`;
    tdContact.append(waLink);
  }

  if (!phone && !wa) {
    tdContact.textContent = "—";
    tdContact.className = "py-4 px-6 text-slate-400";
  }

  // 4. الموقع
  const tdGps = document.createElement("td");
  tdGps.className = "py-4 px-6 text-center";

  const gpsUrl = p.GPS_URL;
  if (gpsUrl) {
    const fullGpsUrl = gpsUrl.startsWith("http") ? gpsUrl : `https://${gpsUrl}`;
    const gpsBtn = document.createElement("a");
    gpsBtn.href = fullGpsUrl;
    gpsBtn.target = "_blank";
    gpsBtn.rel = "noopener noreferrer";
    gpsBtn.className = "inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-lg border border-amber-200 transition-all";
    gpsBtn.innerHTML = '<i class="fa-solid fa-location-dot text-rose-500"></i> <span>الموقع</span>';
    tdGps.append(gpsBtn);
  } else {
    tdGps.textContent = "—";
    tdGps.className = "py-4 px-6 text-center text-slate-400";
  }

  // 5. الصورة المرفقة
  const tdImage = document.createElement("td");
  tdImage.className = "py-4 px-6 text-center";

  if (p.image) {
    const link = document.createElement("a");
    link.href = p.image;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = p.image;
    img.alt = "صورة المشكلة";
    img.className = "w-12 h-12 object-cover rounded-lg border border-slate-200 mx-auto";

    link.append(img);
    tdImage.append(link);
  } else {
    tdImage.textContent = "—";
    tdImage.className = "py-4 px-6 text-center text-slate-400";
  }

  // 6. تاريخ البلاغ
  const tdDate = document.createElement("td");
  tdDate.className = "py-4 px-6 text-center text-slate-500 whitespace-nowrap";
  tdDate.textContent = p.createdAt ? new Date(p.createdAt).toLocaleString("ar-EG") : "—";

  tr.append(tdProblem, tdOrder, tdContact, tdGps, tdImage, tdDate);
  return tr;
}

// ======================================================
// إدارة المستخدمين والصلاحيات (Users Management)
// ======================================================
async function loadUsers() {
  const root = document.querySelector("#users-list");
  if (!root) return;

  try {
    const users = (await request("/api/admin/get_all_users")).data || [];

    if (!users.length) {
      state(root, "لا يوجد مستخدمون مسجلون.", "empty");
      return;
    }

    root.replaceChildren(
      ...users.map((u) => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/80 transition-colors border-b border-slate-100";

        const tdName = text("td", u.name || "مستخدم");
        tdName.className = "py-4 px-6 font-bold text-slate-900";

        const tdEmail = text("td", u.email || "—");
        tdEmail.className = "py-4 px-6 text-slate-600 text-xs";

        const tdRole = document.createElement("td");
        tdRole.className = "py-4 px-6";
        const roleBadge = document.createElement("span");

        if (u.role === "super_admin") {
          roleBadge.className = "px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-700 border border-purple-200";
          roleBadge.textContent = "المدير العام";
        } else if (u.role === "admin") {
          roleBadge.className = "px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200";
          roleBadge.textContent = "مدير (Admin)";
        } else {
          roleBadge.className = "px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200";
          roleBadge.textContent = "عميل";
        }
        tdRole.append(roleBadge);

        const tdAction = document.createElement("td");
        tdAction.className = "py-4 px-6 text-center";

        const btn = document.createElement("button");
        const protectedRole = u.role === "super_admin";

        btn.disabled = protectedRole;
        btn.className = protectedRole
          ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed"
          : u.role === "admin"
          ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
          : "px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all";

        btn.textContent = protectedRole
          ? "محمي"
          : u.role === "admin"
          ? "تخفيض لمستخدم"
          : "ترقية لمدير";

        btn.onclick = async () => {
          try {
            await request(
              u.role === "admin"
                ? "/api/admin/update_admin_to_user"
                : "/api/admin/upgrade_user_to_admin",
              {
                method: "PUT",
                body: { user_id: id(u) }
              }
            );

            toast("تم تحديث صلاحية المستخدم بنجاح", "success");
            await loadUsers();
            await loadOverviewStats();
          } catch (error) {
            console.error("Update user error:", error);
            toast("تعذر تحديث صلاحية المستخدم", "error");
          }
        };

        tdAction.append(btn);
        tr.append(tdName, tdEmail, tdRole, tdAction);
        return tr;
      })
    );
  } catch (error) {
    console.error("Load users error:", error);
    state(root, "تعذر تحميل قائمة المستخدمين.", "error");
  }
}

// ======================================================
// النماذج وإرسال البيانات (Forms Handling)
// ======================================================
function forms() {
  const sectionForm = document.querySelector("#section-form");
  if (sectionForm) {
    sectionForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await request("/api/admin/add_section", {
          method: "POST",
          body: {
            section_name: e.target.section_name.value
          }
        });

        e.target.reset();
        toast("تمت إضافة القسم بنجاح", "success");
        await loadSections();
      } catch (error) {
        console.error("Add section error:", error);
        toast("تعذر إضافة القسم", "error");
      }
    };
  }

  const productForm = document.querySelector("#product-form");
  if (productForm) {
    productForm.onsubmit = async (e) => {
      e.preventDefault();

      const submitBtn = document.querySelector("#add-product-submit-btn");
      const body = Object.fromEntries(new FormData(e.target));
      const quantity = Number(body.quantity);

      if (!Number.isInteger(quantity) || quantity < 0) {
        toast("الكمية يجب أن تكون رقماً صحيحاً وموجباً", "error");
        return;
      }

      body.quantity = quantity;
      body.product_price = Number(body.product_price);
      body.product_discount = Number(body.product_discount || 0);

      if (!body.image || !body.image.trim()) {
        toast("يرجى اختيار صورة للمنتج ليتم رفعها أو وضع رابط صالح", "error");
        return;
      }

      body.image = body.image.trim();

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ حفظ المنتج...</span>';
        }

        await request("/api/admin/add_product", {
          method: "POST",
          body
        });

        e.target.reset();

        const previewImg = document.querySelector("#product-preview-img");
        const placeholder = document.querySelector("#product-preview-placeholder");
        const statusText = document.querySelector("#product-image-status");

        if (previewImg) previewImg.classList.add("hidden");
        if (placeholder) placeholder.classList.remove("hidden");
        if (statusText) {
          statusText.textContent = "لم يتم اختيار صورة بعد";
          statusText.className = "text-[10px] text-slate-400";
        }

        toast("تمت إضافة المنتج بنجاح إلى المتجر", "success");
        await loadProducts(1, false);
        await loadOverviewStats();
      } catch (error) {
        console.error("Add product error:", error);
        toast(error.message || "تعذر إضافة المنتج", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> <span>إضافة المنتج للمتجر</span>';
        }
      }
    };
  }

  const couponForm = document.querySelector("#coupon-form");
  if (couponForm) {
    couponForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const body = Object.fromEntries(new FormData(e.target));
        body.discount = Number(body.discount);
        body.end_time = new Date(body.end_time).toISOString();

        await request("/api/admin/add_coupon", {
          method: "POST",
          body
        });

        toast("تم إنشاء وتفعيل الكوبون بنجاح", "success");
        e.target.reset();
      } catch (error) {
        console.error("Add coupon error:", error);
        toast("تعذر إنشاء الكوبون", "error");
      }
    };
  }

  const settingsForm = document.querySelector("#settings-form");
  if (settingsForm) {
    (async () => {
      try {
        const current = (await request("/api/get_store_settings", { silent: true })).data || {};
        if (current.store_name) settingsForm.store_name.value = current.store_name;
        if (current.store_description) settingsForm.store_description.value = current.store_description;
        if (current.store_phone) settingsForm.store_phone.value = current.store_phone;
        if (current.store_whatsApp_number) settingsForm.store_whatsApp_number.value = current.store_whatsApp_number;
        if (current.store_GPS) settingsForm.store_GPS.value = current.store_GPS;

        const design = current.store_design || {};
        if (design.primary_color) settingsForm.primary_color.value = design.primary_color;
        if (design.secondary_color) settingsForm.secondary_color.value = design.secondary_color;
        if (design.background_color) settingsForm.background_color.value = design.background_color;
        if (design.text_color) settingsForm.text_color.value = design.text_color;
        if (design.font_family) settingsForm.font_family.value = design.font_family;
        if (design.banner_text) settingsForm.banner_text.value = design.banner_text;
      } catch (e) {}
    })();

    settingsForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const raw = Object.fromEntries(new FormData(e.target));

        const store_design = {
          primary_color: raw.primary_color,
          secondary_color: raw.secondary_color,
          background_color: raw.background_color,
          text_color: raw.text_color,
          font_family: raw.font_family,
          banner_text: raw.banner_text
        };

        await request("/api/store", {
          method: "POST",
          body: {
            store_name: raw.store_name,
            store_description: raw.store_description,
            store_phone: raw.store_phone,
            store_whatsApp_number: raw.store_whatsApp_number,
            store_GPS: raw.store_GPS,
            store_design
          }
        });

        toast("تم حفظ إعدادات المتجر والهوية بنجاح", "success");
      } catch (error) {
        console.error("Save settings error:", error);
        toast("تعذر حفظ الإعدادات", "error");
      }
    };
  }
}

// ======================================================
// بدء التشغيل
// ======================================================
guard().then(async () => {
  if (!user) return;

  if (isSuper) {
    forms();
    await loadProducts(1, false);
    await loadUsers();
    await loadProblems();
  } else {
    await loadProducts(1, false);
  }
});