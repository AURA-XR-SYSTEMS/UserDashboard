// Shared page behaviour: theme toggle, header state, footer wordmark fit.
// Copied from the Spatial Accelerator site (spatialaccelerator/site/js/site.js); only the storage key differs.
export function initSite() {
  const root = document.documentElement;

  // Theme: follows the OS until the toggle is used.
  function currentTheme() {
    return root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
    b.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("aura-theme", next); } catch (e) {}
      document.dispatchEvent(new CustomEvent("aura-theme"));
    });
  });

  // Header gains a rule once the page moves.
  const top = document.querySelector("[data-top]");
  function onScroll() { if (top) top.classList.toggle("is-scrolled", scrollY > 30); }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Footer wordmark: each line is sized to span the column exactly.
  function fit() {
    document.querySelectorAll("[data-fit]").forEach((box) => {
      const w = box.clientWidth, one = w >= 700;
      const lines = box.querySelectorAll("[data-line]");
      box.style.fontSize = "0";
      lines.forEach((line, i) => {
        line.style.fontSize = "100px";
        line.style.display = one ? "inline-block" : "block";
        line.style.marginRight = one && i === 0 && lines.length > 1 ? "0.22em" : "0";
      });
      if (one) {
        let total = 0;
        lines.forEach((line, i) => { total += line.getBoundingClientRect().width + (i === 0 && lines.length > 1 ? 22 : 0); });
        lines.forEach((line) => { line.style.fontSize = (99.4 * w / total).toFixed(2) + "px"; });
      } else {
        lines.forEach((line) => { line.style.fontSize = (99.4 * w / line.getBoundingClientRect().width).toFixed(2) + "px"; });
      }
    });
  }
  fit();
  addEventListener("resize", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
}
