// src/main.js
import "./styles.css"; // optional: pull CSS into the bundle
// import auraLogoUrl from "./assets/aura_logo_withtext_transparent_white-06.png";
import auraLogoUrl from "./assets/wizard-top.png";

import { loadMe } from "./lib/api.js";
import {
  handleAuth,
  initTabs,
  handleLogout,
  initAuthFormUX,
} from "./pages/signin.js";
import { loadPlans } from "./pages/plans.js";
import { initDashboard } from "./pages/dashboard.js";
import { initAccount } from "./pages/account.js";
import { initBilling } from "./pages/billing.js";
import { initCredits } from "./pages/credits.js";
import { initResetPassword } from "./pages/reset-password.js";
import { initForgotPassword } from "./pages/forgot-password.js";

const ALLOW_DEBUG_LOGS = import.meta.env.VITE_ALLOW_DEBUG_LOGS === "true";

const originalConsoleLog = console.log;
console.log = function () {
  const timestamp = new Date().toISOString();
  if (ALLOW_DEBUG_LOGS) {
    originalConsoleLog.apply(console, [`[${timestamp}]`, ...arguments]);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Common
  loadMe();

  const img = document.querySelector(".brand-logo");
  if (img) {
    img.src = auraLogoUrl;
    img.alt = "Aura logo";
  }
  const path = location.pathname;

  // Sign-in page features
  if (path.endsWith("/") || path.endsWith("/index.html")) {
    initTabs();
    document
      .querySelectorAll("[data-auth-form]")
      .forEach((f) => f.addEventListener("submit", handleAuth));
    initAuthFormUX();
  }

  if (document.getElementById("status-panel")) initDashboard();
  if (document.querySelector("#plan-list")) loadPlans();
  if (document.getElementById("section-overview")) initAccount();
  if (document.getElementById("balance-section")) initCredits();
  if (document.getElementById("billing-info")) initBilling();
  if (document.getElementById("reset-password")) initResetPassword();
  if (document.getElementById("forgot-password")) initForgotPassword();

  const logout = document.querySelector("[data-logout]");
  if (logout) logout.addEventListener("click", handleLogout);

  // Determine styles for active tab
  document.querySelectorAll(".nav .right a").forEach((a) => {
    try {
      const url = new URL(a.href, location.origin);
      if (url.pathname === path) a.classList.add("active");
    } catch {}
  });
});
