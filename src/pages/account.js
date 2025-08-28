// src/pages/account.js
import { api } from '../lib/api.js';

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
  try {
    const { user } = await api('/api/account');
    if (!user) return;

    // Overview chips
    const renew = user.billing?.renewAt ? new Date(user.billing.renewAt).toLocaleDateString() : '—';
    setText('ov-plan',   `Plan: <strong>${user.billing?.planId || '—'}</strong>`);
    setText('ov-status', `Status: <strong>${user.billing?.status || 'none'}</strong>`);
    setText('ov-renew',  `Renews: <strong>${renew}</strong>`);

    const bal  = user.credits?.balance ?? 0;
    const incl = user.credits?.includedAllowance ?? 0;
    setText('ov-credits', `Credits: <strong>${bal.toLocaleString()}</strong>`);

    // Credits meters
    const incBal = Number.isFinite(user.credits?.includedRemaining) ? user.credits.includedRemaining : incl;
    const purBal = Number.isFinite(user.credits?.purchasedRemaining) ? user.credits.purchasedRemaining : Math.max(0, bal - incBal);
    const purTot = Number.isFinite(user.credits?.purchasedCycleTotal) ? user.credits.purchasedCycleTotal : purBal;

    if (incl > 0) {
      const pct = (incBal / incl) * 100;
      setWidth('cr-meter', pct);
      setText('cr-label', `${incBal.toLocaleString()} / ${incl.toLocaleString()} included this cycle`);
    } else {
      setText('cr-label', `${bal.toLocaleString()} available`);
      setWidth('cr-meter', 0);
    }

    const pPct = purTot > 0 ? (purBal / purTot) * 100 : 0;
    setWidth('crp-meter', pPct);
    setText('crp-label', `${purBal.toLocaleString()} / ${purTot.toLocaleString()} this cycle`);

    // Plan summary
    const statusClass = user.billing?.status === 'active' ? 'success' : (user.billing?.status === 'none' ? 'muted' : 'warn');
    const planSummary = document.getElementById('plan-summary');
    if (planSummary) {
      planSummary.innerHTML = `
        <span class="chip">Plan: <strong>${user.billing?.planId || '—'}</strong></span>
        <span class="chip ${statusClass}">Status: <strong>${user.billing?.status || 'none'}</strong></span>
        <span class="chip muted">Renews: <strong>${renew}</strong></span>
      `;
    }

    // Username (optional)
    const nameEl = document.querySelector('[data-username]');
    if (nameEl) nameEl.textContent = user.name || user.email;
  } catch (e) {
    console.warn('initAccount:', e.message);
  }

  // Event handlers (plan change / cancel / payment / security)
  document.querySelectorAll('#section-plan [data-plan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.getAttribute('data-plan');
      try {
        await api('/api/plan/change', { method: 'POST', body: { planId } });
        location.reload();
      } catch (e) {
        alert(e.message);
      }
    });
  });

  const cancelBtn = document.getElementById('btn-cancel-plan');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm('Cancel your plan?')) return;
      try {
        await api('/api/plan/cancel', { method: 'POST' });
        location.reload();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const pmBtn = document.getElementById('pm-update');
  if (pmBtn) {
    pmBtn.addEventListener('click', async () => {
      const last4 = (document.getElementById('pm-last4')?.value || '').trim();
      try {
        await api('/api/account/payment-method', { method: 'POST', body: { last4 } });
        alert('Payment method updated.');
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const secEmailBtn = document.getElementById('sec-email-save');
  if (secEmailBtn) {
    secEmailBtn.addEventListener('click', async () => {
      const newEmail = (document.getElementById('sec-email')?.value || '').trim();
      if (!newEmail) return alert('Enter an email');
      try {
        await api('/api/account/security/email', { method: 'POST', body: { newEmail } });
        alert('Email updated');
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const secPassBtn = document.getElementById('sec-pass-save');
  if (secPassBtn) {
    secPassBtn.addEventListener('click', async () => {
      const currentPassword = document.getElementById('sec-current')?.value;
      const newPassword     = document.getElementById('sec-new')?.value;
      if (!newPassword || !currentPassword) return alert('Enter both passwords');
      try {
        await api('/api/account/security/password', { method: 'POST', body: { currentPassword, newPassword } });
        alert('Password changed');
      } catch (e) {
        alert(e.message);
      }
    });
  }
}
