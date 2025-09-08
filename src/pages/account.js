// src/pages/account.js
import { api } from "../lib/api.js";

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
  const { account } = await api("/api/account");
  console.log(account);

  const { status } = account.billing;
  const {
    active,
    allowanceAmount,
    allowanceRemaining,
    planType,
    purchasedTotal,
    purchasedRemaining,
    balance,
    renewsAt,
    startedAt,
  } = account.credits;

  // Overview chips
  const renewsAtTzAware = new Date(renewsAt).toLocaleDateString();
  setText("ov-plan", `Plan: <strong>${planType}</strong>`);
  setText("ov-status", `Status: <strong>${status}</strong>`);
  setText("ov-renew", `Renews: <strong>${renewsAtTzAware}</strong>`);

  setText(
    "ov-credits",
    `Credits: <strong>${balance.toLocaleString()}</strong>`
  );

  // Credits meters
  if (allowanceRemaining > 0) {
    const percentage = (allowanceAmount / allowanceRemaining) * 100;
    creditsMeter.style.width = percentage + "%";
    creditsLabel.textContent = `${allowanceRemaining.toLocaleString()} / ${allowanceAmount.toLocaleString()} included this cycle`;
  } else {
    creditsMeter.style.width = "0%";
    creditsLabel.textContent = `${balance.toLocaleString()} available`;
  }

  if (purchasedTotal > 0) {
    const percentage = (purchasedRemaining / purchasedTotal) * 100;
    purchasedMeter.style.width = percentage + "%";
    purchasedLabel.textContent = `${purchasedRemaining.toLocaleString()} / ${purchasedTotal.toLocaleString()} this cycle`;
  } else {
    purchasedMeter.style.width = "0%";
    purchasedLabel.textContent = `${purchasedRemaining.toLocaleString()} additional credits available`;
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
  if (nameEl) nameEl.textContent = user.name || user.email;

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

  const secEmailBtn = document.getElementById("sec-email-save");
  if (secEmailBtn) {
    secEmailBtn.addEventListener("click", async () => {
      const newEmail = (
        document.getElementById("sec-email")?.value || ""
      ).trim();
      if (!newEmail) return alert("Enter an email");
      try {
        await api("/api/account/security/email", {
          method: "POST",
          body: { newEmail },
        });
        alert("Email updated");
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const secPassBtn = document.getElementById("sec-pass-save");
  if (secPassBtn) {
    secPassBtn.addEventListener("click", async () => {
      const currentPassword = document.getElementById("sec-current")?.value;
      const newPassword = document.getElementById("sec-new")?.value;
      if (!newPassword || !currentPassword)
        return alert("Enter both passwords");
      try {
        await api("/api/account/security/password", {
          method: "POST",
          body: { currentPassword, newPassword },
        });
        alert("Password changed");
      } catch (e) {
        alert(e.message);
      }
    });
  }
}
