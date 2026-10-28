// src/dataroom/invite.js
// dataroom-invite.html: where an invite link lands (thread DR). The token rides in the URL
// fragment (#t=...), which browsers never send to a server; it is read once and then wiped
// from the address bar so it doesn't linger in history or get copied along with the URL.

import "../styles.css";
import "./dataroom.css";
import auraLogoUrl from "../assets/wizard-top.png";
import { DATAROOM_ENABLED, authCard, currentUser, dr, el, notAvailable, panel, signOut } from "./common.js";

const KEY = "aura_dr_invite"; // sessionStorage: survives the sign-up round trip, dies with the tab

function readToken() {
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("t");
  if (fromHash) {
    try {
      sessionStorage.setItem(KEY, fromHash);
    } catch {}
    history.replaceState(null, "", location.pathname);
    return fromHash;
  }
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function forgetToken() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

async function boot() {
  const logo = document.querySelector(".brand-logo");
  if (logo) logo.src = auraLogoUrl;
  const root = document.getElementById("dr-root");
  if (!DATAROOM_ENABLED) return notAvailable(root);

  const token = readToken();
  if (!token) {
    root.replaceChildren(card("This invite link is incomplete", "Open the link from your invitation again, or ask the person who invited you for a new one."));
    return;
  }

  let invite;
  try {
    ({ invite } = await dr("/api/dataroom/invites/peek", { method: "POST", body: { token } }));
  } catch (err) {
    forgetToken();
    root.replaceChildren(card("This invite can't be used", err.message));
    return;
  }

  const intro = el(
    "div",
    {},
    el("span", { class: "kicker", text: invite.org }),
    el("p", { class: "dr-lede", text: `You're invited to ${invite.roomName}.` }),
    el("p", {
      class: "muted",
      text: `This private data room is for sharing files with AURA. The invitation is for ${invite.email} as a ${invite.role}.`,
    })
  );

  const user = await currentUser();
  if (!user) {
    root.replaceChildren(
      authCard({
        title: "Data room invitation",
        email: invite.email,
        lockEmail: true,
        intro: el("div", {}, intro, el("p", { class: "small muted", text: "Sign in, or create a free AURA account with this email to open the room. No plan or payment is needed for a data room." })),
        onSignedIn: () => boot(),
      })
    );
    return;
  }

  if ((user.email || "").toLowerCase() !== invite.email) {
    const out = el("button", {
      class: "btn ghost",
      type: "button",
      text: `Sign out of ${user.email}`,
      onclick: async () => {
        await signOut();
        boot();
      },
    });
    root.replaceChildren(
      el("div", { class: "dr-narrow" }, panel("Data room invitation", intro, el("p", { text: `You're signed in as ${user.email}. This invite is for ${invite.email}.` }), el("div", { class: "row" }, out)))
    );
    return;
  }

  const accept = el("button", { class: "btn primary", type: "button", text: "Open the data room" });
  const error = el("div", { class: "form-error", role: "alert", hidden: true });
  accept.addEventListener("click", async () => {
    accept.disabled = true;
    try {
      const { roomId } = await dr("/api/dataroom/invites/accept", { method: "POST", body: { token } });
      forgetToken();
      location.assign(`dataroom.html?room=${encodeURIComponent(roomId)}`);
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      accept.disabled = false;
    }
  });
  root.replaceChildren(el("div", { class: "dr-narrow" }, panel("Data room invitation", intro, error, el("div", { class: "row" }, accept))));
}

function card(title, text) {
  return el("div", { class: "dr-narrow" }, panel(title, el("p", { class: "muted", text })));
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    document.getElementById("dr-root").replaceChildren(card("Something went wrong", err.message));
  });
});
