import { supabase } from "../supabase/supabaseClient.js";

/**
 * Floating Support Chat Widget (GoDaddy-style)
 * - Regular users: opens their ticket room (ticket_<uid>)
 * - Owner: button sends you to full inbox (chatPage)
 * - Telegram notify: calls Edge Function support-hook after sending
 */

const OWNER_UID = "d7e7f252-321c-48b8-ba5c-e1c3ca12940c";
const ROOM_PREFIX = "ticket_";

const fab = document.getElementById("chatWidgetFab");
const badge = document.getElementById("chatWidgetBadge");
const panel = document.getElementById("chatWidget");
const closeBtn = document.getElementById("chatWidgetClose");
const titleEl = document.getElementById("chatWidgetTitle");
const statusEl = document.getElementById("chatWidgetStatus");
const messagesEl = document.getElementById("chatWidgetMessages");
const inputEl = document.getElementById("chatWidgetInput");
const sendBtn = document.getElementById("chatWidgetSend");

let open = false;
let currentUserId = null;
let isOwner = false;
let roomId = null;
let roomName = null;
let channel = null;

let unread = 0;

function setBadge(n) {
  unread = Math.max(0, n);
  if (!badge) return;
  if (unread <= 0) {
    badge.style.display = "none";
    badge.textContent = "";
  } else {
    badge.style.display = "inline-flex";
    badge.textContent = String(unread);
  }
}

function showSystem(text) {
  if (!messagesEl) return;
  const div = document.createElement("div");
  div.className = "cw-bubble system";
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showMessage({ mine, support, text, time }) {
  if (!messagesEl) return;
  const wrap = document.createElement("div");
  wrap.className = `cw-bubble ${mine ? "mine" : (support ? "support" : "")}`.trim();

  const meta = document.createElement("div");
  meta.className = "cw-meta";
  meta.textContent = time || "";

  const body = document.createElement("div");
  body.className = "cw-text";
  body.textContent = text;

  wrap.appendChild(meta);
  wrap.appendChild(body);

  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cleanupChannel() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

async function ensureTicketRoom(uid) {
  const name = `${ROOM_PREFIX}${uid}`;

  const { data: existing, error: selErr } = await supabase
    .from("chat_rooms")
    .select("id, name")
    .eq("name", name)
    .limit(1);

  if (!selErr && existing?.length) return existing[0];

  const { data: inserted, error: insErr } = await supabase
    .from("chat_rooms")
    .insert({ name, created_by: uid })
    .select("id, name")
    .single();

  if (insErr) {
    console.error(insErr);
    showSystem("Could not start chat (database error).");
    return null;
  }
  return inserted;
}

async function loadMessages() {
  if (!roomId) return;
  messagesEl.innerHTML = "";

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, user_id, message, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error(error);
    showSystem("Failed to load messages.");
    return;
  }

  if (!data?.length) {
    showSystem("Hi — leave a message and we’ll reply soon.");
    return;
  }

  for (const m of data) {
    showMessage({
      mine: m.user_id === currentUserId,
      support: m.user_id === OWNER_UID,
      text: m.message,
      time: formatTime(m.created_at),
    });
  }
}

function subscribe() {
  cleanupChannel();
  if (!roomId) return;

  channel = supabase
    .channel(`widget-room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const m = payload.new;
        const mine = m.user_id === currentUserId;
        const support = m.user_id === OWNER_UID;

        if (!open && !mine) setBadge(unread + 1);

        showMessage({
          mine,
          support,
          text: m.message,
          time: formatTime(m.created_at),
        });
      }
    )
    .subscribe();
}

async function openWidget() {
  open = true;
  panel?.classList.remove("hidden");
  setBadge(0);

  const session = await getSession();
  if (!session) {
    titleEl.textContent = "Support Chat";
    statusEl.textContent = "Login required";
    messagesEl.innerHTML = "";
    showSystem("Please log in to start chatting.");
    showSystem("Click Login in the top menu, then open chat again.");
    inputEl.disabled = true;
    sendBtn.disabled = true;
    return;
  }

  currentUserId = session.user.id;
  isOwner = currentUserId === OWNER_UID;

  if (isOwner) {
    // Owner uses the full inbox page
    panel?.classList.add("hidden");
    open = false;
    window.showPage?.("chatPage");
    document.dispatchEvent(new CustomEvent("page:show", { detail: { pageId: "chatPage" } }));
    return;
  }

  titleEl.textContent = "Bokluy Support";
  statusEl.textContent = "We’ll reply as soon as possible.";

  inputEl.disabled = false;
  sendBtn.disabled = false;

  const room = await ensureTicketRoom(currentUserId);
  if (!room) return;

  roomId = room.id;
  roomName = room.name;

  await loadMessages();
  subscribe();
}

function closeWidget() {
  open = false;
  panel?.classList.add("hidden");
  setBadge(0);
}

async function send() {
  const session = await getSession();
  if (!session || !roomId) return;

  const text = (inputEl?.value || "").trim();
  if (!text) return;

  inputEl.value = "";
  sendBtn.disabled = true;

  const { error } = await supabase.from("chat_messages").insert({
    room_id: roomId,
    user_id: session.user.id,
    message: text,
  });

  setTimeout(() => (sendBtn.disabled = false), 500);

  if (error) {
    console.error(error);
    showSystem("Failed to send message.");
    return;
  }

  // Telegram notify (non-blocking)
  try {
    await supabase.functions.invoke("support-hook", {
      body: { room_name: roomName, message: text },
    });
  } catch (e) {
    console.warn("support-hook invoke failed:", e);
  }
}

fab?.addEventListener("click", () => (open ? closeWidget() : openWidget()));
closeBtn?.addEventListener("click", closeWidget);
sendBtn?.addEventListener("click", send);
inputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

document.addEventListener("DOMContentLoaded", () => {
  setBadge(0);

  // If auth state changes, close widget to avoid stale session UI
  supabase.auth.onAuthStateChange(() => {
    closeWidget();
  });
});

window.addEventListener("beforeunload", () => {
  cleanupChannel();
});
