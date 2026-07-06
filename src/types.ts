export interface PlayerState {
  id: string;
  username: string;
  gold: number;
  x: number;
  y: number;
  z: number;
  ry: number;
  lastActive: number;
  equippedPet?: string | null;
  equippedMount?: string | null;
  equippedOutfit?: string | null;
}

export interface HouseState {
  id: string; // house_1 to house_10
  ownerId: string | null;
  ownerUsername: string | null;
  x: number;
  z: number;
  color: string;
  isForSale: boolean;
  name: string; // e.g. "House 1" or "Cozy Cottage"
}

export interface ChatMessage {
  id: string;
  senderId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface ShopItem {
  id: string;
  name: string;
  type: "pet" | "mount" | "outfit";
  cost: number;
  description: string;
  color?: string; // used for rendering outfit/pet color
}

