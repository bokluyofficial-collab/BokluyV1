import { supabase } from "../supabase/supabaseClient.js";

/**
 * Support Chat (GoDaddy-style)
 * - Regular users: single "ticket" conversation (auto-created)
 * - Owner: sees all customer conversations (sorted by latest message)
 * - Customer message triggers Telegram notify via Edge Function: support-hook
 *
 * NOTE:
 * - Room names use prefix "ticket_" to avoid blocked terms.
 * - Auto-reply is not required. (If you later re-enable it, do it server-side.)
 */

const OWNER_UID = "d7e7f252-321c-48b8-ba5c-e1c3ca12940c";
const ROOM_PREFIX = "ticket_";
const SUPPORT_DISPLAY_NAME = "Bokluy Support";

// DOM (existing chat page)
const chatPageEl = document.getElementById("chatPage");
const roomsPanelEl = document.getElementById("chatRoomsPanel");
const roomsListEl = document.getElementById("chatRoomsList");
const newRoomNameEl = document.getElementById("newRoomName");
const createRoomBtn = document.getElementById("createRoomBtn");
const createRoomSectionEl = document.getElementById("createRoomSection");

const chatTitleEl = document.getElementById("chatTitle");
const chatStatusEl = document.getElementById("chatStatusText");
const chatOnlineIndicatorEl = document.getElementById("chatOnlineIndicator");

const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

const chatPageTitleEl = document.getElementById("chatPageTitle");
const chatPageSubtitleEl = document.getElementById("chatPageSubtitle");

let currentRoomId = null;
let currentRoomName = null;
let msgChannel = null;

let currentUserId = null;
let isOwner = false;

// Cache display names to avoid repeated queries
const nameCache = new Map();

// Owner inbox metadata
const roomMeta = new Map(); // roomId -> { lastAt, lastText, lastSender, unread }
const lastSeenKey = (roomId) => `bokluy_owner_last_seen_${roomId}`;

function safeModal(title, text, options = {}) {
  if (window.showActionModal) {
    window.showActionModal(title, text, options);
  } else {
    alert(`${title}\n\n${text}`);
  }
}

function shortId(id) {
  if (!id) return "User";
  return id.slice(0, 6);
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function clearMessages() {
  if (!chatMessagesEl) return;
  chatMessagesEl.innerHTML = "";
}

function appendSystemBubble(text) {
  if (!chatMessagesEl) return;

  const wrap = document.createElement("div");
  wrap.className = "chat-bubble system";

  const body = document.createElement("div");
  body.className = "bubble-text";
  body.textContent = text;

  wrap.appendChild(body);
  chatMessagesEl.appendChild(wrap);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (!session) {
    safeModal("Login required", "Please log in to use chat.", { autoCloseMs: 2000 });
    return null;
  }

  currentUserId = session.user.id;
  isOwner = currentUserId === OWNER_UID;
  return session;
}

async function warmNameCache(userIds) {
  const missing = Array.from(new Set(userIds)).filter((id) => id && !nameCache.has(id));
  if (!missing.length) return;

  missing.forEach((id) => nameCache.set(id, `User ${shortId(id)}`));

  // Try profiles_public first
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, display_name")
    .in("id", missing);

  if (!error && Array.isArray(data)) {
    data.forEach((r) => {
      if (r?.id) nameCache.set(r.id, r.display_name || `User ${shortId(r.id)}`);
    });
    return;
  }

  // Fallback: users table (if exposed)
  const { data: usersData, error: usersErr } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", missing);

  if (!usersErr && Array.isArray(usersData)) {
    usersData.forEach((r) => {
      if (r?.id) nameCache.set(r.id, r.display_name || `User ${shortId(r.id)}`);
    });
  }
}

function setHeaderForRoom(roomName) {
  if (!chatTitleEl) return;

  if (isOwner) {
    const uid = roomName?.startsWith(ROOM_PREFIX) ? roomName.slice(ROOM_PREFIX.length) : null;
    const label = uid ? (nameCache.get(uid) || `User ${shortId(uid)}`) : (roomName || "Conversation");
    chatTitleEl.textContent = `Conversation: ${label}`;
    if (chatStatusEl) chatStatusEl.textContent = "Support inbox";
    if (chatOnlineIndicatorEl) chatOnlineIndicatorEl.textContent = "🟢 Online";
  } else {
    chatTitleEl.textContent = `Chat with ${SUPPORT_DISPLAY_NAME}`;
    if (chatStatusEl) chatStatusEl.textContent = "Leave a message — you’ll get a reply soon.";
    if (chatOnlineIndicatorEl) chatOnlineIndicatorEl.textContent = "🟢 Online";
  }
}

function configureUiForRole() {
  if (!chatPageEl) return;

  if (!isOwner) {
    chatPageEl.classList.add("support-mode");
    if (roomsPanelEl) roomsPanelEl.style.display = "none";
    if (createRoomSectionEl) createRoomSectionEl.style.display = "none";

    if (chatPageTitleEl) chatPageTitleEl.textContent = "💬 Support Chat";
    if (chatPageSubtitleEl) chatPageSubtitleEl.textContent = "Message us — we’ll respond as soon as possible.";
  } else {
    chatPageEl.classList.remove("support-mode");
    if (roomsPanelEl) roomsPanelEl.style.display = "";
    if (createRoomSectionEl) createRoomSectionEl.style.display = "";
    if (chatPageTitleEl) chatPageTitleEl.textContent = "💬 Support Inbox";
    if (chatPageSubtitleEl) chatPageSubtitleEl.textContent = "All customer conversations";
  }
}

async function ensureTicketRoom(userId) {
  const roomName = `${ROOM_PREFIX}${userId}`;

  const { data: existing, error: selectErr } = await supabase
    .from("chat_rooms")
    .select("id, name")
    .eq("name", roomName)
    .limit(1);

  if (!selectErr && existing?.length) return existing[0];

  const { data: inserted, error: insertErr } = await supabase
    .from("chat_rooms")
    .insert({ name: roomName, created_by: userId })
    .select("id, name")
    .single();

  if (insertErr) {
    console.error("ensureTicketRoom insert error:", insertErr);
    safeModal("Error", insertErr.message || "Failed to create support chat.", { autoCloseMs: 2500 });
    return null;
  }
  return inserted;
}

async function computeOwnerRoomMeta(rooms) {
  roomMeta.clear();
  if (!rooms?.length) return;

  const roomIds = rooms.map((r) => r.id);

  // Pull recent messages (fast path). If you ever have thousands of messages,
  // replace this with a view/RPC for last_message per room.
  const { data: msgs, error } = await supabase
    .from("chat_messages")
    .select("room_id, user_id, message, created_at")
    .in("room_id", roomIds)
    .order("created_at", { ascending: false })
    .limit(800);

  if (error) {
    console.warn("computeOwnerRoomMeta error:", error);
    return;
  }

  for (const m of (msgs || [])) {
    if (!roomMeta.has(m.room_id)) {
      const lastAt = m.created_at;
      const lastText = (m.message || "").slice(0, 70);
      const lastSender = m.user_id;
      const lastSeen = Number(localStorage.getItem(lastSeenKey(m.room_id)) || "0");
      const lastAtMs = new Date(lastAt).getTime();
      const unread = (lastSender !== OWNER_UID) && (lastAtMs > lastSeen);
      roomMeta.set(m.room_id, { lastAt, lastText, lastSender, unread });
    }
  }
}

function renderRoomsOwner(rooms) {
  if (!roomsListEl) return;
  roomsListEl.innerHTML = "";

  rooms.forEach((room) => {
    const uid = (room?.name || "").startsWith(ROOM_PREFIX) ? room.name.slice(ROOM_PREFIX.length) : null;
    const label = uid ? (nameCache.get(uid) || `User ${shortId(uid)}`) : (room?.name || "Conversation");

    const meta = roomMeta.get(room.id);
    const preview = meta?.lastText ? meta.lastText : "No messages yet";
    const time = meta?.lastAt ? formatTime(meta.lastAt) : "";
    const unread = !!meta?.unread;

    const btn = document.createElement("button");
    btn.className = "room-item";
    btn.type = "button";
    btn.dataset.roomId = room.id;
    btn.dataset.roomName = room.name;

    btn.innerHTML = `
      <div class="room-line">
        <span class="room-name">${label}</span>
        ${unread ? '<span class="room-badge">•</span>' : ''}
      </div>
      <div class="room-sub">
        <span class="room-preview">${preview}</span>
        <span class="room-time">${time}</span>
      </div>
    `;

    if (room.id === currentRoomId) btn.classList.add("active");

    btn.addEventListener("click", async () => {
      await selectRoom(room.id, room.name);
      [...roomsListEl.querySelectorAll(".room-item")].forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });

    roomsListEl.appendChild(btn);
  });
}

function unsubscribeRoom() {
  if (msgChannel) {
    supabase.removeChannel(msgChannel);
    msgChannel = null;
  }
}

function subscribeToRoom(roomId) {
  unsubscribeRoom();

  msgChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const m = payload.new;
        await warmNameCache([m.user_id]);
        appendMessage(m);
        if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

        // update owner room meta live (badge)
        if (isOwner) {
          const lastSeen = Number(localStorage.getItem(lastSeenKey(roomId)) || "0");
          const lastAtMs = new Date(m.created_at).getTime();
          const unread = (m.user_id !== OWNER_UID) && (lastAtMs > lastSeen);
          roomMeta.set(roomId, {
            lastAt: m.created_at,
            lastText: (m.message || "").slice(0, 70),
            lastSender: m.user_id,
            unread
          });

          // refresh room list text without requerying everything
          const btn = roomsListEl?.querySelector(`.room-item[data-room-id="${roomId}"]`);
          if (btn) {
            const timeEl = btn.querySelector(".room-time");
            const prevEl = btn.querySelector(".room-preview");
            if (timeEl) timeEl.textContent = formatTime(m.created_at);
            if (prevEl) prevEl.textContent = (m.message || "").slice(0, 70);

            const badge = btn.querySelector(".room-badge");
            if (unread && !badge) {
              const nameLine = btn.querySelector(".room-line");
              if (nameLine) {
                const b = document.createElement("span");
                b.className = "room-badge";
                b.textContent = "•";
                nameLine.appendChild(b);
              }
            }
            if (!unread && badge) badge.remove();
          }
        }
      }
    )
    .subscribe();
}

async function loadMessages(roomId) {
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, room_id, user_id, message, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error(error);
    clearMessages();
    appendSystemBubble("Failed to load messages.");
    return [];
  }

  const ids = (messages || []).map((m) => m.user_id).filter(Boolean);
  await warmNameCache(ids);
  return messages || [];
}

function renderMessages(messages) {
  if (!chatMessagesEl) return;

  chatMessagesEl.innerHTML = "";

  if (!messages.length) {
    appendSystemBubble(
      isOwner
        ? "No messages yet in this conversation."
        : "Hi — leave a message and we’ll reply as soon as possible."
    );
    return;
  }

  messages.forEach(appendMessage);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function appendMessage(m) {
  if (!chatMessagesEl) return;

  const mine = m.user_id === currentUserId;

  let bubbleClass = "";
  if (isOwner) {
    bubbleClass = mine ? "mine" : "";
  } else {
    bubbleClass = mine ? "mine" : (m.user_id === OWNER_UID ? "support" : "");
  }

  const wrap = document.createElement("div");
  wrap.className = `chat-bubble ${bubbleClass}`.trim();

  const meta = document.createElement("div");
  meta.className = "bubble-meta";

  const name = document.createElement("span");
  if (isOwner) {
    name.textContent = mine ? "You" : (nameCache.get(m.user_id) || `User ${shortId(m.user_id)}`);
  } else {
    name.textContent = mine ? "You" : SUPPORT_DISPLAY_NAME;
  }

  const time = document.createElement("span");
  time.textContent = formatTime(m.created_at);

  meta.appendChild(name);
  meta.appendChild(time);

  const body = document.createElement("div");
  body.className = "bubble-text";
  body.textContent = m.message;

  wrap.appendChild(meta);
  wrap.appendChild(body);

  chatMessagesEl.appendChild(wrap);
}

async function selectRoom(roomId, roomName) {
  currentRoomId = roomId;
  currentRoomName = roomName;

  if (isOwner) {
    // mark as seen
    localStorage.setItem(lastSeenKey(roomId), String(Date.now()));
    const meta = roomMeta.get(roomId);
    if (meta) {
      meta.unread = false;
      roomMeta.set(roomId, meta);
      const btn = roomsListEl?.querySelector(`.room-item[data-room-id="${roomId}"]`);
      btn?.querySelector(".room-badge")?.remove();
    }
  }

  // Warm cache for header
  if (isOwner && roomName?.startsWith(ROOM_PREFIX)) {
    const uid = roomName.slice(ROOM_PREFIX.length);
    await warmNameCache([uid]);
  }

  setHeaderForRoom(roomName);

  const messages = await loadMessages(roomId);
  renderMessages(messages);

  subscribeToRoom(roomId);
}

async function loadRooms() {
  const session = await requireSession();
  if (!session) return;

  configureUiForRole();

  if (isOwner) {
    const { data: rooms, error } = await supabase
      .from("chat_rooms")
      .select("id, name, created_at")
      .like("name", `${ROOM_PREFIX}%`);

    if (error) {
      console.error(error);
      clearMessages();
      appendSystemBubble("Failed to load conversations.");
      return;
    }

    const uids = (rooms || [])
      .map((r) => (r?.name || "").startsWith(ROOM_PREFIX) ? r.name.slice(ROOM_PREFIX.length) : null)
      .filter(Boolean);

    await warmNameCache(uids);
    await computeOwnerRoomMeta(rooms || []);

    // sort by latest message time (fallback to created_at)
    const sorted = (rooms || []).slice().sort((a, b) => {
      const aMeta = roomMeta.get(a.id);
      const bMeta = roomMeta.get(b.id);
      const aT = aMeta?.lastAt ? new Date(aMeta.lastAt).getTime() : new Date(a.created_at).getTime();
      const bT = bMeta?.lastAt ? new Date(bMeta.lastAt).getTime() : new Date(b.created_at).getTime();
      return bT - aT;
    });

    renderRoomsOwner(sorted);

    if (!currentRoomId && sorted.length) {
      await selectRoom(sorted[0].id, sorted[0].name);
    } else if (!sorted.length) {
      clearMessages();
      appendSystemBubble("No conversations yet.");
    }
  } else {
    const room = await ensureTicketRoom(session.user.id);
    if (!room) return;

    if (roomsListEl) roomsListEl.innerHTML = "";
    await selectRoom(room.id, room.name);
  }
}

async function createRoom() {
  const session = await requireSession();
  if (!session) return;

  if (!isOwner) {
    safeModal("Not allowed", "Only the owner can create rooms.", { autoCloseMs: 1800 });
    return;
  }

  const name = (newRoomNameEl?.value || "").trim();
  if (!name) return;

  const { data: inserted, error } = await supabase
    .from("chat_rooms")
    .insert({ name, created_by: session.user.id })
    .select("id, name")
    .single();

  if (error) {
    console.error(error);
    safeModal("Error", error.message, { autoCloseMs: 2500 });
    return;
  }

  if (newRoomNameEl) newRoomNameEl.value = "";
  await loadRooms();
  await selectRoom(inserted.id, inserted.name);
}

async function sendMessage() {
  const session = await requireSession();
  if (!session) return;
  if (!currentRoomId) return;

  const text = (chatInputEl?.value || "").trim();
  if (!text) return;

  if (sendChatBtn) sendChatBtn.disabled = true;
  if (chatInputEl) chatInputEl.value = "";

  const { error } = await supabase.from("chat_messages").insert({
    room_id: currentRoomId,
    user_id: session.user.id,
    message: text,
  });

  if (sendChatBtn) setTimeout(() => (sendChatBtn.disabled = false), 600);

  if (error) {
    console.error(error);
    safeModal("Error", error.message, { autoCloseMs: 0 });
    return;
  }

  // Notify Telegram for customer messages
  if (!isOwner) {
    const { data, error: fnErr } = await supabase.functions.invoke("support-hook", {
      body: {
        room_id: currentRoomId,
        room_name: currentRoomName,
        message: text,
      },
    });

    if (fnErr) {
      console.error("support-hook invoke error:", fnErr);
      // keep non-blocking but visible
      safeModal("Telegram notify failed", String(fnErr.message || fnErr), { autoCloseMs: 0 });
    } else {
      console.log("support-hook ok:", data);
    }
  }
}

// Wire UI
createRoomBtn?.addEventListener("click", createRoom);
sendChatBtn?.addEventListener("click", sendMessage);
chatInputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});



// Only load chats when the Chat page is shown (reduces background work)
document.addEventListener("page:show", (e) => {
  const pageId = e?.detail?.pageId;
  if (pageId === "chatPage") loadRooms();
});

/**
 * Allow other pages to open/select a room by name.
 * - For regular users, always opens their own ticket room.
 * - For owner, can open a specific room by name.
 */
window.openChatRoomByName = async (roomName) => {
  const session = await requireSession();
  if (!session) return;

  if (!isOwner) {
    const room = await ensureTicketRoom(session.user.id);
    if (room) await selectRoom(room.id, room.name);
    return;
  }

  await loadRooms();

  const btn = roomsListEl?.querySelector(`.room-item[data-room-name="${roomName}"]`);
  if (btn) {
    const rid = btn.dataset.roomId;
    const rname = btn.dataset.roomName;
    if (rid && rname) await selectRoom(rid, rname);
  } else {
    appendSystemBubble("Conversation not found.");
  }
};

// Cleanup
window.addEventListener("beforeunload", () => {
  unsubscribeRoom();
});
