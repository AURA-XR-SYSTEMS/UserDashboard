// src/pages/forgot-password.js
import { api } from "../lib/api.js";

/**
 * Initializes the Forgot Password page.
 * - Collects an email address.
 * - POSTs to /api/auth/forgot { email }.
 * - Shows neutral success state regardless of whether the account exists.
 *
 * HTML contract:
 * - Root: #forgot-password
 * - Form: #forgot-form
 * - Inputs: #email
 * - Submit: #forgot-submit
 * - Success panel: #forgot-success
 * - Rate limit notice: #rate-limit
 */
export function initForgotPassword() {
  const root = document.getElementById("forgot-password");
  if (!root) return;

  const form = document.getElementById("forgot-form");
  const emailInput = document.getElementById("email");
  const submitBtn = document.getElementById("forgot-submit");
  const successEl = document.getElementById("forgot-success");
  const rateLimitEl = document.getElementById("rate-limit");
  const openEmailBtn = document.getElementById("open-email");

  function showSuccess(emailForMailto) {
    form.classList.add("is-hidden");
    successEl.classList.remove("is-hidden");
    openEmailBtn.classList.remove("is-hidden");
    if (openEmailBtn && emailForMailto) {
      const encFor = encodeURIComponent(emailForMailto);
      const encSubject = encodeURIComponent("Aura password reset");
      openEmailBtn.href = `mailto:${encFor}?subject=${encSubject}`;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    rateLimitEl.classList.add("is-hidden");

    const email = (emailInput.value || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      emailInput.focus();
      emailInput.setCustomValidity("Please enter a valid email address.");
      emailInput.reportValidity();
      return;
    } else {
      emailInput.setCustomValidity("");
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    try {
      await api("/api/auth/forgot", {
        method: "POST",
        body: { email },
      });
      showSuccess(email);
    } catch (err) {
      console.error(err);
      // If backend returns a 429 or similar, surface rate-limit UI; otherwise neutral success.
      if (err?.status === 429) {
        rateLimitEl.classList.remove("is-hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Email me a reset link";
        return;
      }
      showSuccess(email);
    }
  });
}
