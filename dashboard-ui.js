import { supabase } from "./supabase/supabaseClient.js";

// Keep simple: if you already have clearSupabaseStorage in another file, you can remove this.
function clearSupabaseStorage() {
  try {
    const keys = Object.keys(localStorage || {});
    keys.forEach((k) => {
      if (k.startsWith("sb-") && k.includes("auth")) localStorage.removeItem(k);
    });
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
    // ===== Prizes modal (placeholder data) =====
const btnPrizes = document.getElementById("btnPrizes");
const prizeModal = document.getElementById("prizeModal");
const prizeModalBackdrop = document.getElementById("prizeModalBackdrop");
const prizeModalClose = document.getElementById("prizeModalClose");
const prizeGameTabs = document.getElementById("prizeGameTabs");
const prizeModalBody = document.getElementById("prizeModalBody");

const PLACEHOLDER_IMG = "./images/placeholder.png";

// Placeholder prize pools per game
const PRIZE_POOLS = {
  mlbb: {
    common: [
      { name: "MLBB Small Pack", img: PLACEHOLDER_IMG },
      { name: "MLBB Bonus Pack", img: PLACEHOLDER_IMG },
      { name: "MLBB Skin Shard", img: PLACEHOLDER_IMG },
      { name: "MLBB Coupon", img: PLACEHOLDER_IMG },
    ],
    epic: [
      { name: "MLBB Epic Pack", img: PLACEHOLDER_IMG },
      { name: "MLBB Big Bonus", img: PLACEHOLDER_IMG },
    ],
    jackpot: [
      { name: "MLBB JACKPOT", img: PLACEHOLDER_IMG },
    ],
  },

  freefire: {
    common: [
      { name: "FF Small Pack", img: PLACEHOLDER_IMG },
      { name: "FF Bonus Pack", img: PLACEHOLDER_IMG },
      { name: "FF Voucher", img: PLACEHOLDER_IMG },
      { name: "FF Coupon", img: PLACEHOLDER_IMG },
    ],
    epic: [
      { name: "FF Epic Pack", img: PLACEHOLDER_IMG },
      { name: "FF Big Bonus", img: PLACEHOLDER_IMG },
    ],
    jackpot: [
      { name: "FF JACKPOT", img: PLACEHOLDER_IMG },
    ],
  },

  hok: {
    common: [
      { name: "HOK Small Pack", img: PLACEHOLDER_IMG },
      { name: "HOK Bonus Pack", img: PLACEHOLDER_IMG },
      { name: "HOK Voucher", img: PLACEHOLDER_IMG },
      { name: "HOK Coupon", img: PLACEHOLDER_IMG },
    ],
    epic: [
      { name: "HOK Epic Pack", img: PLACEHOLDER_IMG },
      { name: "HOK Big Bonus", img: PLACEHOLDER_IMG },
    ],
    jackpot: [
      { name: "HOK JACKPOT", img: PLACEHOLDER_IMG },
    ],
  },

  pubg: {
    common: [
      { name: "PUBG Small Pack", img: PLACEHOLDER_IMG },
      { name: "PUBG Bonus Pack", img: PLACEHOLDER_IMG },
      { name: "PUBG Voucher", img: PLACEHOLDER_IMG },
      { name: "PUBG Coupon", img: PLACEHOLDER_IMG },
    ],
    epic: [
      { name: "PUBG Epic Pack", img: PLACEHOLDER_IMG },
      { name: "PUBG Big Bonus", img: PLACEHOLDER_IMG },
    ],
    jackpot: [
      { name: "PUBG JACKPOT", img: PLACEHOLDER_IMG },
    ],
  },
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPrizeSection(title, rarityClass, items) {
  const cards = (items || []).map(it => `
    <div class="prize-item">
      <div class="prize-pic">
        <img src="${escapeHtml(it.img)}" alt="${escapeHtml(it.name)}"
             onerror="this.src='${PLACEHOLDER_IMG}'">
      </div>
      <div class="prize-name">${escapeHtml(it.name)}</div>
    </div>
  `).join("");

  return `
    <div class="prize-section">
      <div class="prize-head">
        <div class="prize-title">
          <span>${escapeHtml(title)}</span>
          <span class="rarity-pill ${rarityClass}">${escapeHtml(title)}</span>
        </div>
      </div>
      <div class="prize-grid">${cards || ""}</div>
    </div>
  `;
}

function renderPrizes(gameKey) {
  const pool = PRIZE_POOLS[gameKey] || PRIZE_POOLS.mlbb;
  prizeModalBody.innerHTML =
    renderPrizeSection("Common", "rarity-common", pool.common) +
    renderPrizeSection("Epic", "rarity-epic", pool.epic) +
    renderPrizeSection("Jackpot", "rarity-jackpot", pool.jackpot);
}

function openPrizeModal(gameKey = "mlbb") {
  prizeModal?.classList.add("open");
  prizeModal?.setAttribute("aria-hidden", "false");

  // set active tab
  prizeGameTabs?.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  prizeGameTabs?.querySelector(`.tab[data-game="${gameKey}"]`)?.classList.add("active");

  renderPrizes(gameKey);
}

function closePrizeModal() {
  prizeModal?.classList.remove("open");
  prizeModal?.setAttribute("aria-hidden", "true");
}

btnPrizes?.addEventListener("click", () => {
  // default to currently selected wheel if you want:
  // openPrizeModal(selected.key);
  openPrizeModal(selected.key);
});

prizeModalBackdrop?.addEventListener("click", closePrizeModal);
prizeModalClose?.addEventListener("click", closePrizeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePrizeModal();
});

prizeGameTabs?.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const gameKey = tab.dataset.game || "mlbb";
    prizeGameTabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    renderPrizes(gameKey);
  });
});
  // ===== User dropdown =====
  const menuBtn = document.getElementById("userMenuBtn");
  const menu = document.getElementById("userMenu");
  const btnLogout = document.getElementById("btnLogout");
  const dashUserName = document.getElementById("dashUserName");
  const dashUserSub = document.getElementById("dashUserSub");

  function closeMenu() { menu?.classList.remove("open"); }

  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu?.classList.toggle("open");
  });
  document.addEventListener("click", closeMenu);

  function pickDisplayName(user) {
    return (
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "User"
    );
  }

  supabase.auth.getSession().then(({ data }) => {
    const user = data?.session?.user;
    if (user && dashUserName) dashUserName.textContent = pickDisplayName(user);
    if (dashUserSub) dashUserSub.textContent = user ? "Logged in" : "Guest";
  });

  btnLogout?.addEventListener("click", async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    clearSupabaseStorage();
    closeMenu();
    window.location.href = "./auth.html?logged_out=1";
  });
  btnHowItWorks?.addEventListener("click", () => {
    alert(
      "How it works:\n" +
      "- 1 completed order = 1 point.\n" +
      "- Every 100 points can be exchanged for $1."
    );
  });
});