import { supabase } from "./supabase/supabaseClient.js";

const els = {
  statusCard: document.getElementById("statusCard"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  logoutBtn: document.getElementById("logoutBtn"),

  emailStat: document.getElementById("emailStat"),
  applicationStat: document.getElementById("applicationStat"),
  roleStat: document.getElementById("roleStat"),

  refreshProfileBtn: document.getElementById("refreshProfileBtn"),
  profileInfo: document.getElementById("profileInfo"),
  sellerApplicationInfo: document.getElementById("sellerApplicationInfo"),
};

let currentSession = null;

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

function renderProfile(session, application) {
  const user = session.user;
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "User";

  els.emailStat.textContent = user.email || "—";
  els.applicationStat.textContent = application?.status || "none";
  els.roleStat.textContent = "User";

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
      <span class="k">Role</span>
      <span class="v">User</span>
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
    return;
  }

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
      <span class="k">Telegram</span>
      <span class="v">${escapeHtml(application.contact_telegram || "—")}</span>
    </div>
    <div class="info-item">
      <span class="k">WhatsApp</span>
      <span class="v">${escapeHtml(application.contact_whatsapp || "—")}</span>
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

async function refreshAll() {
  setStatus("Loading user dashboard...");
  try {
    const application = await loadApplication(currentSession.user.id);
    renderProfile(currentSession, application);
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