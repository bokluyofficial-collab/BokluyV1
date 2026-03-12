import { supabase } from "./supabase/supabaseClient.js";

// keep your owner id here (same as script.js)
const OWNER_UID = "d7e7f252-321c-48b8-ba5c-e1c3ca12940c";

function clearSupabaseStorage() {
  try {
    const keys = Object.keys(localStorage || {});
    keys.forEach((k) => {
      if (k.startsWith("sb-") && k.includes("auth")) localStorage.removeItem(k);
    });
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  const userbtn = document.getElementById("userbtn");
  const usermenu = document.getElementById("usermenu");
  const umLogin = document.getElementById("umLogin");
  const umLogout = document.getElementById("umLogout");
  const umDashboard = document.getElementById("umDashboard");
  const umOwner = document.getElementById("umOwner");

  function closeMenu() {
    usermenu?.classList.remove("open");
  }

  userbtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    usermenu?.classList.toggle("open");
  });

  document.addEventListener("click", closeMenu);

  function refreshUserMenu(session) {
    const user = session?.user;

    if (!user) {
      if (umLogin) umLogin.style.display = "flex";
      if (umLogout) umLogout.style.display = "none";
      if (umDashboard) umDashboard.style.display = "none";
      if (umOwner) umOwner.style.display = "none";
      return;
    }

    if (umLogin) umLogin.style.display = "none";
    if (umLogout) umLogout.style.display = "flex";
    if (umDashboard) umDashboard.style.display = "flex";
    if (umOwner) umOwner.style.display = (user.id === OWNER_UID) ? "flex" : "none";
  }

  supabase.auth.getSession().then(({ data }) => refreshUserMenu(data.session));
  supabase.auth.onAuthStateChange((_e, session) => refreshUserMenu(session));

  umLogout?.addEventListener("click", async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    clearSupabaseStorage();
    closeMenu();
    window.location.href = "./auth.html?logged_out=1";
  });
});