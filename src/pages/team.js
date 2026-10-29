// src/pages/team.js
// Team plan: buy seats, invite people into them, see who has one.
import { api, esc, fmtDate } from "../lib/api.js";

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

function buyForm(team) {
  const name = team?.name || "";
  const seats = team?.seats || 5;
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
        <input class="input" name="seats" type="number" min="2" max="100" required value="${seats}" />
      </div>
      <p class="muted">Each seat is a full AURA Engine membership for one person, billed monthly
        per seat. You can change the number of seats in Stripe Checkout and later from Billing.</p>
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
        <td><button class="btn ghost" data-revoke="${esc(i.id)}">Revoke</button></td>
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
          </form>
          <div id="invite-result"></div>`
        : `<p class="muted">${team.active ? "Every seat is taken or invited. Add seats from Billing (Manage billing) or revoke an invite." : "Invites open again once the team's billing is active."}</p>`
    }`;
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

  if (!team || team.status === "onboarding") el.innerHTML = buyForm(team);
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
      document.getElementById("invite-result").innerHTML = `
        <div class="notice success">
          ${res.emailSent ? `Invite emailed to ${esc(res.invite.email)}.` : `Invite created for ${esc(res.invite.email)} (the email didn't send; share the link yourself).`}
          You can also send them this link (it works once, for that email):
          <input class="input" readonly value="${esc(res.inviteUrl)}" onclick="this.select()" />
        </div>
        <a class="btn ghost" href="team.html">Done</a>`;
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
