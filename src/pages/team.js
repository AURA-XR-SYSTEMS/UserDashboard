// src/pages/team.js
// Team plan: buy seats, invite people into them, see who has one.
import { api, esc, fmtDate, fmtMoney } from "../lib/api.js";

function checkoutNotice() {
  const checkout = new URLSearchParams(window.location.search).get("checkout");
  if (checkout === "success") {
    return `<div class="notice success">Checkout completed. Your team turns on as soon as Stripe confirms it (usually a few seconds); refresh if it still says pending.</div>`;
  }
  if (checkout === "cancelled") {
    return `<div class="notice">Checkout was canceled. No charge was made.</div>`;
  }
  return "";
}

// The team fee includes some seats; each seat beyond them has its own price.
function teamTotal(pricing, seats) {
  const extra = Math.max(seats - pricing.includedSeats, 0);
  return pricing.basePriceCents + extra * pricing.seatPriceCents;
}

function pricingLine(pricing) {
  if (!pricing) return "Stripe Checkout shows the exact total before you pay.";
  const fee = fmtMoney(pricing.basePriceCents, pricing.currency);
  const seat = fmtMoney(pricing.seatPriceCents, pricing.currency);
  return `${fee} per ${pricing.interval} for the team, including ${pricing.includedSeats} seats
    (yours and ${pricing.includedSeats - 1} more), then ${seat} per ${pricing.interval} for each
    additional seat.`;
}

function buyForm(team, pricing) {
  const name = team?.name || "";
  const min = pricing?.minSeats || 2;
  const max = pricing?.maxSeats || 100;
  const seats = Math.max(team?.seats || 5, min);
  return `
    ${checkoutNotice()}
    ${team ? `<div class="notice">Your team "${esc(name)}" is waiting for checkout to finish.</div>` : ""}
    <form class="form" id="team-buy">
      <div>
        <label>Team name</label>
        <input class="input" name="name" required maxlength="80" value="${esc(name)}" placeholder="Your studio, firm or class" />
      </div>
      <div>
        <label>Seats (including you)</label>
        <input class="input" name="seats" type="number" min="${min}" max="${max}" required value="${seats}" />
      </div>
      <p class="muted">${pricingLine(pricing)} Each seat is a full AURA Engine membership for one
        person. You can change the number of seats in Stripe Checkout and later from Billing.</p>
      <p id="team-total">${pricing ? `<strong>${fmtMoney(teamTotal(pricing, seats), pricing.currency)} per ${pricing.interval}</strong> for ${seats} seats` : ""}</p>
      <div class="form-error" data-team-error hidden></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn primary" type="submit">Continue to checkout</button>
      </div>
    </form>`;
}

function ownerView(team) {
  const free = team.seats - team.seatsUsed - team.invites.length;
  const members = team.members
    .map(
      (m) => `
      <tr>
        <td>${esc(m.name || "")}</td>
        <td>${esc(m.email || "")}</td>
        <td>${m.role === "owner" ? "Owner" : "Member"}</td>
        <td>${m.role === "owner" ? "" : `<button class="btn ghost" data-remove="${esc(m.userId)}">Remove</button>`}</td>
      </tr>`
    )
    .join("");
  const invites = team.invites
    .map(
      (i) => `
      <tr>
        <td colspan="2">${esc(i.email)}</td>
        <td>Invited, expires ${fmtDate(i.expiresAt)}</td>
        <td>
          <button class="btn ghost" data-relink="${esc(i.email)}">New link</button>
          <button class="btn ghost" data-revoke="${esc(i.id)}">Revoke</button>
        </td>
      </tr>`
    )
    .join("");
  return `
    ${checkoutNotice()}
    <div><strong>Team:</strong> ${esc(team.name)}</div>
    <div><strong>Status:</strong> ${team.active ? team.status : `${team.status} (seats are off until billing is fixed in Billing)`}</div>
    <div><strong>Seats:</strong> ${team.seatsUsed} of ${team.seats} used${team.invites.length ? `, ${team.invites.length} invited` : ""}</div>
    ${team.currentPeriodEnd ? `<div><strong>Renews:</strong> ${fmtDate(team.currentPeriodEnd)}${team.cancelAtPeriodEnd ? " (cancels then)" : ""}</div>` : ""}
    <div class="hr"></div>
    <table class="table" style="width:100%">
      <thead><tr><th>Name</th><th>Email</th><th>Seat</th><th></th></tr></thead>
      <tbody>${members}${invites}</tbody>
    </table>
    <div class="hr"></div>
    ${
      team.active && free > 0
        ? `<form class="form" id="team-invite">
            <div>
              <label>Invite by email (${free} seat${free === 1 ? "" : "s"} free)</label>
              <input class="input" name="email" type="email" required placeholder="name@school.edu" />
            </div>
            <div class="form-error" data-team-error hidden></div>
            <div class="row" style="justify-content:flex-end">
              <button class="btn primary" type="submit">Send invite</button>
            </div>
          </form>`
        : `<p class="muted">${team.active ? "Every seat is taken or invited. Add seats from Billing (Manage billing) or revoke an invite." : "Invites open again once the team's billing is active."}</p>`
    }
    <div id="invite-result"></div>`;
}

function memberView(team) {
  return `
    <div><strong>Team:</strong> ${esc(team.name)}</div>
    <div><strong>Owner:</strong> ${esc(team.ownerName || "")}</div>
    <div><strong>Your seat:</strong> ${team.active ? "active" : "off (the team's billing is not active)"}</div>
    <div class="hr"></div>
    <a class="btn primary" href="downloads.html">Go to downloads</a>
    <button class="btn ghost" id="team-leave">Leave team</button>`;
}

// Invite email can land in spam (the sending domain's reputation, 2026-10-28), so
// the link the owner copies is the primary path, not a fallback.
function showInviteLink(res) {
  document.getElementById("invite-result").innerHTML = `
    <div class="notice success">
      <strong>Send ${esc(res.invite.email)} this link</strong> (by chat, text or your own
      email). It works once, only for that address, until ${fmtDate(res.invite.expiresAt)}.
      <input class="input" readonly value="${esc(res.inviteUrl)}" onclick="this.select()" />
      <button class="btn primary" type="button" id="copy-invite">Copy link</button>
      <span class="muted">${res.emailSent ? "We also emailed it, but it may land in spam." : "We couldn't email it, so the link is the only way in."}</span>
    </div>
    <a class="btn ghost" href="team.html">Done</a>`;
  document.getElementById("copy-invite").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(res.inviteUrl);
      e.currentTarget.textContent = "Copied";
    } catch {
      document.querySelector("#invite-result input").select();
    }
  });
}

function showError(form, err) {
  const el = form.querySelector("[data-team-error]");
  if (!el) return alert(err.message);
  el.textContent = err.message;
  el.hidden = false;
}

export async function initTeam() {
  const el = document.getElementById("team-info");
  if (!el) return;
  let team;
  try {
    ({ team } = await api("/api/teams/me"));
  } catch (e) {
    el.textContent = `Error loading your team: ${e.message}`;
    return;
  }

  let pricing = null;
  if (!team || team.status === "onboarding") {
    try {
      pricing = await api("/api/teams/pricing");
    } catch {
      // Checkout still shows the price; the form just can't preview it.
    }
    el.innerHTML = buyForm(team, pricing);
    const seatsInput = el.querySelector('input[name="seats"]');
    seatsInput?.addEventListener("input", () => {
      const n = Number(seatsInput.value);
      if (!pricing || !n) return;
      document.getElementById("team-total").innerHTML =
        `<strong>${fmtMoney(teamTotal(pricing, n), pricing.currency)} per ${pricing.interval}</strong> for ${n} seats`;
    });
  }
  else if (team.role === "owner") el.innerHTML = ownerView(team);
  else el.innerHTML = memberView(team);

  document.getElementById("team-buy")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const { url } = await api("/api/teams/checkout", {
        method: "POST",
        body: { name: body.name, seats: Number(body.seats) },
      });
      if (!url) throw new Error("Checkout response missing redirect URL");
      window.location.href = url;
    } catch (err) {
      showError(form, err);
    }
  });

  document.getElementById("team-invite")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const { email } = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await api(`/api/teams/${team.id}/invites`, {
        method: "POST",
        body: { email },
      });
      showInviteLink(res);
      form.remove();
    } catch (err) {
      showError(form, err);
    }
  });

  el.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remove this person from the team? They lose access at once.")) return;
      try {
        await api(`/api/teams/${team.id}/members/${b.dataset.remove}`, { method: "DELETE" });
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    })
  );
  // Only a hash of each link is stored, so "New link" re-invites the same address:
  // the old link stops working and a fresh one is shown.
  el.querySelectorAll("[data-relink]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        const res = await api(`/api/teams/${team.id}/invites`, {
          method: "POST",
          body: { email: b.dataset.relink },
        });
        showInviteLink(res);
        document.getElementById("invite-result").scrollIntoView({ block: "center" });
      } catch (err) {
        alert(err.message);
      }
    })
  );
  el.querySelectorAll("[data-revoke]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await api(`/api/teams/${team.id}/invites/${b.dataset.revoke}`, { method: "DELETE" });
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    })
  );
  document.getElementById("team-leave")?.addEventListener("click", async () => {
    if (!confirm("Leave the team? You lose access unless you have your own plan.")) return;
    try {
      await api("/api/teams/leave", { method: "POST" });
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
}
