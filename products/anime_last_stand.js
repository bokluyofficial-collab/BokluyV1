// products/anime_last_stand.js
// This file must be loaded BEFORE script.js
// Do NOT use type="module"

window.animeLastStandProducts = [
  {
    P_ID: 1,
    P_name: "Gojo",
    game: "Anime Last Stand",
    tradeValue: 2000,
    image: "./products/images/katana.png"
  },
  {
    P_ID: 2,
    P_name: "Sukuna",
    game: "Anime Last Stand",
    tradeValue: 2500,
    image: "./products/images/placeholder.png"
  }
];

// Debug check (safe to remove later)
console.log(
  "✅ Anime Last Stand products loaded:",
  window.animeLastStandProducts.length
);
