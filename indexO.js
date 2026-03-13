import { supabase } from "./supabase/supabaseClient.js";

const OWNER_UID = "d7e7f252-321c-48b8-ba5c-e1c3ca12940c";

const PRODUCT_CATALOG = [
  ...(window.bloxFruitsProducts || []),
  ...(window.animeLastStandProducts || []),
];

const FALLBACK_IMAGE = "./image.png";

const GAME_PAGE_MAP = {
  mlbb: "./mlbb.html",
  hok: "./hok.html",
  freefire: "./freefire.html",
  pubg: "./pubg.html",
  growtopia: "./growtopia.html",
  deltaforce: "./deltaforce.html",
  bloodstrike: "./bloodstrike.html",
  roblox: "./roblox.html",
  mcgg: "./mcgg.html",
  genacc: "./home.html",
  genser: "./home.html",
};

const CATEGORY_GAME_MAP = {
  Item: null,
  Accounts: "GenAcc",
  Services: "GenSer",
  Robux: "Roblox",
};

const state = {
  itemListings: [],
  storeProducts: [],
  filtered: [],
  currentUserId: null,
  canManage: false,
  editingId: null,
  activeCategory: "Item",
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
  ownerOrdersLink: document.getElementById("ownerOrdersLink"),
  supportBtn: document.getElementById("supportBtn"),

  listingModal: document.getElementById("listingModal"),
  closeListingModal: document.getElementById("closeListingModal"),
  detailTitle: document.getElementById("detailTitle"),
  detailImage: document.getElementById("detailImage"),
  detailPills: document.getElementById("detailPills"),
  detailGrid: document.getElementById("detailGrid"),
  detailNotes: document.getElementById("detailNotes"),
  detailActions: document.getElementById("detailActions"),

  composerModal: document.getElementById("composerModal"),
  composerTitle: document.getElementById("composerTitle"),
  closeComposerBtn: document.getElementById("closeComposerBtn"),
  cancelComposerBtn: document.getElementById("cancelComposerBtn"),
  listingForm: document.getElementById("listingForm"),
  listingGame: document.getElementById("listingGame"),
  listingItem: document.getElementById("listingItem"),
  listingType: document.getElementById("listingType"),
  listingPrice: document.getElementById("listingPrice"),
  listingQuantity: document.getElementById("listingQuantity"),
  contactMethod: document.getElementById("contactMethod"),
  discordField: document.getElementById("discordField"),
  discordUsername: document.getElementById("discordUsername"),
  listingNotes: document.getElementById("listingNotes"),
  formFeedback: document.getElementById("formFeedback"),
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
  return {
    id: row.id,
    source: "listing",
    userId: row.user_id,
    game: row.game || "Unknown",
    item: row.item || "Untitled item",
    type: row.type || "SELLING",
    price: Number(row.price || 0),
    quantity: Number(row.quantity || 1),
    contactMethod: row.contact_method || "chat",
    discord: row.discord || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    sellerName: sellerNameMap.get(row.user_id) || "User",
    image: productImageFor(row.game, row.item),
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

async function fetchDisplayNames(userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, display_name")
    .in("id", uniqueIds);

  if (error) {
    console.warn("Display names lookup failed:", error.message);
    return new Map();
  }

  const map = new Map();
  for (const row of data || []) {
    map.set(row.id, row.display_name || "User");
  }

  return map;
}

async function canManageListings(session) {
  if (!session?.user?.id) return false;
  if (session.user.id === OWNER_UID) return true;

  const { data, error } = await supabase
    .from("admins")
    .select("uid")
    .eq("uid", session.user.id)
    .maybeSingle();

  return !error && !!data;
}

function syncCategoryButtons() {
  const buttons = document.querySelectorAll(".category-btn");
  buttons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.category === state.activeCategory);
  });

  if (els.openComposerBtn) {
    els.openComposerBtn.hidden = !(state.canManage && state.activeCategory === "Item");
  }
}

function getActiveSourceRows() {
  if (state.activeCategory === "Item") {
    return state.itemListings;
  }

  const targetGame = CATEGORY_GAME_MAP[state.activeCategory];
  return state.storeProducts.filter((row) => String(row.game || "").trim() === targetGame);
}

function fillGameFilter() {
  const previous = els.gameFilter?.value || "all";
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
    search: els.searchInput.value.trim().toLowerCase(),
    game: els.gameFilter.value,
    type: els.typeFilter.value,
    sort: els.sortFilter.value,
  };
}

function applyFilters() {
  const filters = activeFilters();
  let rows = [...getActiveSourceRows()];

  if (filters.search) {
    rows = rows.filter((item) =>
      [item.item, item.game, item.sellerName, item.notes]
        .join(" ")
        .toLowerCase()
        .includes(filters.search)
    );
  }

  if (filters.game !== "all") {
    rows = rows.filter((item) => item.game === filters.game);
  }

  if (state.activeCategory === "Item" && filters.type !== "all") {
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
  const items = state.filtered;
  els.listingsGrid.innerHTML = "";

  if (!items.length) {
    const message =
      state.activeCategory === "Item"
        ? "No listed items match the current filters."
        : `No ${state.activeCategory.toLowerCase()} products match the current filters.`;
    emptyCard(message);
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "market-card";

    card.innerHTML = `
      <div class="market-card__media">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.item)}" onerror="this.src='./image.png'" />
      </div>
      <div>
        <div class="market-card__top">
          <div>
            <div class="market-card__meta">
              <span class="market-pill ${item.type === "BUYING" ? "buying" : "selling"}">${escapeHtml(item.type)}</span>
              <span class="market-pill">${escapeHtml(displayGameName(item.game))}</span>
              ${item.source === "store" ? `<span class="market-pill">${escapeHtml(state.activeCategory)}</span>` : ""}
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
    } else {
      if (!state.currentUserId || state.currentUserId !== item.userId) {
        actions.append(
          createActionButton("Message seller", "success", () => messageSeller(item))
        );
      }

      if (state.canManage && state.currentUserId === item.userId) {
        actions.append(createActionButton("Edit", "", () => openComposer(item)));
        actions.append(createActionButton("Delete", "danger", () => deleteListing(item)));
      }
    }

    els.listingsGrid.append(card);
  }
}

function openListingModal(item) {
  els.detailTitle.textContent = item.item;
  els.detailImage.src = item.image || FALLBACK_IMAGE;
  els.detailImage.alt = `${item.item} image`;

  els.detailPills.innerHTML = `
    <span class="market-pill ${item.type === "BUYING" ? "buying" : "selling"}">${escapeHtml(item.type)}</span>
    <span class="market-pill">${escapeHtml(displayGameName(item.game))}</span>
    <span class="market-pill">${formatPrice(item.price)}</span>
    ${item.source === "store" ? `<span class="market-pill">${escapeHtml(item.category || state.activeCategory)}</span>` : ""}
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
      detailField("Quantity", String(item.quantity)),
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
  } else if (item.contactMethod === "discord" && item.discord) {
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

  if (item.source === "listing" && state.canManage && state.currentUserId === item.userId) {
    els.detailActions.append(
      createActionButton("Edit listing", "", () => {
        closeListingModal();
        openComposer(item);
      })
    );
  }

  els.listingModal.showModal();
}

function closeListingModal() {
  if (els.listingModal.open) els.listingModal.close();
}

function syncDiscordField() {
  els.discordField.hidden = els.contactMethod.value !== "discord";
}

function resetComposer() {
  state.editingId = null;
  els.composerTitle.textContent = "Create listing";
  els.listingForm.reset();
  els.listingType.value = "SELLING";
  els.listingQuantity.value = "1";
  els.contactMethod.value = "chat";
  els.formFeedback.textContent = "";
  syncDiscordField();
}

function openComposer(item = null) {
  if (state.activeCategory !== "Item") {
    setStatus("Add listing is only for Item products. Accounts, Services, and Robux come from Supabase store products.", "error");
    return;
  }

  if (!state.canManage) {
    setStatus("Only the owner or an allowlisted admin can manage listings.", "error");
    return;
  }

  resetComposer();

  if (item) {
    state.editingId = item.id;
    els.composerTitle.textContent = "Edit listing";
    els.listingGame.value = item.game;
    els.listingItem.value = item.item;
    els.listingType.value = item.type;
    els.listingPrice.value = String(item.price);
    els.listingQuantity.value = String(item.quantity);
    els.contactMethod.value = item.contactMethod;
    els.discordUsername.value = item.discord || "";
    els.listingNotes.value = item.notes || "";
    syncDiscordField();
  }

  els.composerModal.showModal();
}

function closeComposer() {
  if (els.composerModal.open) els.composerModal.close();
}

async function loadItemListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const sellerNames = await fetchDisplayNames((data || []).map((row) => row.user_id));
  state.itemListings = (data || []).map((row) => normalizeItemListing(row, sellerNames));
}

async function loadStoreProducts() {
  const { data, error } = await supabase
    .from("topup_products")
    .select("*")
    .in("game", ["GenAcc", "GenSer", "Roblox"])
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

  if (session.user.id === item.userId) {
    setStatus("You are the seller of this listing.", "error");
    return;
  }

  const roomName = [session.user.id, item.userId].sort().join("__");

  const { data: existing, error: fetchError } = await supabase
    .from("chat_rooms")
    .select("id, name")
    .eq("name", roomName)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    setStatus(fetchError.message, "error");
    return;
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from("chat_rooms")
      .insert({ name: roomName, created_by: session.user.id });

    if (insertError) {
      setStatus(insertError.message, "error");
      return;
    }
  }

  setStatus("Chat room prepared. Open your chat flow to continue.");
  closeListingModal();
}

async function saveListing(event) {
  event.preventDefault();
  els.formFeedback.textContent = "Saving...";

  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user?.id || !state.canManage) {
    els.formFeedback.textContent = "You do not have permission to manage listings.";
    return;
  }

  const payload = {
    user_id: session.user.id,
    game: els.listingGame.value.trim(),
    item: els.listingItem.value.trim(),
    type: els.listingType.value,
    price: Number(els.listingPrice.value),
    quantity: Number(els.listingQuantity.value),
    contact_method: els.contactMethod.value,
    discord: els.contactMethod.value === "discord" ? els.discordUsername.value.trim() || null : null,
    notes: els.listingNotes.value.trim() || null,
  };

  if (!payload.game || !payload.item || !Number.isFinite(payload.price) || payload.price < 0) {
    els.formFeedback.textContent = "Fill in the required fields correctly.";
    return;
  }

  let error;

  if (state.editingId) {
    const updatePayload = { ...payload };
    delete updatePayload.user_id;

    ({ error } = await supabase
      .from("listings")
      .update(updatePayload)
      .eq("id", state.editingId)
      .eq("user_id", session.user.id));
  } else {
    ({ error } = await supabase.from("listings").insert(payload));
  }

  if (error) {
    els.formFeedback.textContent = error.message;
    return;
  }

  els.formFeedback.textContent = state.editingId ? "Listing updated." : "Listing created.";
  await loadItemListings();
  fillGameFilter();
  applyFilters();

  setTimeout(() => {
    closeComposer();
    resetComposer();
  }, 350);
}

async function deleteListing(item) {
  const confirmed = window.confirm(`Delete "${item.item}"?`);
  if (!confirmed) return;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", item.id)
    .eq("user_id", session.user.id);

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Listing deleted.");
  await loadItemListings();
  fillGameFilter();
  applyFilters();
}

function setAuthUI(session) {
  const user = session?.user;
  state.currentUserId = user?.id || null;

  if (!user) {
    els.loginLink.hidden = false;
    els.userMenu.hidden = true;
    els.openComposerBtn.hidden = true;
    els.ownerOrdersLink.hidden = true;
    return;
  }

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "User";

  els.loginLink.hidden = true;
  els.userMenu.hidden = false;
  els.userName.textContent = displayName;
  els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();
  els.openComposerBtn.hidden = !(state.canManage && state.activeCategory === "Item");
  els.ownerOrdersLink.hidden = user.id !== OWNER_UID;
}

function closeUserDropdown() {
  els.userDropdown.hidden = true;
  els.userChip?.setAttribute("aria-expanded", "false");
}

async function initializeAuth() {
  const { data } = await supabase.auth.getSession();
  state.canManage = await canManageListings(data.session);
  setAuthUI(data.session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.canManage = await canManageListings(session);
    setAuthUI(session);
    applyFilters();
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", applyFilters);
  els.gameFilter.addEventListener("change", applyFilters);
  els.typeFilter.addEventListener("change", applyFilters);
  els.sortFilter.addEventListener("change", applyFilters);

  els.categorySwitch?.addEventListener("click", (event) => {
    const btn = event.target.closest(".category-btn");
    if (!btn) return;

    state.activeCategory = btn.dataset.category || "Item";
    els.typeFilter.value = "all";
    fillGameFilter();
    applyFilters();
    closeUserDropdown();
  });

  els.resetFiltersBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.gameFilter.value = "all";
    els.typeFilter.value = "all";
    els.sortFilter.value = "newest";
    applyFilters();
  });

  els.userChip?.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = els.userDropdown.hidden;
    closeUserDropdown();
    els.userDropdown.hidden = !willOpen;
    els.userChip.setAttribute("aria-expanded", String(willOpen));
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
    openComposer();
  });

  els.closeListingModal?.addEventListener("click", closeListingModal);

  els.listingModal?.addEventListener("click", (event) => {
    const box = els.listingModal.querySelector(".detail-modal__content");
    if (box && !box.contains(event.target)) closeListingModal();
  });

  els.closeComposerBtn?.addEventListener("click", closeComposer);

  els.cancelComposerBtn?.addEventListener("click", () => {
    closeComposer();
    resetComposer();
  });

  els.composerModal?.addEventListener("close", resetComposer);
  els.contactMethod?.addEventListener("change", syncDiscordField);
  els.listingForm?.addEventListener("submit", saveListing);
}

async function init() {
  syncDiscordField();
  bindEvents();
  await initializeAuth();
  await loadEverything();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected error while loading the marketplace.", "error");
});
