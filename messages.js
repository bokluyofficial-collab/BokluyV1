import { supabase } from "./supabase/supabaseClient.js";

const els = {
  statusCard: document.getElementById("statusCard"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  logoutBtn: document.getElementById("logoutBtn"),

  refreshRoomsBtn: document.getElementById("refreshRoomsBtn"),
  roomsList: document.getElementById("roomsList"),

  chatTitle: document.getElementById("chatTitle"),
  chatSubtitle: document.getElementById("chatSubtitle"),
  messagesThread: document.getElementById("messagesThread"),

  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("messageInput"),
  sendMessageBtn: document.getElementById("sendMessageBtn"),
};

const state = {
  session: null,
  currentUserId: null,
  rooms: [],
  activeRoom: null,
  activeOtherUserId: null,
  realtimeChannel: null,
  nameCache: new Map(),
};

function setStatus(message, isError = false) {
  if (!els.statusCard) return;
  els.statusCard.textContent = message;
  els.statusCard.className = `status-card${isError ? " is-error" : ""}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortId(id) {
  return String(id || "").slice(0, 8);
}

function getOtherUserId(room, currentUserId) {
  if (!room) return null;
  return room.user_a_id === currentUserId ? room.user_b_id : room.user_a_id;
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setStatus(error.message || "Failed to read session.", true);
    return null;
  }

  const session = data.session;
  if (!session?.user?.id) {
    window.location.href = "./auth.html";
    return null;
  }

  state.session = session;
  state.currentUserId = session.user.id;

  const displayName =
    session.user.user_metadata?.display_name ||
    session.user.user_metadata?.full_name ||
    session.user.email ||
    "User";

  state.nameCache.set(session.user.id, displayName);

  if (els.userName) els.userName.textContent = displayName;
  if (els.userAvatar) els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();

  return session;
}

async function warmNameCache(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))].filter((id) => !state.nameCache.has(id));
  if (!ids.length) return;

  ids.forEach((id) => state.nameCache.set(id, `User ${shortId(id)}`));

  const { data: sellerRows } = await supabase
    .from("seller_profiles_public")
    .select("user_id, store_name")
    .in("user_id", ids);

  (sellerRows || []).forEach((row) => {
    if (row?.user_id) {
      state.nameCache.set(row.user_id, row.store_name || `User ${shortId(row.user_id)}`);
    }
  });
}

async function loadRooms() {
  const userId = state.currentUserId;

  const { data, error } = await supabase
    .from("chat_rooms")
    .select("id, name, created_at, created_by, user_a_id, user_b_id, last_message_at")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  state.rooms = data || [];

  const otherIds = state.rooms
    .map((room) => getOtherUserId(room, userId))
    .filter(Boolean);

  await warmNameCache(otherIds);
  renderRooms();
}

function renderRooms() {
  if (!els.roomsList) return;

  if (!state.rooms.length) {
    els.roomsList.innerHTML = `<div class="empty-state">No conversations yet.</div>`;
    return;
  }

  els.roomsList.innerHTML = state.rooms
    .map((room) => {
      const otherId = getOtherUserId(room, state.currentUserId);
      const label = state.nameCache.get(otherId) || `User ${shortId(otherId)}`;
      const active = state.activeRoom === room.id ? " is-active" : "";

      return `
        <button class="room-item${active}" type="button" data-room-id="${escapeHtml(room.id)}">
          <div class="room-name">${escapeHtml(label)}</div>
          <div class="room-meta">${escapeHtml(formatDate(room.last_message_at || room.created_at))}</div>
        </button>
      `;
    })
    .join("");
}

function renderMessages(rows) {
  if (!els.messagesThread) return;

  if (!rows.length) {
    els.messagesThread.innerHTML = `<div class="empty-state">No messages yet. Start the conversation.</div>`;
    return;
  }

  els.messagesThread.innerHTML = rows
    .map((msg) => {
      const mine = msg.user_id === state.currentUserId;
      const who = mine ? "You" : (state.nameCache.get(msg.user_id) || `User ${shortId(msg.user_id)}`);

      return `
        <div class="message-bubble ${mine ? "mine" : "other"}">
          <div class="message-text">${escapeHtml(msg.message || "")}</div>
          <div class="message-meta">${escapeHtml(who)} • ${escapeHtml(formatDate(msg.created_at))}</div>
        </div>
      `;
    })
    .join("");

  els.messagesThread.scrollTop = els.messagesThread.scrollHeight;
}

async function loadMessages(roomId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, room_id, user_id, message, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  await warmNameCache((data || []).map((x) => x.user_id));
  renderMessages(data || []);
}

function unsubscribeRoom() {
  if (state.realtimeChannel) {
    try {
      supabase.removeChannel(state.realtimeChannel);
    } catch {}
    state.realtimeChannel = null;
  }
}

function subscribeRoom(roomId) {
  unsubscribeRoom();

  state.realtimeChannel = supabase
    .channel(`messages-room-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        await loadMessages(roomId);
        await loadRooms();
      }
    )
    .subscribe();
}

async function openRoom(roomId) {
  const room = state.rooms.find((x) => x.id === roomId);
  if (!room) return;

  state.activeRoom = room.id;
  state.activeOtherUserId = getOtherUserId(room, state.currentUserId);

  await warmNameCache([state.activeOtherUserId]);

  const label = state.nameCache.get(state.activeOtherUserId) || `User ${shortId(state.activeOtherUserId)}`;
  if (els.chatTitle) els.chatTitle.textContent = label;
  if (els.chatSubtitle) els.chatSubtitle.textContent = "Direct message";

  renderRooms();
  await loadMessages(room.id);
  subscribeRoom(room.id);
}

async function sendMessage(event) {
  event.preventDefault();

  if (!state.activeRoom) {
    setStatus("Select a conversation first.", true);
    return;
  }

  const text = (els.messageInput?.value || "").trim();
  if (!text) return;

  els.sendMessageBtn.disabled = true;

  const { error } = await supabase
    .from("chat_messages")
    .insert({
      room_id: state.activeRoom,
      user_id: state.currentUserId,
      message: text,
    });

  els.sendMessageBtn.disabled = false;

  if (error) {
    console.error(error);
    setStatus(error.message || "Failed to send message.", true);
    return;
  }

  els.messageInput.value = "";
  await loadMessages(state.activeRoom);
  await loadRooms();
}

function getRoomIdFromQuery() {
  const url = new URL(window.location.href);
  return url.searchParams.get("room_id");
}

async function openRoomFromQueryIfAny() {
  const targetRoomId = getRoomIdFromQuery();
  if (!targetRoomId) return;

  const found = state.rooms.find((room) => String(room.id) === String(targetRoomId));
  if (found) {
    await openRoom(found.id);
  }
}

function bindEvents() {
  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.href = "./auth.html?logged_out=1";
  });

  els.refreshRoomsBtn?.addEventListener("click", async () => {
    await loadRooms();
    await openRoomFromQueryIfAny();
  });

  els.roomsList?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-room-id]");
    if (!btn) return;
    await openRoom(btn.dataset.roomId);
  });

  els.messageForm?.addEventListener("submit", sendMessage);
}

async function init() {
  bindEvents();
  const session = await requireSession();
  if (!session) return;

  setStatus("Loading messages...");
  await loadRooms();
  await openRoomFromQueryIfAny();
  setStatus("Messages ready.");
}

window.addEventListener("beforeunload", unsubscribeRoom);

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected messages error.", true);
});