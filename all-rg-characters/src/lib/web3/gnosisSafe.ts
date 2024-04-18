import Safe, { EthersAdapter } from "@safe-global/protocol-kit";
import { ethers } from "ethers";

import {
  RPC_URL,
  NPC_SAFE_OWNER_KEY,
  NPC_SAFE_ADDRESS,
} from "@/utils/constants";

if (!RPC_URL) {
  throw new Error("Missing envs RPC_URL");
}

if (!NPC_SAFE_OWNER_KEY) {
  throw new Error("Missing envs NPC_SAFE_OWNER_KEY");
}

if (!NPC_SAFE_ADDRESS) {
  throw new Error("Missing envs NPC_SAFE_ADDRESS");
}

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
