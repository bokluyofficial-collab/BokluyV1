console.log("FREEFIRE.JS LOADED");

import { supabase } from "./supabase/supabaseClient.js";

// Username lookup
const CHECK_USERNAME_URL =
  "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/game-lookup";

// Telegram notify
const TELEGRAM_CHECKOUT_URL =
  "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/telegram-checkout";

// Free Fire config
const dbGameKey = "freefire";
const apiGame = "free-fire";

const uidLabel = "User ID";

// Elements (same IDs as your HTML)
const elUserId = document.getElementById("mlbbUserId");
const elServerId = document.getElementById("mlbbServerId"); // hidden
const btnCheckName = document.getElementById("btnCheckName");
const nameStatus = document.getElementById("nameStatus");
const playerNameBox = document.getElementById("playerNameBox");
const playerNameValue = document.getElementById("playerNameValue");

const productsScroll = document.getElementById("productsScroll");
const totalPriceEl = document.getElementById("totalPrice");
const btnNext = document.getElementById("btnNext");

const agreeTerms = document.getElementById("agreeTerms");
const btnPay = document.getElementById("btnPay");
const payStatus = document.getElementById("payStatus");

// Force server id hidden (no flash)
if (elServerId) elServerId.style.display = "none";
if (elUserId) elUserId.placeholder = uidLabel;

let PRODUCTS = [];
let verifiedName = false;
let verifiedPlayerName = "";
let selectedProduct = null;

function setStatus(el, text, type) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("ok", "warn", "err");
  if (type) el.classList.add(type);
}

function updateTotal() {
  const total = selectedProduct ? Number(selectedProduct.price) : 0;
  if (totalPriceEl) totalPriceEl.textContent = `$${total.toFixed(2)}`;
}

function updateButtons() {
  if (btnNext) btnNext.disabled = !(verifiedName && selectedProduct);
  if (btnPay) btnPay.disabled = !(verifiedName && selectedProduct && agreeTerms?.checked);
}

async function renderProducts() {
  if (!productsScroll) return;
  productsScroll.innerHTML = "Loading packages...";

  const { data, error } = await supabase
    .from("topup_products")
    // ✅ add pay_link
    .select("id, title, price, img_url, pay_link")
    .eq("game", dbGameKey)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    productsScroll.innerHTML = "Failed to load products.";
    return;
  }

  PRODUCTS = data || [];

  productsScroll.innerHTML = PRODUCTS.map(p => `
    <button class="topup-product" data-id="${p.id}" type="button">
      <div class="topup-product-left">
        <img class="topup-product-img"
             src="${p.img_url || './images/placeholder.png'}"
             alt="${escapeHtml(p.title)}" />
        <div class="topup-product-title">${escapeHtml(p.title)}</div>
      </div>
      <div class="topup-product-price">$${Number(p.price).toFixed(2)}</div>
    </button>
  `).join("");

  productsScroll.querySelectorAll(".topup-product").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      selectedProduct = PRODUCTS.find(x => String(x.id) === String(id)) || null;

      productsScroll.querySelectorAll(".topup-product").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      updateTotal();
      updateButtons();
    });
  });
}

// Verify username (Free Fire: NO server id required)
async function verify() {
  const userId = (elUserId?.value || "").trim();

  if (playerNameBox) playerNameBox.style.display = "none";
  if (playerNameValue) playerNameValue.textContent = "";
  verifiedName = false;
  verifiedPlayerName = "";
  updateButtons();

  if (!userId) {
    setStatus(nameStatus, `Please enter ${uidLabel}.`, "warn");
    return;
  }

  setStatus(nameStatus, "Checking username…", "warn");

  const oldText = btnCheckName?.textContent || "";
  if (btnCheckName) {
    btnCheckName.disabled = true;
    btnCheckName.textContent = "Checking...";
  }

  try {
    const payload = { apiGame, userId };

    const res = await fetch(CHECK_USERNAME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(nameStatus, data?.error || `API error: ${res.status}`, "err");
      verifiedName = false;
      updateButtons();
      return;
    }

    if (!data?.name) {
      setStatus(nameStatus, "Username not found. Please re-check.", "err");
      verifiedName = false;
      updateButtons();
      return;
    }

    verifiedName = true;
    verifiedPlayerName = String(data.name);
    setStatus(nameStatus, "Username found.", "ok");

    if (playerNameValue) playerNameValue.textContent = data.name;
    if (playerNameBox) playerNameBox.style.display = "block";

    updateButtons();
  } catch {
    setStatus(nameStatus, "Failed to check username. Try again.", "err");
    verifiedName = false;
    verifiedPlayerName = "";
    updateButtons();
  } finally {
    if (btnCheckName) {
      btnCheckName.disabled = false;
      btnCheckName.textContent = oldText;
    }
  }
}

// Reset verification when edited
function resetIfEdited() {
  if (!verifiedName) return;
  verifiedName = false;
  verifiedPlayerName = "";
  if (playerNameBox) playerNameBox.style.display = "none";
  if (playerNameValue) playerNameValue.textContent = "";
  setStatus(nameStatus, "ID changed. Please verify again.", "warn");
  updateButtons();
}

async function notifyTelegramCheckout() {
  if (!verifiedName || !verifiedPlayerName || !selectedProduct) {
    throw new Error("Not ready to checkout");
  }

  const userId = (elUserId?.value || "").trim();

  const payload = {
    game: dbGameKey,
    name: verifiedPlayerName,
    userid: userId,
    serverid: "", // Free Fire: none
    productName: selectedProduct.title,
    price: `$${Number(selectedProduct.price).toFixed(2)}`,
  };

  const res = await fetch(TELEGRAM_CHECKOUT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to send Telegram message");
  return data;
}

async function proceedPay() {
  if (btnPay?.disabled) return;

  // ✅ require pay_link
  const payLink = (selectedProduct?.pay_link || "").trim();
  if (!payLink) {
    setStatus(payStatus, "No payment link for this package.", "err");
    return;
  }

  const oldText = btnPay?.textContent || "";
  if (btnPay) {
    btnPay.disabled = true;
    btnPay.textContent = "Processing...";
  }

  try {
    setStatus(payStatus, "Sending order…", "warn");
    await notifyTelegramCheckout();

    setStatus(payStatus, "Redirecting to payment…", "ok");
    window.location.href = payLink;
  } catch (e) {
    setStatus(payStatus, e?.message || "Checkout failed. Try again.", "err");
    updateButtons();
  } finally {
    if (btnPay) {
      btnPay.textContent = oldText;
      // keep correct enabled/disabled state
      updateButtons();
    }
  }
}

// Events
btnCheckName?.addEventListener("click", verify);
elUserId?.addEventListener("input", resetIfEdited);
agreeTerms?.addEventListener("change", updateButtons);

btnNext?.addEventListener("click", () => {
  if (!(verifiedName && selectedProduct)) return;
  setStatus(payStatus, "Ready for payment. Tick Terms, then click Pay.", "ok");
});

btnPay?.addEventListener("click", proceedPay);

// Helpers
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Init
renderProducts();
updateTotal();
updateButtons();