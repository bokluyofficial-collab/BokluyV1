import { supabase } from "./supabase/supabaseClient.js";

const PRODUCT_CATALOG = [
  ...(window.bloxFruitsProducts || []),
  ...(window.animeLastStandProducts || []),
];

const FALLBACK_IMAGE = "./image.png";

const state = {
  sellerId: null,
  seller: null,
  listings: [],
  filtered: [],
  activeCategory: "All",
};

const els = {
  backBtn: document.getElementById("backBtn"),
  storeStatus: document.getElementById("storeStatus"),
  storeAvatar: document.getElementById("storeAvatar"),
  storeName: document.getElementById("storeName"),
  storeBadge: document.getElementById("storeBadge"),
  storeHandle: document.getElementById("storeHandle"),
  statTotal: document.getElementById("statTotal"),
  statActive: document.getElementById("statActive"),
  statSold: document.getElementById("statSold"),
  statGames: document.getElementById("statGames"),
  storeTabs: document.getElementById("storeTabs"),
  storeSearch: document.getElementById("storeSearch"),
  storeGrid: document.getElementById("storeGrid"),
};

function setStatus(message, isError = false) {
  if (!message) {
    els.storeStatus.className = "store-status";
    els.storeStatus.textContent = "";
    return;
  }
  els.storeStatus.textContent = message;
  els.storeStatus.className = `store-status is-visible${isError ? " is-error" : ""}`;
}

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function getSellerIdFromQuery() {
  const url = new URL(window.location.href);
  return url.searchParams.get("seller");
}

async function loadSeller() {
  state.sellerId = getSellerIdFromQuery();
  if (!state.sellerId) throw new Error("Missing seller id.");

  const { data, error } = await supabase
    .from("seller_profiles_public")
    .select("user_id, store_name, is_verified")
    .eq("user_id", state.sellerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Seller store not found.");

  state.seller = data;
}

async function loadListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_user_id", state.sellerId)
    .in("status", ["active", "sold_out", "paused"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  state.listings = (data || []).map((row) => {
    const image = row.category === "Accounts"
      ? (row.image_url || FALLBACK_IMAGE)
      : productImageFor(row.game, row.item);

    return {
      id: row.id,
      category: row.category || "Item",
      game: row.game || "Unknown",
      item: row.item || "Untitled item",
      price: Number(row.price || 0),
      quantity: Number(row.quantity || 0),
      status: row.status || "active",
      image,
    };
  });
}

function renderStoreHeader() {
  const seller = state.seller;
  const listings = state.listings;

  const activeCount = listings.filter((x) => x.status === "active").length;
  const soldCount = listings.filter((x) => x.status === "sold_out").length;
  const gamesCount = new Set(listings.map((x) => x.game).filter(Boolean)).size;

  document.title = `${seller.store_name} • Store`;

  els.storeName.textContent = seller.store_name || "Seller Store";
  els.storeHandle.textContent = `@${String(seller.store_name || "seller").toLowerCase().replace(/\s+/g, "")}`;
  els.storeBadge.hidden = !seller.is_verified;
  els.storeAvatar.textContent = String(seller.store_name || "S").trim().charAt(0).toUpperCase();

  els.statTotal.textContent = String(listings.length);
  els.statActive.textContent = String(activeCount);
  els.statSold.textContent = String(soldCount);
  els.statGames.textContent = String(gamesCount);
}

function applyFilters() {
  const query = els.storeSearch.value.trim().toLowerCase();

  let rows = [...state.listings];

  if (state.activeCategory !== "All") {
    rows = rows.filter((x) => x.category === state.activeCategory);
  }

  if (query) {
    rows = rows.filter((x) =>
      [x.item, x.game, x.category].join(" ").toLowerCase().includes(query)
    );
  }

  state.filtered = rows;
  renderGrid();
}

function renderGrid() {
  const rows = state.filtered;
  els.storeGrid.innerHTML = "";

  if (!rows.length) {
    els.storeGrid.innerHTML = `<div class="store-empty">No listings found in this store.</div>`;
    return;
  }

  for (const item of rows) {
    const sold = item.status === "sold_out";

    const card = document.createElement("a");
    card.className = "store-product-card";
    card.href = `./market-item.html?id=${encodeURIComponent(item.id)}`;

    card.innerHTML = `
      <div class="store-product-image">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.item)}" onerror="this.src='./image.png'" />
        <span class="store-game-pill">${escapeHtml(item.game)}</span>
      </div>
      <h3 class="store-product-title">${escapeHtml(item.item)}</h3>
      <div class="store-product-bottom">
        <span class="store-product-price">${formatPrice(item.price)}</span>
        <span class="store-stock-badge${sold ? " is-sold" : ""}">${sold ? "Sold" : "In stock"}</span>
      </div>
    `;

    els.storeGrid.appendChild(card);
  }
}

function bindEvents() {
  els.backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "./index.html";
  });

  els.storeTabs.addEventListener("click", (event) => {
    const btn = event.target.closest(".store-tab");
    if (!btn) return;

    state.activeCategory = btn.dataset.category || "All";

    document.querySelectorAll(".store-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab === btn);
    });

    applyFilters();
  });

  els.storeSearch.addEventListener("input", applyFilters);
}

async function init() {
  bindEvents();
  await loadSeller();
  await loadListings();
  renderStoreHeader();
  applyFilters();
  setStatus("");
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Failed to load store.", true);
});