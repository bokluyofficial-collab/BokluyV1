import { supabase } from "./supabase/supabaseClient.js";

const PRODUCT_CATALOG = [
  ...(window.bloxFruitsProducts || []),
  ...(window.animeLastStandProducts || []),
];

const FALLBACK_IMAGE = "./image.png";

const GAME_PAGE_MAP = {
  mlbb: "./mlbb.html",
  hok: "./hok.html",
  "honor of kings": "./hok.html",
  freefire: "./freefire.html",
  "free fire": "./freefire.html",
  pubg: "./pubg.html",
  "pubg mobile": "./pubg.html",
  growtopia: "./growtopia.html",
  deltaforce: "./deltaforce.html",
  "delta force": "./deltaforce.html",
  bloodstrike: "./bloodstrike.html",
  "blood strike": "./bloodstrike.html",
  roblox: "./roblox.html",
  mcgg: "./mcgg.html",
  genacc: "./home.html",
  genser: "./home.html",
};

const CATEGORY_GAME_MAP = {
  Item: null,
  Accounts: null,
  Services: null,
  Robux: "Roblox",
};

const state = {
  itemListings: [],
  storeProducts: [],
  filtered: [],
  currentUserId: null,
  canManage: false,
  activeCategory: "Item",
  sellerProfile: null,
  sellerApplication: null,
};

const els = {
  listingsGrid: document.getElementById("listingsGrid"),
  statusCard: document.getElementById("statusCard"),
  searchInput: document.getElementById("searchInput"),
  gameFilter: document.getElementById("gameFilter"),
  typeFilter: document.getElementById("typeFilter"),
  sortFilter: document.getElementById("sortFilter"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  categorySwitch: document.getElementById("categorySwitch"),

  loginLink: document.getElementById("login-link"),
  userMenu: document.getElementById("user-menu"),
  userChip: document.getElementById("user-chip"),
  userAvatar: document.getElementById("user-avatar"),
  userName: document.getElementById("user-name"),
  userDropdown: document.getElementById("user-dropdown"),
  logoutBtn: document.getElementById("logout-btn"),
  openComposerBtn: document.getElementById("openComposerBtn"),
  supportBtn: document.getElementById("supportBtn"),
  sellOpenBtn: document.getElementById("sellOpenBtn"),
  becomeSellerBtn: document.getElementById("becomeSellerBtn"),

  listingModal: document.getElementById("listingModal"),
  closeListingModal: document.getElementById("closeListingModal"),
  detailTitle: document.getElementById("detailTitle"),
  detailImage: document.getElementById("detailImage"),
  detailPills: document.getElementById("detailPills"),
  detailGrid: document.getElementById("detailGrid"),
  detailNotes: document.getElementById("detailNotes"),
  detailActions: document.getElementById("detailActions"),

  sellModal: document.getElementById("sellModal"),
  sellCloseBg: document.getElementById("sellCloseBg"),
  sellCloseBtn: document.getElementById("sellCloseBtn"),
  sellCancel: document.getElementById("sellCancel"),
  sellForm: document.getElementById("sellForm"),
  sellStatus: document.getElementById("sellStatus"),
  sellStoreName: document.getElementById("sellStoreName"),
  sellTelegram: document.getElementById("sellTelegram"),
  sellWhatsapp: document.getElementById("sellWhatsapp"),
  sellGames: document.getElementById("sellGames"),
  sellNotes: document.getElementById("sellNotes"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgo(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (!Number.isFinite(seconds) || seconds < 0) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(days / 365)}y ago`;
}

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "$0";
  return `$${num.toLocaleString()}`;
}

function displayGameName(value) {
  const raw = String(value || "").trim();
  if (raw === "GenAcc") return "Accounts";
  if (raw === "GenSer") return "Services";
  if (raw === "Roblox") return "Robux";
  return raw || "Unknown";
}

function setStatus(message, type = "info") {
  if (!els.statusCard) return;

  if (!message) {
    els.statusCard.className = "status-card";
    els.statusCard.textContent = "";
    return;
  }

  els.statusCard.textContent = message;
  els.statusCard.className = `status-card is-visible${type === "error" ? " is-error" : ""}`;
}

function setSellStatus(message) {
  if (els.sellStatus) els.sellStatus.textContent = message || "";
}

function productImageFor(game, item) {
  const match = PRODUCT_CATALOG.find((entry) => {
    return (
      String(entry.game || "").toLowerCase() === String(game || "").toLowerCase() &&
      String(entry.P_name || "").toLowerCase() === String(item || "").toLowerCase()
    );
  });

  return match?.image || FALLBACK_IMAGE;
}

function getGamePagePath(game) {
  const key = String(game || "").trim().toLowerCase();
  return GAME_PAGE_MAP[key] || null;
}

function detectStoreCategory(row) {
  const game = String(row?.game || "").trim().toLowerCase();
  if (game === "genacc") return "Accounts";
  if (game === "genser") return "Services";
  if (game === "roblox") return "Robux";
  return null;
}

function normalizeItemListing(row, sellerNameMap) {
  const sellerId = row.seller_user_id || row.user_id;
  const category = row.category || "Item";
  const image = category === "Accounts"
    ? (row.image_url || FALLBACK_IMAGE)
    : productImageFor(row.game, row.item);

  return {
    id: row.id,
    source: "listing",
    userId: sellerId,
    category,
    game: row.game || "Unknown",
    item: row.item || "Untitled item",
    type: row.type || "SELLING",
    price: Number(row.price || 0),
    quantity: Number(row.quantity || 1),
    status: row.status || "active",
    contactMethod: row.contact_method || "chat",
    discord: row.discord || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    sellerName: sellerNameMap.get(sellerId) || "User",
    image,
  };
}

function normalizeStoreProduct(row) {
  const category = detectStoreCategory(row);

  return {
    id: row.id,
    source: "store",
    category,
    game: row.game || "Unknown",
    item: row.title || row.name || "Untitled product",
    type: "SELLING",
    price: Number(row.price || 0),
    quantity: 1,
    status: "active",
    contactMethod: "page",
    discord: "",
    notes: row.description || row.notes || "Available from Bokluy store.",
    createdAt: row.created_at || null,
    sellerName: "Bokluy",
    image: row.img_url || productImageFor(row.game, row.title || row.name) || FALLBACK_IMAGE,
    payLink: row.pay_link || "",
    pagePath: getGamePagePath(row.game),
  };
}

async function getSellerProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("seller_profiles")
    .select("user_id, store_name, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || data.status !== "active") return null;
  return data;
}

async function getSellerApplication(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("seller_applications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

function syncCategoryButtons() {
  const buttons = document.querySelectorAll(".category-btn");
  buttons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.category === state.activeCategory);
  });

  if (els.openComposerBtn) {
    els.openComposerBtn.hidden = !state.canManage;
    els.openComposerBtn.textContent = "Create Listing";
  }
}

function getActiveSourceRows() {
  if (state.activeCategory === "Item") {
    return state.itemListings.filter((row) => row.category === "Item");
  }

  if (state.activeCategory === "Accounts") {
    return state.itemListings.filter((row) => row.category === "Accounts");
  }

  if (state.activeCategory === "Services") {
    return state.itemListings.filter((row) => row.category === "Services");
  }

  const targetGame = CATEGORY_GAME_MAP[state.activeCategory];
  return state.storeProducts.filter((row) => String(row.game || "").trim() === targetGame);
}

function fillGameFilter() {
  if (!els.gameFilter) return;

  const previous = els.gameFilter.value || "all";
  const games = [...new Set(getActiveSourceRows().map((item) => item.game).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  els.gameFilter.innerHTML = `
    <option value="all">All games</option>
    ${games
      .map((game) => `<option value="${escapeHtml(game)}">${escapeHtml(displayGameName(game))}</option>`)
      .join("")}
  `;

  els.gameFilter.value = games.includes(previous) ? previous : "all";
}

function activeFilters() {
  return {
    search: els.searchInput?.value.trim().toLowerCase() || "",
    game: els.gameFilter?.value || "all",
    type: els.typeFilter?.value || "all",
    sort: els.sortFilter?.value || "newest",
  };
}

function applyFilters() {
  const filters = activeFilters();
  let rows = [...getActiveSourceRows()];

  if (filters.search) {
    rows = rows.filter((item) =>
      [item.item, item.game, item.sellerName, item.notes, item.category]
        .join(" ")
        .toLowerCase()
        .includes(filters.search)
    );
  }

  if (filters.game !== "all") {
    rows = rows.filter((item) => item.game === filters.game);
  }

  if (["Item", "Accounts", "Services"].includes(state.activeCategory) && filters.type !== "all") {
    rows = rows.filter((item) => item.type === filters.type);
  }

  switch (filters.sort) {
    case "price-low":
      rows.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      rows.sort((a, b) => b.price - a.price);
      break;
    case "name":
      rows.sort((a, b) => a.item.localeCompare(b.item));
      break;
    default:
      rows.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      break;
  }

  state.filtered = rows;
  syncCategoryButtons();
  renderListings();
}

function emptyCard(message) {
  if (!els.listingsGrid) return;

  els.listingsGrid.innerHTML = `
    <article class="market-card">
      <div>
        <span class="eyebrow">No results</span>
        <h3>${escapeHtml(message)}</h3>
        <p>Try changing the search terms or reset the filters.</p>
      </div>
    </article>
  `;
}

function createActionButton(label, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `card-btn ${className}`.trim();
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function detailField(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderListings() {
  if (!els.listingsGrid) return;

  const items = state.filtered;
  els.listingsGrid.innerHTML = "";

  if (!items.length) {
    const message =
      ["Item", "Accounts", "Services"].includes(state.activeCategory)
        ? `No ${state.activeCategory.toLowerCase()} listings match the current filters.`
        : `No ${state.activeCategory.toLowerCase()} products match the current filters.`;
    emptyCard(message);
    return;
  }

  for (const item of items) {
    const sold = item.status === "sold_out";

    const card = document.createElement("article");
    card.className = `market-card${sold ? " is-sold" : ""}`;

    card.innerHTML = `
      <div class="market-card__media ${sold ? "is-sold" : ""}">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.item)}" onerror="this.src='./image.png'" />
        ${sold ? `<div class="sold-overlay">SOLD</div>` : ""}
      </div>
      <div>
        <div class="market-card__top">
          <div>
            <div class="market-card__meta">
              <span class="market-pill ${item.type === "BUYING" ? "buying" : "selling"}">${escapeHtml(item.type)}</span>
              <span class="market-pill">${escapeHtml(displayGameName(item.game))}</span>
              <span class="market-pill">${escapeHtml(item.category || state.activeCategory)}</span>
              ${sold ? `<span class="market-pill">Sold</span>` : ""}
            </div>
            <h3>${escapeHtml(item.item)}</h3>
          </div>
          <div class="market-card__price">${formatPrice(item.price)}</div>
        </div>
        <p>${item.source === "listing" ? `${item.quantity} unit${item.quantity === 1 ? "" : "s"} available` : "Store product"}</p>
        <div class="market-card__seller">
          <span>Seller: ${escapeHtml(item.sellerName)}</span>
          <span>${item.createdAt ? timeAgo(item.createdAt) : "Store"}</span>
        </div>
        <div class="market-card__actions"></div>
      </div>
    `;

    const actions = card.querySelector(".market-card__actions");

    actions.append(
      createActionButton("View details", "primary-inline", () => openListingModal(item))
    );

    if (item.source === "store") {
      actions.append(
        createActionButton("Open product", "success", () => openStoreProduct(item))
      );
    } else if (!sold) {
      if (!state.currentUserId || state.currentUserId !== item.userId) {
        actions.append(
          createActionButton("Message seller", "success", () => messageSeller(item))
        );
      }
    }

    els.listingsGrid.append(card);
  }
}

function openListingModal(item) {
  if (!els.listingModal) return;

  const sold = item.status === "sold_out";

  els.detailTitle.textContent = item.item;
  els.detailImage.src = item.image || FALLBACK_IMAGE;
  els.detailImage.alt = `${item.item} image`;
  els.detailImage.style.filter = sold ? "brightness(0.45)" : "";

  els.detailPills.innerHTML = `
    <span class="market-pill ${item.type === "BUYING" ? "buying" : "selling"}">${escapeHtml(item.type)}</span>
    <span class="market-pill">${escapeHtml(displayGameName(item.game))}</span>
    <span class="market-pill">${formatPrice(item.price)}</span>
    <span class="market-pill">${escapeHtml(item.category || state.activeCategory)}</span>
    ${sold ? `<span class="market-pill">Sold</span>` : ""}
  `;

  if (item.source === "store") {
    els.detailGrid.innerHTML = [
      detailField("Seller", "Bokluy"),
      detailField("Category", item.category || state.activeCategory),
      detailField("Game", displayGameName(item.game)),
      detailField("Open via", item.pagePath ? item.pagePath.replace("./", "") : "Store page"),
    ].join("");
  } else {
    els.detailGrid.innerHTML = [
      detailField("Seller", item.sellerName),
      detailField("Category", item.category || "Item"),
      detailField("Quantity", String(item.quantity)),
      detailField("Status", item.status || "active"),
      detailField(
        "Contact",
        item.contactMethod === "discord" ? `Discord: ${item.discord || "—"}` : "In-app chat"
      ),
      detailField("Created", new Date(item.createdAt).toLocaleString()),
    ].join("");
  }

  els.detailNotes.textContent = item.notes || "No additional notes.";
  els.detailActions.innerHTML = "";

  if (item.source === "store") {
    els.detailActions.append(
      createActionButton("Open product page", "success", () => openStoreProduct(item))
    );
  } else if (!sold) {
    if (item.contactMethod === "discord" && item.discord) {
      els.detailActions.append(
        createActionButton("Copy Discord", "success", async () => {
          try {
            await navigator.clipboard.writeText(item.discord);
            setStatus("Discord username copied.");
          } catch {
            setStatus("Clipboard access failed.", "error");
          }
        })
      );
    } else {
      els.detailActions.append(
        createActionButton("Message seller", "success", () => messageSeller(item))
      );
    }
  }

  els.listingModal.showModal();
}

function closeListingModal() {
  if (els.listingModal?.open) els.listingModal.close();
}

function openSellerDashboard() {
  if (!state.currentUserId) {
    window.location.href = "./auth.html";
    return;
  }

  if (state.sellerProfile) {
    window.location.href = "./dashboard-seller.html";
    return;
  }

  if (state.sellerApplication?.status === "pending") {
    setStatus("Your seller application is still pending review.");
    return;
  }

  if (!els.sellModal) return;
  els.sellModal.setAttribute("aria-hidden", "false");
  setSellStatus("");
}

function closeSellModal() {
  if (!els.sellModal) return;
  els.sellModal.setAttribute("aria-hidden", "true");
  setSellStatus("");
  els.sellForm?.reset();
}

async function loadItemListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .in("status", ["active", "sold_out", "paused"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  const sellerIds = (data || []).map((row) => row.seller_user_id || row.user_id).filter(Boolean);

  let sellerMap = new Map();
  if (sellerIds.length) {
    const { data: sellerRows, error: sellerError } = await supabase
      .from("seller_profiles_public")
      .select("user_id, store_name")
      .in("user_id", [...new Set(sellerIds)]);

    if (!sellerError) {
      sellerMap = new Map((sellerRows || []).map((row) => [row.user_id, row.store_name]));
    }
  }

  state.itemListings = (data || []).map((row) => normalizeItemListing(row, sellerMap));
}

async function loadStoreProducts() {
  const { data, error } = await supabase
    .from("topup_products")
    .select("*")
    .in("game", ["Roblox"])
    .eq("active", true);

  if (error) throw error;

  const rows = (data || []).slice().sort((a, b) => {
    const sa = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 999999;
    const sb = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 999999;
    if (sa !== sb) return sa - sb;
    return String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
  });

  state.storeProducts = rows
    .map(normalizeStoreProduct)
    .filter((row) => !!row.category);
}

async function loadEverything() {
  setStatus("Loading marketplace listings...");
  try {
    await Promise.all([loadItemListings(), loadStoreProducts()]);
    fillGameFilter();
    setStatus("");
    applyFilters();
  } catch (error) {
    console.error(error);
    setStatus(`Failed to load data: ${error.message}`, "error");
    emptyCard("Marketplace data could not be loaded.");
  }
}

function openStoreProduct(item) {
  closeListingModal();

  if (item.pagePath) {
    window.location.href = item.pagePath;
    return;
  }

  if (item.payLink) {
    window.open(item.payLink, "_blank", "noopener");
    return;
  }

  setStatus("No linked game page found for this product.", "error");
}

async function messageSeller(item) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id) {
    window.location.href = "./auth.html";
    return;
  }

  if (item.status === "sold_out") {
    setStatus("This listing is already sold.", "error");
    return;
  }

  const buyerId = session.user.id;
  const sellerId = item.userId;

  if (!sellerId) {
    setStatus("Seller account not found.", "error");
    return;
  }

  if (buyerId === sellerId) {
    setStatus("You are the seller of this listing.", "error");
    return;
  }

  const [userA, userB] = [buyerId, sellerId].sort();
  const roomName = `dm_${userA}_${userB}`;

  const { data: existing, error: fetchError } = await supabase
    .from("chat_rooms")
    .select("id, name, user_a_id, user_b_id")
    .eq("user_a_id", userA)
    .eq("user_b_id", userB)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    setStatus(fetchError.message || "Failed to open chat.", "error");
    return;
  }

  let room = existing;

  if (!room) {
    const { data: inserted, error: insertError } = await supabase
      .from("chat_rooms")
      .insert({
        name: roomName,
        created_by: buyerId,
        user_a_id: userA,
        user_b_id: userB,
        last_message_at: new Date().toISOString(),
      })
      .select("id, name, user_a_id, user_b_id")
      .single();

    if (insertError) {
      setStatus(insertError.message || "Failed to create direct message.", "error");
      return;
    }

    room = inserted;
  }

  window.location.href = `./messages.html?room_id=${encodeURIComponent(room.id)}`;
}

function setAuthUI(session) {
  const user = session?.user;
  state.currentUserId = user?.id || null;

  if (!user) {
    if (els.loginLink) els.loginLink.hidden = false;
    if (els.userMenu) els.userMenu.hidden = true;
    if (els.openComposerBtn) els.openComposerBtn.hidden = true;

    if (els.sellOpenBtn) {
      els.sellOpenBtn.hidden = false;
      els.sellOpenBtn.textContent = "Become a Seller";
    }

    if (els.becomeSellerBtn) els.becomeSellerBtn.hidden = false;
    return;
  }

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "User";

  if (els.loginLink) els.loginLink.hidden = true;
  if (els.userMenu) els.userMenu.hidden = false;
  if (els.userName) els.userName.textContent = displayName;
  if (els.userAvatar) els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();

  if (els.openComposerBtn) {
    els.openComposerBtn.hidden = !state.canManage;
    els.openComposerBtn.textContent = "Create Listing";
  }

  if (state.sellerProfile) {
    if (els.sellOpenBtn) {
      els.sellOpenBtn.hidden = false;
      els.sellOpenBtn.textContent = "Create Listing";
    }
    if (els.becomeSellerBtn) els.becomeSellerBtn.hidden = true;
  } else if (state.sellerApplication?.status === "pending") {
    if (els.sellOpenBtn) {
      els.sellOpenBtn.hidden = false;
      els.sellOpenBtn.textContent = "Seller Pending";
    }
    if (els.becomeSellerBtn) els.becomeSellerBtn.hidden = true;
  } else {
    if (els.sellOpenBtn) {
      els.sellOpenBtn.hidden = false;
      els.sellOpenBtn.textContent = "Become a Seller";
    }
    if (els.becomeSellerBtn) els.becomeSellerBtn.hidden = false;
  }
}

function closeUserDropdown() {
  if (els.userDropdown) els.userDropdown.hidden = true;
  if (els.userChip) els.userChip.setAttribute("aria-expanded", "false");
}

async function initializeAuth() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const userId = session?.user?.id || null;

  state.sellerProfile = await getSellerProfile(userId);
  state.sellerApplication = await getSellerApplication(userId);
  state.canManage = !!state.sellerProfile;
  setAuthUI(session);

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    const nextUserId = nextSession?.user?.id || null;
    state.sellerProfile = await getSellerProfile(nextUserId);
    state.sellerApplication = await getSellerApplication(nextUserId);
    state.canManage = !!state.sellerProfile;
    setAuthUI(nextSession);
    applyFilters();
  });
}

async function submitSellerApplication(event) {
  event.preventDefault();

  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id) {
    window.location.href = "./auth.html";
    return;
  }

  const games = els.sellGames.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const payload = {
    user_id: session.user.id,
    display_name: els.sellStoreName.value.trim(),
    contact_telegram: els.sellTelegram.value.trim() || null,
    contact_whatsapp: els.sellWhatsapp.value.trim() || null,
    games,
    notes: els.sellNotes.value.trim() || null,
    status: "pending",
  };

  if (!payload.display_name || games.length === 0) {
    setSellStatus("Store name and games are required.");
    return;
  }

  setSellStatus("Submitting application...");

  const { error } = await supabase
    .from("seller_applications")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("seller application error:", error);
    setSellStatus(error.message || "Failed to submit application.");
    return;
  }

  state.sellerApplication = payload;
  setSellStatus("Application submitted.");
  setStatus("Seller application submitted. Wait for approval.");
  setAuthUI(session);

  setTimeout(() => {
    closeSellModal();
  }, 500);
}

function bindEvents() {
  els.searchInput?.addEventListener("input", applyFilters);
  els.gameFilter?.addEventListener("change", applyFilters);
  els.typeFilter?.addEventListener("change", applyFilters);
  els.sortFilter?.addEventListener("change", applyFilters);

  els.categorySwitch?.addEventListener("click", (event) => {
    const btn = event.target.closest(".category-btn");
    if (!btn) return;

    state.activeCategory = btn.dataset.category || "Item";

    if (els.typeFilter) els.typeFilter.value = "all";
    fillGameFilter();
    applyFilters();
    closeUserDropdown();
  });

  els.resetFiltersBtn?.addEventListener("click", () => {
    if (els.searchInput) els.searchInput.value = "";
    if (els.gameFilter) els.gameFilter.value = "all";
    if (els.typeFilter) els.typeFilter.value = "all";
    if (els.sortFilter) els.sortFilter.value = "newest";
    applyFilters();
  });

  els.userChip?.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = els.userDropdown?.hidden;
    closeUserDropdown();
    if (els.userDropdown) els.userDropdown.hidden = !willOpen;
    if (els.userChip) els.userChip.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", closeUserDropdown);

  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    closeUserDropdown();
    window.location.href = "./auth.html?logged_out=1";
  });

  els.supportBtn?.addEventListener("click", () => {
    setStatus("Support chat is not embedded in this page. Use the authenticated support flow from the account area.");
  });

  els.openComposerBtn?.addEventListener("click", () => {
    closeUserDropdown();
    openSellerDashboard();
  });

  els.sellOpenBtn?.addEventListener("click", () => {
    closeUserDropdown();
    openSellerDashboard();
  });

  els.becomeSellerBtn?.addEventListener("click", openSellerDashboard);
  els.sellCloseBg?.addEventListener("click", closeSellModal);
  els.sellCloseBtn?.addEventListener("click", closeSellModal);
  els.sellCancel?.addEventListener("click", closeSellModal);
  els.sellForm?.addEventListener("submit", submitSellerApplication);

  els.closeListingModal?.addEventListener("click", closeListingModal);

  els.listingModal?.addEventListener("click", (event) => {
    const box = els.listingModal.querySelector(".detail-modal__content");
    if (box && !box.contains(event.target)) closeListingModal();
  });
}

async function init() {
  bindEvents();
  await initializeAuth();
  await loadEverything();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected error while loading the marketplace.", "error");
});