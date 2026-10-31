// The account's own time on AURA, drawn: one point per day from the day the account was made to today,
// the days a workspace was saved in the signal colour, the next billing date as a hollow point ahead.
// Every number comes from /api/account; if a date is missing the canvas stays empty and says so.
const DAY = 86400000;

// Days are counted in the viewer's own calendar, so "today" is today where they sit.
function dayOf(value) {
  const d = value ? new Date(value) : null;
  return d && !isNaN(d) ? Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY) : null;
}
function fmt(day) {
  return new Date(day * DAY).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Facts about the account's timeline (also what the receipt line prints). */
export function timelineFacts(account) {
  const today = dayOf(new Date());
  const start = dayOf(account?.createdAt);
  if (start === null) return null;
  const sub = account.subscription || {};
  const status = account.billing?.status;
  const ahead = status === "trialing" ? dayOf(sub.trialEnd) : dayOf(sub.currentPeriodEnd);
  const saves = (account.workspaces || [])
    .map((w) => ({ day: dayOf(w.updatedAt || w.createdAt), name: w.name || "Untitled workspace" }))
    .filter((s) => s.day !== null);
  return { today, start, ahead: ahead !== null && ahead >= today ? ahead : null, aheadLabel: status === "trialing" ? "free month ends" : "renews", saves, days: today - start + 1 };
}

/** Draw the timeline into `canvas` and write the receipt into `note`; redraws on a theme change or resize. */
export function drawTimeline(canvas, note, account) {
  if (canvas && !canvas.dataset.timelineLive) {
    canvas.dataset.timelineLive = "1";
    const again = () => paintTimeline(canvas, note, account);
    document.addEventListener("aura-theme", again);
    addEventListener("resize", again);
  }
  return paintTimeline(canvas, note, account);
}

function paintTimeline(canvas, note, account) {
  const f = timelineFacts(account);
  if (!canvas) return f;
  const g = canvas.getContext("2d");
  if (!f || !g) {
    if (note) note.textContent = "No dates on this account yet.";
    return f;
  }
  const cs = getComputedStyle(canvas);
  const ink = cs.color;
  const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
  const sig = getComputedStyle(document.documentElement).getPropertyValue("--signal-fill").trim();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const first = f.start, last = Math.max(f.today, f.ahead || f.today);
  const span = Math.max(last - first, 6);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = canvas.clientWidth || 600, H = 120;
  canvas.width = W * dpr; canvas.height = H * dpr;
  g.scale(dpr, dpr);
  const padL = 6, padR = 6, y = 58;
  const x = (day) => padL + ((day - first) / span) * (W - padL - padR);
  // Days are points; when the span is long, each point stands for several days.
  const perPoint = Math.max(1, Math.ceil(span / Math.max(60, W / 5)));
  const size = Math.max(1.5, Math.min(3, (W - padL - padR) / (span / perPoint) * 0.45));
  const saveDays = new Map();
  f.saves.forEach((s) => saveDays.set(s.day, s.name));

  let t0 = 0;
  function frame(now) {
    if (!t0) t0 = now;
    const t = reduced ? 1 : Math.min(1, (now - t0) / 1100);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = muted; g.globalAlpha = 0.35; g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL, y + 0.5); g.lineTo(W - padR, y + 0.5); g.stroke();
    g.globalAlpha = 1;
    for (let d = first; d <= f.today; d += perPoint) {
      const p = (d - first) / Math.max(f.today - first, 1);
      if (p > t) break;
      const hot = [...saveDays.keys()].some((k) => k >= d && k < d + perPoint);
      g.fillStyle = hot ? sig : ink;
      const s = hot ? size * 2.2 : size;
      g.fillRect(x(d) - s / 2, y - s / 2, s, s);
    }
    if (f.ahead && t >= 1) {
      g.strokeStyle = sig; g.lineWidth = 1.5;
      g.strokeRect(x(f.ahead) - 4, y - 4, 8, 8);
      g.setLineDash([2, 4]);
      g.strokeStyle = muted; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x(f.today) + 6, y + 0.5); g.lineTo(x(f.ahead) - 6, y + 0.5); g.stroke();
      g.setLineDash([]);
    }
    // Labels, in the mono layer.
    g.font = "400 11px 'Plex Mono', ui-monospace, monospace";
    g.fillStyle = muted;
    g.textAlign = "left";
    g.fillText(fmt(first), padL, y + 24);
    const todayX = x(f.today);
    g.fillStyle = ink;
    g.textAlign = todayX > W * 0.75 ? "right" : "left";
    g.fillText("today", todayX + (todayX > W * 0.75 ? -8 : 8), y - 12);
    g.fillRect(todayX - 0.5, y - 6, 1, 12);
    if (f.ahead) {
      g.fillStyle = sig;
      g.textAlign = "right";
      g.fillText(f.aheadLabel + " " + fmt(f.ahead), W - padR, y + 24);
    }
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (note) {
    const ws = f.saves.length;
    note.innerHTML = `<b>${f.days.toLocaleString()}</b> day${f.days === 1 ? "" : "s"} on AURA since <b>${fmt(f.start)}</b>` +
      (ws ? `, <b>${ws}</b> workspace${ws === 1 ? "" : "s"} saved` : ", no workspaces saved yet") +
      (f.ahead ? `, ${f.aheadLabel} <b>${fmt(f.ahead)}</b>.` : ".");
  }
  return f;
}
