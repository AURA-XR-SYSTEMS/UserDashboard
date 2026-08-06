/**
 * The TRY ASK AURA banner — the portal's top-of-page call to action.
 *
 * Ask AURA is the browser app: no download, no install, no GPU. It is by far
 * the shortest path from "made an account" to "saw the product do something",
 * and until now the portal never linked it at all — it existed only on the
 * marketing site. Every signed-in page gets this banner.
 *
 * Two destinations, decided by billing status:
 *   member (active | trialing) -> straight into the app
 *   everyone else              -> Stripe checkout, because Ask AURA gates on
 *                                 the same status and would just bounce them
 *                                 to its own subscribe screen anyway.
 */
import {
  ASKAURA_URL,
  hasPlanAccess,
  isPublicPage,
  loadAccountCached,
  startCheckout,
} from "./api.js";

const MOUNT_ID = "askaura-banner";

function bannerHTML(isMember) {
  const sub = isMember
    ? "Your membership is live — open the browser app and ask the planet a question."
    : "No download, no install. Start your free trial and use Ask AURA in the browser right now.";
  const cta = isMember ? "Open Ask AURA" : "Start free trial";

  return `
    <div class="askaura-banner">
      <div class="askaura-banner-copy">
        <div class="askaura-banner-title">Try Ask AURA on the web now</div>
        <div class="askaura-banner-sub">${sub}</div>
      </div>
      <button class="btn primary askaura-banner-cta" type="button" data-askaura-go>
        ${cta}
      </button>
    </div>`;
}

/**
 * Render the banner at the top of the page's main container.
 * Safe to call on every page — it no-ops where there's no container, and
 * skips pages that opt out with data-no-askaura-banner.
 */
export async function initAskAuraBanner() {
  // Sign-in and password-reset pages share the same <main class="container">,
  // so without this gate the banner would fire a doomed /api/account on them.
  if (isPublicPage()) return;

  const container = document.querySelector("main.container");
  if (!container || container.hasAttribute("data-no-askaura-banner")) return;
  if (document.getElementById(MOUNT_ID)) return;

  const account = await loadAccountCached();
  // Not signed in (loadAccount already redirects) or the call failed — a
  // marketing banner is never worth breaking a page over.
  if (!account) return;

  const isMember = hasPlanAccess(account);

  const mount = document.createElement("div");
  mount.id = MOUNT_ID;
  mount.innerHTML = bannerHTML(isMember);
  container.prepend(mount);

  mount.querySelector("[data-askaura-go]")?.addEventListener("click", async (e) => {
    if (isMember) {
      window.open(ASKAURA_URL, "_blank", "noopener");
      return;
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Opening checkout…";
    try {
      await startCheckout();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Start free trial";
      alert(err.message);
    }
  });
}
