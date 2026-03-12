import { initTopupGame } from "./topup-game-common.js";

initTopupGame({
  dbGameKey: "mcgg",
  apiGame: "mcgg",           // change if needed
  needsServerId: true,
  uidLabel: "User ID",
  serverLabel: "Server ID",
});
