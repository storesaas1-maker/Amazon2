import { request } from '../api.js';
import { toast } from '../toast.js';
import { mountSiteShell } from '../components/site-shell.js';
import { initSite } from './common.js';
import { currentUser } from '../auth-guard.js';

// تثبيت الهيكل العام (الهيدر والفوتر)
mountSiteShell({ active: 'help' });

// ======================================================
// إعدادات Cloudinary (نفس الإعدادات المستخدمة في باقي الموقع)
// تُقرأ من متغيرات البيئة على السيرفر عبر /api/get_cloudinary_config
// ======================================================
let cloudinaryConfig = {
  cloudName: 'de95jndw0',
  uploadPreset: 'youtube mvp',
  uploadUrl: 'https://api.cloudinary.com/v1_1/de95jndw0/image/upload'
};

async function loadCloudinaryConfig() {
  try {
    const res = await request('/api/get_cloudinary_config', { silent: true });
    if (res && res.data) {
      if (res.data.cloudName) cloudinaryConfig.cloudName = res.data.cloudName;
      if (res.data.uploadPreset) cloudinaryConfig.uploadPreset = res.data.uploadPreset;
      if (res.data.uploadUrl) {
        cloudinaryConfig.uploadUrl = res.data.uploadUrl;
      } else if (res.data.cloudName) {
        cloudinaryConfig.uploadUrl = `https://api.cloudinary.com/v1_1/${res.data.cloudName}/image/upload`;
      }
    }
  } catch (e) {}
}

function uploadFileToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    xhr.open('POST', cloudinaryConfig.uploadUrl, true);

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
        } catch (e) {
          reject(new Error('تعذرت قراءة استجابة الرفع'));
        }
      } else {
        reject(new Error('فشل رفع الصورة إلى Cloudinary'));
      }
    };

    xhr.onerror = () => reject(new Error('تعذر الاتصال بخدمة رفع الصور'));
    xhr.send(formData);
  });
}

// ======================================================
// بيانات المشاكل — القسم الأول: مشاكل يمكن حلها ذاتياً
// كل عنصر: سؤال + خطوات حل مقترحة (لا يحتاج تواصل مع خدمة العملاء)
// ======================================================
const SELF_HELP_ITEMS = [
  {
    id: 'confirm-order-not-working',
    icon: 'fa-solid fa-cart-shopping',
    question: 'زر "تأكيد الطلب" لا يعمل أو لا يستجيب عند الضغط عليه',
    tips: [
      'يجب أن تكون مسجّلاً الدخول أولاً حتى يتم قبول الطلب',
      'تأكد أن جميع المنتجات الموجودة في سلتك متوفرة بالمخزون حالياً',
      'تأكد من إدخال كل البيانات المطلوبة بشكل كامل وصحيح (الاسم، رقم الهاتف، عنوان التوصيل)',
      'تأكد من اختيار طريقة الدفع قبل الضغط على تأكيد الطلب',
      'تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة وحاول مجدداً',
      'إذا استمرت المشكلة، جرّب حذف المنتجات من السلة وإضافتها من جديد'
    ]
  },
  {
    id: 'coupon-not-working',
    icon: 'fa-solid fa-ticket',
    question: 'كود الخصم أو القسيمة لا يعمل عند إدخاله',
    tips: [
      'تأكد من كتابة الكود بحروف صحيحة وبدون مسافات إضافية',
      'تحقق من أن الكود لم تنتهِ صلاحيته بعد',
      'بعض الأكواد تتطلب حداً أدنى لقيمة الطلب لتفعيلها',
      'كل قسيمة يمكن استخدامها مرة واحدة فقط لكل عميل'
    ]
  },
  {
    id: 'login-issue',
    icon: 'fa-solid fa-right-to-bracket',
    question: 'لا أستطيع تسجيل الدخول أو نسيت كلمة المرور',
    tips: [
      'استخدم رابط "نسيت كلمة المرور؟" الموجود في صفحة تسجيل الدخول',
      'تأكد من كتابة البريد الإلكتروني أو رقم الهاتف الصحيح المسجل لدينا',
      'تحقق من مجلد الرسائل غير المرغوب فيها (Spam) بحثاً عن رسالة إعادة التعيين'
    ]
  },
  {
    id: 'otp-not-arriving',
    icon: 'fa-solid fa-key',
    question: 'لم يصلني رمز التحقق (OTP) عبر الهاتف أو البريد الإلكتروني',
    tips: [
      'انتظر دقيقة كاملة على الأقل قبل طلب إعادة إرسال الرمز',
      'تأكد من صحة رقم الهاتف أو البريد الإلكتروني الذي أدخلته',
      'تحقق من قوة إشارة الشبكة أو اتصال الإنترنت لديك'
    ]
  },
  {
    id: 'display-glitch',
    icon: 'fa-solid fa-image',
    question: 'الأسعار أو صور المنتجات لا تظهر بشكل صحيح',
    tips: [
      'امسح ذاكرة التخزين المؤقت (Cache) للمتصفح',
      'جرّب إعادة تحميل الصفحة بشكل كامل (Ctrl + F5)',
      'جرّب فتح الموقع من متصفح آخر للتأكد من أن المشكلة ليست من جهازك'
    ]
  },
  {
    id: 'quantity-limit',
    icon: 'fa-solid fa-layer-group',
    question: 'لا أستطيع زيادة كمية المنتج في السلة أكثر من رقم معيّن',
    tips: [
      'هذا يعني أن الكمية المتوفرة من هذا المنتج بالمخزون محدودة حالياً',
      'بعض المنتجات لها حد أقصى للشراء لكل عميل لضمان توفرها لجميع الزوار'
    ]
  }
];

// ======================================================
// بيانات المشاكل — القسم الثاني: مشاكل تحتاج تواصل مع خدمة العملاء
// requiresImage: هل يجب إرفاق صورة لإثبات المشكلة
// urgent: تمييز بصري للمشاكل الحساسة (مثل مشاكل الدفع)
// ======================================================
const SUPPORT_ISSUES = [
  {
    id: 'damaged-product',
    icon: 'fa-solid fa-box-open',
    title: 'استلمت منتجاً تالفاً أو مختلفاً عن الوصف',
    description: 'إذا وصلك المنتج مكسوراً، معيباً، أو غير مطابق لما تم طلبه',
    requiresImage: true,
    urgent: false
  },
  {
    id: 'delivery-delay',
    icon: 'fa-solid fa-truck-fast',
    title: 'الطلب متأخر عن الموعد المتوقع للتوصيل',
    description: 'تجاوز طلبك الموعد المحدد للتسليم ولم يصلك بعد',
    requiresImage: false,
    urgent: false
  },
  {
    id: 'payment-charged-order-failed',
    icon: 'fa-solid fa-credit-card',
    title: 'تم خصم المبلغ من حسابي ولم يتم تأكيد الطلب',
    description: 'مشكلة في الدفع تحتاج مراجعة عاجلة من فريقنا المالي',
    requiresImage: false,
    urgent: true
  },
  {
    id: 'return-exchange',
    icon: 'fa-solid fa-rotate-left',
    title: 'أريد استرجاع أو استبدال منتج',
    description: 'غيّرت رأيك أو تحتاج مقاساً/لوناً مختلفاً لمنتج استلمته',
    requiresImage: true,
    urgent: false
  },
  {
    id: 'missing-items',
    icon: 'fa-solid fa-triangle-exclamation',
    title: 'استلمت الطلب ناقصاً (منتج مفقود من الشحنة)',
    description: 'كمية أو منتج مفقود عن ما هو مذكور في فاتورة الطلب',
    requiresImage: true,
    urgent: false
  },
  {
    id: 'other-issue',
    icon: 'fa-solid fa-circle-question',
    title: 'مشكلة أخرى غير مذكورة أعلاه',
    description: 'صِف مشكلتك بالتفصيل وسنراجعها في أقرب وقت',
    requiresImage: false,
    urgent: false
  }
];

// ======================================================
// عناصر الصفحة
// ======================================================
const selfHelpList = document.querySelector('#self-help-list');
const selfHelpEmpty = document.querySelector('#self-help-empty');
const supportGrid = document.querySelector('#support-issues-grid');
const supportEmpty = document.querySelector('#support-issues-empty');
const searchInput = document.querySelector('#help-search-input');
const searchClearBtn = document.querySelector('#help-search-clear-btn');

const categorySelect = document.querySelector('#report-category');
const reportForm = document.querySelector('#report-form');
const reportFormWrap = document.querySelector('#report-form-wrap');
const reportSuccessBox = document.querySelector('#report-success-box');
const reportRefNumber = document.querySelector('#report-ref-number');
const newTicketBtn = document.querySelector('#report-new-ticket-btn');
const submitBtn = document.querySelector('#report-submit-btn');
const imageRequiredNote = document.querySelector('#image-required-note');
const descriptionInput = document.querySelector('#report-description');
const reportAuthGate = document.querySelector('#report-auth-gate');

// ======================================================
// بناء قائمة الأسئلة القابلة للحل الذاتي (أكورديون)
// ======================================================
function renderSelfHelp(filterText = '') {
  if (!selfHelpList) return;
  selfHelpList.innerHTML = '';

  const filtered = SELF_HELP_ITEMS.filter((item) =>
    !filterText || item.question.includes(filterText) || item.tips.some((t) => t.includes(filterText))
  );

  if (selfHelpEmpty) selfHelpEmpty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'accordion-item';
    el.innerHTML = `
      <button type="button" class="accordion-trigger">
        <span class="q-text"><i class="${item.icon} q-icon"></i> ${item.question}</span>
        <i class="fa-solid fa-chevron-down chev"></i>
      </button>
      <div class="accordion-body">
        <ul class="fix-list">
          ${item.tips.map((t) => `<li><i class="fa-solid fa-circle-check"></i><span>${t}</span></li>`).join('')}
        </ul>
        <div class="accordion-still-stuck">
          <span>ما زالت المشكلة قائمة؟</span>
          <button type="button" class="button btn-secondary btn-sm still-stuck-btn" data-question="${item.question}">
            <i class="fa-solid fa-headset"></i> تواصل مع خدمة العملاء
          </button>
        </div>
      </div>
    `;

    el.querySelector('.accordion-trigger').onclick = () => {
      el.classList.toggle('is-open');
    };

    el.querySelector('.still-stuck-btn').onclick = () => {
      openReportForm('other-issue', item.question);
    };

    selfHelpList.appendChild(el);
  });
}

// ======================================================
// بناء بطاقات المشاكل التي تحتاج خدمة عملاء
// ======================================================
function renderSupportIssues(filterText = '') {
  if (!supportGrid) return;
  supportGrid.innerHTML = '';

  const filtered = SUPPORT_ISSUES.filter((item) =>
    !filterText || item.title.includes(filterText) || item.description.includes(filterText)
  );

  if (supportEmpty) supportEmpty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = `issue-card${item.urgent ? ' is-urgent' : ''}`;
    card.innerHTML = `
      <div class="issue-card-icon"><i class="${item.icon}"></i></div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <div class="tag-row">
        ${item.urgent ? '<span class="badge" style="background: var(--error-bg); color: var(--error);">عاجل</span>' : ''}
        ${item.requiresImage ? '<span class="badge badge-neutral"><i class="fa-solid fa-camera"></i> يتطلب صورة</span>' : ''}
      </div>
      <button type="button" class="button btn-accent btn-block report-issue-btn">
        <i class="fa-solid fa-paper-plane"></i> الإبلاغ عن هذه المشكلة
      </button>
    `;

    card.querySelector('.report-issue-btn').onclick = () => openReportForm(item.id, item.title);
    supportGrid.appendChild(card);
  });
}

// ======================================================
// تعبئة قائمة أنواع المشاكل في نموذج البلاغ
// ======================================================
function populateCategorySelect() {
  if (!categorySelect) return;
  SUPPORT_ISSUES.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.title;
    opt.dataset.requiresImage = item.requiresImage ? '1' : '0';
    categorySelect.appendChild(opt);
  });
}

// ======================================================
// فتح النموذج مع تحديد نوع المشكلة مسبقاً والتمرير إليه
// ======================================================
function openReportForm(categoryId, prefillNote) {
  if (categorySelect) categorySelect.value = categoryId;
  updateImageRequirement();

  if (descriptionInput && prefillNote) {
    descriptionInput.placeholder = `بخصوص: ${prefillNote} — اشرح لنا التفاصيل...`;
  }

  document.querySelector('#report-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => descriptionInput?.focus(), 400);
}

function updateImageRequirement() {
  const selected = SUPPORT_ISSUES.find((i) => i.id === categorySelect?.value);
  const requiresImage = !!selected?.requiresImage;
  if (imageRequiredNote) imageRequiredNote.classList.toggle('is-visible', requiresImage);
  reportForm.dataset.imageRequired = requiresImage ? '1' : '0';
}

// ======================================================
// البحث في القسمين معاً
// ======================================================
function setupSearch() {
  if (!searchInput) return;
  searchInput.oninput = () => {
    const val = searchInput.value.trim();
    renderSelfHelp(val);
    renderSupportIssues(val);
  };
  if (searchClearBtn) {
    searchClearBtn.onclick = () => {
      searchInput.value = '';
      renderSelfHelp('');
      renderSupportIssues('');
      searchInput.focus();
    };
  }
}

// ======================================================
// إخفاء نموذج البلاغ عن الزوار غير المسجلين
// (BUG FIX: /api/admin/add_problem يتطلب تسجيل الدخول، لكن الكود
// القديم كان يعرض النموذج للجميع ولا يتحقق من حالة تسجيل الدخول
// إطلاقاً، فكان الزائر غير المسجل يملأ النموذج بالكامل ثم يفاجأ
// برسالة خطأ عامة عند الإرسال. عنصر #report-auth-gate كان موجوداً
// بالفعل في help.html لهذا الغرض لكنه لم يكن يُستخدم من قبل.)
// ======================================================
async function setupAuthGate() {
  const user = await currentUser();

  if (!user) {
    if (reportAuthGate) reportAuthGate.style.display = '';
    if (reportForm) reportForm.style.display = 'none';
    return false;
  }

  if (reportAuthGate) reportAuthGate.style.display = 'none';
  if (reportForm) reportForm.style.display = '';
  return true;
}

// ======================================================
// تحديد الموقع الجغرافي تلقائياً (زر "تحديد موقعي")
// (BUG FIX: الزر #detect-location-btn كان موجوداً في help.html
// بدون أي كود يشغّله، فلم يكن يفعل شيئاً عند الضغط عليه)
// ======================================================
function setupLocationDetect() {
  const detectBtn = document.querySelector('#detect-location-btn');
  const gpsInput = document.querySelector('#report-gps');
  if (!detectBtn || !gpsInput) return;

  if (!navigator.geolocation) {
    detectBtn.disabled = true;
    detectBtn.title = 'المتصفح لا يدعم تحديد الموقع';
    return;
  }

  detectBtn.onclick = () => {
    detectBtn.disabled = true;
    const icon = detectBtn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        gpsInput.value = `https://www.google.com/maps?q=${latitude},${longitude}`;
        toast('تم تحديد موقعك بنجاح', 'success');
        detectBtn.disabled = false;
        if (icon) icon.className = 'fa-solid fa-location-crosshairs';
      },
      () => {
        toast('تعذر تحديد موقعك، يرجى إدخال الرابط يدوياً', 'error');
        detectBtn.disabled = false;
        if (icon) icon.className = 'fa-solid fa-location-crosshairs';
      }
    );
  };
}

// ======================================================
// رفع الصورة عبر Cloudinary داخل نموذج البلاغ
// ======================================================
function setupImageUpload() {
  const dropZone = document.querySelector('#report-drop-zone');
  const fileInput = document.querySelector('#report-image-file');
  const urlInput = document.querySelector('#report-image-url');
  const progressTrack = document.querySelector('#report-progress-track');
  const progressFill = document.querySelector('#report-progress-fill');
  const previewWrap = document.querySelector('#report-preview-wrap');
  const previewImg = document.querySelector('#report-preview-img');
  const uploadStatus = document.querySelector('#report-upload-status');
  const removeBtn = document.querySelector('#report-remove-image-btn');

  if (!dropZone || !fileInput) return;

  dropZone.onclick = () => fileInput.click();

  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  };
  ['dragleave', 'dragend'].forEach((type) => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over'));
  });
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files?.length) handleFile(e.dataTransfer.files[0]);
  };

  fileInput.onchange = (e) => {
    if (e.target.files?.length) handleFile(e.target.files[0]);
  };

  removeBtn.onclick = () => {
    urlInput.value = '';
    fileInput.value = '';
    previewWrap.classList.remove('is-visible');
    dropZone.style.display = '';
  };

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      toast('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('حجم الصورة كبير جداً، الحد الأقصى 10 ميجابايت', 'error');
      return;
    }

    previewImg.src = URL.createObjectURL(file);
    previewWrap.classList.add('is-visible');
    uploadStatus.textContent = 'جاري الرفع...';
    progressTrack.classList.add('is-visible');
    progressFill.style.width = '0%';
    urlInput.value = '';

    try {
      const secureUrl = await uploadFileToCloudinary(file, (percent) => {
        progressFill.style.width = `${percent}%`;
      });
      urlInput.value = secureUrl;
      uploadStatus.textContent = 'تم رفع الصورة بنجاح ✓';
      toast('تم رفع الصورة بنجاح', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      uploadStatus.textContent = 'فشل الرفع، حاول مجدداً';
      toast(err.message || 'فشل رفع الصورة', 'error');
    } finally {
      setTimeout(() => progressTrack.classList.remove('is-visible'), 1000);
    }
  }
}

// ======================================================
// إرسال نموذج البلاغ
// ======================================================
function setupFormSubmit() {
  if (!reportForm) return;

  categorySelect.onchange = updateImageRequirement;

  reportForm.onsubmit = async (e) => {
    e.preventDefault();

    const category = categorySelect.value;
    if (!category) {
      toast('يرجى اختيار نوع المشكلة', 'error');
      return;
    }

    const imageUrl = document.querySelector('#report-image-url').value.trim();
    const requiresImage = reportForm.dataset.imageRequired === '1';
    if (requiresImage && !imageUrl) {
      toast('يرجى إرفاق صورة توضح المشكلة أولاً', 'error');
      return;
    }

    const whatsAppNumber = document.querySelector('#report-whatsapp').value.trim();
    const gpsUrl = document.querySelector('#report-gps').value.trim();
    const phoneNumber = document.querySelector('#report-phone').value.trim();
    const description = descriptionInput.value.trim();

    // BUG FIX: these three fields are required by the backend
    // (controller/add_problem.controller.js) but were never being
    // read from the form at all before, so every submission failed
    // with "problem, phone_number, whatsApp_number and GPS_URL are
    // required" even when the user filled everything in correctly.
    if (!phoneNumber || !whatsAppNumber || !gpsUrl || !description) {
      toast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }

    // BUG FIX: field names now match what
    // controller/add_problem.controller.js actually reads
    // (problem, phone_number, whatsApp_number, GPS_URL, order_number,
    // image) - the old payload used completely different key names
    // (description, contact_phone, image_url, category...) that the
    // backend silently ignored.
    const payload = {
      problem: `[${SUPPORT_ISSUES.find((i) => i.id === category)?.title || category}] ${description}`,
      phone_number: phoneNumber,
      whatsApp_number: whatsAppNumber,
      GPS_URL: gpsUrl,
      order_number: document.querySelector('#report-order-number').value.trim(),
      image: imageUrl
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';

    try {
      // BUG FIX: this used to POST to '/api/submit_problem_report',
      // an endpoint that doesn't exist anywhere in routes/ - every
      // submission was a guaranteed 404. The real, working endpoint
      // for this (see routes/add_problem.router.js) is
      // '/api/admin/add_problem' (the "admin" in the path is
      // misleading - it only requires a logged-in user, not an
      // admin - see middleware/auth.js).
      const res = await request('/api/admin/add_problem', {
        method: 'POST',
        body: payload
      });

      reportFormWrap.style.display = 'none';
      reportSuccessBox.classList.add('is-visible');
      // BUG FIX: the backend has no "ref_number" field (see
      // models/problem.js) so this was always empty; the Mongo _id
      // is the only identifier actually returned and works fine as
      // a reference number.
      reportRefNumber.textContent = res?.data?._id ? `رقم البلاغ: ${res.data._id}` : '';

      toast('تم إرسال بلاغك بنجاح', 'success');
    } catch (err) {
      console.error('Submit report error:', err);
      if (err?.status === 401) {
        toast('انتهت جلستك، يرجى تسجيل الدخول مرة أخرى', 'error');
        setupAuthGate();
      } else {
        toast(err?.message || 'تعذر إرسال البلاغ، حاول مرة أخرى', 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال البلاغ لخدمة العملاء';
    }
  };

  if (newTicketBtn) {
    newTicketBtn.onclick = () => {
      reportForm.reset();
      document.querySelector('#report-image-url').value = '';
      document.querySelector('#report-preview-wrap').classList.remove('is-visible');
      updateImageRequirement();
      reportSuccessBox.classList.remove('is-visible');
      reportFormWrap.style.display = '';
      document.querySelector('#report-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }
}

// ======================================================
// التشغيل
// ======================================================
initSite().then(() => {
  populateCategorySelect();
  renderSelfHelp();
  renderSupportIssues();
  setupSearch();
  setupImageUpload();
  setupLocationDetect();
  setupFormSubmit();
  setupAuthGate();
  loadCloudinaryConfig();
});