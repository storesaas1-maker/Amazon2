const host = () => {
  let node = document.querySelector('#toast-region');
  if (!node) { node = document.createElement('div'); node.id = 'toast-region'; node.setAttribute('aria-live', 'polite'); document.body.append(node); }
  return node;
};
export function toast(message, type = 'info') {
  const item = document.createElement('div'); item.className = `toast toast-${type}`; item.textContent = message || 'حدث خطأ غير متوقع'; host().append(item);
  setTimeout(() => item.remove(), 4200);
}
