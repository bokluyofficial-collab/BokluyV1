import { supabase } from "../supabase/supabaseClient.js";

/**
 * Top Up (E) — minimal order workflow
 * - Users submit a top-up request into public.orders
 * - Owner views + updates status in Orders page
 *
 * You must create the table in Supabase (SQL provided in README section below).
 */

const OWNER_UID = "d7e7f252-321c-48b8-ba5c-e1c3ca12940c";

const topupForm = document.getElementById("topupForm");
const topupGame = document.getElementById("topupGame");
const topupPlayerId = document.getElementById("topupPlayerId");
const topupServer = document.getElementById("topupServer");
const topupAmount = document.getElementById("topupAmount");
const topupNote = document.getElementById("topupNote");

const ordersBtn = document.getElementById("ordersBtn");
const ordersList = document.getElementById("ordersList");
const ordersStatusFilter = document.getElementById("ordersStatusFilter");
const ordersRefreshBtn = document.getElementById("ordersRefreshBtn");

let isOwner = false;

function modal(title, text, opts={}) {
  if (window.showActionModal) return window.showActionModal(title, text, opts);
  alert(`${title}\n\n${text}`);
}

function fmt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleString();
}

async function refreshOwnerFlag() {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  isOwner = !!user && user.id === OWNER_UID;

  if (ordersBtn) ordersBtn.style.display = isOwner ? "inline-flex" : "none";
}

async function submitTopup(e) {
  e.preventDefault();

  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) {
    modal("Login required", "Please log in before submitting a top-up request.", { autoCloseMs: 2500 });
    return;
  }

  const payload = {
    user_id: session.user.id,
    game: (topupGame?.value || "").trim(),
    player_id: (topupPlayerId?.value || "").trim(),
    server: (topupServer?.value || "").trim() || null,
    amount: (topupAmount?.value || "").trim(),
    note: (topupNote?.value || "").trim() || null,
    status: "pending"
  };

  if (!payload.game || !payload.player_id || !payload.amount) {
    modal("Missing fields", "Please fill Game, Player ID, and Amount/Package.", { autoCloseMs: 2500 });
    return;
  }

  const { data: inserted, error } = await supabase
    .from("orders")
    .insert(payload)
    .select("id, created_at")
    .single();

  if (error) {
    console.error(error);
    modal("Order submit failed", error.message || "Could not submit request. Make sure the orders table/policies exist.", { autoCloseMs: 0 });
    return;
  }

  topupForm?.reset();
  modal("Submitted", `Your request was submitted.\nOrder ID: ${inserted.id}`, { autoCloseMs: 0 });

  // Optional: prompt user to open chat
  try {
    window.showPage?.("chatPage");
    document.dispatchEvent(new CustomEvent("page:show", { detail: { pageId: "chatPage" } }));
  } catch {}
}

function orderCard(o) {
  const canEdit = isOwner;
  const actions = canEdit ? `
    <div class="order-actions">
      <select data-id="${o.id}" class="order-status">
        <option value="pending" ${o.status==="pending"?"selected":""}>pending</option>
        <option value="processing" ${o.status==="processing"?"selected":""}>processing</option>
        <option value="completed" ${o.status==="completed"?"selected":""}>completed</option>
        <option value="cancelled" ${o.status==="cancelled"?"selected":""}>cancelled</option>
      </select>
      <button class="btn btn-primary order-save" data-id="${o.id}" type="button">Save</button>
    </div>
  ` : "";

  return `
    <div class="order-card">
      <div class="order-head">
        <div class="order-title">${o.game} — ${o.amount}</div>
        <div class="order-status-pill status-${o.status}">${o.status}</div>
      </div>
      <div class="order-meta">
        <div><b>Player ID:</b> ${o.player_id}</div>
        <div><b>Server:</b> ${o.server || "-"}</div>
        <div><b>User:</b> ${(o.user_id||"").slice(0,8)}</div>
        <div><b>Created:</b> ${fmt(o.created_at)}</div>
      </div>
      ${o.note ? `<div class="order-note">${o.note}</div>` : ""}
      ${actions}
    </div>
  `;
}

async function loadOrders() {
  await refreshOwnerFlag();
  if (!isOwner) {
    if (ordersList) ordersList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔒</div><p>Owner only</p></div>';
    return;
  }

  if (!ordersList) return;
  ordersList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><p>Loading...</p></div>';

  let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);

  const status = ordersStatusFilter?.value || "all";
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;

  if (error) {
    console.error(error);
    ordersList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load orders</p></div>';
    modal("Orders load failed", error.message || "Check orders table/policies.", { autoCloseMs: 0 });
    return;
  }

  if (!data?.length) {
    ordersList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No orders</p></div>';
    return;
  }

  ordersList.innerHTML = data.map(orderCard).join("");

  // wire save buttons
  ordersList.querySelectorAll(".order-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const sel = ordersList.querySelector(`select.order-status[data-id="${id}"]`);
      const next = sel?.value;
      if (!id || !next) return;

      const { error: upErr } = await supabase.from("orders").update({ status: next }).eq("id", id);
      if (upErr) {
        console.error(upErr);
        modal("Update failed", upErr.message || "Could not update.", { autoCloseMs: 0 });
        return;
      }

      modal("Updated", "Order status updated.", { autoCloseMs: 1200 });
      await loadOrders();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshOwnerFlag();
  supabase.auth.onAuthStateChange(() => refreshOwnerFlag());

  topupForm?.addEventListener("submit", submitTopup);
  ordersRefreshBtn?.addEventListener("click", loadOrders);
  ordersStatusFilter?.addEventListener("change", loadOrders);
});

// Page show hook (called from script.js)
document.addEventListener("page:show", (e) => {
  const pageId = e?.detail?.pageId;
  if (pageId === "ordersPage") loadOrders();
  if (pageId === "topupPage") refreshOwnerFlag();
});

/**
 * Supabase SQL needed (run once):
 *
 * create table if not exists public.orders (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   game text not null,
 *   player_id text not null,
 *   server text,
 *   amount text not null,
 *   note text,
 *   status text not null default 'pending',
 *   created_at timestamptz not null default now()
 * );
 *
 * alter table public.orders enable row level security;
 *
 * -- Users can insert their own orders
 * create policy "orders_insert_own"
 * on public.orders for insert to authenticated
 * with check (user_id = auth.uid());
 *
 * -- Users can read their own orders (optional; enable when you add a My Orders page)
 * create policy "orders_select_own"
 * on public.orders for select to authenticated
 * using (user_id = auth.uid());
 *
 * -- Owner can read/update all orders (replace OWNER_UID)
 * create policy "orders_owner_select"
 * on public.orders for select to authenticated
 * using (auth.uid() = 'd7e7f252-321c-48b8-ba5c-e1c3ca12940c'::uuid);
 *
 * create policy "orders_owner_update"
 * on public.orders for update to authenticated
 * using (auth.uid() = 'd7e7f252-321c-48b8-ba5c-e1c3ca12940c'::uuid)
 * with check (auth.uid() = 'd7e7f252-321c-48b8-ba5c-e1c3ca12940c'::uuid);
 */
