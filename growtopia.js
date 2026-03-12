console.log("GROWTOPIA TIER-CARDS + TIERED QTY + KHR (DL no Tier C) + SELL REQUEST (Edge Function) LOADED");

import { supabase } from "./supabase/supabaseClient.js";

/* ===== Your Supabase Edge Functions ===== */
const TELEGRAM_CHECKOUT_URL =
  "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/telegram-checkout";

const SELLER_REQUEST_URL =
  "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/seller-request";

/* ===== Page config ===== */
const dbGameKey = "growtopia";
const EXCHANGE_KHR_PER_USD = 4000;

/** DL product id (from topup_products.id). DL has NO Tier C */
const DL_ID = "gtp1";

/* ===== DOM ===== */
const rowsWrap = document.getElementById("rowsWrap");
const growIdEl = document.getElementById("growId");
const worldEl = document.getElementById("world");

const qtyMinus = document.getElementById("qtyMinus");
const qtyPlus = document.getElementById("qtyPlus");
const qtyValue = document.getElementById("qtyValue");

const totalUSDLine = document.getElementById("totalUSD");
const totalKHRLine = document.getElementById("totalKHR");

const btnBuy = document.getElementById("btnBuy");
const statusEl = document.getElementById("status");

/* Sell modal elements */
const sellOpenBtn = document.getElementById("sellOpenBtn");
const sellModal = document.getElementById("sellModal");
const sellCloseBg = document.getElementById("sellCloseBg");
const sellCloseBtn = document.getElementById("sellCloseBtn");
const sellCancel = document.getElementById("sellCancel");
const sellForm = document.getElementById("sellForm");
const sellStatus = document.getElementById("sellStatus");

/* Sell form fields */
const sellPhoneEl = document.getElementById("sellPhone");
const sellGameEl = document.getElementById("sellGame");
const sellItemEl = document.getElementById("sellItem");
const sellPriceEl = document.getElementById("sellPrice");
const sellMessageEl = document.getElementById("sellMessage");

/* ===== State ===== */
let PRODUCTS = [];
let selected = null; // { product, tierIndex, qty }
let PAYLINK_MAP = new Map(); // `${productId}:${qty}` -> pay_link

/* ===== Tiers ===== */
const TIERS = [
  { key: "A", label: "1–9", min: 1, max: 9, step: 1, hint: "x1 steps" },
  { key: "B", label: "10–90", min: 10, max: 90, step: 10, hint: "x10 steps" },
  { key: "C", label: "100–1000", min: 100, max: 1000, step: 100, hint: "x100 steps" },
];

// DL only uses A + B
function getTiersForProduct(productId) {
  if (String(productId) === String(DL_ID)) return [TIERS[0], TIERS[1]];
  return TIERS;
}

/* ===== Helpers ===== */
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function setSellStatus(msg) {
  if (sellStatus) sellStatus.textContent = msg || "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currencyLabel(p) {
  return (p?.currency || "USD").toUpperCase();
}

function getPayLink(productId, qty) {
  if (!productId || !qty) return "";
  return PAYLINK_MAP.get(`${productId}:${qty}`) || "";
}

function calcTotal() {
  if (!selected) return 0;
  const unit = Number(selected.product.price) || 0;
  return unit * selected.qty;
}

function updateCheckoutUI() {
  if (qtyValue) qtyValue.value = selected ? String(selected.qty) : "1";

  const cur = selected ? currencyLabel(selected.product) : "USD";
  const total = calcTotal();

  if (totalUSDLine) totalUSDLine.textContent = `${cur} ${total.toFixed(2)}`;

  if (totalKHRLine) {
    if (cur === "USD") {
      const khr = Math.round(total * EXCHANGE_KHR_PER_USD);
      totalKHRLine.textContent = `KHR ${khr.toLocaleString()}`;
    } else {
      totalKHRLine.textContent = `KHR -`;
    }
  }

  const okInputs =
    (growIdEl?.value || "").trim().length > 0 &&
    (worldEl?.value || "").trim().length > 0;

  const okPayLink = !!getPayLink(selected?.product?.id, selected?.qty);

  btnBuy.disabled = !(selected && okInputs && okPayLink);

  if (selected && !okPayLink) {
    setStatus("No payment link for this quantity. Add it in topup_pay_links.");
  } else if (!selected) {
    setStatus("Select an item & tier.");
  } else {
    setStatus("");
  }
}

function rerenderSelection() {
  if (!rowsWrap) return;

  rowsWrap.querySelectorAll("[data-item]").forEach(row => {
    const pid = row.getAttribute("data-item");
    const activeItem = selected && String(selected.product.id) === String(pid);

    row.style.borderColor = activeItem ? "rgba(250,204,21,.55)" : "rgba(255,255,255,.12)";
    row.style.background = activeItem ? "rgba(250,204,21,.06)" : "rgba(255,255,255,.06)";

    row.querySelectorAll("[data-tier]").forEach(card => {
      const idx = Number(card.getAttribute("data-tier"));
      card.classList.toggle("active", activeItem && selected.tierIndex === idx);
    });
  });
}

function selectProduct(productId) {
  const p = PRODUCTS.find(x => String(x.id) === String(productId));
  if (!p) return;

  const allowed = getTiersForProduct(p.id);
  const defaultTier = 0; // start at A
  selected = { product: p, tierIndex: defaultTier, qty: allowed[defaultTier].min };

  rerenderSelection();
  updateCheckoutUI();
}

function setTier(idx) {
  if (!selected) return;

  const allowed = getTiersForProduct(selected.product.id);
  const allowedIdxs = allowed.map(t => TIERS.findIndex(x => x.key === t.key));

  if (!allowedIdxs.includes(idx)) return; // DL can't select C

  const tier = TIERS[idx];
  selected.tierIndex = idx;
  selected.qty = tier.min;

  rerenderSelection();
  updateCheckoutUI();
}

function bumpQty(direction) {
  if (!selected) return;

  const allowed = getTiersForProduct(selected.product.id);
  const allowedIdxs = allowed.map(t => TIERS.findIndex(x => x.key === t.key));
  const currentAllowedPos = allowedIdxs.indexOf(selected.tierIndex);

  let pos = currentAllowedPos >= 0 ? currentAllowedPos : 0;
  let tierIndex = allowedIdxs[pos];
  let qty = selected.qty;

  const t = TIERS[tierIndex];

  if (direction === "plus") {
    if (qty + t.step <= t.max) {
      qty += t.step;
    } else {
      if (pos < allowed.length - 1) {
        pos += 1;
        tierIndex = allowedIdxs[pos];
        qty = TIERS[tierIndex].min;
      } else {
        qty = t.max; // DL stops at 90
      }
    }
  } else {
    if (qty - t.step >= t.min) {
      qty -= t.step;
    } else {
      if (pos > 0) {
        pos -= 1;
        tierIndex = allowedIdxs[pos];
        qty = TIERS[tierIndex].max;
      } else {
        qty = t.min;
      }
    }
  }

  selected.tierIndex = tierIndex;
  selected.qty = qty;

  rerenderSelection();
  updateCheckoutUI();
}

/* ===== Load products + links ===== */
async function loadProducts() {
  if (!rowsWrap) return;
  rowsWrap.textContent = "Loading...";

  const { data, error } = await supabase
    .from("topup_products")
    .select("id, game, title, price, currency, sort_order, active, img_url")
    .eq("game", dbGameKey)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    rowsWrap.textContent = "Failed to load products.";
    return;
  }

  PRODUCTS = data || [];
  if (!PRODUCTS.length) {
    rowsWrap.textContent = "No products found.";
    return;
  }

  // preload pay links for all products
  const productIds = PRODUCTS.map(p => p.id);
  const { data: links, error: linkErr } = await supabase
    .from("topup_pay_links")
    .select("product_id, qty, pay_link, active")
    .in("product_id", productIds)
    .eq("active", true);

  PAYLINK_MAP.clear();
  if (!linkErr) {
    (links || []).forEach(r => {
      PAYLINK_MAP.set(`${r.product_id}:${Number(r.qty)}`, r.pay_link);
    });
  }

  // Render rows (DL renders only A+B)
  rowsWrap.innerHTML = PRODUCTS.map(p => {
    const img = p.img_url || "./images/placeholder.png";
    const cur = currencyLabel(p);
    const allowed = getTiersForProduct(p.id);

    return `
      <div class="item-row" data-item="${escapeHtml(p.id)}">
        <div class="item-top">
          <div class="item-left">
            <img class="item-icon" src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" />
            <div style="min-width:0;">
              <div class="item-name" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
              <div class="item-sub">${cur} ${Number(p.price).toFixed(2)} per unit</div>
            </div>
          </div>
          <div class="unit">${cur}</div>
        </div>

        <div class="tiers-row">
          ${allowed.map((t) => {
            const idx = TIERS.findIndex(x => x.key === t.key);
            return `
              <div class="tier-card" role="button" tabindex="0"
                   data-pid="${escapeHtml(p.id)}" data-tier="${idx}">
                <img class="tier-img" src="${escapeHtml(img)}" alt="${escapeHtml(p.title)} ${t.label}" />
                <div class="tier-label">${t.label}</div>
                <div class="tier-hint">${t.hint}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");

  // Tier click
  rowsWrap.querySelectorAll("[data-tier]").forEach(card => {
    card.addEventListener("click", () => {
      const pid = card.getAttribute("data-pid");
      const idx = Number(card.getAttribute("data-tier"));

      if (!selected || String(selected.product.id) !== String(pid)) {
        selectProduct(pid);
      }
      setTier(idx);
    });
  });

  selectProduct(PRODUCTS[0].id);
}

/* ===== Checkout: notify + redirect ===== */
async function notifyTelegramCheckout(payload) {
  const res = await fetch(TELEGRAM_CHECKOUT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Telegram checkout notify failed");
  return data;
}

async function checkout() {
  updateCheckoutUI();
  if (btnBuy.disabled) return;

  const growId = (growIdEl.value || "").trim();
  const world = (worldEl.value || "").trim();

  const pid = selected.product.id;
  const qty = selected.qty;
  const payLink = getPayLink(pid, qty);

  if (!payLink) {
    setStatus("No payment link for this quantity. Add it in topup_pay_links.");
    return;
  }

  const cur = currencyLabel(selected.product);
  const total = calcTotal();

  btnBuy.disabled = true;
  setStatus("Processing...");

  try {
    await notifyTelegramCheckout({
      game: dbGameKey,
      name: growId,
      userid: growId,
      serverid: world,
      productName: selected.product.title,
      qty: qty,
      price: `${cur} ${total.toFixed(2)}`
    });

    setStatus("Redirecting to payment...");
    window.location.href = payLink;
  } catch (e) {
    setStatus(e?.message || "Checkout failed. Try again.");
    updateCheckoutUI();
  }
}

/* ===== Want to sell modal ===== */
function openSell(){
  if (!sellModal) return;
  sellModal.setAttribute("aria-hidden","false");
  setSellStatus("");
}

function closeSell(){
  if (!sellModal) return;
  sellModal.setAttribute("aria-hidden","true");
  setSellStatus("");
}

sellOpenBtn?.addEventListener("click", openSell);
sellCloseBg?.addEventListener("click", closeSell);
sellCloseBtn?.addEventListener("click", closeSell);
sellCancel?.addEventListener("click", closeSell);

/* Submit to Edge Function (Option 2) */
sellForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = (sellPhoneEl?.value || "").trim();
  const game = (sellGameEl?.value || "").trim();
  const item = (sellItemEl?.value || "").trim();
  const price = (sellPriceEl?.value || "").trim();
  const message = (sellMessageEl?.value || "").trim();

  if (!phone || !game || !item || !price || !message) {
    setSellStatus("សូមបំពេញព័ត៌មានឲ្យครบ/ត្រឹមត្រូវ។");
    return;
  }

  setSellStatus("កំពុងផ្ញើសំណើ...");

  try {
    const res = await fetch(SELLER_REQUEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, game, item, price, message }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Send failed");

    setSellStatus("បានផ្ញើជោគជ័យ ✅");
    setTimeout(() => closeSell(), 700);
  } catch (err) {
    setSellStatus("បរាជ័យក្នុងការផ្ញើ។ សូមព្យាយាមម្ដងទៀត។");
  }
});

/* ===== Events ===== */
qtyPlus?.addEventListener("click", () => bumpQty("plus"));
qtyMinus?.addEventListener("click", () => bumpQty("minus"));

// lock manual typing
qtyValue?.addEventListener("input", () => {
  if (qtyValue) qtyValue.value = selected ? String(selected.qty) : "1";
});

growIdEl?.addEventListener("input", updateCheckoutUI);
worldEl?.addEventListener("input", updateCheckoutUI);
btnBuy?.addEventListener("click", checkout);

/* ===== Init ===== */
loadProducts();
updateCheckoutUI();