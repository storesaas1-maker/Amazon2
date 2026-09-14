(function () {
  // If a valid session cookie is already present, there's no reason to show
  // the sign-in form — send the person straight to the store.
  Api.me()
    .then(() => {
      window.location.replace("/index.html");
    })
    .catch(() => {
      /* not signed in — show the form as normal */
    });

  const form = document.getElementById("login-form");
  const alertBox = document.getElementById("form-alert");
  const submitBtn = document.getElementById("submit-btn");
  const emailField = document.getElementById("email");
  const passwordField = document.getElementById("password");

  function setFieldError(input, message) {
    const wrapper = input.closest(".field");
    const errorEl = wrapper.querySelector(".field-error");
    if (message) {
      wrapper.classList.add("has-error");
      errorEl.textContent = message;
      input.setAttribute("aria-invalid", "true");
    } else {
      wrapper.classList.remove("has-error");
      errorEl.textContent = "";
      input.removeAttribute("aria-invalid");
    }
  }

  function validate() {
    let valid = true;
    const email = emailField.value.trim();
    const password = passwordField.value;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(emailField, "Enter a valid email address.");
      valid = false;
    } else {
      setFieldError(emailField, "");
    }

    if (!password || password.length < 8) {
      setFieldError(passwordField, "Password must be at least 8 characters.");
      valid = false;
    } else {
      setFieldError(passwordField, "");
    }

    return valid;
  }

  function setLoading(isLoading) {
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.disabled = isLoading;
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.classList.add("show");
  }
  function hideAlert() {
    alertBox.classList.remove("show");
    alertBox.textContent = "";
  }

  document.querySelectorAll(".reveal-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Show" : "Hide";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    if (!validate()) return;

    setLoading(true);
    try {
      await Api.login(emailField.value.trim(), passwordField.value);
      showToast("Welcome back — signing you in…");
      window.location.href = "/index.html";
    } catch (err) {
      if (err.isNetworkError) {
        showAlert(err.message);
      } else if (err.status === 401 || err.status === 400) {
        showAlert(err.message || "Invalid email or password.");
      } else {
        showAlert(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  });
})();