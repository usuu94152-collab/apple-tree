export const objectTypes = ["apple", "fish", "balloon", "star"] as const;
export type ObjectType = (typeof objectTypes)[number];
export interface Artwork {
  messageId: string;
  roomId: string;
  objectType: ObjectType;
  imageData: string;
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
