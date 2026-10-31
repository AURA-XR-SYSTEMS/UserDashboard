// Type that materializes out of lidar: scanlines sample its real letterforms, points cast in from a sensor
// above it, then the real text takes over. The text stays real throughout; this only paints over it.
// Copied from the Spatial Accelerator site (spatialaccelerator/site/js/hero-type.js) as a module: a page
// calls materialize(el) once the headline's words are final (some are filled in from the account first).
const DUR_SWEEP = 1250, DUR_CAST = 300, DUR_SETTLE = 420;
const STRETCH = { "100%": "normal", "87.5%": "semi-condensed", "75%": "condensed", "112.5%": "semi-expanded", "125%": "expanded" };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function paint(el, finish) {
  const root = document.documentElement;
  const cs = getComputedStyle(el);
  const fontSize = parseFloat(cs.fontSize);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const box = el.getBoundingClientRect();
  if (!box.width) { finish(); return; }
  const pad = Math.ceil(fontSize * 0.2);
  const W = Math.ceil(box.width + pad * 2), H = Math.ceil(box.height + pad * 2);

  // Draw the same words at the same places, offscreen, one word at a time so line wraps match.
  const off = document.createElement("canvas");
  off.width = W * dpr; off.height = H * dpr;
  const o = off.getContext("2d", { willReadFrequently: true });
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  if (!o || !g) { finish(); return; }
  o.scale(dpr, dpr);
  o.font = cs.fontWeight + " " + fontSize + "px " + cs.fontFamily;
  if ("fontStretch" in o) o.fontStretch = STRETCH[cs.fontStretch] || "normal";
  if ("letterSpacing" in o) o.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
  o.textBaseline = "alphabetic";
  o.fillStyle = "#000";
  const ascent = o.measureText("Hg").fontBoundingBoxAscent;
  const range = document.createRange(), hot = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const node = walk.currentNode, re = /\S+/g;
    let m;
    while ((m = re.exec(node.textContent))) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getBoundingClientRect();
      const x0 = r.left - box.left + pad, y0 = r.top - box.top + pad;
      o.fillText(m[0], x0, y0 + ascent);
      if (node.parentNode.closest("[data-hot]")) hot.push([x0, y0, x0 + r.width, y0 + r.height]);
    }
  }

  // Scanlines: rows of samples, like the beams of a sensor, with some dropped.
  const data = o.getImageData(0, 0, off.width, off.height).data;
  const rowGap = Math.max(2, fontSize / 42), colGap = Math.max(1.5, fontSize / 90);
  const pts = [];
  function isHot(x, y) {
    for (let h = 0; h < hot.length; h++) { if (x >= hot[h][0] && x <= hot[h][2] && y >= hot[h][1] && y <= hot[h][3]) return true; }
    return false;
  }
  for (let y = 0; y < H; y += rowGap) {
    for (let x = 0; x < W; x += colGap) {
      const px = Math.round(x * dpr), py = Math.round(y * dpr);
      if (data[(py * off.width + px) * 4 + 3] > 128 && Math.random() > 0.06) {
        pts.push({ x, y, hot: isHot(x, y), at: (x / W) * DUR_SWEEP * 0.82 + Math.random() * DUR_SWEEP * 0.18 });
      }
    }
  }
  if (!pts.length) { finish(); return; }

  c.className = "hero__type";
  c.setAttribute("aria-hidden", "true");
  c.width = W * dpr; c.height = H * dpr;
  c.style.cssText = "left:" + -pad + "px;top:" + -pad + "px;width:" + W + "px;height:" + H + "px";
  el.appendChild(c);
  g.scale(dpr, dpr);
  const ink = getComputedStyle(el.parentNode).color; // The element itself is transparent until the scan ends.
  const sig = getComputedStyle(root).getPropertyValue("--signal-fill").trim();
  const ox = W * 0.5, oy = -H * 0.9; // The sensor, up in the scene.

  let t0 = 0, done = false;
  const size = Math.max(1.1, fontSize / 95);
  function end() {
    if (done) return;
    done = true;
    finish();
    setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, DUR_SETTLE + 80);
  }
  // A tab opened in the background doesn't run frames: never leave the text hidden.
  setTimeout(end, DUR_SWEEP + DUR_CAST + 1600);

  function frame(now) {
    if (!t0) t0 = now;
    const t = now - t0;
    g.clearRect(0, 0, W, H);
    const settle = Math.min(1, Math.max(0, (t - DUR_SWEEP - DUR_CAST) / DUR_SETTLE));
    if (settle > 0 && !done) end();
    g.globalAlpha = 1 - settle;
    // Settled points in their final colour, young ones still flying and in the signal colour.
    const young = [];
    let i, p, a;
    g.fillStyle = ink;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      a = t - p.at;
      if (a < 0) continue;
      if (a >= DUR_CAST) { if (!p.hot) g.fillRect(p.x, p.y, size, size); }
      else young.push(p, a / DUR_CAST);
    }
    g.fillStyle = sig;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      if (p.hot && t - p.at >= DUR_CAST) g.fillRect(p.x, p.y, size, size);
    }
    for (i = 0; i < young.length; i += 2) {
      p = young[i]; a = young[i + 1];
      const e = a * a * (3 - 2 * a);
      g.fillRect(ox + (p.x - ox) * e, oy + (p.y - oy) * e, size * 1.3, size * 1.3);
    }
    // A few live rays down to where the scan is working.
    if (t < DUR_SWEEP + DUR_CAST && young.length) {
      g.strokeStyle = sig;
      g.lineWidth = 1;
      g.globalAlpha = 0.28;
      g.beginPath();
      for (i = 0; i < 14; i++) {
        p = young[Math.floor(Math.random() * young.length / 2) * 2];
        g.moveTo(ox, oy);
        g.lineTo(p.x, p.y);
      }
      g.stroke();
    }
    if (settle < 1) requestAnimationFrame(frame);
    else g.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

// Sampling needs the real font. If it's slow, show the text rather than hold the page.
function whenFont(el, go, giveUp) {
  if (!document.fonts || !document.fonts.load) { giveUp(); return; }
  const cs = getComputedStyle(el);
  let late = false;
  const bail = setTimeout(() => { late = true; giveUp(); }, 1500);
  document.fonts.load(cs.fontWeight + " " + cs.fontSize + " Archivo", "Welcome.").then(() => {
    clearTimeout(bail);
    if (!late) go();
  }, () => { clearTimeout(bail); giveUp(); });
}

/** Draw `el` (a [data-lidar] headline) out of lidar points, then hand over to the real text. Runs once. */
export function materialize(el) {
  if (!el || el.classList.contains("is-done") || el.dataset.lidarRunning) return;
  const show = () => el.classList.add("is-done");
  if (reduced() || document.hidden) { show(); return; }
  el.dataset.lidarRunning = "1";
  whenFont(el, () => paint(el, show), show);
}

/** Headlines whose words are final at load: materialize them now. */
export function materializeStatic() {
  document.querySelectorAll("[data-lidar]:not([data-lidar-later])").forEach(materialize);
}
