// Combine products
const allProducts = [...bloxFruits, ...animeLastStand];
let listings = [];

// Populate games dropdown
const gamesSet = new Set(allProducts.map(p => p.game));
const listingGame = document.getElementById("listingGame");
const filterGame = document.getElementById("filterGame");
gamesSet.forEach(game => {
  const opt1 = document.createElement("option"); opt1.value = game; opt1.textContent = game; listingGame.appendChild(opt1);
  const opt2 = document.createElement("option"); opt2.value = game; opt2.textContent = game; filterGame.appendChild(opt2);
});

// Modal
const listingModal = document.getElementById("listingModal");
document.getElementById("openListingModalBtn").onclick = () => listingModal.style.display = "block";
document.getElementById("closeModal").onclick = () => listingModal.style.display = "none";
window.onclick = e => { if (e.target === listingModal) listingModal.style.display = "none"; };

// Discord visibility
const contactMethod = document.getElementById("contactMethod");
const discordLabel = document.getElementById("discordLabel");
contactMethod.onchange = () => discordLabel.style.display = contactMethod.value === "discord" ? "block" : "none";

// Autocomplete
const listingItem = document.getElementById("listingItem");
const autocompleteList = document.getElementById("autocompleteList");

listingItem.addEventListener("input", () => {
  autocompleteList.innerHTML = "";
  const game = listingGame.value;
  if (!game) return;
  const term = listingItem.value.toLowerCase();
  const items = allProducts.filter(p => p.game === game && p.P_name.toLowerCase().includes(term));
  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.P_name;
    li.onclick = () => { listingItem.value = item.P_name; autocompleteList.innerHTML = ""; };
    autocompleteList.appendChild(li);
  });
});

// Add listing
document.getElementById("listingForm").onsubmit = e => {
  e.preventDefault();
  const game = listingGame.value;
  const itemName = listingItem.value;
  const type = document.getElementById("listingType").value;
  const price = Number(document.getElementById("listingPrice").value);
  const quantity = Number(document.getElementById("listingQuantity").value);
  const contact = contactMethod.value;
  const discord = document.getElementById("discordUsername").value;
  const notes = document.getElementById("listingNotes").value;

  if (contact === "discord" && !discord) window.showActionModal("Missing info", "Please enter your Discord username.", { autoCloseMs: 2000 });
return;


  listings.push({ game, itemName, type, price, quantity, contact, discord, notes });
  listingModal.style.display = "none";
  renderListings();
};

// Render Listings
const listingsGrid = document.getElementById("listingsGrid");
function renderListings() {
  listingsGrid.innerHTML = "";
  const filtered = listings.filter(l => {
    const gameFilter = filterGame.value ? l.game === filterGame.value : true;
    const typeFilter = filterType.value ? l.type === filterType.value : true;
    const minPrice = filterMinPrice.value ? l.price >= Number(filterMinPrice.value) : true;
    const maxPrice = filterMaxPrice.value ? l.price <= Number(filterMaxPrice.value) : true;
    const searchTerm = searchInput.value.toLowerCase();
    const searchFilter = l.itemName.toLowerCase().includes(searchTerm) || l.game.toLowerCase().includes(searchTerm);
    return gameFilter && typeFilter && minPrice && maxPrice && searchFilter;
  });

  // Sorting
  switch(filterSort.value) {
    case "priceLow": filtered.sort((a,b)=>a.price-b.price); break;
    case "priceHigh": filtered.sort((a,b)=>b.price-a.price); break;
    case "bestValue": filtered.sort((a,b)=>{
      const av1 = allProducts.find(p=>p.P_name===a.itemName)?.tradeValue || 0;
      const av2 = allProducts.find(p=>p.P_name===b.itemName)?.tradeValue || 0;
      return (av2-b.tradeValue)-(av1-a.tradeValue);
    }); break;
    case "newest": break;
  }

  filtered.forEach(l => {
    const card = document.createElement("div"); card.className = "listing-card";
    const tradeValue = allProducts.find(p => p.P_name === l.itemName)?.tradeValue || 0;
    const priceClass = l.price > tradeValue ? "price-over" : l.price < tradeValue ? "price-under" : "";
    card.innerHTML = `
      <h3>${l.itemName}</h3>
      <p>Game: ${l.game}</p>
      <p>Type: ${l.type}</p>
      <p>Price: <span class="${priceClass}">${l.price}</span> (Trade: ${tradeValue})</p>
      <p>Quantity: ${l.quantity}</p>
      <p>${l.notes || ""}</p>
       <button onclick="${
  l.contact === 'discord'
    ? `navigator.clipboard.writeText(${JSON.stringify(l.discord || '')})
        .then(()=>window.notifyOk('Copied', 'Discord username copied.', 1200))
        .catch(()=>window.notifyError('Clipboard blocked by browser.'))`
    : ''
}">
  Contact
</button>

      `;
    listingsGrid.appendChild(card);
  });

  // Stats
  document.getElementById("totalListings").textContent = `Total Listings: ${listings.length}`;
  document.getElementById("activeListings").textContent = `Active Listings: ${filtered.length}`;
  document.getElementById("totalGames").textContent = `Games: ${gamesSet.size}`;
}

// Filters
const filterType = document.getElementById("filterType");
const filterMinPrice = document.getElementById("filterMinPrice");
const filterMaxPrice = document.getElementById("filterMaxPrice");
const filterSort = document.getElementById("filterSort");
const searchInput = document.getElementById("searchInput");
[filterGame, filterType, filterMinPrice, filterMaxPrice, filterSort, searchInput].forEach(el => {
  el.addEventListener("input", renderListings);
});

renderListings();
