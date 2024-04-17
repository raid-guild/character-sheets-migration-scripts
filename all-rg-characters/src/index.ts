import axios from "axios";
import Jimp from "jimp";
import { dbPromise } from "./lib/mongodb";
import {
  CHARACTER_SHEETS_SUBGRAPH_URL,
  RAIDGUILD_GAME_ADDRESS,
} from "./utils/constants";
import { CharacterSubgraph, CharacterMetaDB, Attribute } from "./utils/types";
import {
  formatTraitsForUpload,
  getBaseAttributes,
  getTraitsObjectFromAttributes,
  getImageUrl,
} from "./utils/helpers";
import { uploadToPinata } from "./lib/fileStorage";

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
        characters(where: { game: "${RAIDGUILD_GAME_ADDRESS}", jailed: false}) {
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

    return response.data.data.characters as CharacterSubgraph[];
  } catch (error) {
    console.error("Error getting old RaidGuild characters", error);
    return null;
  }
};

// 2. Get all metadata from database or Pinata (if not in database)

const getOldRaidGuildCharacterMetadata = async (characterUris: string[]) => {
  console.log("Getting old RaidGuild character metadata");

  try {
    const dbClient = await dbPromise;

    const result = await dbClient
      .collection("characters")
      .find({ uri: { $in: characterUris } })
      .toArray();

    if (!result) {
      throw new Error("Error fetching metadata from database");
    }

    return result as CharacterMetaDB[];
  } catch (error) {
    console.error("Error getting metadata from database", error);
    return null;
  }
};

// 3. Re-create all base character images using attributes

const uploadBaseCharacterImage = async (
  attributes: Attribute[],
  currentImageIndex: number,
  totalImagesToUpload: number
) => {
  const baseAttributes = getBaseAttributes(attributes);
  const traits = getTraitsObjectFromAttributes(baseAttributes);
  const traitsArray = await formatTraitsForUpload(traits);

  const traitImages = await Promise.all(
    traitsArray.map(async (trait) => {
      const url = getImageUrl(trait);
      const image = await Jimp.read(url);
      return image.resize(700, Jimp.AUTO);
    })
  );

  const imageComposite = traitImages.reduce((acc, image) => {
    return acc.composite(image, 0, 0);
  });

  const fileContents = await imageComposite
    .quality(85)
    .getBufferAsync(Jimp.MIME_JPEG);

  console.log(
    `Uploading image ${currentImageIndex + 1} of ${totalImagesToUpload}...`
  );
  const cid = await uploadToPinata(fileContents, "characterAvater.jpg");
  return cid;
};

const uploadBaseCharacterImages = async (
  characterMetadatas: CharacterMetaDB[]
) => {
  const uploadedImages: {
    [key: string]: { attributes: Attribute[]; image: string };
  } = {};
  characterMetadatas
    .filter((meta) => !meta.attributes || meta.attributes.length === 0)
    .forEach((meta) => {
      uploadedImages[meta.characterId] = {
        attributes: [],
        image: meta.image,
      };
    });

  const charactersThatNeedImages = characterMetadatas.filter(
    (meta) => !!meta.attributes && meta.attributes.length > 0
  );

  await Promise.all(
    charactersThatNeedImages.map(async (metadata, i) => {
      const newImage = await uploadBaseCharacterImage(
        metadata.attributes,
        i,
        charactersThatNeedImages.length
      );
      uploadedImages[metadata.characterId] = {
        attributes: getBaseAttributes(metadata.attributes),
        image: newImage,
      };
    })
  );

  return uploadedImages;
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

  const characterMetaDatas = await getOldRaidGuildCharacterMetadata(
    characterUris
  );

  if (!characterMetaDatas) return;

  const newAttributesAndImages = await uploadBaseCharacterImages(
    characterMetaDatas
  );

  console.log(newAttributesAndImages);

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
