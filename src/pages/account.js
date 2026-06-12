import { api, fmtDate, loadAccount } from "../lib/api.js";

function setText(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function openBillingPortal() {
  const { url } = await api("/api/subscriptions/portal", { method: "POST" });
  if (!url) throw new Error("Billing portal response missing redirect URL");
  window.location.href = url;
}

export async function initAccount() {
  const account = await loadAccount();
  const { email, firstName, lastName, subscription } = account;
  const { status } = account.billing;
  const planName = subscription?.name || "No membership";
  const periodDate =
    status === "trialing"
      ? subscription?.trialEnd
      : subscription?.currentPeriodEnd;
  const renewsAtTzAware = fmtDate(periodDate);

  setText("ov-plan", `Plan: <strong>${planName}</strong>`);
  setText("ov-status", `Status: <strong>${status}</strong>`);
  setText("ov-renew", `Renews: <strong>${renewsAtTzAware}</strong>`);

  let statusClass = status === "onboarding" ? "muted" : "warn";
  if (["active", "trialing"].includes(status)) {
    statusClass = "success";
  }

  const planSummary = document.getElementById("plan-summary");
  if (planSummary) {
    planSummary.innerHTML = `
        <span class="chip">Plan: <strong>${planName}</strong></span>
        <span class="chip ${statusClass}">Status: <strong>${status}</strong></span>
        <span class="chip muted">Renews: <strong>${renewsAtTzAware}</strong></span>
      `;
  }

  const nameEl = document.querySelector("[data-username]");
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (nameEl) nameEl.textContent = fullName || email;

  ["ov-manage-billing", "btn-manage-plan"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", async () => {
      try {
        await openBillingPortal();
      } catch (e) {
        alert(e.message);
      }
    });
  });

  const emailResetForm = document.getElementById("email-reset-form");
  const emailResetInput = document.getElementById("sec-email");
  emailResetInput.addEventListener("input", () =>
    emailResetInput.setCustomValidity("")
  );
  const secEmailBtn = document.getElementById("sec-email-save");
  secEmailBtn.addEventListener("click", async () => {
    const newEmail = (emailResetInput.value || "").trim();
    if (!newEmail) {
      emailResetInput.setCustomValidity("Invalid email");
      emailResetInput.reportValidity();
      emailResetInput.classList.add("invalid");
      return;
    }
    emailResetInput.setCustomValidity("");
    emailResetInput.classList.remove("invalid");

    try {
      await api("/api/auth/emailUpdate", {
        method: "POST",
        body: { newEmail },
      });
      alert("Email updated");
    } catch (e) {
      alert(e.message);
    }
  });

  emailResetForm.addEventListener("invalid", async (e) => {
    emailResetForm.classList.add("shake");
    setTimeout(() => emailResetForm.classList.remove("shake"), 300);
    e.target.classList.add("invalid");
  });

  const passwordResetForm = document.getElementById("pw-reset-form");
  const passwordResetButton = document.getElementById("sec-pass-save");
  const currentPasswordInput = document.getElementById("sec-current");
  const newPasswordInput = document.getElementById("sec-new");
  const confirmPasswordInput = document.getElementById("sec-new-confirm");

  [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach((input) => {
    input.addEventListener("input", () => input.setCustomValidity(""));
  });

  passwordResetForm.addEventListener("invalid", async (e) => {
    passwordResetForm.classList.add("shake");
    setTimeout(() => passwordResetForm.classList.remove("shake"), 300);
    e.target.classList.add("invalid");
  });

  passwordResetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (newPasswordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity("Passwords don't match");
      confirmPasswordInput.reportValidity();
      confirmPasswordInput.classList.add("invalid");
      return;
    }
    confirmPasswordInput.setCustomValidity("");
    confirmPasswordInput.classList.remove("invalid");

    try {
      const { token } = await api("api/auth/resetToken", {
        method: "POST",
        body: {
          previousPassword: currentPasswordInput.value,
          newPassword: confirmPasswordInput.value,
        },
      });

      await api("api/auth/reset", {
        method: "POST",
        body: { token, newPassword: confirmPasswordInput.value },
      });
      alert("Your password has been reset!");
    } catch (err) {
      console.error(err);
      alert(
        err?.message ||
          "Unable to reset your password at this time. Please contact the AURA team for assistance."
      );
      passwordResetButton.disabled = false;
      passwordResetButton.textContent = "Reset Password";
    }
  });
}
