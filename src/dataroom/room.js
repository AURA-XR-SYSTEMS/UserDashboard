// src/dataroom/room.js
// dataroom.html: a client's private data room (thread DR).
//   - everyone in the room: the sorted file list, downloads of files scanned clean
//   - contributors and managers: uploads, straight to S3 through a presigned POST
//   - managers: people and invites, NDA status, the audit log, deleting the room

import "../styles.css";
import "./dataroom.css";
import auraLogoUrl from "../assets/wizard-top.png";
import {
  ApiError,
  DATAROOM_ENABLED,
  authCard,
  currentUser,
  dr,
  el,
  fill,
  fmtBytes,
  fmtWhen,
  handlingNotice,
  notAvailable,
  panel,
  signOut,
} from "./common.js";

const CATEGORY_ORDER = ["documents", "cad_bim", "gis", "spreadsheets", "images", "archives", "other"];
const POLL_MS = 4000;

const STATUS_TEXT = {
  uploading: "Uploading…",
  scanning: "Scanning…",
  clean: "Ready",
  blocked: "Blocked",
};
const BLOCKED_TEXT = {
  malware: "Blocked: malware detected. The file was deleted.",
  scan_unsupported: "Blocked: this file type couldn't be scanned.",
  scan_failed: "Blocked: the malware scan failed.",
  scan_access_denied: "Blocked: the scanner couldn't read the file.",
  size_mismatch: "Blocked: the upload was incomplete.",
};
const READ_TEXT = {
  not_sent: "Not sent",
  queued: "Queued",
  reading: "Reading…",
  read: "Read",
  failed: "Couldn't read",
};

const state = {
  user: null,
  rooms: [],
  canCreateRooms: false,
  room: null,
  files: [],
  filter: { q: "", sort: "date", status: "all" },
  uploads: new Map(), // fileId -> {name, loaded, total, error}
  pollTimer: null,
};

const root = () => document.getElementById("dr-root");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function setRoomInUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("room", id);
  else url.searchParams.delete("room");
  history.replaceState(null, "", url);
}

function toast(message, kind = "ok") {
  const t = el("div", { class: `dr-toast ${kind}`, role: "status", text: message });
  document.body.append(t);
  setTimeout(() => t.remove(), 5000);
}

// ---------------------------------------------------------------- boot

async function boot() {
  const logo = document.querySelector(".brand-logo");
  if (logo) logo.src = auraLogoUrl;
  if (!DATAROOM_ENABLED) return notAvailable(root());

  state.user = await currentUser();
  if (!state.user) {
    fill(root(), 
      authCard({
        title: "Sign in to your data room",
        intro: el("p", { class: "muted", text: "Use the email address your invitation was sent to." }),
        onSignedIn: () => location.reload(),
      })
    );
    return;
  }
  document.getElementById("dr-signed-in").textContent = state.user.email || "";
  document.getElementById("dr-logout").hidden = false;
  document.getElementById("dr-logout").addEventListener("click", async () => {
    await signOut();
    location.reload();
  });
  await loadRooms();
  const wanted = new URL(location.href).searchParams.get("room");
  const pick = state.rooms.find((r) => r.id === wanted) || (state.rooms.length === 1 ? state.rooms[0] : null);
  if (pick) await openRoom(pick.id);
  else renderRoomList();
}

async function loadRooms() {
  try {
    const data = await dr("/api/dataroom/rooms");
    state.rooms = data.rooms;
    state.canCreateRooms = data.canCreateRooms;
  } catch (err) {
    if (err.status === 404) return notAvailable(root());
    throw err;
  }
}

// ---------------------------------------------------------------- room list

function renderRoomList() {
  stopPolling();
  setRoomInUrl(null);
  state.room = null;
  const list = state.rooms.length
    ? el(
        "div",
        { class: "dr-room-list" },
        state.rooms.map((r) =>
          el(
            "button",
            { class: "card dr-room-item", type: "button", onclick: () => openRoom(r.id) },
            el("div", { class: "dr-room-name", text: r.name }),
            el("div", { class: "muted", text: r.org }),
            el("div", { class: "mono muted small", text: `${plural(r.fileCount, "file")} · ${fmtBytes(r.bytesUsed)} · you are ${r.role}` })
          )
        )
      )
    : el("p", { class: "muted", text: state.canCreateRooms ? "No data rooms yet. Create one below for a client." : "You aren't in any data room yet. If AURA invited you, open the link in your invitation email." });

  fill(root(), 
    el("section", { class: "page-head" }, el("span", { class: "kicker", text: "AURA" }), el("h1", { text: "Data rooms" })),
    list,
    state.canCreateRooms ? createRoomForm() : null
  );
}

function createRoomForm() {
  const form = el(
    "form",
    { class: "form dr-form" },
    el("div", {}, el("label", { text: "Room name" }), el("input", { class: "input", name: "name", required: true, maxlength: 255, placeholder: "CMC pilot" })),
    el("div", {}, el("label", { text: "Client organisation" }), el("input", { class: "input", name: "org", required: true, maxlength: 255, placeholder: "Critical Materials Co" })),
    el(
      "div",
      {},
      el("label", { text: "Allowed email domains (comma separated; empty = any)" }),
      el("input", { class: "input", name: "domains", placeholder: "cmc.com" })
    ),
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit", text: "Create room" }))
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      const { room } = await dr("/api/dataroom/rooms", {
        method: "POST",
        body: {
          name: f.get("name"),
          org: f.get("org"),
          allowedEmailDomains: String(f.get("domains") || "")
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        },
      });
      await loadRooms();
      await openRoom(room.id);
    } catch (err) {
      toast(err.message, "bad");
    }
  });
  const card = panel("New data room (AURA staff)", form);
  card.classList.add("dr-create");
  return card;
}

// ---------------------------------------------------------------- one room

async function openRoom(id) {
  try {
    const { room } = await dr(`/api/dataroom/rooms/${encodeURIComponent(id)}`);
    state.room = room;
    setRoomInUrl(room.id);
    renderRoom();
    await refreshFiles();
  } catch (err) {
    if (err.status === 404) {
      toast("That room doesn't exist or you aren't in it.", "bad");
      return renderRoomList();
    }
    toast(err.message, "bad");
  }
}

function canUpload() {
  const r = state.room;
  if (!r || r.role === "viewer") return { ok: false, why: "Viewers can download but not upload." };
  if (r.role !== "manager" && r.uploadsNeedNda && r.nda.status !== "signed")
    return { ok: false, why: "Uploads open once AURA has recorded the NDA for this room." };
  return { ok: true };
}

function renderRoom() {
  const r = state.room;
  const nda = { none: "NDA: not recorded", sent: "NDA: sent, awaiting signature", signed: "NDA: in place" }[r.nda.status] || "NDA";
  const header = el(
    "section",
    { class: "page-head dr-head" },
    state.rooms.length > 1 || state.canCreateRooms ? el("button", { class: "btn link", type: "button", text: "← All rooms", onclick: renderRoomList }) : null,
    el("span", { class: "kicker", text: r.org }),
    el("h1", { text: r.name }),
    el(
      "div",
      { class: "dr-chips" },
      el("span", { class: "chip", text: `You are ${r.role}` }),
      el("span", { class: `chip ${r.nda.status === "signed" ? "success" : "warn"}`, text: nda }),
      el("span", { class: "chip", id: "dr-usage", text: `${plural(r.fileCount, "file")} · ${fmtBytes(r.bytesUsed)} of ${fmtBytes(r.maxRoomBytes)}` })
    )
  );

  const up = canUpload();
  const picker = el("input", { type: "file", multiple: true, hidden: true, id: "dr-picker" });
  picker.addEventListener("change", () => {
    startUploads([...picker.files]);
    picker.value = "";
  });
  const drop = up.ok
    ? el(
        "div",
        { class: "dr-drop", tabindex: 0, role: "button", "aria-label": "Upload files" },
        el("strong", { text: "Drop files here or click to choose" }),
        el("span", { class: "muted small", text: `Any file type, up to ${fmtBytes(r.maxFileBytes)} each. Files are sorted automatically and scanned for malware before anyone can open them.` }),
        picker
      )
    : el("div", { class: "dr-drop disabled" }, el("span", { class: "muted", text: up.why }));
  if (up.ok) {
    drop.addEventListener("click", () => picker.click());
    drop.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && picker.click());
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("over");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("over");
      startUploads([...e.dataTransfer.files]);
    });
  }

  const toolbar = el(
    "div",
    { class: "dr-toolbar" },
    el("input", {
      class: "input",
      type: "search",
      placeholder: "Search file names",
      value: state.filter.q,
      oninput: (e) => {
        state.filter.q = e.target.value;
        renderFiles();
      },
    }),
    select(
      "Sort",
      [
        ["date", "Newest first"],
        ["name", "Name"],
        ["size", "Largest first"],
        ["uploader", "Uploader"],
      ],
      state.filter.sort,
      (v) => {
        state.filter.sort = v;
        renderFiles();
      }
    ),
    select(
      "Show",
      [
        ["all", "All files"],
        ["clean", "Ready"],
        ["scanning", "Scanning"],
        ["blocked", "Blocked"],
      ],
      state.filter.status,
      (v) => {
        state.filter.status = v;
        renderFiles();
      }
    )
  );

  fill(root(), 
    header,
    handlingNotice(),
    drop,
    el("div", { id: "dr-uploads" }),
    toolbar,
    el("div", { id: "dr-files" }),
    r.role === "manager" ? managerPanel() : null
  );
  renderUploads();
}

function select(label, options, value, onChange) {
  const s = el(
    "select",
    { class: "input", "aria-label": label },
    options.map(([v, t]) => el("option", { value: v, selected: v === value || undefined, text: t }))
  );
  s.addEventListener("change", () => onChange(s.value));
  return s;
}

// ---------------------------------------------------------------- files

async function refreshFiles() {
  if (!state.room) return;
  const roomId = state.room.id;
  try {
    const { files } = await dr(`/api/dataroom/rooms/${roomId}/files`);
    if (!state.room || state.room.id !== roomId) return;
    state.files = files;
    renderFiles();
    updateUsage();
  } catch (err) {
    if (err.status === 404) return renderRoomList();
    toast(err.message, "bad");
  }
  schedulePoll();
}

function schedulePoll() {
  stopPolling();
  const busy = state.files.some((f) => f.status === "scanning" || f.status === "uploading") || state.uploads.size;
  if (busy) state.pollTimer = setTimeout(refreshFiles, POLL_MS);
}

function stopPolling() {
  if (state.pollTimer) clearTimeout(state.pollTimer);
  state.pollTimer = null;
}

function updateUsage() {
  const live = state.files.filter((f) => f.status !== "blocked");
  const bytes = live.reduce((s, f) => s + f.size, 0);
  const u = document.getElementById("dr-usage");
  if (u) u.textContent = `${plural(live.length, "file")} · ${fmtBytes(bytes)} of ${fmtBytes(state.room.maxRoomBytes)}`;
}

function visibleFiles() {
  const q = state.filter.q.trim().toLowerCase();
  let files = state.files.filter((f) => (!q || f.name.toLowerCase().includes(q)) && (state.filter.status === "all" || f.status === state.filter.status));
  const by = {
    date: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
    name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
    size: (a, b) => b.size - a.size,
    uploader: (a, b) => (a.uploadedBy.email || "").localeCompare(b.uploadedBy.email || ""),
  }[state.filter.sort];
  return files.sort(by);
}

function renderFiles() {
  const host = document.getElementById("dr-files");
  if (!host) return;
  const files = visibleFiles();
  if (!state.files.length) {
    fill(host, el("p", { class: "muted dr-empty", text: "No files yet." }));
    return;
  }
  const groups = CATEGORY_ORDER.map((c) => [c, files.filter((f) => f.category === c)]).filter(([, fs]) => fs.length);
  fill(host, 
    ...groups.map(([, fs]) =>
      el(
        "section",
        { class: "dr-group" },
        el("div", { class: "dr-group-head" }, el("span", { class: "section-tab", text: fs[0].categoryLabel }), el("span", { class: "mono muted small", text: plural(fs.length, "file") })),
        el(
          "table",
          { class: "dr-table dr-files-table" },
          el(
            "thead",
            {},
            el("tr", {}, ["Name", "Size", "Uploaded by", "Uploaded", "Status", "Read by AURA", ""].map((h) => el("th", { text: h })))
          ),
          el("tbody", {}, fs.map(fileRow))
        )
      )
    ),
    files.length ? null : el("p", { class: "muted", text: "No files match." })
  );
}

function fileRow(f) {
  const statusText = f.status === "blocked" ? BLOCKED_TEXT[f.blockedReason] || "Blocked" : f.scanDelayed ? "Scan delayed; still checking…" : STATUS_TEXT[f.status];
  const status = el(
    "td",
    {},
    el("span", { class: `dr-status ${f.status}`, title: f.status === "scanning" ? "Checking for malware. It can be downloaded once the scan is clean." : null, text: statusText }),
    f.typeCheck === "mismatch" ? el("div", { class: "small warn-text", text: `Contents don't look like a .${f.extension} file` }) : null
  );
  const mine = f.uploadedBy.id === state.user.id;
  const canDelete = state.room.role === "manager" || (state.room.role === "contributor" && mine);
  const actions = el(
    "td",
    { class: "dr-actions" },
    f.status === "clean" ? el("button", { class: "btn ghost small", type: "button", text: "Download", onclick: () => download(f) }) : null,
    canDelete && f.status !== "uploading" ? el("button", { class: "btn link small danger", type: "button", text: "Delete", onclick: () => removeFile(f) }) : null
  );
  return el(
    "tr",
    {},
    el("td", { class: "dr-name" }, el("span", { text: f.name })),
    el("td", { class: "mono", text: fmtBytes(f.size) }),
    el("td", { text: f.uploadedBy.name || f.uploadedBy.email || "--" }),
    el("td", { class: "mono small", text: fmtWhen(f.uploadedAt || f.createdAt) }),
    status,
    el("td", { class: "small", text: f.readableByAura ? READ_TEXT[f.readStatus] || f.readStatus : "Not readable yet" }),
    actions
  );
}

async function download(f) {
  try {
    const { url } = await dr(`/api/dataroom/rooms/${state.room.id}/files/${f.id}/download-url`, { method: "POST", body: {} });
    // The URL lives 60 seconds and says "attachment", so this saves rather than navigates.
    const a = el("a", { href: url, rel: "noopener" });
    document.body.append(a);
    a.click();
    a.remove();
  } catch (err) {
    toast(err.message, "bad");
  }
}

async function removeFile(f) {
  if (!confirm(`Delete "${f.name}"? It is removed from storage and can't be recovered. The audit log keeps a record that it existed.`)) return;
  try {
    await dr(`/api/dataroom/rooms/${state.room.id}/files/${f.id}`, { method: "DELETE" });
    toast(`Deleted ${f.name}`);
    await refreshFiles();
  } catch (err) {
    toast(err.message, "bad");
  }
}

// ---------------------------------------------------------------- uploads

async function startUploads(files) {
  for (const file of files) {
    // Sequential: one presign and one POST at a time keeps a 40-file drop from tripping the
    // API's S3 slots, and a failure names the file it belongs to.
    await uploadOne(file);
  }
  await refreshFiles();
}

async function uploadOne(file) {
  const roomId = state.room.id;
  let started;
  try {
    started = await dr(`/api/dataroom/rooms/${roomId}/files`, { method: "POST", body: { name: file.name, size: file.size } });
  } catch (err) {
    toast(`${file.name}: ${err.message}`, "bad");
    if (err instanceof ApiError && err.code === "nda_required") renderRoom();
    return;
  }
  const id = started.file.id;
  state.uploads.set(id, { name: file.name, loaded: 0, total: file.size });
  renderUploads();
  try {
    await postToS3(started.upload, file, (loaded) => {
      state.uploads.get(id).loaded = loaded;
      renderUploads();
    });
    await dr(`/api/dataroom/rooms/${roomId}/files/${id}/complete`, { method: "POST", body: {} });
    state.uploads.delete(id);
  } catch (err) {
    state.uploads.get(id).error = err.message || "upload failed";
  }
  renderUploads();
}

function postToS3(upload, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
    form.append("file", file); // S3 requires the file to be the last field
    const xhr = new XMLHttpRequest();
    xhr.open("POST", upload.url);
    xhr.upload.addEventListener("progress", (e) => e.lengthComputable && onProgress(e.loaded));
    xhr.addEventListener("load", () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage refused the upload (${xhr.status})`))));
    xhr.addEventListener("error", () => reject(new Error("network error during upload")));
    xhr.send(form);
  });
}

function renderUploads() {
  const host = document.getElementById("dr-uploads");
  if (!host) return;
  fill(host, 
    ...[...state.uploads.entries()].map(([id, u]) =>
      el(
        "div",
        { class: `dr-upload ${u.error ? "bad" : ""}` },
        el("span", { class: "dr-name", text: u.name }),
        u.error
          ? el("span", { class: "small", text: u.error })
          : el("progress", { max: u.total, value: u.loaded }),
        u.error ? el("button", { class: "btn link small", type: "button", text: "Dismiss", onclick: () => (state.uploads.delete(id), renderUploads()) }) : null
      )
    )
  );
}

// ---------------------------------------------------------------- manager tools

function managerPanel() {
  const panels = { people: el("div"), nda: el("div"), audit: el("div"), danger: el("div") };
  const tabs = [
    ["people", "People"],
    ["nda", "NDA"],
    ["audit", "Audit log"],
    ["danger", "Delete room"],
  ];
  const head = el("div", { class: "tab-header dr-tabs" });
  const body = el("div", { class: "dr-manager-body" });
  const show = async (key) => {
    head.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.key === key));
    fill(body, panels[key]);
    await { people: renderPeople, nda: renderNda, audit: renderAudit, danger: renderDanger }[key](panels[key]);
  };
  tabs.forEach(([key, label]) => head.append(el("button", { class: "tab-btn", type: "button", dataset: { key }, text: label, onclick: () => show(key) })));
  const card = panel("Manage this room", head, body);
  card.classList.add("dr-manager");
  setTimeout(() => show("people"));
  return card;
}

async function renderPeople(host) {
  const { members, invites } = await dr(`/api/dataroom/rooms/${state.room.id}/members`);
  const linkBox = el("div", { class: "dr-invite-link", hidden: true });
  const form = el(
    "form",
    { class: "dr-inline-form" },
    el("input", { class: "input", type: "email", name: "email", required: true, placeholder: "name@client.com" }),
    el(
      "select",
      { class: "input", name: "role" },
      el("option", { value: "contributor", text: "Contributor (upload + download)" }),
      el("option", { value: "viewer", text: "Viewer (download only)" })
    ),
    el("button", { class: "btn primary", type: "submit", text: "Create invite link" })
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      const { invite } = await dr(`/api/dataroom/rooms/${state.room.id}/invites`, { method: "POST", body: { email: f.get("email"), role: f.get("role") } });
      const input = el("input", { class: "input mono", readonly: true, value: invite.inviteUrl });
      fill(linkBox, 
        el("strong", { text: `Invite for ${invite.email} (${invite.role})` }),
        el("p", { class: "small muted", text: `Shown once. Send it to them yourself; it works once and expires ${fmtWhen(invite.expiresAt)}.` }),
        input,
        el("button", { class: "btn ghost small", type: "button", text: "Copy", onclick: () => navigator.clipboard.writeText(invite.inviteUrl).then(() => toast("Copied")) })
      );
      linkBox.hidden = false;
      form.reset();
      renderList();
    } catch (err) {
      toast(err.message, "bad");
    }
  });

  const listHost = el("div");
  const renderList = async () => {
    const fresh = await dr(`/api/dataroom/rooms/${state.room.id}/members`);
    draw(fresh.members, fresh.invites);
  };
  const draw = (ms, invs) => {
    fill(listHost, 
      el("div", { class: "dr-subhead", text: "Members" }),
      el(
        "table",
        { class: "dr-table" },
        el("tbody", {}, ms.map((m) =>
          el(
            "tr",
            {},
            el("td", { text: m.name || "--" }),
            el("td", { text: m.email || "--" }),
            el("td", { text: m.role }),
            el(
              "td",
              { class: "dr-actions" },
              m.userId === state.user.id
                ? el("span", { class: "muted small", text: "you" })
                : el("button", {
                    class: "btn link small danger",
                    type: "button",
                    text: "Remove",
                    onclick: async () => {
                      if (!confirm(`Remove ${m.email} from this room?`)) return;
                      try {
                        await dr(`/api/dataroom/rooms/${state.room.id}/members/${m.userId}`, { method: "DELETE" });
                        renderList();
                      } catch (err) {
                        toast(err.message, "bad");
                      }
                    },
                  })
            )
          )
        ))
      ),
      el("div", { class: "dr-subhead", text: "Invites" }),
      invs.length
        ? el(
            "table",
            { class: "dr-table" },
            el("tbody", {}, invs.map((i) =>
              el(
                "tr",
                {},
                el("td", { text: i.email }),
                el("td", { text: i.role }),
                el("td", { text: i.state }),
                el("td", { class: "mono small", text: `expires ${fmtWhen(i.expiresAt)}` }),
                el(
                  "td",
                  { class: "dr-actions" },
                  i.state === "pending"
                    ? el("button", {
                        class: "btn link small danger",
                        type: "button",
                        text: "Revoke",
                        onclick: async () => {
                          await dr(`/api/dataroom/rooms/${state.room.id}/invites/${i.id}`, { method: "DELETE" });
                          renderList();
                        },
                      })
                    : null
                )
              )
            ))
          )
        : el("p", { class: "muted small", text: "No invites yet." })
    );
  };
  draw(members, invites);
  const domains = state.room.allowedEmailDomains;
  fill(host, 
    el("p", { class: "muted small", text: domains.length ? `Invites are limited to ${domains.map((d) => "@" + d).join(", ")} addresses.` : "Any email address can be invited." }),
    form,
    linkBox,
    listHost
  );
}

async function renderNda(host) {
  const r = state.room;
  const pdfs = state.files.filter((f) => f.status === "clean");
  const form = el(
    "form",
    { class: "form" },
    el("p", { class: "muted small", text: "Record the NDA's status as it stands between the parties. AURA stores this and the signed copy; it doesn't read or interpret the agreement." }),
    el(
      "div",
      {},
      el("label", { text: "Status" }),
      el(
        "select",
        { class: "input", name: "status" },
        [
          ["none", "Not recorded"],
          ["sent", "Sent, awaiting signature"],
          ["signed", "Signed and in place"],
        ].map(([v, t]) => el("option", { value: v, selected: r.nda.status === v || undefined, text: t }))
      )
    ),
    el(
      "div",
      {},
      el("label", { text: "Signed copy (a file in this room)" }),
      el(
        "select",
        { class: "input", name: "fileId" },
        el("option", { value: "", text: "None" }),
        pdfs.map((f) => el("option", { value: f.id, selected: r.nda.fileId === f.id || undefined, text: f.name }))
      )
    ),
    el("div", {}, el("label", { text: "Note (optional)" }), el("input", { class: "input", name: "note", maxlength: 500, value: r.nda.note || "" })),
    el(
      "label",
      { class: "dr-check" },
      el("input", { type: "checkbox", name: "uploadsNeedNda", checked: r.uploadsNeedNda || undefined }),
      " Guests can upload only once the NDA is signed"
    ),
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit", text: "Save NDA status" }))
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      const { room } = await dr(`/api/dataroom/rooms/${r.id}/nda`, {
        method: "POST",
        body: { status: f.get("status"), fileId: f.get("fileId") || null, note: f.get("note") || null, uploadsNeedNda: f.get("uploadsNeedNda") === "on" },
      });
      state.room = room;
      toast("NDA status saved");
      renderRoom();
      await refreshFiles();
    } catch (err) {
      toast(err.message, "bad");
    }
  });
  fill(host, form);
}

async function renderAudit(host) {
  const { events } = await dr(`/api/dataroom/rooms/${state.room.id}/audit?limit=500`);
  const csv = el("button", {
    class: "btn ghost small",
    type: "button",
    text: "Download CSV",
    onclick: async () => {
      const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/dataroom/rooms/${state.room.id}/audit.csv`, { credentials: "include" });
      const blob = await res.blob();
      const a = el("a", { href: URL.createObjectURL(blob), download: `${state.room.name}-audit.csv` });
      document.body.append(a);
      a.click();
      a.remove();
    },
  });
  fill(host, 
    el("div", { class: "row" }, el("p", { class: "muted small", text: `${events.length} most recent events. Nothing in this log can be edited or deleted while the room exists.` }), csv),
    el(
      "div",
      { class: "dr-audit-wrap" },
      el(
        "table",
        { class: "dr-table" },
        el("thead", {}, el("tr", {}, ["When", "Who", "What", "File", "From"].map((h) => el("th", { text: h })))),
        el("tbody", {}, events.map((e) =>
          el(
            "tr",
            {},
            el("td", { class: "mono small", text: fmtWhen(e.at) }),
            el("td", { text: e.actorEmail || "AURA (automatic)" }),
            el("td", { text: describe(e) }),
            el("td", { text: e.fileName || "" }),
            el("td", { class: "mono small", text: e.ip || "" })
          )
        ))
      )
    )
  );
}

function describe(e) {
  const d = e.detail || {};
  switch (e.action) {
    case "file.scan_result":
      return `Malware scan: ${d.result}${d.typeCheck === "mismatch" ? " (contents don't match the extension)" : ""}`;
    case "file.upload_refused":
      return `Upload refused (${d.reason})`;
    case "invite.create":
      return `Invited ${d.email} as ${d.role}`;
    case "invite.refused":
      return `Invite refused: ${d.reason}`;
    case "member.remove":
      return `Removed ${d.email}`;
    case "nda.update":
      return `NDA status: ${d.status}`;
    default:
      return e.action.replace(".", ": ").replace(/_/g, " ");
  }
}

async function renderDanger(host) {
  const input = el("input", { class: "input", placeholder: state.room.name });
  const btn = el("button", { class: "btn danger-btn", type: "button", text: "Delete this room and every file in it", disabled: true });
  input.addEventListener("input", () => (btn.disabled = input.value !== state.room.name));
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const res = await dr(`/api/dataroom/rooms/${state.room.id}`, { method: "DELETE" });
      toast(`Room deleted; ${res.objectsDeleted} stored files purged.`);
      await loadRooms();
      renderRoomList();
    } catch (err) {
      toast(err.message, "bad");
      btn.disabled = false;
    }
  });
  fill(host, 
    el("p", { text: "Deleting the room purges every stored file immediately and removes everyone's access. It can't be undone. The audit log is kept as the record of what happened." }),
    el("label", { text: `Type the room name (${state.room.name}) to confirm` }),
    input,
    el("div", { class: "row" }, btn)
  );
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    fill(root(), el("div", { class: "dr-narrow" }, panel("Something went wrong", el("p", { class: "muted", text: err.message }))));
  });
});
