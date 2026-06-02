// src/pages/account.js
import { api, creditPct, fmtDate, fmtInt, loadAccount } from "../lib/api.js";

function setText(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

export async function initAccount() {
  // Load account overview
  const creditsLabel = document.getElementById("credits-label");
  const creditsMeter = document.getElementById("credits-meter");
  const purchasedLabel = document.getElementById("purchased-label");
  const purchasedMeter = document.getElementById("purchased-meter");

  const account = await loadAccount();
  const { email, firstName, lastName } = account;
  const { status } = account.billing;
  const {
    allowanceAmount,
    allowanceRemaining,
    planType,
    purchasedRemaining,
    balance,
    renewsAt,
  } = account.credits;

  // Overview chips
  const renewsAtTzAware = fmtDate(renewsAt);
  setText("ov-plan", `Plan: <strong>${planType}</strong>`);
  setText("ov-status", `Status: <strong>${status}</strong>`);
  setText("ov-renew", `Renews: <strong>${renewsAtTzAware}</strong>`);

  setText("ov-credits", `Credits: <strong>${fmtInt(balance)}</strong>`);

  // Credits meters
  if (allowanceAmount > 0) {
    creditsMeter.style.width = `${creditPct(
      allowanceRemaining,
      allowanceAmount
    )}%`;
    creditsLabel.textContent = `${fmtInt(allowanceRemaining)} / ${fmtInt(
      allowanceAmount
    )} included this cycle`;
  } else {
    creditsMeter.style.width = "0%";
    creditsLabel.textContent = `${fmtInt(balance)} available`;
  }

  if (purchasedRemaining > 0) {
    purchasedMeter.style.width = "100%";
    purchasedLabel.textContent = `${fmtInt(
      purchasedRemaining
    )} additional credits available`;
  } else {
    purchasedMeter.style.width = "0%";
    purchasedLabel.textContent = `${fmtInt(
      purchasedRemaining
    )} additional credits available`;
  }

  let statusClass = status === "none" ? "muted" : "warn";
  if (status === "active") {
    statusClass = "success";
  }

  const planSummary = document.getElementById("plan-summary");
  if (planSummary) {
    planSummary.innerHTML = `
        <span class="chip">Plan: <strong>${planType}</strong></span>
        <span class="chip ${statusClass}">Status: <strong>${status}</strong></span>
        <span class="chip muted">Renews: <strong>${renewsAtTzAware}</strong></span>
      `;
  }

  // Username (optional)
  const nameEl = document.querySelector("[data-username]");
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (nameEl) nameEl.textContent = fullName || email;

  // Event handlers (plan change / cancel / payment / security)
  document.querySelectorAll("#section-plan [data-plan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const planId = btn.getAttribute("data-plan");
      try {
        await api("/api/plan/change", { method: "POST", body: { planId } });
        location.reload();
      } catch (e) {
        alert(e.message);
      }
    });
  });

  const cancelBtn = document.getElementById("btn-cancel-plan");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      if (!confirm("Cancel your plan?")) return;
      try {
        await api("/api/plan/cancel", { method: "POST" });
        location.reload();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const pmBtn = document.getElementById("pm-update");
  if (pmBtn) {
    pmBtn.addEventListener("click", async () => {
      const last4 = (document.getElementById("pm-last4")?.value || "").trim();
      try {
        await api("/api/account/payment-method", {
          method: "POST",
          body: { last4 },
        });
        alert("Payment method updated.");
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const emailResetForm = document.getElementById('email-reset-form');
  const emailResetInput = document.getElementById('sec-email');
  emailResetInput.addEventListener('input', () => emailResetInput.setCustomValidity(''))
  const secEmailBtn = document.getElementById("sec-email-save");
  secEmailBtn.addEventListener("click", async () => {
    const newEmail = (emailResetInput.value || "").trim();
    if (!newEmail) {
      emailResetInput.setCustomValidity("Invalid email");
      emailResetInput.reportValidity();
      emailResetInput.classList.add('invalid');
      return;
    }
    emailResetInput.setCustomValidity('');
    emailResetInput.classList.remove('invalid');

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
    emailResetForm.classList.add('shake');
    setTimeout(() => emailResetForm.classList.remove("shake"), 300);
    e.target.classList.add("invalid");
  })

  // Password Reset
  const passwordResetForm = document.getElementById("pw-reset-form");
  const passwordResetButton = document.getElementById('sec-pass-save');
  const currentPasswordInput = document.getElementById('sec-current');
  const newPasswordInput = document.getElementById('sec-new');
  const confirmPasswordInput = document.getElementById('sec-new-confirm');

  // console.log([currentPasswordInput, newPasswordInput, confirmPasswordInput]);
  [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(input => {
    input.addEventListener('input', () => input.setCustomValidity(''))
  })

  passwordResetForm.addEventListener("invalid", async (e) => {
    passwordResetForm.classList.add('shake');
    setTimeout(() => passwordResetForm.classList.remove("shake"), 300);
    e.target.classList.add("invalid");
  })


  passwordResetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (newPasswordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity("Passwords don't match");
      confirmPasswordInput.reportValidity();
      confirmPasswordInput.classList.add('invalid');
      return;
    }
    confirmPasswordInput.setCustomValidity('');
    confirmPasswordInput.classList.remove('invalid');

    // attempt to submit password reset
    try {

      const { token } = await api("api/auth/resetToken", {
        method: "POST",
        body: {
          previousPassword: currentPasswordInput.value,
          newPassword: confirmPasswordInput.value,
        }
      });

      await api("api/auth/reset", {
        method: "POST",
        body: { token, newPassword: confirmPasswordInput.value }
      })
      alert(
        "Your password has been reset! "
      )
    }
    catch (err) {
      console.error(err);
      alert(
        err?.message || "Unable to reset your password at this time. Please contact the AURA team for assistance."
      )
      passwordResetButton.disabled = false;
      passwordResetButton.textContent = 'Reset Password'
    }
  })
}
