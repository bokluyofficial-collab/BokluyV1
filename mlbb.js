console.log("MLBB.JS LOADED");

import { initTopupGame } from "./topup-game-common.js";

initTopupGame({
  dbGameKey: "mlbb",
  apiGame: "mobile-legends",
  needsServerId: true,
  uidLabel: "User ID",
  serverLabel: "Server ID",
});
