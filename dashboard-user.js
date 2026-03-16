import { supabase } from "./supabase/supabaseClient.js";

const els = {
  statusCard: document.getElementById("statusCard"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  logoutBtn: document.getElementById("logoutBtn"),

  emailStat: document.getElementById("emailStat"),
  applicationStat: document.getElementById("applicationStat"),
  ordersStat: document.getElementById("ordersStat"),

  refreshProfileBtn: document.getElementById("refreshProfileBtn"),
  refreshOrdersBtn: document.getElementById("refreshOrdersBtn"),
  profileInfo: document.getElementById("profileInfo"),
  sellerApplicationInfo: document.getElementById("sellerApplicationInfo"),
  ordersTableBody: document.getElementById("ordersTableBody"),
};

let currentSession = null;
let currentOrders = [];
let sellerNameMap = new Map();

function setStatus(message, isError = false) {
  if (!els.statusCard) return;
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

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending_payment" || s === "paid" || s === "delivered") return "badge pending";
  if (s === "buyer_completed" || s === "admin_completed") return "badge approved";
  if (s === "help_requested" || s === "cancelled" || s === "refunded") return "badge rejected";
  return "badge";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatBCoins(value) {
  return `${Number(value || 0).toLocaleString()} B Coins`;
}

async function requireUser() {
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

  const displayName =
    session.user.user_metadata?.display_name ||
    session.user.user_metadata?.full_name ||
    session.user.email ||
    "User";

  els.userName.textContent = displayName;
  els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();
  currentSession = session;

  const [{ data: isAdmin, error: adminErr }, { data: sellerProfile, error: sellerErr }] =
    await Promise.all([
      supabase.rpc("is_admin", { check_user_id: session.user.id }),
      supabase
        .from("seller_profiles")
        .select("user_id, status")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  if (adminErr) {
    setStatus(adminErr.message || "Failed to verify account.", true);
    return null;
  }

  if (sellerErr && sellerErr.code !== "PGRST116") {
    setStatus(sellerErr.message || "Failed to verify seller status.", true);
    return null;
  }

  if (isAdmin === true) {
    window.location.href = "./dashboard-admin.html";
    return null;
  }

  if (sellerProfile?.user_id) {
    window.location.href = "./dashboard-seller.html";
    return null;
  }

  return session;
}

async function loadApplication(userId) {
  const { data, error } = await supabase
    .from("seller_applications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

async function loadOrders(userId) {
  const { data, error } = await supabase
    .from("marketplace_orders")
    .select("*")
    .eq("buyer_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  currentOrders = data || [];

  const sellerIds = [...new Set(currentOrders.map((x) => x.seller_user_id).filter(Boolean))];
  if (!sellerIds.length) {
    sellerNameMap = new Map();
    return;
  }

  const { data: sellers } = await supabase
    .from("seller_profiles_public")
    .select("user_id, store_name")
    .in("user_id", sellerIds);

  sellerNameMap = new Map((sellers || []).map((x) => [x.user_id, x.store_name]));
}

function renderProfile(session, application) {
  const user = session.user;
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "User";

  els.emailStat.textContent = user.email || "—";
  els.applicationStat.textContent = application?.status || "none";
  els.ordersStat.textContent = String(currentOrders.length);

  els.profileInfo.innerHTML = `
    <div class="info-item">
      <span class="k">Display name</span>
      <span class="v">${escapeHtml(displayName)}</span>
    </div>
    <div class="info-item">
      <span class="k">Email</span>
      <span class="v">${escapeHtml(user.email || "—")}</span>
    </div>
    <div class="info-item">
      <span class="k">User ID</span>
      <span class="v">${escapeHtml(user.id)}</span>
    </div>
    <div class="info-item">
      <span class="k">Created</span>
      <span class="v">${escapeHtml(formatDate(user.created_at))}</span>
    </div>
  `;

  if (!application) {
    els.sellerApplicationInfo.innerHTML = `
      <div class="info-item">
        <span class="k">Status</span>
        <span class="v">No application submitted</span>
      </div>
      <div class="info-item">
        <span class="k">Next step</span>
        <span class="v">Go to marketplace and click Become a Seller</span>
      </div>
    `;
  } else {
    const games = Array.isArray(application.games) && application.games.length
      ? application.games.join(", ")
      : "—";

    els.sellerApplicationInfo.innerHTML = `
      <div class="info-item">
        <span class="k">Status</span>
        <span class="v"><span class="${badgeClass(application.status)}">${escapeHtml(application.status)}</span></span>
      </div>
      <div class="info-item">
        <span class="k">Display name</span>
        <span class="v">${escapeHtml(application.display_name || "—")}</span>
      </div>
      <div class="info-item">
        <span class="k">Games</span>
        <span class="v">${escapeHtml(games)}</span>
      </div>
      <div class="info-item">
        <span class="k">Submitted</span>
        <span class="v">${escapeHtml(formatDate(application.created_at))}</span>
      </div>
    `;
  }
}

function renderOrders() {
  if (!currentOrders.length) {
    els.ordersTableBody.innerHTML = `
      <tr>
        <td colspan="6"><div class="empty-state">No orders yet.</div></td>
      </tr>
    `;
    return;
  }

  els.ordersTableBody.innerHTML = currentOrders.map((order) => {
    const sellerName = sellerNameMap.get(order.seller_user_id) || "Seller";
    const canComplete = order.status === "delivered";
    const canHelp = !["admin_completed", "cancelled", "refunded"].includes(order.status);

    return `
      <tr>
        <td>${escapeHtml(order.listing_snapshot_title || "Order")}</td>
        <td>${escapeHtml(sellerName)}</td>
        <td>${escapeHtml(formatMoney(order.total_price_usd))}</td>
        <td><span class="${badgeClass(order.status)}">${escapeHtml(order.status)}</span></td>
        <td>${escapeHtml(formatBCoins(order.reward_bcoins || 0))}</td>
        <td>
          <div class="actions-row">
            ${canComplete ? `<button class="btn-success" type="button" data-action="complete" data-id="${escapeHtml(order.id)}">Complete Order</button>` : ""}
            ${canHelp ? `<button class="btn-danger" type="button" data-action="help" data-id="${escapeHtml(order.id)}">Ask for Help</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function completeOrder(orderId) {
  const { error } = await supabase.rpc("buyer_complete_order", { target_order_id: orderId });
  if (error) throw error;
}

async function requestHelp(orderId) {
  const note = window.prompt("Describe the issue:");
  if (note === null) return;
  const { error } = await supabase.rpc("buyer_request_order_help", {
    target_order_id: orderId,
    help_note: note.trim() || null,
  });
  if (error) throw error;
}

async function refreshAll() {
  setStatus("Loading user dashboard...");
  try {
    const application = await loadApplication(currentSession.user.id);
    await loadOrders(currentSession.user.id);
    renderProfile(currentSession, application);
    renderOrders();
    setStatus("User dashboard ready.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to load user dashboard.", true);
  }
}

function bindEvents() {
  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.href = "./auth.html?logged_out=1";
  });

  els.refreshProfileBtn?.addEventListener("click", refreshAll);
  els.refreshOrdersBtn?.addEventListener("click", refreshAll);

  els.ordersTableBody?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action][data-id]");
    if (!btn) return;

    try {
      if (btn.dataset.action === "complete") {
        setStatus("Completing order...");
        await completeOrder(btn.dataset.id);
        setStatus("Order marked buyer completed.");
      } else if (btn.dataset.action === "help") {
        setStatus("Submitting help request...");
        await requestHelp(btn.dataset.id);
        setStatus("Help request submitted.");
      }
      await refreshAll();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Order action failed.", true);
    }
  });
}

async function init() {
  bindEvents();
  const session = await requireUser();
  if (!session) return;
  await refreshAll();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected user dashboard error.", true);
});