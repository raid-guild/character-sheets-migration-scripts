import dotenv from "dotenv";

dotenv.config();

export const CHARACTER_SHEETS_SUBGRAPH_URL =
  process.env.CHARACTER_SHEETS_SUBGRAPH_URL ?? "";

export const RAIDGUILD_GAME_ADDRESS = process.env.RAIDGUILD_GAME_ADDRESS ?? "";
