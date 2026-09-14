(function () {
  // If a valid session cookie is already present, there's no reason to show
  // the registration form — send the person straight to the store.
  Api.me()
    .then(() => {
      window.location.replace("/index.html");
    })
    .catch(() => {
      /* not signed in — show the form as normal */
    });

  const form = document.getElementById("register-form");
  const alertBox = document.getElementById("form-alert");
  const submitBtn = document.getElementById("submit-btn");
  const nameField = document.getElementById("name");
  const emailField = document.getElementById("email");
  const phoneField = document.getElementById("phone");
  const whatsappField = document.getElementById("whatsapp");
  const gpsField = document.getElementById("gps");
  const gpsLocateBtn = document.getElementById("gps-locate-btn");
  const passwordField = document.getElementById("password");
  const confirmField = document.getElementById("confirm");

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
    const name = nameField.value.trim();
    const email = emailField.value.trim();
    const password = passwordField.value;
    const confirm = confirmField.value;

    if (!name) {
      setFieldError(nameField, "Enter your full name.");
      valid = false;
    } else {
      setFieldError(nameField, "");
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(emailField, "Enter a valid email address.");
      valid = false;
    } else {
      setFieldError(emailField, "");
    }

    const phone = phoneField.value.trim();
    if (!phone || !/^\+?[0-9]{8,15}$/.test(phone)) {
      setFieldError(phoneField, "Enter a valid phone number.");
      valid = false;
    } else {
      setFieldError(phoneField, "");
    }

    const whatsapp = whatsappField.value.trim();
    if (whatsapp && !/^\+?[0-9]{8,15}$/.test(whatsapp)) {
      setFieldError(whatsappField, "Enter a valid WhatsApp number.");
      valid = false;
    } else {
      setFieldError(whatsappField, "");
    }

    if (!password || password.length < 8) {
      setFieldError(passwordField, "Password must be at least 8 characters.");
      valid = false;
    } else {
      setFieldError(passwordField, "");
    }

    if (confirm !== password) {
      setFieldError(confirmField, "Passwords don't match.");
      valid = false;
    } else {
      setFieldError(confirmField, "");
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

  document.querySelectorAll(".password-row .reveal-toggle[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Show" : "Hide";
    });
  });

  if (gpsLocateBtn) {
    gpsLocateBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        setFieldError(gpsField, "Geolocation isn't supported on this device.");
        return;
      }
      gpsLocateBtn.disabled = true;
      const originalLabel = gpsLocateBtn.textContent;
      gpsLocateBtn.textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          gpsField.value = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setFieldError(gpsField, "");
          gpsLocateBtn.disabled = false;
          gpsLocateBtn.textContent = originalLabel;
        },
        () => {
          setFieldError(gpsField, "Couldn't get your location. You can paste a Google Maps link instead.");
          gpsLocateBtn.disabled = false;
          gpsLocateBtn.textContent = originalLabel;
        }
      );
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    if (!validate()) return;

    setLoading(true);
    try {
      await Api.register({
        name: nameField.value.trim(),
        email: emailField.value.trim(),
        password: passwordField.value,
        phone_number: phoneField.value.trim(),
        whatsApp_number: whatsappField.value.trim(),
        GPS_URL: gpsField.value.trim(),
      });
      showToast("Account created — welcome!");
      window.location.href = "/index.html";
    } catch (err) {
      if (err.isNetworkError) {
        showAlert(err.message);
      } else if (err.status === 400) {
        showAlert(err.message || "This email address is already in use.");
      } else {
        showAlert(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  });
})();