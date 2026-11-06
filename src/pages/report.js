// src/pages/report.js
// Buy a one-off report about one address: pick a report, enter the address, pay
// in Stripe Checkout. Stripe sends the browser back to
// report.html?order=<id>&checkout=success|cancelled. The return is not proof of
// payment: the webhook marks the order paid, so this page polls the order.
//
// Dark until the server's AURA_REPORTS_ENABLED is on: then every /api/reports route is a 404.
import { api, esc, fmtDate, redirectToSignIn } from "../lib/api.js";

const POLL_MS = 2000;
const POLL_FOR_MS = 30000;

const STATUS = {
  pending: "Waiting for payment",
  paid: "Paid: your report is being made",
  fulfilled: "Ready",
  expired: "Not paid",
  refunded: "Refunded",
};

const KIND = {
  home_report: "Home buyer neighbourhood report",
  adu_report: "ADU feasibility report",
};

const MESSAGES = {
  report_not_for_sale: "That report isn't for sale right now. Please pick another or try again later.",
  report_too_many_pending:
    "You have too many unfinished checkouts from the last day. Finish one, or wait for it to lapse, then try again.",
  report_checkout_unavailable: "Checkout isn't available right now. Please try again in a few minutes.",
  report_order_not_found: "We couldn't find that order on this account.",
};

function errorText(err) {
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];
  if (err?.status === 422) return "Please enter the address in full (up to 300 characters) and pick a report.";
  if (err?.status === 400) return "Checkout isn't set up yet. Please try again later.";
  if (!err?.status) return "We couldn't reach AURA. Check your connection and try again.";
  return err?.message || "Something went wrong. Please try again.";
}

function sessionEnded(el) {
  el.textContent = redirectToSignIn()
    ? "Your session has ended. Taking you to sign in…"
    : "We couldn't confirm your sign-in. Please e-mail support@auraengine.com and we'll sort it out.";
}

/** Stripe amounts are in the currency's smallest unit; Intl knows how many digits that is. */
export function fmtPrice(amount, currency) {
  if (amount == null || !currency) return "";
  try {
    const nf = new Intl.NumberFormat(undefined, { style: "currency", currency: String(currency).toUpperCase() });
    const digits = nf.resolvedOptions().maximumFractionDigits;
    return nf.format(Number(amount) / 10 ** digits);
  } catch {
    return "";
  }
}

const statusWord = (s) => STATUS[s] || s || "--";

function block(id, title, body) {
  return `
    <section class="block" id="${id}" aria-labelledby="${id}-h">
      <h2 id="${id}-h">${title}</h2>
      <div class="block__body">${body}</div>
    </section>`;
}

function productOptions(products) {
  const firstForSale = products.findIndex((p) => p.forSale);
  return products
    .map((p, i) => {
      const price = p.forSale ? fmtPrice(p.amountCents, p.currency) : "";
      const note = p.forSale ? price || "Price shown at checkout" : "Not available yet";
      return `
        <div>
          <label class="legal-agree${p.forSale ? "" : " muted"}" data-product="${esc(p.kind)}">
            <input type="radio" name="kind" value="${esc(p.kind)}" ${p.forSale ? "" : "disabled"} ${i === firstForSale ? "checked" : ""} required />
            <span><strong>${esc(p.name || KIND[p.kind] || p.kind)}</strong> <span class="muted" data-price>${esc(note)}</span></span>
          </label>
        </div>`;
    })
    .join("");
}

function buyForm(products) {
  const any = products.some((p) => p.forSale);
  return `
    <form class="form" id="report-buy">
      <div class="features">${productOptions(products)}</div>
      <div>
        <label for="report-address">Address</label>
        <input class="input" id="report-address" name="address" required maxlength="300" autocomplete="street-address" placeholder="Street, city, state" />
      </div>
      <p>Stripe Checkout shows the total before you pay.</p>
      <div class="form-error" data-report-error hidden></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn primary funnel" type="submit" ${any ? "" : "disabled"}>Continue to checkout</button>
      </div>
    </form>`;
}

function orderRows(orders, names) {
  if (!orders.length) return `<p class="muted">No orders yet.</p>`;
  const rows = orders
    .map(
      (o) => `
      <tr data-order-row="${esc(o.id)}">
        <td>${esc(names[o.kind] || KIND[o.kind] || o.kind)}</td>
        <td>${esc(o.subject?.address || "")}</td>
        <td data-order-status>${esc(statusWord(o.status))}</td>
        <td>${fmtDate(o.createdAt)}</td>
      </tr>`
    )
    .join("");
  return `
    <div style="overflow-x:auto">
      <table class="table" id="report-orders">
        <thead><tr><th>Report</th><th>Address</th><th>Status</th><th>Ordered</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function loadOrders(el, names) {
  try {
    const { orders } = await api("/api/reports/orders");
    el.innerHTML = orderRows(orders || [], names);
  } catch (err) {
    if (err.status === 401) return sessionEnded(el);
    el.textContent = errorText(err);
  }
}

function orderLine(order, names, lead) {
  return `
    ${lead}
    <div><strong>Report:</strong> ${esc(names[order.kind] || KIND[order.kind] || order.kind)}</div>
    <div><strong>Address:</strong> ${esc(order.subject?.address || "")}</div>
    <div><strong>Status:</strong> <span data-return-status>${esc(statusWord(order.status))}</span></div>`;
}

/** Back from Stripe: show the order, polling while the webhook hasn't landed yet. */
async function showReturn(el, orderId, checkout, names) {
  const lead =
    checkout === "cancelled"
      ? `<div class="notice">Checkout was cancelled. You haven't been charged.</div>`
      : `<div class="notice success">Thanks. Stripe is confirming your payment; this can take a few seconds.</div>`;
  const started = Date.now();
  for (;;) {
    let order;
    try {
      ({ order } = await api(`/api/reports/orders/${encodeURIComponent(orderId)}`));
    } catch (err) {
      if (err.status === 401) return sessionEnded(el);
      el.innerHTML = `<div class="notice warn">${esc(errorText(err))}</div>`;
      return;
    }
    el.innerHTML = orderLine(order, names, lead);
    if (checkout !== "success" || order.status !== "pending") return;
    if (Date.now() - started >= POLL_FOR_MS) {
      el.insertAdjacentHTML(
        "beforeend",
        `<p class="muted" data-still-pending>Stripe hasn't confirmed the payment yet. Some payment methods take longer; refresh this page later to see it.</p>`
      );
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export async function initReport() {
  const root = document.getElementById("report");
  if (!root) return;
  const body = root.querySelector(".features") || root;

  let products;
  try {
    ({ products } = await api("/api/reports/products"));
  } catch (err) {
    if (err.status === 404) {
      const lead = document.getElementById("report-lead");
      if (lead) lead.textContent = "Reports aren't available yet.";
      root.innerHTML = "";
      return;
    }
    body.textContent = `Error loading reports: ${errorText(err)}`;
    return;
  }
  products = products || [];
  const names = Object.fromEntries(products.map((p) => [p.kind, p.name || KIND[p.kind] || p.kind]));

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");
  const checkout = params.get("checkout");
  const returning = Boolean(orderId && (checkout === "success" || checkout === "cancelled"));

  const buy = block("report-buy-b", "Buy a report", buyForm(products));
  const mine = block("report-orders-b", "Your orders", `<div id="report-order-list">Loading…</div>`);
  root.innerHTML = returning
    ? block("report-return-b", "Your order", `<div id="report-return" class="features">Loading…</div>`) + mine + buy
    : buy + mine;

  const form = document.getElementById("report-buy");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = form.querySelector("[data-report-error]");
    err.hidden = true;
    const data = new FormData(form);
    const kind = data.get("kind");
    const address = String(data.get("address") || "").trim();
    if (!kind || !address) {
      err.textContent = !kind ? "Pick a report." : "Enter the address.";
      err.hidden = false;
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const { url } = await api("/api/reports/checkout", {
        method: "POST",
        body: { kind, subject: { address } },
      });
      if (!url) throw new Error("Checkout response missing redirect URL");
      window.location = url;
    } catch (e2) {
      if (e2.status === 401) sessionEnded(err);
      else err.textContent = errorText(e2);
      err.hidden = false;
      btn.disabled = false;
    }
  });

  const list = document.getElementById("report-order-list");
  const listed = loadOrders(list, names);
  if (returning) {
    await showReturn(document.getElementById("report-return"), orderId, checkout, names);
    await listed;
    // The order may have turned paid while we polled.
    await loadOrders(list, names);
  } else {
    await listed;
  }
}
