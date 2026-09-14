/**
 * Thin wrapper around the store's API.
 * Every call sends credentials so the httpOnly "token" cookie set by
 * /api/auth/log_in and /api/auth/register is included on later requests.
 */
const Api = (() => {
  const BASE = ""; // same origin, served by the Express app itself

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(BASE + path, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
    } catch (networkError) {
      // fetch itself threw: server unreachable, offline, CORS, etc.
      const err = new Error("Can't reach the server. Check your connection and try again.");
      err.cause = networkError;
      err.isNetworkError = true;
      throw err;
    }

    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      // non-JSON response body; body stays null
    }

    if (!response.ok) {
      const message =
        (body && (body.message || body.data)) ||
        `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  return {
    getProducts() {
      return request("/api/get_products", { method: "GET" });
    },
    me() {
      return request("/api/auth/me", { method: "GET" });
    },
    login(email, password) {
      return request("/api/auth/log_in", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    register(name, email, password) {
      return request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
    },
  };
})();