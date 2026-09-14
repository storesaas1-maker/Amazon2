import { request } from './api.js';
const destinations = { super_admin: '/super-admin.html', admin: '/admin.html', user: '/index.html' };
export async function currentUser() { try { const data = await request('/api/auth/me', { silent: true }); return data.user; } catch { return null; } }
export async function checkAuth(allowedRoles) {
  const user = await currentUser();
  if (!user) { location.replace('/login.html'); return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) { location.replace(destinations[user.role] || '/index.html'); return null; }
  return user;
}
export { destinations };
