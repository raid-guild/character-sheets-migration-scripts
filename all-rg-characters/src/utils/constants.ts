import dotenv from "dotenv";

dotenv.config();

export const CHARACTER_SHEETS_SUBGRAPH_URL =
  process.env.CHARACTER_SHEETS_SUBGRAPH_URL ?? "";
export const RAIDGUILD_GAME_ADDRESS = process.env.RAIDGUILD_GAME_ADDRESS ?? "";

export const MONGODB_URI = process.env.MONGODB_URI ?? "";
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? "";

export const PINATA_GATEWAY = "https://charactersheets.mypinata.cloud";
export const PINATA_JWT = process.env.PINATA_JWT ?? "";
