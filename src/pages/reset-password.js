// src/pages/reset-password.js
import { api } from "../lib/api.js";

/**
 * Initializes the Reset Password page.
 * - Ensures a ?token= is present in the URL.
 * - Validates new password + confirmation.
 * - POSTs to /api/auth/reset { token, newPassword }.
 * - On success: informs the user and routes to sign-in.
 *
 * HTML contract:
 * - Root container: #reset-password
 * - Form: #reset-form
 * - Status notice: #token-status
 * - Inputs: #new-password, #confirm-password
 * - Submit button: #reset-submit
 */
export function initResetPassword() {
  const root = document.getElementById("reset-password");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const token = (params.get("token") || "").trim();

  const statusEl = document.getElementById("token-status");
  const formEl = document.getElementById("reset-form");
  const newEl = document.getElementById("new-password");
  const confirmEl = document.getElementById("confirm-password");
  const submitBtn = document.getElementById("reset-submit");

  // Basic link validation: require token in URL
  if (!token) {
    statusEl.textContent =
      "This link is missing a token. Please use the password reset link from your email.";
    statusEl.classList.add("warn");
    submitBtn.disabled = true;
    newEl.disabled = true;
    confirmEl.disabled = true;
    return;
  } else {
    statusEl.textContent = "Reset link detected. You can set a new password.";
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const p1 = newEl.value;
    const p2 = confirmEl.value;

    if (p1.length < 8) {
      alert("Please choose a password with at least 8 characters.");
      newEl.focus();
      return;
    }
    if (p1 !== p2) {
      alert("Passwords do not match.");
      confirmEl.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
    try {
      await api("/api/auth/reset", {
        method: "POST",
        body: { token, newPassword: p1 },
      });
      alert(
        "Your password has been reset. Please sign in with your new password."
      );
      location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert(
        err?.message ||
          "Unable to reset your password. The link may be expired or already used."
      );
      submitBtn.disabled = false;
      submitBtn.textContent = "Set new password";
    }
  });
}
