import { supabase } from "./supabase/supabaseClient.js";

const LISTING_OPTIONS = {
  "Blox Fruits": {
    Accounts: ["Starter Account", "Mid Account", "Max Account", "PvP Account", "Fruit Account"],
    Services: ["Raid Service", "Leveling Service", "Fruit Hunt Service"]
  },
  "MLBB": {
    Accounts: ["Epic Account", "Legend Account", "Mythic Account", "Skin Account"],
    Services: ["Rank Push", "Classic Boost", "Coaching"]
  },
  "Growtopia": {
    Item: ["DL", "BGL", "World Lock"],
    Accounts: ["Starter Account", "Farm Account", "Rich Account"],
    Services: ["Farm Service", "Build Service", "World Setup"]
  },
  "Roblox": {
    Item: ["Giftable Item", "Limited Item", "In-game Item"],
    Accounts: ["Starter Account", "Main Account", "Stacked Account"],
    Services: ["Grinding Service", "Leveling Service", "Game Service"]
  },
  "Free Fire": {
    Accounts: ["Starter Account", "Elite Account", "Rare Skin Account"],
    Services: ["Rank Push", "Coaching", "Boosting"]
  },
  "Honor of Kings": {
    Accounts: ["Starter Account", "High Rank Account", "Skin Account"],
    Services: ["Rank Push", "Coaching", "Duo Service"]
  },
  "PUBG Mobile": {
    Accounts: ["Starter Account", "UC Account", "Rare Skin Account"],
    Services: ["Rank Push", "Coaching", "Duo Service"]
  },
  "Delta Force": {
    Accounts: ["Starter Account", "Mid Account", "High Tier Account"],
    Services: ["Boosting", "Coaching", "Mission Service"]
  },
  "Blood Strike": {
    Accounts: ["Starter Account", "Rare Account", "Max Account"],
    Services: ["Rank Push", "Coaching", "Boosting"]
  }
};

const state = {
  session: null,
  sellerProfile: null,
  listings: [],
  editingId: null,
  editingImageUrl: null,
};

const els = {
  statusCard: document.getElementById("statusCard"),
  userName: document.getElementById("userName"),
  userAvatar: document.getElementById("userAvatar"),
  logoutBtn: document.getElementById("logoutBtn"),

  storeNameStat: document.getElementById("storeNameStat"),
  listingCountStat: document.getElementById("listingCountStat"),
  walletStat: document.getElementById("walletStat"),

  refreshProfileBtn: document.getElementById("refreshProfileBtn"),
  refreshListingsBtn: document.getElementById("refreshListingsBtn"),

  sellerProfileInfo: document.getElementById("sellerProfileInfo"),
  sellerListingsTableBody: document.getElementById("sellerListingsTableBody"),

  sellerListingForm: document.getElementById("sellerListingForm"),
  listingGame: document.getElementById("listingGame"),
  listingCategory: document.getElementById("listingCategory"),
  listingItem: document.getElementById("listingItem"),
  listingType: document.getElementById("listingType"),
  listingPrice: document.getElementById("listingPrice"),
  listingQuantity: document.getElementById("listingQuantity"),
  listingStatus: document.getElementById("listingStatus"),
  contactMethod: document.getElementById("contactMethod"),
  discordField: document.getElementById("discordField"),
  discordUsername: document.getElementById("discordUsername"),
  listingImage: document.getElementById("listingImage"),
  imageField: document.getElementById("imageField"),
  imagePreviewWrap: document.getElementById("imagePreviewWrap"),
  imagePreview: document.getElementById("imagePreview"),
  listingNotes: document.getElementById("listingNotes"),
  listingFormStatus: document.getElementById("listingFormStatus"),
  saveListingBtn: document.getElementById("saveListingBtn"),
  resetListingBtn: document.getElementById("resetListingBtn"),
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

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "approved") return "badge active";
  if (s === "suspended" || s === "rejected" || s === "deleted" || s === "sold_out") return "badge suspended";
  if (s === "pending" || s === "paused") return "badge pending";
  return "badge";
}

function setFormStatus(message, isError = false) {
  if (!els.listingFormStatus) return;
  els.listingFormStatus.textContent = message || "";
  els.listingFormStatus.style.color = isError ? "#fecaca" : "var(--muted)";
}

function syncDiscordField() {
  els.discordField.hidden = els.contactMethod.value !== "discord";
}

function clearImagePreview() {
  els.imagePreview.removeAttribute("src");
  els.imagePreviewWrap.hidden = true;
}

function syncImageField() {
  const isAccount = els.listingCategory.value === "Accounts";

  els.imageField.hidden = !isAccount;

  if (!isAccount) {
    clearImagePreview();
    if (els.listingImage) els.listingImage.value = "";
    els.imagePreviewWrap.hidden = true;
    return;
  }

  els.imagePreviewWrap.hidden = !els.imagePreview.getAttribute("src");
}

function populateGames() {
  const games = Object.keys(LISTING_OPTIONS);
  els.listingGame.innerHTML = `
    <option value="">Select game</option>
    ${games.map((game) => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`).join("")}
  `;
}

function populateCategories() {
  const game = els.listingGame.value;
  const categories = game ? Object.keys(LISTING_OPTIONS[game] || {}) : [];

  els.listingCategory.innerHTML = `
    <option value="">Select category</option>
    ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
  `;

  els.listingItem.innerHTML = `<option value="">Select item</option>`;
  syncImageField();
}

function populateItems() {
  const game = els.listingGame.value;
  const category = els.listingCategory.value;
  const items = LISTING_OPTIONS[game]?.[category] || [];

  els.listingItem.innerHTML = `
    <option value="">Select item</option>
    ${items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
  `;
}

function resetForm() {
  state.editingId = null;
  state.editingImageUrl = null;
  els.sellerListingForm.reset();
  els.listingType.value = "SELLING";
  els.listingQuantity.value = "1";
  els.listingStatus.value = "active";
  els.contactMethod.value = "chat";
  els.saveListingBtn.textContent = "Save listing";
  setFormStatus("");
  populateGames();
  els.listingCategory.innerHTML = `<option value="">Select category</option>`;
  els.listingItem.innerHTML = `<option value="">Select item</option>`;
  syncDiscordField();
  clearImagePreview();
  syncImageField();
}

async function requireSeller() {
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
    "Seller";

  els.userName.textContent = displayName;
  els.userAvatar.textContent = String(displayName).trim().charAt(0).toUpperCase();

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin", {
    check_user_id: session.user.id,
  });

  if (adminErr) {
    setStatus(adminErr.message || "Failed to verify account.", true);
    return null;
  }

  if (isAdmin === true) {
    window.location.href = "./dashboard-admin.html";
    return null;
  }

  const { data: sellerProfile, error: sellerErr } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (sellerErr && sellerErr.code !== "PGRST116") {
    setStatus(sellerErr.message || "Failed to load seller profile.", true);
    return null;
  }

  if (!sellerProfile) {
    window.location.href = "./dashboard-user.html";
    return null;
  }

  state.session = session;
  state.sellerProfile = sellerProfile;
  return session;
}

async function loadSellerListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_user_id", state.session.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.listings = data || [];
}

function renderProfile() {
  const sp = state.sellerProfile;
  if (!sp) return;

  els.storeNameStat.textContent = sp.store_name || "—";
  els.walletStat.textContent = formatMoney(sp.wallet_balance);
  els.sellerProfileInfo.innerHTML = `
    <div class="info-item">
      <span class="k">Store name</span>
      <span class="v">${escapeHtml(sp.store_name || "—")}</span>
    </div>
    <div class="info-item">
      <span class="k">Status</span>
      <span class="v"><span class="${badgeClass(sp.status)}">${escapeHtml(sp.status)}</span></span>
    </div>
    <div class="info-item">
      <span class="k">Wallet balance</span>
      <span class="v">${escapeHtml(formatMoney(sp.wallet_balance))}</span>
    </div>
    <div class="info-item">
      <span class="k">Total sales</span>
      <span class="v">${escapeHtml(formatMoney(sp.total_sales))}</span>
    </div>
    <div class="info-item">
      <span class="k">Total withdrawn</span>
      <span class="v">${escapeHtml(formatMoney(sp.total_withdrawn))}</span>
    </div>
    <div class="info-item">
      <span class="k">Created</span>
      <span class="v">${escapeHtml(formatDate(sp.created_at))}</span>
    </div>
  `;
}

function renderListings() {
  els.listingCountStat.textContent = String(state.listings.length);

  if (!state.listings.length) {
    els.sellerListingsTableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">You have no listings yet.</div>
        </td>
      </tr>
    `;
    return;
  }

  els.sellerListingsTableBody.innerHTML = state.listings
    .map((row) => `
      <tr>
        <td>
          <strong>${escapeHtml(row.item || "Untitled")}</strong>
          ${row.image_url ? `<div style="margin-top:8px;"><img src="${escapeHtml(row.image_url)}" alt="listing" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line);" /></div>` : ""}
        </td>
        <td>${escapeHtml(row.category || "Item")}</td>
        <td>${escapeHtml(row.game || "—")}</td>
        <td>${escapeHtml(formatMoney(row.price))}</td>
        <td>${escapeHtml(String(row.quantity || 0))}</td>
        <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status || "active")}</span></td>
        <td>
          <div class="actions-row">
            <button class="btn-secondary" type="button" data-action="edit" data-id="${escapeHtml(row.id)}">Edit</button>
            <button class="btn-secondary" type="button" data-action="sold" data-id="${escapeHtml(row.id)}">Mark Sold</button>
            <button class="btn-danger" type="button" data-action="delete" data-id="${escapeHtml(row.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

async function uploadListingImage(file) {
  if (!file) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${state.session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

function loadFormFromListing(row) {
  state.editingId = row.id;
  state.editingImageUrl = row.image_url || null;

  populateGames();
  els.listingGame.value = row.game || "";
  populateCategories();
  els.listingCategory.value = row.category || "";
  populateItems();
  els.listingItem.value = row.item || "";
  els.listingType.value = row.type || "SELLING";
  els.listingPrice.value = String(row.price ?? "");
  els.listingQuantity.value = String(row.quantity ?? 1);
  els.listingStatus.value = row.status || "active";
  els.contactMethod.value = row.contact_method || "chat";
  els.discordUsername.value = row.discord || "";
  els.listingNotes.value = row.notes || "";

  if (row.image_url && (row.category || "") === "Accounts") {
    els.imagePreview.src = row.image_url;
    els.imagePreviewWrap.hidden = false;
  } else {
    clearImagePreview();
  }

  els.saveListingBtn.textContent = "Update listing";
  setFormStatus("Editing listing.");
  syncDiscordField();
  syncImageField();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveListing(event) {
  event.preventDefault();
  setFormStatus("Saving...");

  const category = els.listingCategory.value;
  const status = els.listingStatus.value;
  const file = els.listingImage.files?.[0] || null;

  let imageUrl = state.editingImageUrl;

  try {
    if (category === "Accounts" && file) {
      imageUrl = await uploadListingImage(file);
    }

    const payload = {
      seller_user_id: state.session.user.id,
      user_id: state.session.user.id,
      category,
      game: els.listingGame.value,
      item: els.listingItem.value,
      type: els.listingType.value,
      price: Number(els.listingPrice.value),
      quantity: Number(els.listingQuantity.value),
      status,
      contact_method: els.contactMethod.value,
      discord: els.contactMethod.value === "discord" ? els.discordUsername.value.trim() || null : null,
      notes: els.listingNotes.value.trim() || null,
      image_url: category === "Accounts" ? imageUrl : null,
      sold_at: status === "sold_out" ? new Date().toISOString() : null,
    };

    if (!payload.game || !payload.category || !payload.item || !Number.isFinite(payload.price) || payload.price < 0) {
      setFormStatus("Fill in the required fields correctly.", true);
      return;
    }

    if (category === "Accounts" && !payload.image_url) {
      setFormStatus("Account listings need an image.", true);
      return;
    }

    let error;

    if (state.editingId) {
      const updatePayload = { ...payload };
      delete updatePayload.user_id;
      delete updatePayload.seller_user_id;

      ({ error } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", state.editingId)
        .eq("seller_user_id", state.session.user.id));
    } else {
      ({ error } = await supabase.from("listings").insert(payload));
    }

    if (error) {
      console.error(error);
      setFormStatus(error.message || "Failed to save listing.", true);
      return;
    }

    setFormStatus(state.editingId ? "Listing updated." : "Listing created.");
    await loadSellerListings();
    renderListings();
    resetForm();
  } catch (error) {
    console.error(error);
    setFormStatus(error.message || "Failed to upload image or save listing.", true);
  }
}

async function markSold(id) {
  const { error } = await supabase
    .from("listings")
    .update({
      status: "sold_out",
      sold_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("seller_user_id", state.session.user.id);

  if (error) {
    setStatus(error.message || "Failed to mark listing as sold.", true);
    return;
  }

  setStatus("Listing marked as sold.");
  await loadSellerListings();
  renderListings();
}

async function deleteListing(id) {
  const confirmed = window.confirm("Delete this listing?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("seller_user_id", state.session.user.id);

  if (error) {
    setStatus(error.message || "Failed to delete listing.", true);
    return;
  }

  setStatus("Listing deleted.");
  await loadSellerListings();
  renderListings();
}

async function refreshAll() {
  setStatus("Loading seller dashboard...");
  try {
    const { data: freshProfile, error: profileErr } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", state.session.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (profileErr && profileErr.code !== "PGRST116") throw profileErr;
    if (!freshProfile) {
      window.location.href = "./dashboard-user.html";
      return;
    }

    state.sellerProfile = freshProfile;
    await loadSellerListings();
    renderProfile();
    renderListings();
    setStatus("Seller dashboard ready.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to load seller dashboard.", true);
  }
}

function bindEvents() {
  els.logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.href = "./auth.html?logged_out=1";
  });

  els.refreshProfileBtn?.addEventListener("click", refreshAll);
  els.refreshListingsBtn?.addEventListener("click", refreshAll);
  els.contactMethod?.addEventListener("change", syncDiscordField);

  els.listingGame?.addEventListener("change", () => {
    populateCategories();
    clearImagePreview();
    if (els.listingImage) els.listingImage.value = "";
    state.editingImageUrl = null;
  });

  els.listingCategory?.addEventListener("change", () => {
    populateItems();

    if (els.listingCategory.value !== "Accounts") {
      clearImagePreview();
      if (els.listingImage) els.listingImage.value = "";
      state.editingImageUrl = null;
    }

    syncImageField();
  });

  els.listingImage?.addEventListener("change", () => {
    const file = els.listingImage.files?.[0];
    if (!file) {
      clearImagePreview();
      syncImageField();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      els.imagePreview.src = reader.result;
      els.imagePreviewWrap.hidden = false;
      syncImageField();
    };
    reader.readAsDataURL(file);
  });

  els.sellerListingForm?.addEventListener("submit", saveListing);
  els.resetListingBtn?.addEventListener("click", resetForm);

  els.sellerListingsTableBody?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action][data-id]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const row = state.listings.find((item) => String(item.id) === String(id));

    if (!row) return;

    if (action === "edit") {
      loadFormFromListing(row);
    } else if (action === "delete") {
      deleteListing(row.id);
    } else if (action === "sold") {
      markSold(row.id);
    }
  });
}

async function init() {
  bindEvents();
  const session = await requireSeller();
  if (!session) return;
  resetForm();
  await refreshAll();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || "Unexpected seller dashboard error.", true);
});