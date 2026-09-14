import { request } from "./api.js";
import { onEvent } from "./socket-client.js";

let timer;
const defaultTheme = {
  primary_color: "#131921",
  secondary_color: "#FF9900",
  background_color: "#FFFFFF",
  text_color: "#111111",
  font_family: "Inter, Arial, Helvetica, sans-serif",
  banner_text: "أجهزة iPhone مجددة ومفحوصة معتمدة مع ضمان 90 يوماً وشحن سريع",
};

export function applyTheme(settings) {
  const store = settings?.store_setting || settings;
  const design = { ...defaultTheme, ...(store?.store_design || {}) };

  clearTimeout(timer);
  timer = setTimeout(() => {
    const root = document.documentElement;
    const colors = {
      "--primary": design.primary_color,
      "--secondary": design.secondary_color,
      "--background": design.background_color,
      "--text": design.text_color,
      "--font-family": design.font_family,
    };

    Object.entries(colors).forEach(([key, value]) => {
      if (value) root.style.setProperty(key, value);
    });

    document
      .querySelectorAll("[data-store-name]")
      .forEach((n) => (n.textContent = store?.store_name || "متجري"));
    document
      .querySelectorAll("[data-store-description]")
      .forEach(
        (n) =>
          (n.textContent =
            store?.store_description ||
            "أجهزة iPhone مجددة معتمدة بفحص 42 نقطة تقنية"),
      );
    document
      .querySelectorAll("[data-banner]")
      .forEach(
        (n) => (n.textContent = design.banner_text || defaultTheme.banner_text),
      );
  }, 100);
}

export async function initTheme() {
  applyTheme();
  try {
    const response = await request("/api/get_store_settings", { silent: true });
    if (response.data) applyTheme(response.data);
  } catch {}
  onEvent("store_setting", applyTheme);
}
