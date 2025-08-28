// src/main.js
import './styles.css'; // optional: pull CSS into the bundle
import auraLogoUrl from './assets/aura_logo_withtext_transparent_white-06.png';

import { loadMe, handleAuth, initTabs } from './pages/signin.js';
import { loadPlans, handleLogout } from './pages/plans.js';
import { initDashboard } from './pages/dashboard.js';
import { initAccount } from './pages/account.js';
import { initBilling } from './pages/billing.js';
import { initCredits } from './pages/credits.js';

document.addEventListener('DOMContentLoaded', () => {
  // Common
  loadMe();
  const img = document.querySelector('.brand-logo');
  if (img) { 
    img.src = auraLogoUrl;
    img.alt = "Aura logo";
  }
  const path = location.pathname;

  // Sign-in page features
  if (path.endsWith('/') || path.endsWith('/index.html')) {
    initTabs();
    document.querySelectorAll('[data-auth-form]').forEach(f => f.addEventListener('submit', handleAuth));
  }

  if (document.getElementById('status-panel')) initDashboard();
  if (document.querySelector('#plan-list')) loadPlans();
  if (document.getElementById('section-overview')) initAccount();
  if (document.getElementById('balance-section')) initCredits();
  if (document.getElementById('billing-info')) initBilling();

  const logout = document.querySelector('[data-logout]');
  if (logout) logout.addEventListener('click', handleLogout);

  // Determine styles for active tab
  document.querySelectorAll('.nav .right a').forEach(a => {
    try {
      const url = new URL(a.href, location.origin);
      if (url.pathname === path) a.classList.add('active');
    } catch {}
  });
});
