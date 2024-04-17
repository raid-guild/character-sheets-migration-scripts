import { capitalize } from "lodash";
import { PINATA_GATEWAY } from "./constants";
import { Attribute } from "./types";

export enum BaseTraitType {
  BACKGROUND = "BACKGROUND",
  BODY = "BODY",
  EYES = "EYES",
  HAIR = "HAIR",
  CLOTHING = "CLOTHING",
  MOUTH = "MOUTH",
}

export enum EquippableTraitType {
  EQUIPPED_ITEM_1 = "EQUIPPED ITEM 1",
  EQUIPPED_WEARABLE = "EQUIPPED WEARABLE",
  EQUIPPED_ITEM_2 = "EQUIPPED ITEM 2",
}

export type TraitsArray = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
];

export const LAYERS_URI =
  "ipfs://bafybeidfpt3earjjmrcbk4gcviupjp3a4b5vkx5ldhf5brioobtvbgzlni";

const IPFS_GATEWAYS = [
  PINATA_GATEWAY,
  "https://cloudflare-ipfs.com",
  "https://ipfs.io",
];

/**
 * Given a URI that may be ipfs, ipns, http, https, ar, or data protocol, return the fetch-able http(s) URLs for the same content
 * @param uri to convert to fetch-able http url
 */
export const uriToHttp = (uri: string): string[] => {
  try {
    const protocol = uri.split(":")[0].toLowerCase();
    switch (protocol) {
      case "data":
        return [uri];
      case "https":
        return [uri];
      case "http":
        return ["https" + uri.substring(4), uri];
      case "ipfs": {
        const hash = uri.match(/^ipfs:(\/\/)?(.*)$/i)?.[2];
        return IPFS_GATEWAYS.map((g) => `${g}/ipfs/${hash}`);
      }
      case "ipns": {
        const name = uri.match(/^ipns:(\/\/)?(.*)$/i)?.[2];
        return IPFS_GATEWAYS.map((g) => `${g}/ipns/${name}`);
      }
      case "ar": {
        const tx = uri.match(/^ar:(\/\/)?(.*)$/i)?.[2];
        return [`https://arweave.net/${tx}`];
      }
      default:
        return [""];
    }
  } catch (e) {
    console.error(e);
    return [""];
  }
};

export const getBaseAttributes = (attributes: Attribute[]): Attribute[] => {
  const onlyBaseAttributes = attributes.filter(
    (attr) =>
      attr.trait_type === BaseTraitType.BACKGROUND ||
      attr.trait_type === BaseTraitType.BODY ||
      attr.trait_type === BaseTraitType.EYES ||
      attr.trait_type === BaseTraitType.HAIR ||
      attr.trait_type === BaseTraitType.CLOTHING ||
      attr.trait_type === BaseTraitType.MOUTH
  );

  return [
    ...onlyBaseAttributes,
    {
      trait_type: "EQUIPPED ITEM 1",
      value: "",
    },
    {
      trait_type: "EQUIPPED WEARABLE",
      value: "",
    },
    {
      trait_type: "EQUIPPED ITEM 2",
      value: "",
    },
  ];
};

export const traitPositionToIndex = (
  position: BaseTraitType | EquippableTraitType
): number => {
  switch (position) {
    case BaseTraitType.BACKGROUND:
      return 0;
    case BaseTraitType.BODY:
      return 1;
    case BaseTraitType.EYES:
      return 2;
    case BaseTraitType.HAIR:
      return 3;
    case EquippableTraitType.EQUIPPED_ITEM_1:
      return 4;
    case BaseTraitType.CLOTHING:
      return 5;
    case EquippableTraitType.EQUIPPED_WEARABLE:
      return 5;
    case BaseTraitType.MOUTH:
      return 6;
    case EquippableTraitType.EQUIPPED_ITEM_2:
      return 7;
    default:
      return 5;
  }
};

export const formatLayerNameFromTrait = (
  traitType: BaseTraitType,
  trait: string
): string => {
  const [variant, color] = trait.split(" ");
  return `${traitPositionToIndex(traitType)}_${capitalize(
    variant
  )}_${color.toLowerCase()}`;
};

/*
 * NOTE:
 * base trait names are formatted as <index>_<variant>_<color>
 * equippable trait names are formatted as <tag>_<name>_<uri>
 */
export type CharacterTraits = {
  [key in BaseTraitType | EquippableTraitType]: string;
};

export const getTraitsObjectFromAttributes = (
  attributes: Attribute[]
): CharacterTraits => {
  const characterTraits: CharacterTraits = {
    [BaseTraitType.BACKGROUND]: "",
    [BaseTraitType.BODY]: "",
    [BaseTraitType.EYES]: "",
    [BaseTraitType.HAIR]: "",
    [BaseTraitType.CLOTHING]: "",
    [BaseTraitType.MOUTH]: "",
    [EquippableTraitType.EQUIPPED_ITEM_1]: "",
    [EquippableTraitType.EQUIPPED_WEARABLE]: "",
    [EquippableTraitType.EQUIPPED_ITEM_2]: "",
  };

  attributes.forEach((attribute) => {
    if (!attribute.value) return;
    switch (attribute.trait_type) {
      case BaseTraitType.BACKGROUND:
        characterTraits[BaseTraitType.BACKGROUND] = formatLayerNameFromTrait(
          BaseTraitType.BACKGROUND,
          attribute.value
        );
        break;
      case BaseTraitType.BODY:
        characterTraits[BaseTraitType.BODY] = formatLayerNameFromTrait(
          BaseTraitType.BODY,
          attribute.value
        );
        break;
      case BaseTraitType.EYES:
        characterTraits[BaseTraitType.EYES] = formatLayerNameFromTrait(
          BaseTraitType.EYES,
          attribute.value
        );
        break;
      case BaseTraitType.HAIR:
        characterTraits[BaseTraitType.HAIR] = formatLayerNameFromTrait(
          BaseTraitType.HAIR,
          attribute.value
        );
        break;
      case EquippableTraitType.EQUIPPED_ITEM_1:
        characterTraits[EquippableTraitType.EQUIPPED_ITEM_1] = attribute.value;
        break;
      case BaseTraitType.CLOTHING:
        characterTraits[BaseTraitType.CLOTHING] = formatLayerNameFromTrait(
          BaseTraitType.CLOTHING,
          attribute.value
        );
        break;
      case EquippableTraitType.EQUIPPED_WEARABLE:
        characterTraits[EquippableTraitType.EQUIPPED_WEARABLE] =
          attribute.value;
        break;
      case BaseTraitType.MOUTH:
        characterTraits[BaseTraitType.MOUTH] = formatLayerNameFromTrait(
          BaseTraitType.MOUTH,
          attribute.value
        );
        break;
      case EquippableTraitType.EQUIPPED_ITEM_2:
        characterTraits[EquippableTraitType.EQUIPPED_ITEM_2] = attribute.value;
        break;
      default:
        break;
    }
  });

  return characterTraits;
};

export const formatTraitsForUpload = async (
  traits: CharacterTraits
): Promise<string[]> => {
  const traitsArray: TraitsArray = ["", "", "", "", "", "", "", ""];
  Object.keys(traits).forEach((traitType) => {
    const trait = traits[traitType as keyof CharacterTraits];
    const index = traitPositionToIndex(traitType as keyof CharacterTraits);

    if (
      traitType === BaseTraitType.CLOTHING &&
      !!traits[EquippableTraitType.EQUIPPED_WEARABLE]
    ) {
      return;
    }

    if (!trait) return;
    traitsArray[index] = trait;
  });

  return traitsArray.filter((trait) => trait !== "");
};

export const removeTraitHex = (trait: string): string => {
  const traitSplit = trait.split("_");
  if (traitSplit.length <= 3) return trait;
  return traitSplit[0] + "_" + traitSplit[1] + "_" + traitSplit[2];
};

export const getThumbnailUrl = (fileName: string): string => {
  return uriToHttp(LAYERS_URI)[0] + "/" + fileName + ".png";
};

export const getImageUrl = (fileName: string): string => {
  if (fileName.startsWith("THUMB")) {
    return getThumbnailUrl(fileName);
  }
  const [index] = fileName.split("_");
  if (index.includes("equip")) {
    // We want to take everything after the second underscore, even if it contains more underscores
    const potentialUrl = fileName.split("_").slice(2).join("_");
    return potentialUrl; // In this case, what would normally be "color" is actually the URL of the newly equipped item
  }

  return uriToHttp(LAYERS_URI)[0] + "/" + removeTraitHex(fileName) + ".png";
};
