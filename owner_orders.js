import { supabase } from "./supabase/supabaseClient.js";

function moneyFromCents(c){ return (Number(c||0)/100).toFixed(2); }

async function requireAuth(){
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) return data.session.user;
  location.href = `auth.html?returnTo=${encodeURIComponent(location.href)}`;
  throw new Error("Redirecting");
}

async function checkIsAdmin(){
  const { data, error } = await supabase.rpc("is_admin");
  if(error) throw error;
  return !!data;
}

async function loadOrders(filter){
  let q = supabase
    .from("topup_orders")
    .select("id, user_id, game_key, status, total_cents, product_id, verified_name, userid, serverid, created_at")
    .order("created_at", { ascending:false })
    .limit(200);

  if(filter && filter !== "all"){
    q = q.eq("status", filter);
  }
  const { data, error } = await q;
  if(error) throw error;
  return data || [];
}

function badge(status){
  const s = String(status||"").toLowerCase();
  if(s==="completed") return {cls:"ok", text:"completed"};
  if(s==="pending") return {cls:"warn", text:"pending"};
  return {cls:"", text:s||"unknown"};
}

async function completeOrder(orderId){
  const { data, error } = await supabase.rpc("admin_complete_order", { order_uuid: orderId });
  if(error) throw error;
  return data;
}

async function deleteOrder(orderId){
  const { data, error } = await supabase.rpc("admin_delete_order", { order_uuid: orderId });
  if(error) throw error;
  return data;
}

function render(list){
  const wrap = document.getElementById("list");
  const statusEl = document.getElementById("status");
  wrap.innerHTML = "";

  if(!list.length){
    statusEl.textContent = "No orders.";
    return;
  }
  statusEl.textContent = "";

  for(const o of list){
    const b = badge(o.status);
    const el = document.createElement("div");
    el.className = "order";
    el.innerHTML = `
      <div>
        <div><b>${o.game_key.toUpperCase()}</b> • $${moneyFromCents(o.total_cents)} • <span class="badge ${b.cls}">${b.text}</span></div>
        <div class="hint">
          Name: <b>${o.verified_name || "-"}</b> • UID: <b>${o.userid || "-"}</b>${o.serverid ? ` • SID: <b>${o.serverid}</b>` : ""}<br>
          Order: <b>${o.id}</b><br>
          Time: ${new Date(o.created_at).toLocaleString()}
        </div>
      </div>
      <div class="actions">
        ${String(o.status).toLowerCase()==="pending" ? `<button class="btn" data-complete="${o.id}">Complete + Award</button>` : ""}
        <button class="btn ghost" data-delete="${o.id}">Delete</button>
      </div>
    `;
    wrap.appendChild(el);
  }

  wrap.querySelectorAll("[data-complete]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      btn.disabled = true;
      try{
        const id = btn.getAttribute("data-complete");
        const res = await completeOrder(id);
        btn.textContent = res.status === "completed" ? `Completed (+${res.awarded_points ?? 0})` : "Done";
        await refresh();
      }catch(e){
        btn.disabled = false;
        alert(e?.message || "Failed");
      }
    });
  });

  wrap.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-delete");
      if(!confirm("Delete this order?")) return;
      btn.disabled = true;
      try{
        await deleteOrder(id);
        await refresh();
      }catch(e){
        btn.disabled = false;
        alert(e?.message || "Failed");
      }
    });
  });
}

let currentFilter = "all";
async function refresh(){
  const list = await loadOrders(currentFilter);
  render(list);
}

document.getElementById("btnLogout")?.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  location.href = "index.html";
});

document.querySelectorAll("[data-filter]")?.forEach(b=>{
  b.addEventListener("click", async ()=>{
    currentFilter = b.getAttribute("data-filter");
    await refresh();
  });
});

(async ()=>{
  await requireAuth();
  const ok = await checkIsAdmin();
  if(!ok){
    document.getElementById("status").textContent = "Not authorized (not admin).";
    return;
  }
  await refresh();
})();