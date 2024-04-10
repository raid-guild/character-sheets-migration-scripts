import axios from "axios";
import {
  CHARACTER_SHEETS_SUBGRAPH_URL,
  RAIDGUILD_GAME_ADDRESS,
} from "./utils/constants";
import { Character } from "./utils/types";

if (!RAIDGUILD_GAME_ADDRESS || !CHARACTER_SHEETS_SUBGRAPH_URL) {
  throw new Error(
    "Missing envs RAIDGUILD_GAME_ADDRESS or CHARACTER_SHEETS_SUBGRAPH_URL"
  );
}

// # CHARACTER MIGRATION

// 1. Get all RaidGuild characters from subgraph

const getOldRaidGuildCharacters = async () => {
  console.log("Getting old RaidGuild characters");

  try {
    const query = `
      query CharacterAccountQuery {
        characters(where: { game: "${RAIDGUILD_GAME_ADDRESS}" }) {
          account
          player
          uri
        }
      }
    `;

    const response = await axios({
      url: CHARACTER_SHEETS_SUBGRAPH_URL,
      method: "post",
      data: {
        query,
      },
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    return response.data.data.characters as Character[];
  } catch (error) {
    console.error("Error getting old RaidGuild characters", error);
    return null;
  }
};

// 2. Get all metadata from database or Pinata (if not in database)

const getOldRaidGuildCharacterMetadata = async () => {
  console.log("Getting old RaidGuild character metadata");
};

// 3. Re-create all base character images using attributes

const uploadBaseCharacterImages = async () => {
  console.log("Uploading base character images");
};

// 4. Store all metadata in database with new game address

const storeNewRaidGuildCharacterMetadata = async () => {
  console.log("Storing new RaidGuild character metadata");
};

// 5. Batch roll character function calls

const batchRollCharacters = async () => {
  console.log("Batch rolling characters");
};

const migrateRaidGuildCharacters = async () => {
  const characters = await getOldRaidGuildCharacters();

  if (!characters) return;

  const characterUris = characters.map((character) => character.uri);

  console.log(characterUris);

  await getOldRaidGuildCharacterMetadata();

  await uploadBaseCharacterImages();

  await storeNewRaidGuildCharacterMetadata();

  await batchRollCharacters();

  console.log("Migration complete");
};

// CLASS MIGRATION
// 1. Get all classes from subgraph
// 2. Assign old classes to new characters accordingly

// # XP MIGRATION
// 1. Get the XP of all characters
// 2. Get all XP transactions that came in batches of 50
// 3. Subtract all 50 XP transactions from each character's general XP
// 4. Use the 50 XP transactions to give jester class XP to characters

// # ITEM MIGRATION
// Skip

const run = () => {
  console.log("Starting migration");
  migrateRaidGuildCharacters();
};

run();
