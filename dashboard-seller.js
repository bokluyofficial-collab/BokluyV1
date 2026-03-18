import { supabase } from "./supabase/supabaseClient.js";

const LISTING_OPTIONS = {
  "Blox Fruits": {
    Accounts: ["Starter Account", "Mid Account", "Max Account", "PvP Account", "Fruit Account"],
    Services: ["Raid Service", "Leveling Service", "Fruit Hunt Service"]
  },
  "MLBB": {
    Accounts: ["Epic Account", "Legend Account", "Mythic Account", "Skin Account"],
    Services: ["Rank Push", "Classic Boost", "Coaching"]
  },
  "Growtopia": {
    Item: ["DL", "BGL", "World Lock"],
    Accounts: ["Starter Account", "Farm Account", "Rich Account"],
    Services: ["Farm Service", "Build Service", "World Setup"]
  },
  "Roblox": {
    Item: ["Giftable Item", "Limited Item", "In-game Item"],
    Accounts: ["Starter Account", "Main Account", "Stacked Account"],
    Services: ["Grinding Service", "Leveling Service", "Game Service"]
  },
  "Free Fire": {
    Accounts: ["Starter Account", "Elite Account", "Rare Skin Account"],
    Services: ["Rank Push", "Coaching", "Boosting"]
  },
  "Honor of Kings": {
    Accounts: ["Starter Account", "High Rank Account", "Skin Account"],
    Services: ["Rank Push", "Coaching", "Duo Service"]
  },
  "PUBG Mobile": {
    Accounts: ["Starter Account", "UC Account", "Rare Skin Account"],
    Services: ["Rank Push", "Coaching", "Duo Service"]
  },
  "Delta Force": {
    Accounts: ["Starter Account", "Mid Account", "High Tier Account"],
    Services: ["Boosting", "Coaching", "Mission Service"]
  },
  "Blood Strike": {
    Accounts: ["Starter Account", "Rare Account", "Max Account"],
    Services: ["Rank Push", "Coaching", "Boosting"]
  }
};

const COSMETIC_LABELS = {
  name_style: "Name color",
  banner: "Banner",
  avatar_border: "Avatar border",
  theme: "Theme",
};

const state = {
  session: null,
  sellerProfile: null,
  listings: [],
  orders: [],
  ledger: [],
  catalog: [],
  owned: [],
  editingId: null,
  editingImageUrl: null,
};

const els = {
  statusCard: document.getElementById("statusCard"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  logoutBtn: document.getElementById("logoutBtn"),

  storeNameStat: document.getElementById("storeNameStat"),
  walletStat: document.getElementById("walletStat"),
  verifiedStat: document.getElementById("verifiedStat"),

  refreshProfileBtn: document.getElementById("refreshProfileBtn"),
  refreshListingsBtn: document.getElementById("refreshListingsBtn"),
  refreshOrdersBtn: document.getElementById("refreshOrdersBtn"),
  refreshLedgerBtn: document.getElementById("refreshLedgerBtn"),
  refreshShopBtn: document.getElementById("refreshShopBtn"),
  refreshOwnedBtn: document.getElementById("refreshOwnedBtn"),
  refreshCustomizeBtn: document.getElementById("refreshCustomizeBtn"),
  openStoreBtn: document.getElementById("openStoreBtn"),

  sellerProfileInfo: document.getElementById("sellerProfileInfo"),
  sellerListingsTableBody: document.getElementById("sellerListingsTableBody"),
  sellerOrdersTableBody: document.getElementById("sellerOrdersTableBody"),
  ledgerTableBody: document.getElementById("ledgerTableBody"),
  shopGrid: document.getElementById("shopGrid"),
  ownedGrid: document.getElementById("ownedGrid"),
  inventoryTableBody: document.getElementById("inventoryTableBody"),
  activeCosmeticsInfo: document.getElementById("activeCosmeticsInfo"),

  avatarForm: document.getElementById("avatarForm"),
  avatarUrlInput: document.getElementById("avatarUrlInput"),
  avatarPreviewImg: document.getElementById("avatarPreviewImg"),
  avatarPreviewFallback: document.getElementById("avatarPreviewFallback"),
  avatarFormStatus: document.getElementById("avatarFormStatus"),
  resetAvatarBtn: document.getElementById("resetAvatarBtn"),

  sellerListingForm: document.getElementById("sellerListingForm"),
  listingGame: document.getElementById("listingGame"),
  listingCategory: document.getElementById("listingCategory"),
  listingItem: document.getElementById("listingItem"),
  listingType: document.getElementById("listingType"),
  listingPrice: document.getElementById("listingPrice"),
  listingQuantity: document.getElementById("listingQuantity"),
  listingStatus: document.getElementById("listingStatus"),
  contactMethod: document.getElementById("contactMethod"),
  discordField: document.getElementById("discordField"),
  discordUsername: document.getElementById("discordUsername"),
  listingImage: document.getElementById("listingImage"),
  imageField: document.getElementById("imageField"),
  imagePreviewWrap: document.getElementById("imagePreviewWrap"),
  imagePreview: document.getElementById("imagePreview"),
  listingNotes: document.getElementById("listingNotes"),
  listingFormStatus: document.getElementById("listingFormStatus"),
  saveListingBtn: document.getElementById("saveListingBtn"),
  resetListingBtn: document.getElementById("resetListingBtn"),
};

function setStatus(message, isError = false) {
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

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatBCoins(value) {
  return `${Number(value || 0).toLocaleString()} B Coins`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "approved" || s === "admin_completed") return "badge approved";
  if (s === "suspended" || s === "rejected" || s === "deleted" || s === "sold_out" || s === "help_requested") return "badge rejected";
  if (s === "pending" || s === "paused" || s === "paid" || s === "delivered" || s === "buyer_completed") return "badge pending";
  return "badge";
}

function setFormStatus(message, isError = false) {
  els.listingFormStatus.textContent = message || "";
  els.listingFormStatus.style.color = isError ? "#fecaca" : "var(--muted)";
}

function setAvatarStatus(message, isError = false) {
  els.avatarFormStatus.textContent = message || "";
  els.avatarFormStatus.style.color = isError ? "#fecaca" : "var(--muted)";
}

function syncDiscordField() {
  els.discordField.hidden = els.contactMethod.value !== "discord";
}

function clearImagePreview() {
  els.imagePreview.removeAttribute("src");
  els.imagePreviewWrap.hidden = true;
}

function syncImageField() {
  const isAccount = els.listingCategory.value === "Accounts";
  els.imageField.hidden = !isAccount;

  if (!isAccount) {
    clearImagePreview();
    if (els.listingImage) els.listingImage.value = "";
    els.imagePreviewWrap.hidden = true;
    return;
  }

  els.imagePreviewWrap.hidden = !els.imagePreview.getAttribute("src");
}

function populateGames() {
  const games = Object.keys(LISTING_OPTIONS);
  els.listingGame.innerHTML = `
    <option value="">Select game</option>
    ${games.map((game) => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`).join("")}
  `;
}

function populateCategories() {
  const game = els.listingGame.value;
  const categories = game ? Object.keys(LISTING_OPTIONS[game] || {}) : [];
  els.listingCategory.innerHTML = `
    <option value="">Select category</option>
    ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
  `;
  els.listingItem.innerHTML = `<option value="">Select item</option>`;
  syncImageField();
}

function populateItems() {
  const game = els.listingGame.value;
  const category = els.listingCategory.value;
  const items = LISTING_OPTIONS[game]?.[category] || [];

  els.listingItem.innerHTML = `
    <option value="">Select item</option>
    ${items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
  `;
}

function renderAvatarPreview(url, name) {
  const fallback = String(name || "S").trim().charAt(0).toUpperCase();
  if (url) {
    els.avatarPreviewImg.src = url;
    els.avatarPreviewImg.hidden = false;
    els.avatarPreviewFallback.hidden = true;
  } else {
    els.avatarPreviewImg.hidden = true;
    els.avatarPreviewFallback.hidden = false;
    els.avatarPreviewFallback.textContent = fallback;
  }
}

function getAvatarCooldownText(value) {
  if (!value) return "You can update your avatar now.";
  const next = new Date(new Date(value).getTime() + 3 * 24 * 60 * 60 * 1000);
  const now = new Date();
  if (next <= now) return "You can update your avatar now.";

  const diff = next.getTime() - now.getTime();
  const totalHours = Math.ceil(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) return `You can update your avatar again in ${days} day(s) ${hours} hour(s).`;
  return `You can update your avatar again in ${hours} hour(s).`;
}

function resetAvatarForm() {
  const sp = state.sellerProfile || {};
  els.avatarUrlInput.value = sp.avatar_url || "";
  renderAvatarPreview(sp.avatar_url || "", sp.store_name || "Seller");
  setAvatarStatus(getAvatarCooldownText(sp.avatar_updated_at), false);
}

function resetForm() {
  state.editingId = null;
  state.editingImageUrl = null;
  els.sellerListingForm.reset();
  els.listingType.value = "SELLING";
  els.listingQuantity.value = "1";
  els.listingStatus.value = "active";
  els.contactMethod.value = "chat";
  els.saveListingBtn.textContent = "Save listing";
  setFormStatus("");
  populateGames();
  els.listingCategory.innerHTML = `<option value="">Select category</option>`;
  els.listingItem.innerHTML = `<option value="">Select item</option>`;
  syncDiscordField();
  clearImagePreview();
  syncImageField();
}

function setTab(tab) {
  const safeTab = ["dashboard", "customize", "inventory"].includes(tab) ? tab : "dashboard";

  document.querySelectorAll(".dashboard-tab-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === safeTab);
  });

  document.getElementById("tab-dashboard").hidden = safeTab !== "dashboard";
  document.getElementById("tab-customize").hidden = safeTab !== "customize";
  document.getElementById("tab-inventory").hidden = safeTab !== "inventory";
}

function getInitialTabFromQuery() {
  const url = new URL(window.location.href);
  return url.searchParams.get("tab") || "dashboard";
}

async function requireSeller() {
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

  const url = new URL(window.location.href);
  const mode = url.searchParams.get("mode");
  const allowAdminStore = mode === "admin_store";

  const displayName =
    session.user.user_metadata?.display_name ||
    session.user.user_metadata?.full_name ||
    session.user.email ||
    "Seller";

  els.userName.textContent = displayName;
  els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin", {
    check_user_id: session.user.id,
  });

  if (adminErr) {
    setStatus(adminErr.message || "Failed to verify account.", true);
    return null;
  }

  const { data: sellerProfile, error: sellerErr } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (sellerErr && sellerErr.code !== "PGRST116") {
    setStatus(sellerErr.message || "Failed to load seller profile.", true);
    return null;
  }

  if (isAdmin === true && !allowAdminStore) {
    window.location.href = "./dashboard-admin.html";
    return null;
  }

  if (!sellerProfile) {
    if (isAdmin === true && allowAdminStore) {
      setStatus("Admin store profile not found.", true);
      return null;
    }

    window.location.href = "./dashboard-user.html";
    return null;
  }

  state.session = session;
  state.sellerProfile = sellerProfile;
  return session;
}
async function loadSellerListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_user_id", state.session.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.listings = data || [];
}

async function loadSellerOrders() {
  const { data, error } = await supabase
    .from("marketplace_orders")
    .select("*")
    .eq("seller_user_id", state.session.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.orders = data || [];
}

async function loadLedger() {
  const { data, error } = await supabase
    .from("seller_wallet_ledger")
    .select("*")
    .eq("seller_user_id", state.session.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.ledger = data || [];
}

async function loadCatalog() {
  const { data, error } = await supabase
    .from("seller_cosmetics_catalog")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  state.catalog = data || [];
}

async function loadOwned() {
  const { data, error } = await supabase
    .from("seller_owned_cosmetics")
    .select("id, cosmetic_id, purchased_at")
    .eq("seller_user_id", state.session.user.id)
    .order("purchased_at", { ascending: false });

  if (error) throw error;
  state.owned = data || [];
}

function renderProfile() {
  const sp = state.sellerProfile;
  els.storeNameStat.textContent = sp.store_name || "—";
  els.walletStat.textContent = formatBCoins(sp.bcoin_balance);
  els.verifiedStat.innerHTML = sp.is_verified ? `Yes <span class="verified-badge">✓</span>` : "No";

  els.sellerProfileInfo.innerHTML = `
    <div class="info-item">
      <span class="k">Store name</span>
      <span class="v">${escapeHtml(sp.store_name || "—")}${sp.is_verified ? ` <span class="verified-badge">✓</span>` : ""}</span>
    </div>
    <div class="info-item">
      <span class="k">Status</span>
      <span class="v"><span class="${badgeClass(sp.status)}">${escapeHtml(sp.status)}</span></span>
    </div>
    <div class="info-item">
      <span class="k">B Coin balance</span>
      <span class="v">${escapeHtml(formatBCoins(sp.bcoin_balance))}</span>
    </div>
    <div class="info-item">
      <span class="k">Lifetime earned</span>
      <span class="v">${escapeHtml(formatBCoins(sp.lifetime_bcoin_earned))}</span>
    </div>
    <div class="info-item">
      <span class="k">Avatar cooldown</span>
      <span class="v">${escapeHtml(getAvatarCooldownText(sp.avatar_updated_at))}</span>
    </div>
    <div class="info-item">
      <span class="k">Active name color</span>
      <span class="v">${escapeHtml(sp.active_name_style || "Default")}</span>
    </div>
    <div class="info-item">
      <span class="k">Active banner</span>
      <span class="v">${escapeHtml(sp.active_banner_style || "Default")}</span>
    </div>
    <div class="info-item">
      <span class="k">Active avatar border</span>
      <span class="v">${escapeHtml(sp.active_avatar_border || "Default")}</span>
    </div>
    <div class="info-item">
      <span class="k">Active theme</span>
      <span class="v">${escapeHtml(sp.active_store_theme || "Default")}</span>
    </div>
  `;

  els.activeCosmeticsInfo.innerHTML = `
    <div class="info-item"><span class="k">Name color</span><span class="v">${escapeHtml(sp.active_name_style || "Default")}</span></div>
    <div class="info-item"><span class="k">Banner</span><span class="v">${escapeHtml(sp.active_banner_style || "Default")}</span></div>
    <div class="info-item"><span class="k">Avatar border</span><span class="v">${escapeHtml(sp.active_avatar_border || "Default")}</span></div>
    <div class="info-item"><span class="k">Theme</span><span class="v">${escapeHtml(sp.active_store_theme || "Default")}</span></div>
  `;

  resetAvatarForm();
}

function renderListings() {
  if (!state.listings.length) {
    els.sellerListingsTableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">You have no listings yet.</div></td></tr>`;
    return;
  }

  els.sellerListingsTableBody.innerHTML = state.listings.map((row) => `
    <tr>
      <td>
        <strong>${escapeHtml(row.item || "Untitled")}</strong>
        ${row.image_url ? `<div style="margin-top:8px;"><img src="${escapeHtml(row.image_url)}" alt="listing" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line);" /></div>` : ""}
      </td>
      <td>${escapeHtml(row.category || "Item")}</td>
      <td>${escapeHtml(row.game || "—")}</td>
      <td>${escapeHtml(formatMoney(row.price))}</td>
      <td>${escapeHtml(String(row.quantity || 0))}</td>
      <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status || "active")}</span></td>
      <td>
        <div class="actions-row">
          <button class="btn-secondary" type="button" data-action="edit" data-id="${escapeHtml(row.id)}">Edit</button>
          <button class="btn-secondary" type="button" data-action="sold" data-id="${escapeHtml(row.id)}">Mark Sold</button>
          <button class="btn-danger" type="button" data-action="delete" data-id="${escapeHtml(row.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderOrders() {
  if (!state.orders.length) {
    els.sellerOrdersTableBody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No seller orders yet.</div></td></tr>`;
    return;
  }

  els.sellerOrdersTableBody.innerHTML = state.orders.map((row) => {
    const canDeliver = ["paid", "help_requested"].includes(row.status);

    return `
      <tr>
        <td>${escapeHtml(row.listing_snapshot_title || "Order")}</td>
        <td>${escapeHtml(String(row.buyer_user_id).slice(0, 12))}</td>
        <td>${escapeHtml(formatMoney(row.total_price_usd))}</td>
        <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${escapeHtml(formatBCoins(row.reward_bcoins || 0))}</td>
        <td>
          <div class="actions-row">
            ${canDeliver ? `<button class="btn-success" type="button" data-order-action="deliver" data-id="${escapeHtml(row.id)}">Mark Delivered</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderLedger() {
  if (!state.ledger.length) {
    els.ledgerTableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No wallet history yet.</div></td></tr>`;
    return;
  }

  els.ledgerTableBody.innerHTML = state.ledger.map((row) => `
    <tr>
      <td>${escapeHtml(row.entry_type)}</td>
      <td>${escapeHtml(formatBCoins(row.amount_bcoins))}</td>
      <td>${escapeHtml(row.note || "—")}</td>
      <td>${escapeHtml(formatDate(row.created_at))}</td>
    </tr>
  `).join("");
}

function isActiveCosmetic(item) {
  const sp = state.sellerProfile;
  if (item.cosmetic_type === "name_style") return sp.active_name_style === item.code;
  if (item.cosmetic_type === "banner") return sp.active_banner_style === item.code;
  if (item.cosmetic_type === "avatar_border") return sp.active_avatar_border === item.code;
  if (item.cosmetic_type === "theme") return sp.active_store_theme === item.code;
  return false;
}

function renderShop() {
  if (!state.catalog.length) {
    els.shopGrid.innerHTML = `<div class="empty-state">No cosmetics available.</div>`;
    return;
  }

  const ownedIds = new Set(state.owned.map((x) => x.cosmetic_id));

  els.shopGrid.innerHTML = state.catalog.map((item) => {
    const owned = ownedIds.has(item.id);
    const active = isActiveCosmetic(item);
    const label = COSMETIC_LABELS[item.cosmetic_type] || item.cosmetic_type;

    return `
      <article class="shop-card">
        <div class="coin-chip">${escapeHtml(formatBCoins(item.price_bcoins))}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || "Cosmetic item")}</p>
        <p><strong>Type:</strong> ${escapeHtml(label)}</p>
        <div class="actions-row">
          ${
            owned
              ? `<button class="btn-secondary" type="button" data-shop-action="apply" data-type="${escapeHtml(item.cosmetic_type)}" data-code="${escapeHtml(item.code)}" ${active ? "disabled" : ""}>${active ? "Applied" : "Apply"}</button>`
              : `<button class="btn-success" type="button" data-shop-action="buy" data-code="${escapeHtml(item.code)}">Buy</button>`
          }
        </div>
      </article>
    `;
  }).join("");
}

function renderOwnedGrid() {
  const ownedIds = new Set(state.owned.map((x) => x.cosmetic_id));
  const ownedCatalog = state.catalog.filter((item) => ownedIds.has(item.id));

  if (!ownedCatalog.length) {
    els.ownedGrid.innerHTML = `<div class="empty-state">You do not own any cosmetics yet.</div>`;
    return;
  }

  els.ownedGrid.innerHTML = ownedCatalog.map((item) => {
    const active = isActiveCosmetic(item);
    const label = COSMETIC_LABELS[item.cosmetic_type] || item.cosmetic_type;

    return `
      <article class="shop-card">
        <div class="coin-chip">${escapeHtml(label)}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || "Owned cosmetic")}</p>
        <div class="actions-row">
          <button class="btn-secondary" type="button" data-shop-action="apply" data-type="${escapeHtml(item.cosmetic_type)}" data-code="${escapeHtml(item.code)}" ${active ? "disabled" : ""}>
            ${active ? "Applied" : "Apply"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderInventoryTable() {
  const ownedMap = new Map(state.owned.map((row) => [row.cosmetic_id, row]));
  const ownedCatalog = state.catalog.filter((item) => ownedMap.has(item.id));

  if (!ownedCatalog.length) {
    els.inventoryTableBody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No purchased cosmetics yet.</div></td></tr>`;
    return;
  }

  els.inventoryTableBody.innerHTML = ownedCatalog.map((item) => {
    const ownedRow = ownedMap.get(item.id);
    const label = COSMETIC_LABELS[item.cosmetic_type] || item.cosmetic_type;

    return `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(formatDate(ownedRow?.purchased_at))}</td>
      </tr>
    `;
  }).join("");
}

async function uploadListingImage(file) {
  if (!file) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${state.session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

function loadFormFromListing(row) {
  state.editingId = row.id;
  state.editingImageUrl = row.image_url || null;

  populateGames();
  els.listingGame.value = row.game || "";
  populateCategories();
  els.listingCategory.value = row.category || "";
  populateItems();
  els.listingItem.value = row.item || "";
  els.listingType.value = row.type || "SELLING";
  els.listingPrice.value = String(row.price ?? "");
  els.listingQuantity.value = String(row.quantity ?? 1);
  els.listingStatus.value = row.status || "active";
  els.contactMethod.value = row.contact_method || "chat";
  els.discordUsername.value = row.discord || "";
  els.listingNotes.value = row.notes || "";

  if (row.image_url && (row.category || "") === "Accounts") {
    els.imagePreview.src = row.image_url;
    els.imagePreviewWrap.hidden = false;
  } else {
    clearImagePreview();
  }

  els.saveListingBtn.textContent = "Update listing";
  setFormStatus("Editing listing.");
  syncDiscordField();
  syncImageField();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveListing(event) {
  event.preventDefault();
  setFormStatus("Saving...");

  const category = els.listingCategory.value;
  const status = els.listingStatus.value;
  const file = els.listingImage.files?.[0] || null;

  let imageUrl = state.editingImageUrl;

  try {
    if (category === "Accounts" && file) {
      imageUrl = await uploadListingImage(file);
    }

    const payload = {
      seller_user_id: state.session.user.id,
      user_id: state.session.user.id,
      category,
      game: els.listingGame.value,
      item: els.listingItem.value,
      type: els.listingType.value,
      price: Number(els.listingPrice.value),
      quantity: Number(els.listingQuantity.value),
      status,
      contact_method: els.contactMethod.value,
      discord: els.contactMethod.value === "discord" ? els.discordUsername.value.trim() || null : null,
      notes: els.listingNotes.value.trim() || null,
      image_url: category === "Accounts" ? imageUrl : null,
      sold_at: status === "sold_out" ? new Date().toISOString() : null,
    };

    if (!payload.game || !payload.category || !payload.item || !Number.isFinite(payload.price) || payload.price < 0) {
      setFormStatus("Fill in the required fields correctly.", true);
      return;
    }

    if (category === "Accounts" && !payload.image_url) {
      setFormStatus("Account listings need an image.", true);
      return;
    }

    let error;

    if (state.editingId) {
      const updatePayload = { ...payload };
      delete updatePayload.user_id;
      delete updatePayload.seller_user_id;

      ({ error } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", state.editingId)
        .eq("seller_user_id", state.session.user.id));
    } else {
      ({ error } = await supabase.from("listings").insert(payload));
    }

    if (error) {
      console.error(error);
      setFormStatus(error.message || "Failed to save listing.", true);
      return;
    }

    setFormStatus(state.editingId ? "Listing updated." : "Listing created.");
    await loadSellerListings();
    renderListings();
    resetForm();
  } catch (error) {
    console.error(error);
    setFormStatus(error.message || "Failed to upload image or save listing.", true);
  }
}

async function markSold(id) {
  const { error } = await supabase
    .from("listings")
    .update({
      status: "sold_out",
      sold_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("seller_user_id", state.session.user.id);

  if (error) {
    setStatus(error.message || "Failed to mark listing as sold.", true);
    return;
  }

  setStatus("Listing marked as sold.");
  await loadSellerListings();
  renderListings();
}

async function deleteListing(id) {
  const confirmed = window.confirm("Delete this listing?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("seller_user_id", state.session.user.id);

  if (error) {
    setStatus(error.message || "Failed to delete listing.", true);
    return;
  }

  setStatus("Listing deleted.");
  await loadSellerListings();
  renderListings();
}

async function markDelivered(orderId) {
  const { error } = await supabase.rpc("seller_mark_order_delivered", {
    target_order_id: orderId,
  });

  if (error) throw error;
}

async function buyCosmetic(code) {
  const { error } = await supabase.rpc("purchase_seller_cosmetic", {
    target_code: code,
  });

  if (error) throw error;
}

async function applyCosmetic(type, code) {
  const { error } = await supabase.rpc("apply_seller_cosmetic", {
    target_type: type,
    target_code: code,
  });

  if (error) throw error;
}

async function saveAvatar(event) {
  event.preventDefault();
  const newUrl = els.avatarUrlInput.value.trim();

  if (!newUrl) {
    setAvatarStatus("Enter an avatar image URL first.", true);
    return;
  }

  setAvatarStatus("Updating avatar...");

  const { error } = await supabase.rpc("update_seller_avatar", {
    new_avatar_url: newUrl,
  });

  if (error) {
    setAvatarStatus(error.message || "Failed to update avatar.", true);
    return;
  }

  setAvatarStatus("Avatar updated.");
  await refreshAll();
}

async function refreshAll() {
  setStatus("Loading seller dashboard...");
  try {
    const { data: freshProfile, error: profileErr } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", state.session.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (profileErr && profileErr.code !== "PGRST116") throw profileErr;
    if (!freshProfile) {
      window.location.href = "./dashboard-user.html";
      return;
    }

    state.sellerProfile = freshProfile;

    await Promise.all([
      loadSellerListings(),
      loadSellerOrders(),
      loadLedger(),
      loadCatalog(),
      loadOwned(),
    ]);

    renderProfile();
    renderListings();
    renderOrders();
    renderLedger();
    renderShop();
    renderOwnedGrid();
    renderInventoryTable();

    setStatus("Seller dashboard ready.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to load seller dashboard.", true);
  }
}

function bindEvents() {
  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.href = "./auth.html?logged_out=1";
  });

  document.querySelectorAll(".dashboard-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  els.refreshProfileBtn?.addEventListener("click", refreshAll);
  els.refreshListingsBtn?.addEventListener("click", refreshAll);
  els.refreshOrdersBtn?.addEventListener("click", refreshAll);
  els.refreshLedgerBtn?.addEventListener("click", refreshAll);
  els.refreshShopBtn?.addEventListener("click", refreshAll);
  els.refreshOwnedBtn?.addEventListener("click", refreshAll);
  els.refreshCustomizeBtn?.addEventListener("click", refreshAll);
  els.openStoreBtn?.addEventListener("click", () => {
    window.location.href = `./seller-store.html?seller=${encodeURIComponent(state.session.user.id)}`;
  });

  els.contactMethod?.addEventListener("change", syncDiscordField);

  els.avatarUrlInput?.addEventListener("input", () => {
    renderAvatarPreview(els.avatarUrlInput.value.trim(), state.sellerProfile?.store_name || "Seller");
  });

  els.avatarForm?.addEventListener("submit", saveAvatar);
  els.resetAvatarBtn?.addEventListener("click", resetAvatarForm);

  els.listingGame?.addEventListener("change", () => {
    populateCategories();
    clearImagePreview();
    if (els.listingImage) els.listingImage.value = "";
    state.editingImageUrl = null;
  });

  els.listingCategory?.addEventListener("change", () => {
    populateItems();

    if (els.listingCategory.value !== "Accounts") {
      clearImagePreview();
      if (els.listingImage) els.listingImage.value = "";
      state.editingImageUrl = null;
    }

    syncImageField();
  });

  els.listingImage?.addEventListener("change", () => {
    const file = els.listingImage.files?.[0];
    if (!file) {
      clearImagePreview();
      syncImageField();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      els.imagePreview.src = reader.result;
      els.imagePreviewWrap.hidden = false;
      syncImageField();
    };
    reader.readAsDataURL(file);
  });

  els.sellerListingForm?.addEventListener("submit", saveListing);
  els.resetListingBtn?.addEventListener("click", resetForm);

  els.sellerListingsTableBody?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action][data-id]");
    if (!btn) return;

    const action = btn.dataset.action;
    const row = state.listings.find((item) => String(item.id) === String(btn.dataset.id));
    if (!row) return;

    if (action === "edit") {
      loadFormFromListing(row);
      setTab("dashboard");
    } else if (action === "delete") {
      await deleteListing(row.id);
    } else if (action === "sold") {
      await markSold(row.id);
    }
  });

  els.sellerOrdersTableBody?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-order-action][data-id]");
    if (!btn) return;

    try {
      setStatus("Updating order...");
      await markDelivered(btn.dataset.id);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to update order.", true);
    }
  });

  const handleShopClick = async (event) => {
    const btn = event.target.closest("button[data-shop-action]");
    if (!btn) return;

    try {
      if (btn.dataset.shopAction === "buy") {
        setStatus("Purchasing cosmetic...");
        await buyCosmetic(btn.dataset.code);
      } else if (btn.dataset.shopAction === "apply") {
        setStatus("Applying cosmetic...");
        await applyCosmetic(btn.dataset.type, btn.dataset.code);
      }
      await refreshAll();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Shop action failed.", true);
    }
  };

  els.shopGrid?.addEventListener("click", handleShopClick);
  els.ownedGrid?.addEventListener("click", handleShopClick);
}

async function init() {
  bindEvents();
  const session = await requireSeller();
  if (!session) return;
  resetForm();
  setTab(getInitialTabFromQuery());
  await refreshAll();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected seller dashboard error.", true);
});