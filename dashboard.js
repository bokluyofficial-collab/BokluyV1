import { supabase } from "./supabase/supabaseClient.js";

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function moneyFromCents(c){ return (Number(c || 0) / 100).toFixed(2); }

async function requireAuth(){
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) return data.session.user;
  location.href = `auth.html?returnTo=${encodeURIComponent(location.href)}`;
  throw new Error("Redirecting");
}

async function loadWallet(){
  const { data, error } = await supabase.rpc("ensure_wallet");
  if (error) throw error;
  return data || {};
}

async function loadOrders(){
  const { data, error } = await supabase
    .from("topup_orders")
    .select("id, game_key, status, total_cents, product_label, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

function setText(id, value){
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setWidth(id, pct){
  const el = document.getElementById(id);
  if (el) el.style.width = `${clamp(pct, 0, 100)}%`;
}

function statusBadge(status){
  const s = String(status || "").toLowerCase();
  if (s === "completed") return { cls: "ok", text: "Completed" };
  if (s === "pending") return { cls: "warn", text: "Pending" };
  return { cls: "", text: s || "Unknown" };
}

function renderStats(wallet, orders){
  // New rules:
  // - 1 completed order = 1 point
  // - 100 points = $1 exchange value
  const completedOrders = orders.filter(o => String(o.status || "").toLowerCase() === "completed");
  const pendingOrders = orders.filter(o => String(o.status || "").toLowerCase() !== "completed");

  const points = completedOrders.length;
  const pendingEstimated = pendingOrders.length;

  // Points (UI shows max 100)
  setText("pointsValue", String(points));
  setText("pointsHint", `${clamp(points, 0, 100)} / 100`);
  setWidth("pointsFill", (clamp(points, 0, 100) / 100) * 100);

  // Pending points (estimate = pending order count)
  setText("pendingPointsValue", String(pendingEstimated));
  const pendingHint = document.getElementById("pendingHint");
  if (pendingHint){
    pendingHint.textContent = pendingOrders.length
      ? `From ${pendingOrders.length} pending order(s)`
      : "No pending orders";
  }

  // Exchange value
  const dollars = Math.floor(points / 100);
  const remainder = points % 100;
  const exchangeValueEl = document.getElementById("exchangeValue");
  if (exchangeValueEl) exchangeValueEl.textContent = `$${dollars.toFixed(2)}`;

  const exchangeHintEl = document.getElementById("exchangeHint");
  if (exchangeHintEl){
    exchangeHintEl.textContent = remainder === 0
      ? "Ready to exchange $1"
      : `${100 - remainder} pts until $1`;
  }
}

function renderOrdersfunction renderOrders(orders){
  const listEl = document.getElementById("ordersList");
  const emptyEl = document.getElementById("ordersEmpty");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (!orders.length){
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";

  for (const o of orders){
    const st = statusBadge(o.status);
    const row = document.createElement("div");
    row.className = "t-row t-item";

    const pkg = o.product_label || "—";
    const dt = o.created_at ? new Date(o.created_at).toLocaleString() : "—";

    row.innerHTML = `
      <div>${String(o.game_key || "—").toUpperCase()}</div>
      <div>${pkg}</div>
      <div>$${moneyFromCents(o.total_cents)}</div>
      <div><span class="badge ${st.cls}">${st.text}</span></div>
      <div>${dt}</div>
    `;

    listEl.appendChild(row);
  }
}


async function refreshAll(){
  await requireAuth();
  const [wallet, orders] = await Promise.all([ loadWallet(), loadOrders() ]);
  renderStats(wallet, orders);
  renderOrders(orders);
}

document.getElementById("btnLogout")?.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  location.href = "index.html";
});

document.getElementById("btnRefreshOrders")?.addEventListener("click", async ()=>{
  try { await refreshAll(); }
  catch (e){ alert(e?.message || "Refresh failed"); }
});    await refreshAll();
  }catch(e){
    alert(
      (e?.message || "Convert failed") +
      "\n\nIf you haven't created the RPC yet, add it in Supabase SQL Editor (SQL below)."
    );
    try { await refreshAll(); } catch {}
  }
});

refreshAll().catch(console.error);