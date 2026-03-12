import { supabase } from "./supabase/supabaseClient.js";

const CHECK_USERNAME_URL =
  "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/game-lookup";

// Telegram checkout function endpoint (Supabase Edge Function)
const TELEGRAM_CHECKOUT_URL =
  "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/telegram-checkout";

/** Require auth, else redirect to auth.html with returnTo */
async function requireAuthOrRedirect(returnToUrl) {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) return data.session.user;

  const rt = encodeURIComponent(returnToUrl || location.href);
  location.href = `auth.html?returnTo=${rt}`;
  throw new Error("Not authenticated");
}

export function initTopupGame(config) {
  const {
    dbGameKey,      // your Supabase "topup_products.game" value
    apiGame,        // RapidAPI slug, e.g. "mobile-legends"
    needsServerId,  // true/false
    uidLabel = "User ID",
    serverLabel = "Server ID",
  } = config;

  // Elements (must exist in the HTML)
  const elUserId = document.getElementById("mlbbUserId");
  const elServerId = document.getElementById("mlbbServerId");
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

  // Optional: adjust placeholders based on game type
  if (elUserId) elUserId.placeholder = uidLabel;
  if (elServerId) elServerId.placeholder = serverLabel;

  // Hide server input if not needed
  if (!needsServerId && elServerId) {
    elServerId.style.display = "none";
  }

  let PRODUCTS = [];
  let verifiedName = false;
  let selectedProduct = null;
  let verifiedPlayerName = ""; // store verified name safely

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

  // Verify username
  async function verify() {
    const userId = (elUserId?.value || "").trim();
    const serverId = (elServerId?.value || "").trim();

    if (playerNameBox) playerNameBox.style.display = "none";
    if (playerNameValue) playerNameValue.textContent = "";
    verifiedName = false;
    verifiedPlayerName = "";
    updateButtons();

    if (!userId) {
      setStatus(nameStatus, `Please enter ${uidLabel}.`, "warn");
      return;
    }
    if (needsServerId && !serverId) {
      setStatus(nameStatus, `Please enter ${serverLabel}.`, "warn");
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
      if (needsServerId) payload.serverId = serverId;

      const res = await fetch(CHECK_USERNAME_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(nameStatus, data?.error || `API error: ${res.status}`, "err");
        verifiedName = false;
        verifiedPlayerName = "";
        updateButtons();
        return;
      }

      if (!data?.name) {
        setStatus(nameStatus, "Username not found. Please re-check.", "err");
        verifiedName = false;
        verifiedPlayerName = "";
        updateButtons();
        return;
      }

      verifiedName = true;
      verifiedPlayerName = String(data.name);
      setStatus(nameStatus, "Username found.", "ok");

      if (playerNameValue) playerNameValue.textContent = data.name;
      if (playerNameBox) playerNameBox.style.display = "block";

      localStorage.setItem(
        `${dbGameKey}_verified`,
        JSON.stringify({
          dbGameKey,
          apiGame,
          userId,
          serverId: needsServerId ? serverId : "",
          name: data.name
        })
      );

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
    localStorage.removeItem(`${dbGameKey}_verified`);
    if (playerNameBox) playerNameBox.style.display = "none";
    if (playerNameValue) playerNameValue.textContent = "";
    setStatus(nameStatus, "ID changed. Please verify again.", "warn");
    updateButtons();
  }

  // Send message to Telegram bot via Edge Function
  async function notifyTelegramCheckout() {
    const userId = (elUserId?.value || "").trim();
    const serverId = (elServerId?.value || "").trim();

    if (!verifiedName || !verifiedPlayerName || !selectedProduct) {
      throw new Error("Not ready to checkout");
    }

    const payload = {
      name: verifiedPlayerName,
      userid: userId,
      serverid: needsServerId ? serverId : "",
      productName: selectedProduct.title,
      price: `$${Number(selectedProduct.price).toFixed(2)}`,
      game: dbGameKey,
    };

    const res = await fetch(TELEGRAM_CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Failed to send Telegram message");
    }
    return data;
  }

  /** Create order record then go to wheel page */
  async function createOrderAndGoDashboard(user) {
    const total = Number(selectedProduct?.price || 0);

    const { data: orderRow, error: orderErr } = await supabase
      .from("topup_orders")
      .insert({
        user_id: user.id,
        game_key: dbGameKey,
        status: "pending",
        total,
        product_id: String(selectedProduct.id),
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;

    window.location.href = `dashboard.html?order_id=${encodeURIComponent(orderRow.id)}`;
  }

  // Events
  btnCheckName?.addEventListener("click", verify);
  elUserId?.addEventListener("input", resetIfEdited);
  elServerId?.addEventListener("input", resetIfEdited);
  agreeTerms?.addEventListener("change", updateButtons);

  btnNext?.addEventListener("click", () => {
    if (!(verifiedName && selectedProduct)) return;
    setStatus(payStatus, "Ready for payment. Tick Terms, then click Pay.", "ok");
  });

  // Pay click: require login -> telegram -> create order -> go to dashboard
 btnPay?.addEventListener("click", async () => {
  if (btnPay?.disabled) return;

  const payLink = (selectedProduct?.pay_link || "").trim();
  if (!payLink) {
    setStatus(payStatus, "No payment link for this package. Please contact support.", "err");
    return;
  }

  const oldText = btnPay.textContent;
  btnPay.disabled = true;
  btnPay.textContent = "Redirecting...";

  try {
    // Must be logged in so points can be awarded later
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      const rt = encodeURIComponent(location.href);
      location.href = `auth.html?returnTo=${rt}`;
      return;
    }

    // 1) Send Telegram message
    await notifyTelegramCheckout();

    // 2) Create pending order in DB (recorded for owner)
    const userId = (elUserId?.value || "").trim();
    const serverId = (elServerId?.value || "").trim();
    const totalCents = Math.round(Number(selectedProduct.price || 0) * 100);

    const { error: orderErr } = await supabase
      .from("topup_orders")
      .insert({
        user_id: user.id,
        game_key: dbGameKey,
        status: "pending",
        total_cents: totalCents,
        product_id: String(selectedProduct.id),
        verified_name: verifiedPlayerName,
        userid: userId,
        serverid: needsServerId ? serverId : "",
      });

    if (orderErr) throw orderErr;

    setStatus(payStatus, "Order recorded. Redirecting to payment…", "ok");

    // 3) Redirect to pay link
    window.location.href = payLink;
  } catch (e) {
    setStatus(payStatus, String(e?.message || e || "Failed"), "err");
    btnPay.disabled = false;
    btnPay.textContent = oldText;
    updateButtons();
  }
});

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
}