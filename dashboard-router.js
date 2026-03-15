import { supabase } from "./supabase/supabaseClient.js";

const statusCard = document.getElementById("statusCard");

function setStatus(message, isError = false) {
  if (!statusCard) return;
  statusCard.textContent = message;
  statusCard.className = `status-card${isError ? " is-error" : ""}`;
}

async function goToRoleDashboard() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setStatus(error.message || "Failed to read session.", true);
    return;
  }

  const session = data.session;
  if (!session?.user?.id) {
    window.location.href = "./auth.html";
    return;
  }

  const userId = session.user.id;

  const [{ data: adminCheck, error: adminErr }, { data: sellerProfile, error: sellerErr }] =
    await Promise.all([
      supabase.rpc("is_admin", { check_user_id: userId }),
      supabase
        .from("seller_profiles")
        .select("user_id, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  if (adminErr) {
    setStatus(adminErr.message || "Failed to check admin role.", true);
    return;
  }

  if (sellerErr && sellerErr.code !== "PGRST116") {
    setStatus(sellerErr.message || "Failed to check seller role.", true);
    return;
  }

  if (adminCheck === true) {
    window.location.href = "./dashboard-admin.html";
    return;
  }

  if (sellerProfile?.user_id) {
    window.location.href = "./dashboard-seller.html";
    return;
  }

  window.location.href = "./dashboard-user.html";
}

goToRoleDashboard().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected router error.", true);
});