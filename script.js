// ========================
// SUPABASE
// ========================
console.log("✅ script.js loaded");
import { supabase } from "./supabase/supabaseClient.js";

// ========================
// PERMISSION: owner OR allowlisted admin (public.admins)
// ========================
const OWNER_UID = "d7e7f252-321c-48b8-ba5c-e1c3ca12940c";

async function canAddListing() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  if (session.user.id === OWNER_UID) return true;

  const { data, error } = await supabase
    .from("admins")
    .select("uid")
    .eq("uid", session.user.id)
    .maybeSingle();

  return !error && !!data;
}

function isOwner(session) {
  return session?.user?.id === OWNER_UID;
}

// Robust local logout: if network signOut fails, still clear the local session
function clearSupabaseStorage() {
  try {
    const keys = Object.keys(localStorage || {});
    keys.forEach((k) => {
      if (k.startsWith("sb-") && k.includes("auth")) localStorage.removeItem(k);
    });
  } catch {}
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (!isFinite(s) || s < 0) return "";

  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(days / 365);
  return `${y}y ago`;
}

async function fetchDisplayNames(userIds) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, display_name")
    .in("id", unique);

  if (error) {
    console.warn("Could not load display names:", error.message);
    return new Map();
  }

  const map = new Map();
  (data || []).forEach((u) => map.set(u.id, u.display_name || "User"));
  return map;
}

function makeDMRoomName(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return `dm_${x}_${y}`;
}

// ========================
// STATE
// ========================
let allItems = [];
let currentUserId = null;
let editingListingId = null;

// ========================
// DOM ELEMENTS
// ========================
const marketplace = document.getElementById("listingsGrid");
const searchInput = document.getElementById("searchInput");
const gameSelect = document.getElementById("gameSelect");

// Listing form
const listingForm = document.getElementById("listingForm");
const listingGame = document.getElementById("listingGame");
const listingItem = document.getElementById("listingItem");
const listingType = document.getElementById("listingType");
const listingPrice = document.getElementById("listingPrice");
const listingQuantity = document.getElementById("listingQuantity");
const contactMethod = document.getElementById("contactMethod");
const discordUsername = document.getElementById("discordUsername");
const listingNotes = document.getElementById("listingNotes");
const autocompleteList = document.getElementById("autocompleteList");

// Filters
const filterType = document.getElementById("filterType");
const filterMinPrice = document.getElementById("filterMinPrice");
const filterMaxPrice = document.getElementById("filterMaxPrice");
const filterSort = document.getElementById("filterSort");

// ========================
// DATA
// ========================
const allProducts = [
  ...(window.bloxFruitsProducts || []),
  ...(window.animeLastStandProducts || []),
];

// ========================
// PAGE NAV
// ========================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(pageId)?.classList.add("active");
  window.scrollTo(0, 0);
}
window.showPage = showPage;

// ========================
// POPULATE GAME DROPDOWNS
// ========================
function populateGameDropdowns() {
  const games = [...new Set(allProducts.map((p) => p.game).filter(Boolean))].sort();

  if (gameSelect) {
    const hasAll = [...gameSelect.options].some((o) => o.value === "all");
    gameSelect.innerHTML = hasAll ? `<option value="all">All Games</option>` : "";
    games.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      gameSelect.appendChild(opt);
    });
  }

  if (listingGame) {
    listingGame.innerHTML = `<option value="">Choose a game...</option>`;
    games.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      listingGame.appendChild(opt);
    });
  }
}
populateGameDropdowns();

listingGame?.addEventListener("change", () => {
  if (listingItem) listingItem.value = "";
  if (autocompleteList) autocompleteList.innerHTML = "";
});

// ========================
// FILTERS
// ========================
function applyFilters() {
  let items = [...allItems];

  const q = (searchInput?.value || "").trim().toLowerCase();
  if (q) items = items.filter((i) => (i.name || "").toLowerCase().includes(q));

  const game = gameSelect?.value;
  if (game && game !== "all") items = items.filter((i) => i.game === game);

  const type = filterType?.value;
  if (type) items = items.filter((i) => i.type === type);

  const min = Number(filterMinPrice?.value);
  if (!Number.isNaN(min) && filterMinPrice?.value !== "") items = items.filter((i) => i.price >= min);

  const max = Number(filterMaxPrice?.value);
  if (!Number.isNaN(max) && filterMaxPrice?.value !== "") items = items.filter((i) => i.price <= max);

  const sort = filterSort?.value || "newest";
  if (sort === "priceLow") items.sort((a, b) => a.price - b.price);
  if (sort === "priceHigh") items.sort((a, b) => b.price - a.price);
  if (sort === "newest") items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  renderItems(items);
}

function resetFilters() {
  if (searchInput) searchInput.value = "";
  if (gameSelect) gameSelect.value = "all";
  if (filterType) filterType.value = "";
  if (filterMinPrice) filterMinPrice.value = "";
  if (filterMaxPrice) filterMaxPrice.value = "";
  if (filterSort) filterSort.value = "newest";
  applyFilters();
}

function setGridView(mode) {
  if (!marketplace) return;
  marketplace.style.gridTemplateColumns = mode === "list" ? "1fr" : "";
  document.querySelectorAll(".view-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.view-btn[onclick*="'${mode}'"]`)?.classList.add("active");
}
window.resetFilters = resetFilters;
window.setGridView = setGridView;

searchInput?.addEventListener("input", applyFilters);
gameSelect?.addEventListener("change", applyFilters);
filterType?.addEventListener("change", applyFilters);
filterMinPrice?.addEventListener("input", applyFilters);
filterMaxPrice?.addEventListener("input", applyFilters);
filterSort?.addEventListener("change", applyFilters);

// ========================
// RENDER LISTINGS (game-card style + actions kept)
// ========================
function renderItems(items) {
  if (!marketplace) return;

  marketplace.innerHTML = "";

  if (!items || items.length === 0) {
    marketplace.innerHTML = '<div class="no-items">No listings yet.</div>';
    return;
  }

  items.forEach((item) => {
    const productData = allProducts.find((p) => p.P_name === item.name);
    const fallbackImg = "./images/logo.png";
    const itemImage = productData?.image || fallbackImg;

    const card = document.createElement("div");
    card.className = "market-card-v3";

    // Card content
    card.innerHTML = `
      <a class="market-card-v3-link" href="javascript:void(0)">
        <div class="market-card-v3-media">
          <img src="${itemImage}" alt="${escapeHtml(item.name)}"
               onerror="this.src='./products/images/placeholder.png'">
        </div>

        <div class="market-card-v3-label">${escapeHtml(item.name)}</div>

        <div class="market-card-v3-meta">
          <span class="market-pill">${escapeHtml(item.game)}</span>
          <span class="market-pill">$${Number(item.price).toLocaleString()}</span>
        </div>

        <div class="market-card-v3-sub">
          <span>@ ${escapeHtml(item.seller_name || "User")}</span>
          <span>⏱ ${timeAgo(item.created_at)}</span>
        </div>
      </a>
    `;

    // Open details modal when clicked
    card.querySelector(".market-card-v3-link")?.addEventListener("click", () => {
      openListingDetails(item);
    });

    // Contact block (kept)
    const contact = document.createElement("div");
    contact.className = "listing-contact";

    if (item.contact_method === "discord" && item.discord) {
      contact.innerHTML = `
        <div class="contact-row">
          <div class="contact-text">Discord: ${escapeHtml(item.discord)}</div>
          <button class="btn btn-primary copy-btn" type="button">Copy</button>
        </div>
      `;
      contact.querySelector(".copy-btn")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.discord);
          window.showActionModal("Copied", "Discord username copied!", { autoCloseMs: 1200 });
        } catch {
          window.showActionModal("Copy failed", "Your browser blocked clipboard access.", { autoCloseMs: 1800 });
        }
      });
    } else {
      contact.innerHTML = `<div class="contact-text">Contact: In-app chat</div>`;
    }
    card.appendChild(contact);

    // Actions (kept)
    const actionRow = document.createElement("div");
    actionRow.className = "listing-actions";

    // Message button if not seller
    if (!currentUserId || item.user_id !== currentUserId) {
      const msgBtn = document.createElement("button");
      msgBtn.className = "btn btn-success";
      msgBtn.type = "button";
      msgBtn.textContent = "Message";
      msgBtn.onclick = () => messageSeller(item);
      actionRow.appendChild(msgBtn);
    }

    // Edit/Delete for owner of listing
    if (currentUserId && item.user_id === currentUserId) {
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-warning";
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.onclick = () => startEditListing(item);

      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.onclick = () => deleteListing(item);

      actionRow.appendChild(editBtn);
      actionRow.appendChild(delBtn);
    }

    card.appendChild(actionRow);
    marketplace.appendChild(card);
  });
}

// ========================
// LISTING DETAILS MODAL
// ========================
function openListingDetails(item) {
  const modal = document.getElementById("listingModal");
  const body = document.getElementById("modalBody");
  const closeBtn = document.getElementById("closeListingModal");

  if (!modal || !body) return;

  const productData = allProducts.find((p) => p.P_name === item.name);
  const tradeValue = productData?.tradeValue || 0;

  body.innerHTML = `
    <h3>${escapeHtml(item.name)}</h3>
    <p><strong>Game:</strong> ${escapeHtml(item.game)}</p>
    <p><strong>Price:</strong> $${Number(item.price).toLocaleString()}</p>
    <p><strong>Trade Value:</strong> ${tradeValue}</p>
    <p><strong>Type:</strong> ${escapeHtml(item.type)}</p>
    <p><strong>Quantity:</strong> ${Number(item.quantity)}</p>
    <p><strong>Seller:</strong> ${escapeHtml(item.seller_name || "User")}</p>
    <p><strong>Contact:</strong> ${
      item.contact_method === "discord"
        ? `Discord: ${escapeHtml(item.discord || "")}`
        : "In-app chat"
    }</p>
    <p><strong>Notes:</strong> ${item.notes ? escapeHtml(item.notes) : "—"}</p>
  `;

  modal.style.display = "flex";

  closeBtn?.addEventListener(
    "click",
    () => {
      modal.style.display = "none";
    },
    { once: true }
  );

  modal.addEventListener(
    "click",
    (e) => {
      if (e.target === modal) modal.style.display = "none";
    },
    { once: true }
  );
}

// ========================
// SUPABASE: LOAD LISTINGS
// ========================
async function loadListings() {
  if (!marketplace) return;

  marketplace.innerHTML = '<div class="no-items">Loading listings…</div>';

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading listings:", error);
    marketplace.innerHTML = `<div class="no-items">Failed to load listings: ${error.message}</div>`;
    return;
  }

  const rows = data || [];
  const nameMap = await fetchDisplayNames(rows.map((r) => r.user_id));

  allItems = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    game: r.game,
    name: r.item,
    type: r.type,
    price: r.price,
    quantity: r.quantity,
    contact_method: r.contact_method,
    discord: r.discord,
    notes: r.notes,
    created_at: r.created_at,
    seller_name: nameMap.get(r.user_id) || "User",
  }));

  applyFilters();
}
loadListings();

// ========================
// AUTOCOMPLETE
// ========================
if (listingGame && listingItem && autocompleteList) {
  listingItem.addEventListener("input", () => {
    const game = listingGame.value;
    const query = listingItem.value.toLowerCase();
    autocompleteList.innerHTML = "";

    if (!game || !query) return;

    allProducts
      .filter((p) => p.game === game && p.P_name.toLowerCase().includes(query))
      .slice(0, 6)
      .forEach((p) => {
        const li = document.createElement("li");
        li.textContent = `${p.P_name} (${p.tradeValue})`;
        li.style.cursor = "pointer";
        li.onclick = () => {
          listingItem.value = p.P_name;
          if (listingPrice) listingPrice.value = p.tradeValue;
          autocompleteList.innerHTML = "";
        };
        autocompleteList.appendChild(li);
      });
  });
}

// ========================
// AUTH UI + USER ICON MENU (single init)
// ========================
document.addEventListener("DOMContentLoaded", () => {
  // Old auth UI elements
  const loginLink = document.getElementById("login-link");
  const userMenu = document.getElementById("user-menu");
  const logoutBtn = document.getElementById("logout-btn");
  const userName = document.getElementById("user-name");
  const addListingBtn = document.getElementById("addListingBtn");
  const ordersBtn = document.getElementById("ordersBtn");

  // New user icon dropdown (optional)
  const userbtn = document.getElementById("userbtn");
  const usermenu = document.getElementById("usermenu");
  const umLogin = document.getElementById("umLogin");
  const umLogout = document.getElementById("umLogout");
  const umDashboard = document.getElementById("umDashboard");
  const umOwner = document.getElementById("umOwner");

  function pickDisplayName(user) {
    return (
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "User"
    );
  }

  function closeIconMenu() {
    usermenu?.classList.remove("open");
  }

  userbtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    usermenu?.classList.toggle("open");
  });
  document.addEventListener("click", closeIconMenu);

  function refreshIconMenu(session) {
    const user = session?.user;

    if (!user) {
      if (umLogin) umLogin.style.display = "flex";
      if (umLogout) umLogout.style.display = "none";
      if (umDashboard) umDashboard.style.display = "none";
      if (umOwner) umOwner.style.display = "none";
      return;
    }

    if (umLogin) umLogin.style.display = "none";
    if (umLogout) umLogout.style.display = "flex";
    if (umDashboard) umDashboard.style.display = "flex";
    if (umOwner) umOwner.style.display = user.id === OWNER_UID ? "flex" : "none";
  }

  function refreshUI(session) {
    const user = session?.user;
    currentUserId = user?.id || null;

    if (!user) {
      if (loginLink) loginLink.style.display = "inline-flex";
      if (userMenu) userMenu.style.display = "none";
      if (addListingBtn) addListingBtn.style.display = "none";
      if (ordersBtn) ordersBtn.style.display = "none";
      if (userName) userName.textContent = "User";
      refreshIconMenu(null);
      return;
    }

    if (loginLink) loginLink.style.display = "none";
    if (userMenu) userMenu.style.display = "inline-flex";
    if (addListingBtn) addListingBtn.style.display = isOwner(session) ? "inline-flex" : "none";
    if (ordersBtn) ordersBtn.style.display = isOwner(session) ? "inline-flex" : "none";
    if (userName) userName.textContent = pickDisplayName(user);

    refreshIconMenu(session);
  }

  // initial state + live updates
  supabase.auth.getSession().then(({ data }) => refreshUI(data.session));
  supabase.auth.onAuthStateChange((_e, session) => refreshUI(session));

  // Logout (old menu)
  logoutBtn?.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}
    clearSupabaseStorage();
    refreshUI(null);
    try { await loadListings(); } catch {}
    window.location.href = "./auth.html?logged_out=1";
  });

  // Logout (icon menu)
  umLogout?.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}
    clearSupabaseStorage();
    closeIconMenu();
    refreshUI(null);
    try { await loadListings(); } catch {}
    window.location.href = "./auth.html?logged_out=1";
  });

  // Add listing (owner only)
  addListingBtn?.addEventListener("click", async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "./auth.html");

    if (!isOwner(session)) {
      window.showActionModal("Not allowed", "Only the site owner can add listings.", { autoCloseMs: 1800 });
      return;
    }
    showPage("addListingPage");
  });
});

// ========================
// ADD / UPDATE LISTING
// ========================
if (listingForm) {
  listingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.showActionModal("Login required", "Redirecting to login…", { autoCloseMs: 1200 });
      setTimeout(() => (window.location.href = "./auth.html"), 900);
      return;
    }

    if (!isOwner(session)) {
      window.showActionModal("Not allowed", "Only the site owner can add or edit listings.", { autoCloseMs: 2000 });
      return;
    }

    const payload = {
      user_id: session.user.id,
      game: listingGame?.value,
      item: listingItem?.value,
      type: listingType?.value,
      price: Number(listingPrice?.value),
      quantity: Number(listingQuantity?.value),
      contact_method: contactMethod?.value,
      discord: discordUsername?.value || null,
      notes: listingNotes?.value || null,
    };

    if (!payload.game || !payload.item || !payload.type || !payload.price) {
      window.showActionModal("Missing info", "Please fill in the required fields.", { autoCloseMs: 2000 });
      return;
    }

    let error;

    if (editingListingId) {
      const updatePayload = { ...payload };
      delete updatePayload.user_id;

      ({ error } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", editingListingId)
        .eq("user_id", session.user.id));
    } else {
      ({ error } = await supabase.from("listings").insert(payload));
    }

    if (error) {
      console.error("Save listing error:", error);
      window.showActionModal("Error", error.message, { autoCloseMs: 2500 });
      return;
    }

    window.showActionModal("Success", editingListingId ? "Listing updated." : "Listing created.", { autoCloseMs: 1500 });

    editingListingId = null;
    listingForm.reset();
    autocompleteList.innerHTML = "";

    showPage("mainPage");
    await loadListings();
  });
}

// ========================
// EDIT / DELETE
// ========================
function startEditListing(item) {
  editingListingId = item.id;
  showPage("addListingPage");

  if (listingGame) listingGame.value = item.game;
  if (listingItem) listingItem.value = item.name;
  if (listingType) listingType.value = item.type;
  if (listingPrice) listingPrice.value = item.price;
  if (listingQuantity) listingQuantity.value = item.quantity;
  if (contactMethod) contactMethod.value = item.contact_method || "chat";
  if (discordUsername) discordUsername.value = item.discord || "";
  if (listingNotes) listingNotes.value = item.notes || "";

  window.showActionModal("Edit mode", "Update the form then submit to save.", { autoCloseMs: 2000 });
}

async function deleteListing(item) {
  const ok = confirm(`Delete listing "${item.name}"?`);
  if (!ok) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", item.id)
    .eq("user_id", session.user.id);

  if (error) {
    console.error("Delete listing error:", error);
    window.showActionModal("Error", error.message, { autoCloseMs: 2500 });
    return;
  }

  window.showActionModal("Deleted", "Listing removed.", { autoCloseMs: 1200 });
  await loadListings();
}

window.startEditListing = startEditListing;
window.deleteListing = deleteListing;

// ========================
// CHAT / MESSAGE SELLER
// ========================
async function messageSeller(item) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.showActionModal("Login required", "Redirecting to login…", { autoCloseMs: 1200 });
    setTimeout(() => (window.location.href = "./auth.html"), 900);
    return;
  }

  const buyerId = session.user.id;
  const sellerId = item.user_id;
  if (!sellerId) return;

  if (buyerId === sellerId) {
    window.showActionModal("Note", "You are the seller of this listing.", { autoCloseMs: 1600 });
    return;
  }

  const roomName = makeDMRoomName(buyerId, sellerId);

  const { data: existing, error: exErr } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("name", roomName)
    .maybeSingle();

  if (exErr && exErr.code !== "PGRST116") console.error(exErr);

  let room = existing;

  if (!room) {
    const { data: inserted, error } = await supabase
      .from("chat_rooms")
      .insert({ name: roomName, created_by: buyerId })
      .select("*")
      .single();

    if (error) {
      console.error("Create room error:", error);
      window.showActionModal("Error", error.message, { autoCloseMs: 2500 });
      return;
    }
    room = inserted;
  }

  showPage("chatPage");
  window.openChatRoomByName?.(room.name);
}
window.messageSeller = messageSeller;

// ========================
// CONTACT METHOD UI
// ========================
function syncContactUI() {
  const method = contactMethod?.value;
  const discordWrap = document.getElementById("discordWrap");
  if (!discordWrap) return;
  discordWrap.style.display = method === "discord" ? "block" : "none";
}
contactMethod?.addEventListener("change", syncContactUI);
syncContactUI();

// ========================
// ACTION MODAL HELPERS
// ========================
window.showActionModal = function (title, text, options = {}) {
  const modal = document.getElementById("actionModal");
  const t = document.getElementById("modalTitle");
  const b = document.getElementById("modalMessage");
  const closeBtn = document.getElementById("modalCloseBtn");
  const okBtn = document.getElementById("modalOkBtn");

  if (!modal || !t || !b) return;

  t.textContent = title || "";
  b.textContent = text || "";

  modal.style.display = "flex";

  const close = () => {
    modal.style.display = "none";
  };

  closeBtn?.addEventListener("click", close, { once: true });
  okBtn?.addEventListener(
    "click",
    () => {
      try {
        options?.onOk?.();
      } finally {
        close();
      }
    },
    { once: true }
  );

  modal.addEventListener(
    "click",
    (e) => {
      if (e.target === modal) close();
    },
    { once: true }
  );

  const autoCloseMs = options.autoCloseMs ?? null;
  if (autoCloseMs) setTimeout(close, autoCloseMs);
};