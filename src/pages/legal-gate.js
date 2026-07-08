import termsMd from "../legal/terms-of-service.md?raw";
import privacyMd from "../legal/privacy-policy.md?raw";

// Bump when either document materially changes — re-prompts all users.
export const LEGAL_VERSION = "2026-07-08";
const STORAGE_KEY = "aura_legal_acceptance";

/* ---------- minimal markdown renderer (headings, lists, tables,
   blockquotes, hr, bold/italic/links) — enough for these documents ---------- */

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(https?:\/\/[^\s<)]+[^\s<).,])/g, (m) =>
      /href="/.test(s) ? m : `<a href="${m}" target="_blank" rel="noopener">${m}</a>`
    );
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let list = null; // "ul"
  let table = null; // array of rows
  let quote = false;

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeQuote = () => { if (quote) { out.push("</blockquote>"); quote = false; } };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push('<div class="legal-table-wrap"><table>');
    out.push("<thead><tr>" + head.map((c) => `<th>${inline(esc(c))}</th>`).join("") + "</tr></thead>");
    out.push("<tbody>");
    rows.forEach((r) => out.push("<tr>" + r.map((c) => `<td>${inline(esc(c))}</td>`).join("") + "</tr>"));
    out.push("</tbody></table></div>");
    table = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (/^\s*\|/.test(line)) {
      closeList(); closeQuote();
      const cells = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      (table ||= []).push(cells);
      continue;
    }
    closeTable();

    if (/^---+$/.test(line.trim())) { closeList(); closeQuote(); out.push("<hr/>"); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList(); closeQuote();
      const level = h[1].length;
      out.push(`<h${level + 1}>${inline(esc(h[2]))}</h${level + 1}>`); // shift down: doc h1 -> h2
      continue;
    }

    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      closeList();
      if (!quote) { out.push("<blockquote>"); quote = true; }
      if (q[1].trim()) out.push(`<p>${inline(esc(q[1]))}</p>`);
      continue;
    }
    closeQuote();

    const li = line.match(/^\s*-\s+(.*)$/);
    if (li) {
      if (!list) { out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(esc(li[1]))}</li>`);
      continue;
    }
    closeList();

    if (!line.trim()) continue;
    out.push(`<p>${inline(esc(line))}</p>`);
  }
  closeList(); closeQuote(); closeTable();
  return out.join("\n");
}

/* ---------- acceptance record ---------- */

export function getAcceptance() {
  try {
    const rec = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return rec && rec.version === LEGAL_VERSION ? rec : null;
  } catch {
    return null;
  }
}

function recordAcceptance() {
  const rec = { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  return rec;
}

/* ---------- modal ---------- */

let modalEl = null;

function buildModal() {
  const el = document.createElement("div");
  el.className = "legal-overlay";
  el.innerHTML = `
    <div class="legal-modal" role="dialog" aria-modal="true" aria-label="Terms of Service and Privacy Policy">
      <div class="legal-head">
        <div class="legal-title">Before you download</div>
        <div class="legal-sub">Please review and accept the Terms of Service and Privacy Policy.</div>
        <button class="legal-close" aria-label="Close" data-legal-close>&times;</button>
      </div>
      <div class="tab-header legal-tabs">
        <button class="tab-btn active" data-legal-tab="terms">Terms of Service</button>
        <button class="tab-btn" data-legal-tab="privacy">Privacy Policy</button>
      </div>
      <div class="legal-doc" data-legal-doc tabindex="0"></div>
      <div class="legal-foot">
        <label class="legal-agree">
          <input type="checkbox" data-legal-check />
          <span>I have read and agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</span>
        </label>
        <div class="card-actions" style="margin:0;">
          <button class="btn ghost" data-legal-close>Cancel</button>
          <button class="btn primary" data-legal-accept disabled>Agree &amp; download</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

const DOCS = {
  terms: mdToHtml(termsMd),
  privacy: mdToHtml(privacyMd),
};

function showTab(which) {
  const doc = modalEl.querySelector("[data-legal-doc]");
  doc.innerHTML = DOCS[which];
  doc.scrollTop = 0;
  modalEl.querySelectorAll("[data-legal-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.legalTab === which)
  );
}

function openModal(onAccept) {
  modalEl ||= buildModal();
  const check = modalEl.querySelector("[data-legal-check]");
  const accept = modalEl.querySelector("[data-legal-accept]");
  check.checked = false;
  accept.disabled = true;
  showTab("terms");
  modalEl.classList.add("open");
  document.body.style.overflow = "hidden";

  const close = () => {
    modalEl.classList.remove("open");
    document.body.style.overflow = "";
  };

  modalEl.onclick = (e) => {
    if (e.target === modalEl || e.target.closest("[data-legal-close]")) close();
    const tab = e.target.closest("[data-legal-tab]");
    if (tab) showTab(tab.dataset.legalTab);
  };
  check.onchange = () => { accept.disabled = !check.checked; };
  accept.onclick = () => {
    if (!check.checked) return;
    recordAcceptance();
    close();
    onAccept();
  };
  document.onkeydown = (e) => { if (e.key === "Escape" && modalEl.classList.contains("open")) close(); };
}

/* ---------- wiring ---------- */

export function initLegalGate() {
  document.querySelectorAll("[data-legal-gate]").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (getAcceptance()) return; // already accepted this version — let the download proceed
      e.preventDefault();
      openModal(() => {
        // re-trigger the original download after acceptance
        const a = document.createElement("a");
        a.href = link.href;
        if (link.hasAttribute("download")) a.setAttribute("download", "");
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    });
  });

  // "View terms/privacy" links open the reader without gating
  document.querySelectorAll("[data-legal-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openModal(() => {});
      showTab(link.dataset.legalView || "terms");
    });
  });
}
