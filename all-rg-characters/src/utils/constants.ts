import dotenv from "dotenv";

dotenv.config();

export const OLD_CHARACTER_SHEETS_SUBGRAPH_URL =
  process.env.OLD_CHARACTER_SHEETS_SUBGRAPH_URL ?? "";
export const NEW_CHARACTER_SHEETS_SUBGRAPH_URL =
  process.env.NEW_CHARACTER_SHEETS_SUBGRAPH_URL ?? "";
export const OLD_RAIDGUILD_GAME_ADDRESS =
  process.env.OLD_RAIDGUILD_GAME_ADDRESS ?? "";
export const NEW_RAIDGUILD_GAME_ADDRESS =
  process.env.NEW_RAIDGUILD_GAME_ADDRESS ?? "";

export const MONGODB_URI = process.env.MONGODB_URI ?? "";
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE ?? "";

export const PINATA_GATEWAY = "https://charactersheets.mypinata.cloud";
export const PINATA_JWT = process.env.PINATA_JWT ?? "";

export const BASE_CHARACTER_URI = process.env.BASE_CHARACTER_URI ?? "";
export const CHAIN_LABEL = process.env.CHAIN_LABEL ?? "";

export const NPC_SAFE_ADDRESS = process.env.NPC_SAFE_ADDRESS ?? "";
export const NPC_SAFE_OWNER_KEY = process.env.NPC_SAFE_OWNER_KEY ?? "";
export const RPC_URL = process.env.RPC_URL ?? "";
