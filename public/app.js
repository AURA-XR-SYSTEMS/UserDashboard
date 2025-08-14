// Simple front-end helpers for forms/navigation

async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }
  
  async function loadMe() {
    try {
      const { user } = await api('/api/me');
      window.currentUser = user;
      const el = document.querySelector('[data-username]');
      if (el && user) el.textContent = user.name || user.email;
      const gate = document.querySelectorAll('[data-requires-plan]');
      gate.forEach(n => {
        const status = user?.billing?.status;
        if (!user || (status !== 'active' && status !== 'trial')) n.style.display = 'none';
      });
    } catch (_) {}
  }
  
  async function handleAuth(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const mode = form.dataset.mode || 'login';
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      await api(path, { method: 'POST', body });
      location.href = '/dashboard';
    } catch (err) {
      alert(err.message);
    }
  }
  
  async function handleLogout() {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
  }
  
  async function loadPlans() {
    const list = document.querySelector('#plan-list');
    if (!list) return;
    const { plans } = await api('/api/plans');
    // also load user to determine trial state
    let user = null;
    try { ({ user } = await api('/api/me')); } catch(_){ user = null; }
    const trialActive = !!(user && user.billing && user.billing.trial && user.billing.trial.active);
    const trialExpired = !!(user && user.billing && user.billing.trial && user.billing.trial.expiresAt && new Date(user.billing.trial.expiresAt) < new Date());
    const trialEligible = !trialActive && !trialExpired;
    list.innerHTML = '';
    plans.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card has-header';
      // trial treatment for Basic plan
      const isBasic = p.id === 'basic';
      const showTrialOnBasic = isBasic && trialEligible;
      const priceHtml = showTrialOnBasic
        ? `<div class=\"row\" style=\"align-items:baseline; gap:8px;\"><div class=\"price\" style=\"font-size:28px; font-weight:700;\"><s>$${p.price}</s> $0</div><span class=\"badge\">/14 days</span></div>`
        : `<div class=\"row\" style=\"align-items:baseline; gap:8px;\"><div class=\"price\" style=\"font-size:28px; font-weight:700;\">$${p.price}</div><span class=\"badge\">/${p.period}</span></div>`;
      const bannerHtml = showTrialOnBasic ? `<span class=\"chip success\" style=\"margin-left:8px;\">14-day free trial</span>` : '';
      const ctaHtml = showTrialOnBasic
        ? `<button class=\"btn primary\" data-start-trial>Start free trial</button>`
        : `<button class=\"btn primary\" data-choose=\"${p.id}\">Choose ${p.name}</button>`;
      card.innerHTML = `
        <div class="card-header">${p.name}${bannerHtml}</div>
        <div class="card-body">
          <div class="features">
            ${priceHtml}
            <p class="muted" style="margin:8px 0 12px;">${p.description || ''}</p>
            <div class="row" style="gap:12px; flex-wrap:wrap;">
              ${typeof p.credits === 'number' ? `<span class="chip">${p.credits.toLocaleString()} credits/mo</span>` : ''}
              ${typeof p.workspaces === 'number' ? `<span class="chip">${p.workspaces} workspaces</span>` : ''}
              ${typeof p.users === 'number' ? `<span class="chip">${p.users} users</span>` : ''}
            </div>
            <div style="margin-top:12px;">
              <ul style="margin:0; padding-left:18px;">
                ${p.features.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>
          </div>
          <div class="hr"></div>
          <div class="card-actions">
            ${ctaHtml}
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    list.addEventListener('click', async (e) => {
      const id = e.target.dataset.choose;
      if (id){
        try {
          await api('/api/subscribe', { method: 'POST', body: { planId: id, method: 'test' } });
          location.href = '/downloads';
        } catch (err) { alert(err.message); }
        return;
      }
      if (e.target && e.target.hasAttribute('data-start-trial')){
        try{
          await api('/api/trial/start', { method: 'POST' });
          location.href = '/downloads';
        } catch (err){ alert(err.message); }
      }
    });
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    loadMe();
    loadPlans();
    document.querySelectorAll('[data-auth-form]').forEach(f => f.addEventListener('submit', handleAuth));
    const logout = document.querySelector('[data-logout]');
    if (logout) logout.addEventListener('click', handleLogout);
    // Active nav state
    const path = location.pathname;
    document.querySelectorAll('.nav .right a').forEach(a => {
      try {
        const url = new URL(a.href, location.origin);
        if (url.pathname === path) a.classList.add('active');
      } catch (_) {}
    });
  });