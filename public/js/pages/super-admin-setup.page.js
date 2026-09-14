import { request } from "../api.js";
import { currentUser } from "../auth-guard.js";
import { initTheme } from "../theme-engine.js";
import { toast } from "../toast.js";
initTheme();
const user = await currentUser();
if (user?.role === "super_admin") location.replace("/super-admin.html");
if (user?.role === "admin") location.replace("/admin.html");
if (user?.role === "user") location.replace("/index.html");
const form = document.querySelector("#setup-form");
const existing = document.querySelector("#existing-super-admin");
form.onsubmit = async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form));
  if (body.password.length < 8) {
    toast("كلمة المرور يجب أن تتكون من 8 أحرف على الأقل", "error");
    return;
  }
  try {
    await request("/api/auth/admin/register_super_admin", {
      method: "POST",
      body,
    });
    location.replace("/super-admin.html");
  } catch (error) {
    if (error.message === "super admin is found you can not register") {
      form.hidden = true;
      existing.hidden = false;
    }
  }
};
