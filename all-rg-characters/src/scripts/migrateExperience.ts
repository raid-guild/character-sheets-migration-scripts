import axios from "axios";
import {
  OLD_CHARACTER_SHEETS_SUBGRAPH_URL,
  NEW_CHARACTER_SHEETS_SUBGRAPH_URL,
  OLD_RAIDGUILD_GAME_ADDRESS,
  NEW_RAIDGUILD_GAME_ADDRESS,
} from "@/utils/constants";
import {
  Address,
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { gnosis, sepolia } from "viem/chains";
import { getNpcGnosisSafe } from "@/lib/web3/gnosisSafe";
import { CharacterSubgraph } from "@/utils/types";
import { assignNewClasses } from "./migrateClasses";

const getChain = (chainId: string) => {
  switch (Number(chainId)) {
    case gnosis.id:
      return gnosis;
    case sepolia.id:
      return sepolia;
    default:
      return sepolia;
  }
};

const SEPOLIA_STARTING_BLOCK = 5706174n;
const GNOSIS_STARTING_BLOCK = 30757806n;

const getStartingBlock = (chainId: string) => {
  switch (Number(chainId)) {
    case gnosis.id:
      return GNOSIS_STARTING_BLOCK;
    case sepolia.id:
      return SEPOLIA_STARTING_BLOCK;
    default:
      return SEPOLIA_STARTING_BLOCK;
  }
};

// # XP MIGRATION
// 1. Get experience contract address from old game

const getOldExperienceAddressAndChainId = async () => {
  console.log("Getting old experience address");

  try {
    const query = `
      query {
        game(id: "${OLD_RAIDGUILD_GAME_ADDRESS}") {
          experienceAddress
          chainId
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
    const game = response.data.data.game;

    return {
      experienceAddress: game.experienceAddress as Address,
      chainId: game.chainId as string,
    };
  } catch (error) {
    console.error("Error getting old experience address", error);
    return null;
  }
};

// 2. Get all transfer XP events from old game

const getOldTransferEvents = async (
  experienceAddress: Address,
  chainId: string
) => {
  console.log("Getting old transfer events");

  try {
    const publicViemClient = createPublicClient({
      chain: getChain(chainId),
      transport: http(),
    });

    const logs = await publicViemClient.getContractEvents({
      address: experienceAddress,
      fromBlock: getStartingBlock(chainId),
      abi: [
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: "address",
              name: "from",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          name: "Transfer",
          type: "event",
        },
      ],
      eventName: "Transfer",
    });

    return logs.filter((log) => log.args.value === 50n).map((log) => log.args);
  } catch (error) {
    console.error("Error getting old transfer events", error);
    return null;
  }
};

// 3. Get all transfers of 50 XP + who the recipient is (by character ID)

const getOldCharacterAccountsToIdMapping = async () => {
  try {
    const query = `
      query {
        characters(where: { game: "${OLD_RAIDGUILD_GAME_ADDRESS}", jailed: false}) {
          characterId
          account
          player
          uri
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

    const characters = response.data.data.characters as CharacterSubgraph[];

    return characters.reduce((acc: Record<string, string>, character: any) => {
      acc[character.account] = character.characterId;
      return acc;
    }, {});
  } catch (error) {
    console.error("Error getting old character accounts to ID mapping", error);
    return null;
  }
};

// 4. Get the experience and class address of new game

const getNewClassesAddress = async () => {
  console.log("Getting new classes addresses");

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

    return response.data.data.game.classesAddress as Address;
  } catch (error) {
    console.error("Error getting new classes addresses", error);
    return null;
  }
};

// 5. Get all character accounts by ID in the new game

const getNewCharacterIdsToAccount = async () => {
  console.log("Getting new character IDs to account mapping");

  try {
    const query = `
      query {
        characters(where: { game: "${NEW_RAIDGUILD_GAME_ADDRESS}", jailed: false}) {
          characterId
          account
          player
          uri
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

    const characters = response.data.data.characters as CharacterSubgraph[];

    return characters.reduce((acc: Record<string, string>, character: any) => {
      acc[character.characterId] = character.account;
      return acc;
    }, {});
  } catch (error) {
    console.error("Error getting new character IDs to account mapping", error);
    return null;
  }
};

// 6. Assign the Jester class to the character accounts that received 50 XP in the old game
// 7. Mint Jester XP to the character accounts that received 50 XP in the old game (the equivalent amount of XP they received in the old game)

const buildGiveClassExpsTransactionData = async (
  newClassesAddress: Address,
  accountAndClassId: {
    account: Address;
    classId: string;
  }
) => {
  try {
    const abi = parseAbi([
      "function giveClassExp(address characterAccount, uint256 classId, uint256 amountOfExp) public",
    ]);

    const { account, classId } = accountAndClassId;

    const data = encodeFunctionData({
      abi,
      functionName: "giveClassExp",
      args: [account as Address, BigInt(classId), 50n],
    });

    const giveClassExpTransactionData: SafeTransactionDataPartial = {
      to: newClassesAddress,
      data,
      value: "0",
    };

    return giveClassExpTransactionData;
  } catch (err) {
    return null;
  }
};

export const giveClassExp = async (
  newClassesAddress: Address,
  acountAndClassIdArray: {
    account: Address;
    classId: string;
  }[]
) => {
  console.log("Giving class XP");

  const safe = await getNpcGnosisSafe();

  try {
    const safeTransactionData = await Promise.all(
      acountAndClassIdArray.map(async (acountAndClassId) => {
        const txData = await buildGiveClassExpsTransactionData(
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
    console.error("Error giving class XP", err);
    return null;
  }
};

const migrateJesterExperience = async () => {
  console.log("Starting jester XP migration");

  const JESTER_CLASS_ID = "14";

  const oldExperienceAddressAndChainId =
    await getOldExperienceAddressAndChainId();
  if (!oldExperienceAddressAndChainId) return;

  const { experienceAddress, chainId } = oldExperienceAddressAndChainId;

  const oldTransferEvents = await getOldTransferEvents(
    experienceAddress,
    chainId
  );
  if (!oldTransferEvents || oldTransferEvents.length === 0) return;
  if (oldTransferEvents.some((transfer) => !transfer.to)) return;

  const oldCharacterAccountsToIdMapping =
    await getOldCharacterAccountsToIdMapping();
  if (!oldCharacterAccountsToIdMapping) return;

  const jesterXpToMint = oldTransferEvents.map((transfer) => {
    return {
      to: oldCharacterAccountsToIdMapping[transfer.to?.toLowerCase() ?? ""],
      amount: 50n,
    };
  });

  const newClassesAddress = await getNewClassesAddress();
  if (!newClassesAddress) return;

  const newCharacterIdsToAccountMapping = await getNewCharacterIdsToAccount();
  if (!newCharacterIdsToAccountMapping) return;

  const acountAndClassIdArray = jesterXpToMint.map((jesterTransfer) => {
    return {
      account: newCharacterIdsToAccountMapping[jesterTransfer.to] as Address,
      classId: JESTER_CLASS_ID,
    };
  });

  let tx = await assignNewClasses(newClassesAddress, acountAndClassIdArray);
  if (!tx) return;

  console.log("Assigned Jester class to characters", tx.hash);

  tx = await giveClassExp(newClassesAddress, acountAndClassIdArray);
  if (!tx) return;

  console.log("Minted Jester XP to characters", tx.hash);

  console.log("Jester XP complete");
};

export default migrateJesterExperience;
