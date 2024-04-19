import { ObjectId } from "mongodb";

export type Attribute = {
  trait_type: string;
  value: string;
};

export type CharacterMetaDB = Metadata & {
  _id: ObjectId;
  chainId: string;
  gameAddress: string;
  characterId: string;
  account: string;
  player: string;
  uri: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CharacterSubgraph = {
  characterId: string;
  account: string;
  player: string;
  uri: string;
};

export type Metadata = {
  name: string;
  description: string;
  image: string;
  equippable_layer: string | null;
  attributes: Attribute[];
};
