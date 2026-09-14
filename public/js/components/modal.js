export function confirm(message) { return new Promise(resolve => { const d = document.createElement('dialog'); d.className = 'modal'; d.innerHTML = `<p></p><div><button class="button ghost">إلغاء</button><button class="button danger">تأكيد</button></div>`; d.querySelector('p').textContent = message; d.querySelector('.ghost').onclick = () => { d.close(); d.remove(); resolve(false); }; d.querySelector('.danger').onclick = () => { d.close(); d.remove(); resolve(true); }; document.body.append(d); d.showModal(); }); }

export function promptDialog(title, defaultValue = '') {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = `
      <div style="padding: 18px; min-width: 300px; text-align: right; direction: rtl; font-family: inherit;">
        <p style="font-weight: 700; margin-bottom: 12px; font-size: 14px; color: #0f172a;"></p>
        <input type="text" class="input" style="width: 100%; margin-bottom: 14px; height: 40px; font-size: 14px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 8px;" />
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" class="button ghost cancel-btn" style="padding: 6px 14px;">إلغاء</button>
          <button type="button" class="button btn-accent save-btn" style="padding: 6px 16px; background: #ff9900; color: #000; font-weight: bold; border-radius: 8px;">تأكيد</button>
        </div>
      </div>
    `;
    d.querySelector('p').textContent = title;
    const input = d.querySelector('input');
    input.value = defaultValue;
    d.querySelector('.cancel-btn').onclick = () => { d.close(); d.remove(); resolve(null); };
    d.querySelector('.save-btn').onclick = () => { const val = input.value.trim(); d.close(); d.remove(); resolve(val); };
    document.body.append(d);
    d.showModal();
    input.focus();
  });
}
