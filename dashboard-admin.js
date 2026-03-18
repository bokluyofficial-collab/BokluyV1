import { supabase } from "./supabase/supabaseClient.js";

const els = {
  statusCard: document.getElementById("statusCard"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  logoutBtn: document.getElementById("logoutBtn"),

  pendingCount: document.getElementById("pendingCount"),
  approvedCount: document.getElementById("approvedCount"),
  rejectedCount: document.getElementById("rejectedCount"),

  refreshApplicationsBtn: document.getElementById("refreshApplicationsBtn"),
  refreshProfilesBtn: document.getElementById("refreshProfilesBtn"),
  refreshOrdersBtn: document.getElementById("refreshOrdersBtn"),

  applicationsTableBody: document.getElementById("applicationsTableBody"),
  profilesTableBody: document.getElementById("profilesTableBody"),
  ordersTableBody: document.getElementById("ordersTableBody"),

  grantForm: document.getElementById("grantForm"),
  grantUserIdInput: document.getElementById("grantUserIdInput"),
  grantAmountInput: document.getElementById("grantAmountInput"),
  grantReasonInput: document.getElementById("grantReasonInput"),
  grantFormStatus: document.getElementById("grantFormStatus"),
  adminStoreBtn: document.getElementById("adminStoreBtn"),

  adminTabs: document.querySelectorAll(".admin-main-tab-btn"),
  adminMainPanel: document.getElementById("adminMainPanel"),
  storeMainPanel: document.getElementById("storeMainPanel"),
  adminStoreFrame: document.getElementById("adminStoreFrame"),
  adminStoreRefreshBtn: document.getElementById("adminStoreRefreshBtn"),
  adminStoreOpenTabBtn: document.getElementById("adminStoreOpenTabBtn"),
};

const state = {
  session: null,
};

function setStatus(message, isError = false) {
  if (!els.statusCard) return;
  els.statusCard.textContent = message;
  els.statusCard.className = `status-card${isError ? " is-error" : ""}`;
}

function setGrantStatus(message, isError = false) {
  els.grantFormStatus.textContent = message || "";
  els.grantFormStatus.style.color = isError ? "#fecaca" : "var(--muted)";
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

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending" || s === "paid" || s === "delivered" || s === "buyer_completed") return "badge pending";
  if (s === "approved" || s === "active" || s === "admin_completed") return "badge approved";
  if (s === "rejected" || s === "suspended" || s === "help_requested") return "badge rejected";
  return "badge";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shorten(value, max = 18) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function setAdminMainTab(tab) {
  els.adminTabs.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.adminTab === tab);
  });

  els.adminMainPanel.hidden = tab !== "admin";
  els.storeMainPanel.hidden = tab !== "store";
}

async function requireAdmin() {
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
    "Admin";

  els.userName.textContent = displayName;
  els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin", {
    check_user_id: session.user.id,
  });

  if (adminErr) {
    setStatus(adminErr.message || "Failed to verify admin access.", true);
    return null;
  }

  if (isAdmin !== true) {
    setStatus("You do not have admin access.", true);
    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 900);
    return null;
  }

  state.session = session;
  return session;
}

async function loadApplicationRows() {
  const { data, error } = await supabase
    .from("seller_applications_admin_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function loadSellerProfiles() {
  const { data, error } = await supabase
    .from("seller_profiles")
    .select("user_id, store_name, status, is_verified, bcoin_balance, lifetime_bcoin_earned, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("marketplace_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

function renderApplicationStats(rows) {
  const pending = rows.filter((row) => row.status === "pending").length;
  const approved = rows.filter((row) => row.status === "approved").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;

  els.pendingCount.textContent = String(pending);
  els.approvedCount.textContent = String(approved);
  els.rejectedCount.textContent = String(rejected);
}

function applicationContact(row) {
  const parts = [];
  if (row.contact_telegram) parts.push(`Telegram: ${row.contact_telegram}`);
  if (row.contact_whatsapp) parts.push(`WhatsApp: ${row.contact_whatsapp}`);
  return parts.length ? parts.join(" | ") : "—";
}

function renderApplications(rows) {
  const pendingRows = rows.filter((row) => row.status === "pending");

  if (!pendingRows.length) {
    els.applicationsTableBody.innerHTML = `
      <tr><td colspan="6"><div class="empty-state">No pending seller applications.</div></td></tr>
    `;
    return;
  }

  els.applicationsTableBody.innerHTML = pendingRows.map((row) => {
    const games = Array.isArray(row.games) && row.games.length ? row.games.join(", ") : "—";

    return `
      <tr>
        <td>
          <strong>${escapeHtml(row.store_name || row.display_name || "Unnamed")}</strong><br />
          <span style="color:var(--muted);">${escapeHtml(shorten(row.user_id, 26))}</span>
          ${row.notes ? `<div style="margin-top:8px;color:var(--muted);">${escapeHtml(row.notes)}</div>` : ""}
        </td>
        <td>${escapeHtml(applicationContact(row))}</td>
        <td>${escapeHtml(games)}</td>
        <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${escapeHtml(formatDate(row.created_at))}</td>
        <td>
          <div class="actions-row">
            <button class="btn-success" type="button" data-action="approve" data-user-id="${escapeHtml(row.user_id)}">Approve</button>
            <button class="btn-danger" type="button" data-action="reject" data-user-id="${escapeHtml(row.user_id)}">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderProfiles(rows) {
  if (!rows.length) {
    els.profilesTableBody.innerHTML = `
      <tr><td colspan="6"><div class="empty-state">No seller profiles found.</div></td></tr>
    `;
    return;
  }

  els.profilesTableBody.innerHTML = rows.map((row) => {
    const isSuspended = row.status === "suspended";
    const isVerified = !!row.is_verified;

    return `
      <tr>
        <td>
          ${escapeHtml(row.store_name || "Unnamed")}
          ${isVerified ? `<span class="verified-badge">✓</span>` : ""}
        </td>
        <td>${escapeHtml(shorten(row.user_id, 26))}</td>
        <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${escapeHtml(formatBCoins(row.bcoin_balance))}</td>
        <td>${escapeHtml(formatBCoins(row.lifetime_bcoin_earned))}</td>
        <td>
          <div class="actions-row">
            ${
              isVerified
                ? `<button class="btn-secondary" type="button" data-action="unverify" data-user-id="${escapeHtml(row.user_id)}">Remove Verify</button>`
                : `<button class="btn-success" type="button" data-action="verify" data-user-id="${escapeHtml(row.user_id)}">Verify</button>`
            }
            ${
              isSuspended
                ? `<button class="btn-success" type="button" data-action="reactivate" data-user-id="${escapeHtml(row.user_id)}">Reactivate</button>`
                : `<button class="btn-danger" type="button" data-action="suspend" data-user-id="${escapeHtml(row.user_id)}">Suspend</button>`
            }
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderOrders(rows) {
  if (!rows.length) {
    els.ordersTableBody.innerHTML = `
      <tr><td colspan="7"><div class="empty-state">No orders found.</div></td></tr>
    `;
    return;
  }

  els.ordersTableBody.innerHTML = rows.map((row) => {
    const canFinalize = ["buyer_completed", "delivered"].includes(row.status);

    return `
      <tr>
        <td>${escapeHtml(row.listing_snapshot_title || "Order")}</td>
        <td>${escapeHtml(shorten(row.buyer_user_id, 18))}</td>
        <td>${escapeHtml(shorten(row.seller_user_id, 18))}</td>
        <td>${escapeHtml(formatMoney(row.total_price_usd))}</td>
        <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${escapeHtml(formatBCoins(row.reward_bcoins || 0))}</td>
        <td>
          <div class="actions-row">
            ${canFinalize ? `<button class="btn-success" type="button" data-order-action="complete" data-id="${escapeHtml(row.id)}">Admin Complete</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function refreshAll() {
  setStatus("Loading admin dashboard...");
  try {
    const [applications, profiles, orders] = await Promise.all([
      loadApplicationRows(),
      loadSellerProfiles(),
      loadOrders(),
    ]);

    renderApplicationStats(applications);
    renderApplications(applications);
    renderProfiles(profiles);
    renderOrders(orders);
    setStatus("Admin dashboard ready.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to load admin dashboard.", true);
  }
}

async function callAdminRpc(name, userId) {
  const { error } = await supabase.rpc(name, { target_user_id: userId });
  if (error) throw error;
}

async function completeOrder(orderId) {
  const { error } = await supabase.rpc("admin_complete_order", { target_order_id: orderId });
  if (error) throw error;
}

async function submitGrant(event) {
  event.preventDefault();

  const targetUserId = els.grantUserIdInput.value.trim();
  const amount = Number(els.grantAmountInput.value);
  const reason = els.grantReasonInput.value.trim();

  if (!targetUserId) {
    setGrantStatus("Enter a target user ID.", true);
    return;
  }

  if (!Number.isFinite(amount) || amount === 0) {
    setGrantStatus("Enter a valid B Coin amount.", true);
    return;
  }

  setGrantStatus("Applying B Coin adjustment...");

  const { error } = await supabase.rpc("grant_bcoins", {
    target_user_id: targetUserId,
    amount_bcoins: amount,
    reason,
  });

  if (error) {
    console.error(error);
    setGrantStatus(error.message || "Failed to grant B Coins.", true);
    return;
  }

  setGrantStatus("B Coin adjustment completed.");
  await refreshAll();
}

async function openOrCreateAdminStore() {
  setStatus("Preparing your store...");

  const storeName = window.prompt("Store name for your admin shop:", "Admin Store") || "Admin Store";

  const { error } = await supabase.rpc("ensure_admin_seller_profile", {
    target_store_name: storeName,
  });

  if (error) {
    console.error(error);
    setStatus(error.message || "Failed to prepare admin store.", true);
    return;
  }

  setAdminMainTab("store");
  if (els.adminStoreFrame) {
    els.adminStoreFrame.src = "./dashboard-seller.html?tab=dashboard&mode=admin_store";
  }
}

function bindEvents() {
  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.href = "./auth.html?logged_out=1";
  });

  els.refreshApplicationsBtn?.addEventListener("click", refreshAll);
  els.refreshProfilesBtn?.addEventListener("click", refreshAll);
  els.refreshOrdersBtn?.addEventListener("click", refreshAll);
  els.grantForm?.addEventListener("submit", submitGrant);
  els.adminStoreBtn?.addEventListener("click", openOrCreateAdminStore);

  els.adminTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      setAdminMainTab(btn.dataset.adminTab);
    });
  });

  els.adminStoreRefreshBtn?.addEventListener("click", () => {
    if (els.adminStoreFrame) {
      els.adminStoreFrame.src = "./dashboard-seller.html?tab=dashboard&mode=admin_store&ts=" + Date.now();
    }
  });

  els.adminStoreOpenTabBtn?.addEventListener("click", () => {
    window.open("./dashboard-seller.html?tab=dashboard&mode=admin_store", "_blank");
  });

  els.applicationsTableBody?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action][data-user-id]");
    if (!btn) return;

    try {
      if (btn.dataset.action === "approve") {
        setStatus("Approving seller...");
        await callAdminRpc("approve_seller_application", btn.dataset.userId);
      } else if (btn.dataset.action === "reject") {
        setStatus("Rejecting seller...");
        await callAdminRpc("reject_seller_application", btn.dataset.userId);
      }
      await refreshAll();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Admin action failed.", true);
    }
  });

  els.profilesTableBody?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action][data-user-id]");
    if (!btn) return;

    try {
      const actionMap = {
        verify: "verify_seller",
        unverify: "unverify_seller",
        suspend: "suspend_seller",
        reactivate: "reactivate_seller",
      };
      setStatus("Updating seller...");
      await callAdminRpc(actionMap[btn.dataset.action], btn.dataset.userId);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Admin action failed.", true);
    }
  });

  els.ordersTableBody?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-order-action][data-id]");
    if (!btn) return;

    try {
      setStatus("Completing order...");
      await completeOrder(btn.dataset.id);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Order completion failed.", true);
    }
  });
}

async function init() {
  bindEvents();
  const session = await requireAdmin();
  if (!session) return;
  setAdminMainTab("admin");
  await refreshAll();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected admin dashboard error.", true);
});