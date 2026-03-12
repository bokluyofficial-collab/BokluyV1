// Shared seller-request modal logic (copied from growtopia.js)
const SELLER_REQUEST_URL = "https://jszfngwewbpregrwapzo.supabase.co/functions/v1/seller-request";

const sellOpenBtn = document.getElementById("sellOpenBtn");
const sellModal = document.getElementById("sellModal");
const sellCloseBg = document.getElementById("sellCloseBg");
const sellCloseBtn = document.getElementById("sellCloseBtn");
const sellCancel = document.getElementById("sellCancel");
const sellForm = document.getElementById("sellForm");
const sellStatus = document.getElementById("sellStatus");

const sellPhoneEl = document.getElementById("sellPhone");
const sellGameEl = document.getElementById("sellGame");
const sellItemEl = document.getElementById("sellItem");
const sellPriceEl = document.getElementById("sellPrice");
const sellMessageEl = document.getElementById("sellMessage");

function setSellStatus(msg) {
  if (sellStatus) sellStatus.textContent = msg || "";
}

function openSell() {
  if (!sellModal) return;
  sellModal.setAttribute("aria-hidden", "false");
  setSellStatus("");
}

function closeSell() {
  if (!sellModal) return;
  sellModal.setAttribute("aria-hidden", "true");
  setSellStatus("");
}

sellOpenBtn?.addEventListener("click", openSell);
sellCloseBg?.addEventListener("click", closeSell);
sellCloseBtn?.addEventListener("click", closeSell);
sellCancel?.addEventListener("click", closeSell);

sellForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = (sellPhoneEl?.value || "").trim();
  const game = (sellGameEl?.value || "").trim();
  const item = (sellItemEl?.value || "").trim();
  const price = (sellPriceEl?.value || "").trim();
  const message = (sellMessageEl?.value || "").trim();

  if (!phone || !game || !item || !price || !message) {
    setSellStatus("សូមបំពេញព័ត៌មានឲ្យครบ/ត្រឹមត្រូវ។");
    return;
  }

  setSellStatus("កំពុងផ្ញើសំណើ...");

  try {
    const res = await fetch(SELLER_REQUEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, game, item, price, message }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Send failed");

    setSellStatus("បានផ្ញើជោគជ័យ ✅");
    setTimeout(() => closeSell(), 700);
  } catch (err) {
    setSellStatus("បរាជ័យក្នុងការផ្ញើ។ សូមព្យាយាមម្ដងទៀត។");
  }
});
