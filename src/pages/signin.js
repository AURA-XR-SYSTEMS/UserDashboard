// src/pages/signin.js
import { api } from "../lib/api.js";

export async function handleAuth(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const mode = form.dataset.mode || "login";
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    await api(path, { method: "POST", body });
    location.href = "dashboard.html";
  } catch (err) {
    alert(err.message);
  }
}

export function initTabs() {
  const btns = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  btns.forEach((btn) =>
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.tabTarget);
      btns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      if (target) target.classList.add("active");
    })
  );
}

export async function handleLogout() {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "index.html";
}
