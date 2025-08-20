// src/pages/billing.js
import { api } from '../lib/api.js';

export async function initBilling() {
  const el = document.getElementById('billing-info');
  if (!el) return;

  try {
    const { user } = await api('/api/me');

    if (!user || !user.billing || user.billing.status === 'none') {
      el.innerHTML = 'No active plan. <a href="/plans.html">Choose a plan</a>.';
      return;
    }

    const renewAt = user.billing.renewAt ? new Date(user.billing.renewAt).toLocaleString() : '—';
    el.innerHTML = `
      <div><strong>Status:</strong> ${user.billing.status}</div>
      <div><strong>Plan:</strong> ${user.billing.planId || '—'}</div>
      <div><strong>Renews:</strong> ${renewAt}</div>
      <div class="hr"></div>
      <a class="btn primary" href="/downloads.html">Go to downloads</a>
    `;
  } catch (e) {
    el.textContent = `Error loading billing: ${e.message}`;
  }
}
