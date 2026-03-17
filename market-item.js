import { supabase } from "./supabase/supabaseClient.js";

const PRODUCT_CATALOG = [
  ...(window.bloxFruitsProducts || []),
  ...(window.animeLastStandProducts || []),
];

const FALLBACK_IMAGE = "./image.png";

const state = {
  listing: null,
  qty: 1,
  currentUserId: null,
};

const els = {
  backBtn: document.getElementById("backBtn"),
  statusBanner: document.getElementById("statusBanner"),
  productImage: document.getElementById("productImage"),
  soldBadge: document.getElementById("soldBadge"),
  productTitle: document.getElementById("productTitle"),
  productPrice: document.getElementById("productPrice"),
  productStock: document.getElementById("productStock"),
  inlineTotal: document.getElementById("inlineTotal"),
  bottomTotal: document.getElementById("bottomTotal"),
  productNote: document.getElementById("productNote"),
  sellerName: document.getElementById("sellerName"),
  sellerBadge: document.getElementById("sellerBadge"),
  sellerSubtitle: document.getElementById("sellerSubtitle"),
  qtyMinus: document.getElementById("qtyMinus"),
  qtyPlus: document.getElementById("qtyPlus"),
  qtyValue: document.getElementById("qtyValue"),
  termsCheck: document.getElementById("termsCheck"),
  buyNowBtn: document.getElementById("buyNowBtn"),
  messageSellerBtn: document.getElementById("messageSellerBtn"),
  messageSellerTop: document.getElementById("messageSellerTop"),
  viewStoreBtn: document.getElementById("viewStoreBtn"),
};

function setStatus(message, isError = false) {
  if (!els.statusBanner) return;
  if (!message) {
    els.statusBanner.className = "status-banner";
    els.statusBanner.textContent = "";
    return;
  }
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner is-visible${isError ? " is-error" : ""}`;
}

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
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

function getListingIdFromQuery() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id");
}

async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  state.currentUserId = data?.session?.user?.id || null;
}

async function loadListing() {
  const listingId = getListingIdFromQuery();
  if (!listingId) throw new Error("Missing listing id.");

  const { data: row, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();

  if (error) throw error;
  if (!row) throw new Error("Listing not found.");

  const sellerId = row.seller_user_id || row.user_id;
  let seller = null;

  if (sellerId) {
    const { data: sellerRow } = await supabase
      .from("seller_profiles_public")
      .select("user_id, store_name, is_verified")
      .eq("user_id", sellerId)
      .maybeSingle();

    seller = sellerRow || null;
  }

  const image = row.category === "Accounts"
    ? (row.image_url || FALLBACK_IMAGE)
    : productImageFor(row.game, row.item);

  state.listing = {
    id: row.id,
    userId: sellerId,
    category: row.category || "Item",
    game: row.game || "Unknown",
    item: row.item || "Untitled item",
    price: Number(row.price || 0),
    quantity: Math.max(1, Number(row.quantity || 1)),
    status: row.status || "active",
    notes: row.notes || "",
    sellerName: seller?.store_name || "Seller",
    sellerVerified: !!seller?.is_verified,
    image,
  };
}

function syncQtyButtons() {
  const maxQty = state.listing?.quantity || 1;
  const sold = state.listing?.status === "sold_out";
  els.qtyMinus.disabled = sold || state.qty <= 1;
  els.qtyPlus.disabled = sold || state.qty >= maxQty;
  els.buyNowBtn.disabled = sold;
  els.messageSellerBtn.disabled = sold;
  els.messageSellerTop.disabled = sold;
}

function updateTotals() {
  const total = (state.listing?.price || 0) * state.qty;
  const label = formatPrice(total);
  els.qtyValue.value = String(state.qty);
  els.inlineTotal.textContent = label;
  els.bottomTotal.textContent = label;
}

function renderListing() {
  const item = state.listing;
  if (!item) return;

  document.title = `${item.item} • Bokluy`;
  els.productImage.src = item.image || FALLBACK_IMAGE;
  els.productImage.alt = `${item.item} image`;
  els.productTitle.textContent = item.item;
  els.productPrice.textContent = formatPrice(item.price);
  els.productStock.textContent = String(item.quantity);
  els.productNote.textContent = item.notes || "No additional note.";
  els.sellerName.textContent = item.sellerName;
  els.sellerSubtitle.textContent = `${item.category} • ${item.game}`;
  els.sellerBadge.hidden = !item.sellerVerified;
  els.soldBadge.hidden = item.status !== "sold_out";

  state.qty = Math.min(Math.max(1, state.qty), item.quantity);
  updateTotals();
  syncQtyButtons();

  if (item.status === "sold_out") {
    setStatus("This listing is already sold.");
  } else {
    setStatus("");
  }
}

async function ensureDirectRoom(item) {
  if (!state.currentUserId) {
    window.location.href = `./auth.html?redirect=${encodeURIComponent(window.location.href)}`;
    return null;
  }

  if (state.currentUserId === item.userId) {
    setStatus("You are the seller of this listing.", true);
    return null;
  }

  const [userA, userB] = [state.currentUserId, item.userId].sort();
  const roomName = `dm_${userA}_${userB}`;

  const { data: existing, error: fetchError } = await supabase
    .from("chat_rooms")
    .select("id, user_a_id, user_b_id")
    .eq("user_a_id", userA)
    .eq("user_b_id", userB)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await supabase
    .from("chat_rooms")
    .insert({
      name: roomName,
      created_by: state.currentUserId,
      user_a_id: userA,
      user_b_id: userB,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}

async function openSellerChat(prefillMessage = "") {
  const item = state.listing;
  if (!item) return;

  if (item.status === "sold_out") {
    setStatus("This listing is already sold.", true);
    return;
  }

  if (!item.userId) {
    setStatus("Seller account not found.", true);
    return;
  }

  try {
    const roomId = await ensureDirectRoom(item);
    if (!roomId) return;

    const message = String(prefillMessage || "").trim();
    if (message) {
      await supabase.from("chat_messages").insert({
        room_id: roomId,
        user_id: state.currentUserId,
        message,
      });
    }

    window.location.href = `./messages.html?room_id=${encodeURIComponent(roomId)}`;
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to open seller chat.", true);
  }
}

function buildBuyMessage() {
  const item = state.listing;
  return `Hi, I want to buy ${state.qty} unit(s) of ${item.item} for ${formatPrice(item.price * state.qty)}.`;
}

async function handleBuyNow() {
  if (!els.termsCheck.checked) {
    setStatus("Please accept the terms first.", true);
    return;
  }

  await openSellerChat(buildBuyMessage());
}

function openStorePage() {
  const item = state.listing;
  if (!item?.userId) {
    setStatus("Seller store not found.", true);
    return;
  }

  window.location.href = `./seller-store.html?seller=${encodeURIComponent(item.userId)}`;
}

function bindEvents() {
  els.backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "./index.html";
  });

  els.qtyMinus.addEventListener("click", () => {
    state.qty = Math.max(1, state.qty - 1);
    updateTotals();
    syncQtyButtons();
  });

  els.qtyPlus.addEventListener("click", () => {
    const maxQty = state.listing?.quantity || 1;
    state.qty = Math.min(maxQty, state.qty + 1);
    updateTotals();
    syncQtyButtons();
  });

  els.messageSellerBtn.addEventListener("click", () => openSellerChat("Hi, I want to ask about this listing."));
  els.messageSellerTop.addEventListener("click", () => openSellerChat("Hi, I want to ask about this listing."));
  els.buyNowBtn.addEventListener("click", handleBuyNow);
  els.viewStoreBtn.addEventListener("click", openStorePage);
}

async function init() {
  bindEvents();
  await getCurrentUser();
  await loadListing();
  renderListing();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Failed to load product.", true);
});