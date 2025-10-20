// src/pages/forgot-password.js
import { api, onForgotSubmit } from "../lib/api.js";


/**
 * Initializes the Forgot Password page.
 * - Collects an email address.
 * - POSTs to /api/auth/forgot { email }.
 * - Shows neutral success state regardless of whether the account exists.
 */

export function initForgotPassword() {
  const root = document.getElementById("forgot-password");
  if (!root) return;

  const forgotForm = document.getElementById("forgot-form");
  const emailInput = document.getElementById("email");
  const submitForgotBtn = document.getElementById("forgot-submit");
  const successEl = document.getElementById("forgot-success");
  const rateLimitEl = document.getElementById("rate-limit");
  const openEmailBtn = document.getElementById("open-email");

  function showSuccess(emailForMailto) {
    forgotForm.classList.add("is-hidden");
    successEl.classList.remove("is-hidden");
    openEmailBtn.classList.remove("is-hidden");
    if (openEmailBtn && emailForMailto) {
      const encFor = encodeURIComponent(emailForMailto);
      const encSubject = encodeURIComponent("Aura password reset");
      openEmailBtn.href = `mailto:${encFor}?subject=${encSubject}`;
    }
  }

  function onErr() {
    rateLimitEl.classList.remove("is-hidden");
    submitForgotBtn.disabled = false;
    submitForgotBtn.textContent = "Email me a reset link";
  }

  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    // TODO: add logic for rate-limiting
    if (true) {
      rateLimitEl.classList.add("is-hidden");
    }
    const email = (emailInput.value || "").trim().toLowerCase();
    if (emailWasInvalid(email)) {
      emailInput.focus();
      emailInput.setCustomValidity("Please enter a valid email address.");
      emailInput.reportValidity();
      return
    }
    else {
      emailInput.setCustomValidity("");
      submitForgotBtn.disabled = true;
      submitForgotBtn.textContent = "Sending…";
    }

    await onForgotSubmit(email, showSuccess, onErr)

  });
}

function emailWasInvalid(email) {
  return !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase())

}
