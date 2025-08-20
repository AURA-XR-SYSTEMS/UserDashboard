// src/pages/dashboard.js
import { api } from '../lib/api.js';

export async function initDashboard() {
  const chipsEl = document.getElementById('status-chips');
  const creditsBlock = document.getElementById('credits-block');
  const creditsLabel = document.getElementById('credits-label');
  const creditsMeter = document.getElementById('credits-meter');
  const purchasedLabel = document.getElementById('purchased-label');
  const purchasedMeter = document.getElementById('purchased-meter');

  try {
    const { user } = await api('/api/me');

    // Username (shared pattern with signin page)
    const nameEl = document.querySelector('[data-username]');
    if (nameEl && user) nameEl.textContent = user.name || user.email;

    // Status chips
    if (!user || !user.billing || user.billing.status === 'none') {
      chipsEl.innerHTML = 'No active plan. <a href="/plans.html">Choose a plan</a> to unlock downloads.';
    } else {
      const renew = user.billing.renewAt ? new Date(user.billing.renewAt).toLocaleDateString() : '—';
      const statusClass = user.billing.status === 'active' ? 'success' : 'warn';
      chipsEl.innerHTML = `
        <div class="row" style="flex-wrap:wrap; gap:8px;">
          <span class="chip">Plan: <strong>${user.billing.planId || '—'}</strong></span>
          <span class="chip ${statusClass}">Status: <strong>${user.billing.status}</strong></span>
          <span class="chip muted">Renews: <strong>${renew}</strong></span>
        </div>
      `;
    }

    // Credits meters
    if (user?.credits && typeof user.credits.balance === 'number') {
      const bal   = user.credits.balance;
      const incl  = Number.isFinite(user.credits.includedAllowance) ? user.credits.includedAllowance : 0;
      const incBal = Number.isFinite(user.credits.includedRemaining)
        ? user.credits.includedRemaining
        : Math.min(bal, incl);
      const purBal = Number.isFinite(user.credits.purchasedRemaining)
        ? user.credits.purchasedRemaining
        : Math.max(0, bal - incBal);
      const purTotal = Number.isFinite(user.credits.purchasedCycleTotal)
        ? user.credits.purchasedCycleTotal
        : purBal;

      if (incl > 0) {
        const pct = Math.max(0, Math.min(100, (incBal / incl) * 100));
        creditsMeter.style.width = pct + '%';
        creditsLabel.textContent = `${incBal.toLocaleString()} / ${incl.toLocaleString()} included this cycle`;
      } else {
        creditsLabel.textContent = `${bal.toLocaleString()} available`;
        creditsMeter.style.width = '0%';
      }

      const pPct = purTotal > 0 ? Math.max(0, Math.min(100, (purBal / purTotal) * 100)) : 0;
      purchasedMeter.style.width = pPct + '%';
      purchasedLabel.textContent = `${purBal.toLocaleString()} / ${purTotal.toLocaleString()} this cycle`;

      creditsBlock.style.display = 'block';
    }
  } catch (e) {
    // Silent fail here to keep the page usable
    console.warn('initDashboard:', e.message);
  }
}
