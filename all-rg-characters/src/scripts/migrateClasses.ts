import axios from "axios";
import { parseAbi, encodeFunctionData, Address } from "viem";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import {
  OLD_CHARACTER_SHEETS_SUBGRAPH_URL,
  NEW_CHARACTER_SHEETS_SUBGRAPH_URL,
  OLD_RAIDGUILD_GAME_ADDRESS,
  NEW_RAIDGUILD_GAME_ADDRESS,
} from "@/utils/constants";
import { getNpcGnosisSafe } from "@/lib/web3/gnosisSafe";

// CLASS MIGRATION

// 1. Get new character accounts by ID

const getNewCharacterIdsToAccount = async () => {
  console.log("Getting new character accounts by ID");

  try {
    const query = `
      query {
        game(id: "${NEW_RAIDGUILD_GAME_ADDRESS}") {
          characters {
            characterId
            account
          }
        }
      }
    `;

    const response = await axios({
      url: NEW_CHARACTER_SHEETS_SUBGRAPH_URL,
      method: "post",
      data: {
        query,
      },
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    const characters = response.data.data.game.characters as {
      characterId: string;
      account: string;
    }[];

    const characterAccountsToIdMapping = characters.reduce((acc, character) => {
      acc[character.characterId] = character.account;
      return acc;
    }, {} as Record<string, string>);

    return characterAccountsToIdMapping;
  } catch (error) {
    console.error("Error getting new character accounts by ID", error);
    return null;
  }
};

// 2. Get all old classes from subgraph

const getOldCharacterClasses = async (
  characterIdsToAccountMapping: Record<string, string>
) => {
  console.log("Getting old classes");

  try {
    const query = `
      query {
        game(id: "${OLD_RAIDGUILD_GAME_ADDRESS}") {
          characters {
            characterId
            heldClasses {
              classEntity {
                classId
              }
            }
          }
        }
      }
    `;

    const response = await axios({
      url: OLD_CHARACTER_SHEETS_SUBGRAPH_URL,
      method: "post",
      data: {
        query,
      },
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    const characters = response.data.data.game.characters as {
      characterId: string;
      heldClasses: { classEntity: { classId: string } }[];
    }[];

    const accountAndClassIdArray = characters
      .map((character) => {
        const classIds = character.heldClasses.map(
          (heldClass) => heldClass.classEntity.classId
        );
        return classIds.map((classId) => ({
          account: characterIdsToAccountMapping[
            character.characterId
          ] as Address,
          classId,
        }));
      })
      .flat();

    return accountAndClassIdArray;
  } catch (error) {
    console.error("Error getting old classes", error);
    return null;
  }
};

// 2. Assign old classes to new characters accordingly

const getNewClassesAddress = async () => {
  try {
    const query = `
      query {
        game(id: "${NEW_RAIDGUILD_GAME_ADDRESS}") {
          classesAddress
        }
      }
    `;

    const response = await axios({
      url: NEW_CHARACTER_SHEETS_SUBGRAPH_URL,
      method: "post",
      data: {
        query,
      },
    });

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    const classesAddress = response.data.data.game.classesAddress as Address;
    return classesAddress;
  } catch (error) {
    console.error("Error getting new classes address", error);
    return null;
  }
};

const buildAssignClassTransactionData = async (
  newClassesAddress: Address,
  accountAndClassId: {
    account: Address;
    classId: string;
  }
) => {
  try {
    const abi = parseAbi([
      "function assignClass(address character, uint256 classId) public",
    ]);

    const { account, classId } = accountAndClassId;

    const data = encodeFunctionData({
      abi,
      functionName: "assignClass",
      args: [account as Address, BigInt(classId)],
    });

    const assignClassTransactionData: SafeTransactionDataPartial = {
      to: newClassesAddress,
      data,
      value: "0",
    };

    return assignClassTransactionData;
  } catch (err) {
    return null;
  }
};

export const assignNewClasses = async (
  newClassesAddress: Address,
  acountAndClassIdArray: {
    account: Address;
    classId: string;
  }[]
) => {
  console.log("Assigning classes");

  const safe = await getNpcGnosisSafe();

  try {
    const safeTransactionData = await Promise.all(
      acountAndClassIdArray.map(async (acountAndClassId) => {
        const txData = await buildAssignClassTransactionData(
          newClassesAddress,
          acountAndClassId
        );
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
    console.error("Error assigning classes", err);
    return null;
  }
};

const migrateClasses = async () => {
  console.log("Starting class migration");

  const characterIdsToAccountMapping = await getNewCharacterIdsToAccount();
  if (!characterIdsToAccountMapping) return;

  const acountAndClassIdArray = await getOldCharacterClasses(
    characterIdsToAccountMapping
  );
  if (!acountAndClassIdArray) return;

  const newClassesAddress = await getNewClassesAddress();
  if (!newClassesAddress) return;

  const tx = await assignNewClasses(newClassesAddress, acountAndClassIdArray);
  if (!tx) return;

  console.log("Class migration complete");
  console.log("Transaction hash: ", tx.hash);
};

export default migrateClasses;
