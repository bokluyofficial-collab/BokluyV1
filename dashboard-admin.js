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

  applicationsTableBody: document.getElementById("applicationsTableBody"),
  profilesTableBody: document.getElementById("profilesTableBody"),
};

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

function formatMoney(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString()}`;
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "badge pending";
  if (s === "approved" || s === "active") return "badge approved";
  if (s === "rejected" || s === "suspended") return "badge rejected";
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

  if (els.userName) els.userName.textContent = displayName;
  if (els.userAvatar) els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();

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
    .select("user_id, store_name, status, wallet_balance, total_sales, total_withdrawn, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

function renderApplicationStats(rows) {
  const pending = rows.filter((row) => row.status === "pending").length;
  const approved = rows.filter((row) => row.status === "approved").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;

  if (els.pendingCount) els.pendingCount.textContent = String(pending);
  if (els.approvedCount) els.approvedCount.textContent = String(approved);
  if (els.rejectedCount) els.rejectedCount.textContent = String(rejected);
}

function applicationContact(row) {
  const parts = [];
  if (row.contact_telegram) parts.push(`Telegram: ${row.contact_telegram}`);
  if (row.contact_whatsapp) parts.push(`WhatsApp: ${row.contact_whatsapp}`);
  return parts.length ? parts.join(" | ") : "—";
}

function renderApplications(rows) {
  if (!els.applicationsTableBody) return;

  const pendingRows = rows.filter((row) => row.status === "pending");

  if (!pendingRows.length) {
    els.applicationsTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">No pending seller applications.</div>
        </td>
      </tr>
    `;
    return;
  }

  els.applicationsTableBody.innerHTML = pendingRows
    .map((row) => {
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
              <button class="btn-success" type="button" data-action="approve" data-user-id="${escapeHtml(row.user_id)}">
                Approve
              </button>
              <button class="btn-danger" type="button" data-action="reject" data-user-id="${escapeHtml(row.user_id)}">
                Reject
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderProfiles(rows) {
  if (!els.profilesTableBody) return;

  if (!rows.length) {
    els.profilesTableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">No seller profiles found.</div>
        </td>
      </tr>
    `;
    return;
  }

  els.profilesTableBody.innerHTML = rows
    .map((row) => {
      const isSuspended = row.status === "suspended";
      return `
        <tr>
          <td>${escapeHtml(row.store_name || "Unnamed")}</td>
          <td>${escapeHtml(shorten(row.user_id, 26))}</td>
          <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
          <td>${escapeHtml(formatMoney(row.wallet_balance))}</td>
          <td>${escapeHtml(formatMoney(row.total_sales))}</td>
          <td>
            <div class="actions-row">
              ${
                isSuspended
                  ? `<button class="btn-success" type="button" data-action="reactivate" data-user-id="${escapeHtml(row.user_id)}">Reactivate</button>`
                  : `<button class="btn-danger" type="button" data-action="suspend" data-user-id="${escapeHtml(row.user_id)}">Suspend</button>`
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function refreshAll() {
  setStatus("Loading admin dashboard...");
  try {
    const [applications, profiles] = await Promise.all([
      loadApplicationRows(),
      loadSellerProfiles(),
    ]);

    renderApplicationStats(applications);
    renderApplications(applications);
    renderProfiles(profiles);
    setStatus("Admin dashboard ready.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to load admin dashboard.", true);
  }
}

async function approveSeller(userId) {
  const { error } = await supabase.rpc("approve_seller_application", {
    target_user_id: userId,
  });

  if (error) throw error;
}

async function rejectSeller(userId) {
  const { error } = await supabase.rpc("reject_seller_application", {
    target_user_id: userId,
  });

  if (error) throw error;
}

async function suspendSeller(userId) {
  const { error } = await supabase.rpc("suspend_seller", {
    target_user_id: userId,
  });

  if (error) throw error;
}

async function reactivateSeller(userId) {
  const { error } = await supabase.rpc("reactivate_seller", {
    target_user_id: userId,
  });

  if (error) throw error;
}

async function handleAction(action, userId) {
  try {
    if (action === "approve") {
      setStatus("Approving seller...");
      await approveSeller(userId);
      setStatus("Seller approved.");
    } else if (action === "reject") {
      setStatus("Rejecting seller...");
      await rejectSeller(userId);
      setStatus("Seller rejected.");
    } else if (action === "suspend") {
      setStatus("Suspending seller...");
      await suspendSeller(userId);
      setStatus("Seller suspended.");
    } else if (action === "reactivate") {
      setStatus("Reactivating seller...");
      await reactivateSeller(userId);
      setStatus("Seller reactivated.");
    }

    await refreshAll();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Admin action failed.", true);
  }
}

function bindEvents() {
  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.href = "./auth.html?logged_out=1";
  });

  els.refreshApplicationsBtn?.addEventListener("click", refreshAll);
  els.refreshProfilesBtn?.addEventListener("click", refreshAll);

  els.applicationsTableBody?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action][data-user-id]");
    if (!btn) return;

    const action = btn.dataset.action;
    const userId = btn.dataset.userId;
    if (!action || !userId) return;

    handleAction(action, userId);
  });

  els.profilesTableBody?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action][data-user-id]");
    if (!btn) return;

    const action = btn.dataset.action;
    const userId = btn.dataset.userId;
    if (!action || !userId) return;

    handleAction(action, userId);
  });
}

async function init() {
  bindEvents();
  const session = await requireAdmin();
  if (!session) return;
  await refreshAll();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected admin dashboard error.", true);
});