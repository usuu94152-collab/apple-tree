export const objectTypes = ["figure"] as const;
export type ObjectType = (typeof objectTypes)[number];
export const regionIds = [
  "item",
  "itemTrim",
  "legL",
  "legR",
  "hips",
  "torso",
  "armL",
  "armR",
  "handL",
  "handR",
  "head",
  "hat",
  "hatTrim",
] as const;
export const hatIds = [
  "conductor",
  "helmet",
  "crown",
  "hair",
  "pigtails",
  "party",
  "none",
] as const;
export const faceIds = ["smile", "grin", "wink", "wow"] as const;
export const itemIds = [
  "none",
  "flag",
  "balloon",
  "suitcase",
  "lollipop",
] as const;
export type Region = (typeof regionIds)[number];
export type HatId = (typeof hatIds)[number];
export type FaceId = (typeof faceIds)[number];
export type ItemId = (typeof itemIds)[number];
/** How the friend was dressed: lets the big screen build it in 3D. */
export interface Design {
  fills: Partial<Record<Region, string>>;
  hat: HatId;
  face: FaceId;
  item: ItemId;
}
const has = (list: readonly string[], v: unknown) =>
  typeof v === "string" && list.includes(v);
/** Strict copy of a design received from the network, or undefined if malformed. */
export function cleanDesign(d: unknown): Design | undefined {
  if (!d || typeof d !== "object") return undefined;
  const o = d as Record<string, unknown>;
  if (!has(hatIds, o.hat) || !has(faceIds, o.face) || !has(itemIds, o.item))
    return undefined;
  if (!o.fills || typeof o.fills !== "object") return undefined;
  const fills: Design["fills"] = {};
  for (const [k, v] of Object.entries(o.fills)) {
    if (
      !has(regionIds, k) ||
      typeof v !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(v)
    )
      return undefined;
    fills[k as Region] = v;
  }
  return {
    fills,
    hat: o.hat as HatId,
    face: o.face as FaceId,
    item: o.item as ItemId,
  };
}
export interface Artwork {
  messageId: string;
  roomId: string;
  objectType: ObjectType;
  imageData: string;
  design?: Design;
  timestamp: number;
}
export interface Reply {
  ok: boolean;
  error?: string;
  roomId?: string;
  token?: string;
  artworks?: Artwork[];
  displayed?: boolean;
}
export const MAX_OBJECTS = 30;
export const MAX_IMAGE_BYTES = 400_000;
