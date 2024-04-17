import axios from "axios";
import Jimp from "jimp";
import { toHex, parseAbi, encodeFunctionData, Address, getAddress } from "viem";
import Safe, { EthersAdapter } from "@safe-global/protocol-kit";
import { ethers } from "ethers";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { dbPromise } from "./lib/mongodb";
import {
  CHARACTER_SHEETS_SUBGRAPH_URL,
  OLD_RAIDGUILD_GAME_ADDRESS,
  NEW_RAIDGUILD_GAME_ADDRESS,
  BASE_CHARACTER_URI,
  CHAIN_LABEL,
  RPC_URL,
  NPC_SAFE_OWNER_KEY,
  NPC_SAFE_ADDRESS,
} from "./utils/constants";
import { CharacterSubgraph, CharacterMetaDB, Attribute } from "./utils/types";
import {
  formatTraitsForUpload,
  getBaseAttributes,
  getTraitsObjectFromAttributes,
  getImageUrl,
} from "./utils/helpers";
import { uploadToPinata } from "./lib/fileStorage";

if (!OLD_RAIDGUILD_GAME_ADDRESS) {
  throw new Error("Missing envs OLD_RAIDGUILD_GAME_ADDRESS");
}

if (!CHARACTER_SHEETS_SUBGRAPH_URL) {
  throw new Error("Missing envs CHARACTER_SHEETS_SUBGRAPH_URL");
}

if (!NEW_RAIDGUILD_GAME_ADDRESS) {
  throw new Error("Missing envs NEW_RAIDGUILD_GAME_ADDRESS");
}

if (!BASE_CHARACTER_URI) {
  throw new Error("Missing envs BASE_CHARACTER_URI");
}

if (!CHAIN_LABEL) {
  throw new Error("Missing envs CHAIN_LABEL");
}

if (!RPC_URL) {
  throw new Error("Missing envs RPC_URL");
}

if (!NPC_SAFE_OWNER_KEY) {
  throw new Error("Missing envs NPC_SAFE_OWNER_KEY");
}

if (!NPC_SAFE_ADDRESS) {
  throw new Error("Missing envs NPC_SAFE_ADDRESS");
}

// # CHARACTER MIGRATION

// 1. Get all RaidGuild characters from subgraph

const getOldRaidGuildCharacters = async () => {
  console.log("Getting old RaidGuild characters");

  try {
    const query = `
      query CharacterAccountQuery {
        characters(where: { game: "${OLD_RAIDGUILD_GAME_ADDRESS}", jailed: false}) {
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
      const newImageCid = await uploadBaseCharacterImage(
        metadata.attributes,
        i,
        charactersThatNeedImages.length
      );
      uploadedImages[metadata.characterId] = {
        attributes: getBaseAttributes(metadata.attributes),
        image: `ipfs://${newImageCid}`,
      };
    })
  );

  return uploadedImages;
};

// 4. Store all metadata in database with new game address

const storeNewRaidGuildCharacterMetadata = async (
  characterMetadatas: CharacterMetaDB[],
  newAttributesAndImages: {
    [key: string]: { attributes: Attribute[]; image: string };
  }
) => {
  console.log("Storing new RaidGuild character metadata");

  const formattedCharacterMetadatas = characterMetadatas.map((meta) => {
    const newAttributesAndImage = newAttributesAndImages[meta.characterId];

    const gameAddress = getAddress(NEW_RAIDGUILD_GAME_ADDRESS);

    const extendedCharacterId = `${gameAddress}-character-${toHex(
      Number(meta.characterId)
    )}`;

    return {
      characterId: meta.characterId,
      gameAddress,
      account: "",
      attributes: newAttributesAndImage.attributes,
      chainId: meta.chainId,
      name: meta.name,
      description: meta.description,
      image: newAttributesAndImage.image,
      player: meta.player,
      uri: `${BASE_CHARACTER_URI}${CHAIN_LABEL}/${extendedCharacterId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Omit<CharacterMetaDB, "_id">;
  });

  try {
    const dbClient = await dbPromise;

    const result = await dbClient
      .collection("characters")
      .insertMany(formattedCharacterMetadatas);

    if (!result) {
      throw new Error("Error storing metadata in database");
    }

    return result;
  } catch (error) {
    console.error("Error storing metadata in database", error);
    return null;
  }
};

// 5. Batch roll character function calls

export const getNpcGnosisSafe = async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const ownerSigner = new ethers.Wallet(NPC_SAFE_OWNER_KEY, provider);

  const ethAdapterOwner = new EthersAdapter({
    ethers,
    signerOrProvider: ownerSigner,
  });

  const safe = await Safe.create({
    ethAdapter: ethAdapterOwner,
    safeAddress: NPC_SAFE_ADDRESS,
  });

  return safe;
};

const buildRollCharacterTransactionData = async (
  characterMetadata: CharacterMetaDB
) => {
  try {
    const abi = parseAbi([
      "function rollCharacterSheet(address player,string calldata _tokenURI) external returns (uint256)",
    ]);

    const { player } = characterMetadata;
    const extendedCharacterId = `${getAddress(
      NEW_RAIDGUILD_GAME_ADDRESS
    )}-character-${toHex(Number(characterMetadata.characterId))}`;

    const data = encodeFunctionData({
      abi,
      functionName: "rollCharacterSheet",
      args: [player as Address, extendedCharacterId],
    });

    const rollCharacterSheetTransactionData: SafeTransactionDataPartial = {
      to: NEW_RAIDGUILD_GAME_ADDRESS,
      data,
      value: "0",
    };

    return rollCharacterSheetTransactionData;
  } catch (err) {
    return null;
  }
};

export const rollCharacterSheets = async (
  characterMetadatas: CharacterMetaDB[]
) => {
  console.log("Rolling character sheets");

  const safe = await getNpcGnosisSafe();

  try {
    const safeTransactionData = await Promise.all(
      characterMetadatas.map(async (metadata) => {
        const txData = await buildRollCharacterTransactionData(metadata);
        return txData;
      })
    );

    if (safeTransactionData.includes(null)) {
      throw new Error("Could not build transaction data");
    }

    const safeTx = await safe.createTransaction({
      safeTransactionData: safeTransactionData as SafeTransactionDataPartial[],
    });

    const txRes = await safe.executeTransaction(safeTx);
    const tx = txRes.transactionResponse;

    if (!tx) throw new Error("Could not submit transaction");

    return tx;
  } catch (err) {
    console.error("Error rolling character sheets", err);
    return null;
  }
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

  const result = await storeNewRaidGuildCharacterMetadata(
    characterMetaDatas,
    newAttributesAndImages
  );

  if (!result) return;

  const tx = await rollCharacterSheets(characterMetaDatas);

  if (!tx) return;

  console.log("Migration complete");
  console.log("Transaction hash: ", tx.hash);
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
