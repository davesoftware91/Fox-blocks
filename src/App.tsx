/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Coins,
  Clock,
  Users,
  Home,
  Tv,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Volume2,
  RefreshCw,
  X,
  Menu
} from "lucide-react";
import { collection, doc, onSnapshot, setDoc, getDoc, query, orderBy, limit } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./lib/firebase";
import { HouseState, PlayerState, ChatMessage } from "./types";
import GameCanvas from "./components/GameCanvas";
import Joystick from "./components/Joystick";
import ChatDrawer from "./components/ChatDrawer";
import { BannerAd, RewardedAdModal } from "./components/AdOverlay";

const HOUSE_COORDS = [
  // Central Avenue (X = 0) Houses
  { x: -12, z: -45, color: "#fca5a5", isForSale: true, name: "Pine Lodge" },
  { x: -12, z: -25, color: "#cbd5e1", isForSale: false, name: "City Hall Annex" },
  { x: -12, z: -5, color: "#fef08a", isForSale: true, name: "Cozy Cottage" },
  { x: -12, z: 15, color: "#94a3b8", isForSale: false, name: "Baker's Bakery" },
  { x: -12, z: 35, color: "#fed7aa", isForSale: true, name: "Sunset Villa" },
  { x: 12, z: -45, color: "#cbd5e1", isForSale: false, name: "Police Depot" },
  { x: 12, z: -25, color: "#a5f3fc", isForSale: true, name: "Maple Cabin" },
  { x: 12, z: -5, color: "#e2e8f0", isForSale: false, name: "Town Library" },
  { x: 12, z: 15, color: "#cbd5e1", isForSale: false, name: "City Post" },
  { x: 12, z: 35, color: "#bfdbfe", isForSale: true, name: "Fox Burrow" },

  // West Highway (X = -40) Houses
  { x: -52, z: -45, color: "#a7f3d0", isForSale: true, name: "Oak Manor" },
  { x: -52, z: -15, color: "#fed7aa", isForSale: true, name: "Redwood Lodge" },
  { x: -52, z: 15, color: "#ddd6fe", isForSale: false, name: "Stone Villa" },
  { x: -52, z: 45, color: "#fca5a5", isForSale: true, name: "Birch Cabin" },
  { x: -28, z: -35, color: "#34d399", isForSale: true, name: "Emerald Crest" },
  { x: -28, z: -5, color: "#38bdf8", isForSale: false, name: "Glacier Loft" },
  { x: -28, z: 25, color: "#f472b6", isForSale: true, name: "Rose Cottage" },

  // East Highway (X = 40) Houses
  { x: 28, z: -35, color: "#475569", isForSale: false, name: "Shadow Hold" },
  { x: 28, z: -5, color: "#fbbf24", isForSale: true, name: "Sunny Bungalow" },
  { x: 28, z: 25, color: "#a7f3d0", isForSale: true, name: "Windswept Den" },
  { x: 52, z: -45, color: "#818cf8", isForSale: true, name: "Spruce Retreat" },
  { x: 52, z: 15, color: "#312e81", isForSale: false, name: "Obsidian Spire" }
];

const SHOP_ITEMS = [
  {
    id: "pet_wolf",
    name: "Wolf Pet",
    category: "pet",
    emoji: "🐺",
    description: "A loyal blocky canine companion to walk by your side."
  },
  {
    id: "pet_creeper",
    name: "Creeper Pet",
    category: "pet",
    emoji: "🟢",
    description: "An explosive looking sidekick (completely tame!)."
  },
  {
    id: "pet_ocelot",
    name: "Ocelot Pet",
    category: "pet",
    emoji: "🐯",
    description: "A fast voxel feline helper to accompany you."
  },
  {
    id: "mount_pig",
    name: "Pig Mount",
    category: "mount",
    emoji: "🐷",
    description: "Ride through the city streets on a pink blocky pig."
  },
  {
    id: "mount_horse",
    name: "Horse Mount",
    category: "mount",
    emoji: "🐴",
    description: "Saddle up on a swift steed for high-speed travel."
  },
  {
    id: "mount_dragon",
    name: "Ender Dragon Mount",
    category: "mount",
    emoji: "🐉",
    description: "A legendary purple-eyed ride of blocky legends."
  },
  {
    id: "outfit_diamond",
    name: "Diamond Armor",
    category: "outfit",
    emoji: "💎",
    description: "Equip premium glowing diamond plated armor."
  },
  {
    id: "outfit_gold",
    name: "Gold Armor",
    category: "outfit",
    emoji: "👑",
    description: "Show off your massive wealth with glistening gold armor."
  },
  {
    id: "outfit_tux",
    name: "Tuxedo Suit",
    category: "outfit",
    emoji: "🤵",
    description: "An incredibly elegant tuxedo outfit for meetings."
  }
];

export default function App() {
  const [username, setUsername] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [isSpawned, setIsSpawned] = useState(true);
  const [gold, setGold] = useState(600); // 600 Gold so they can buy exactly 1 house and have 100 gold left to test!
  const [ownedHouses, setOwnedHouses] = useState<string[]>([]);
  const [lastCollectedTime, setLastCollectedTime] = useState<number>(0);
  const [timeUntilCollect, setTimeUntilCollect] = useState<string>("00:00");
  const [isCollectReady, setIsCollectReady] = useState(false);
  const [latestChats, setLatestChats] = useState<ChatMessage[]>([]);

  // Shop & Customization State variables
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [equippedOutfit, setEquippedOutfit] = useState<string | null>(null);
  const [equippedPet, setEquippedPet] = useState<string | null>(null);
  const [equippedMount, setEquippedMount] = useState<string | null>(null);
  const [purchasedItems, setPurchasedItems] = useState<string[]>([]);

  // Temporary name change input state (inside the menu overlay)
  const [nameInput, setNameInput] = useState("");

  // Houses status
  const [houses, setHouses] = useState<HouseState[]>([]);
  const [promptedBuyHouse, setPromptedBuyHouse] = useState<HouseState | null>(null);

  // Joystick Input State
  const [joystickInput, setJoystickInput] = useState({ x: 0, y: 0 });
  const [jumpTriggered, setJumpTriggered] = useState(false);

  // Drawer & Ad Modal States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [activePlayers, setActivePlayers] = useState<PlayerState[]>([]);

  // Sound effects emulation
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Generate randomized username
  const generateRandomName = () => {
    const prefixes = ["Swift", "Cosmic", "Golden", "Sneaky", "Crafty", "Pixel", "Voxel", "Lucky"];
    const suffixes = ["Fox", "Cub", "Builder", "Miner", "Player", "Den", "Block", "Tail"];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}_${randomNum}`;
  };

  // Load profile from Local Storage or create new
  useEffect(() => {
    const storedUsername = localStorage.getItem("fox_blocks_username");
    const storedPlayerId = localStorage.getItem("fox_blocks_player_id");

    if (storedUsername && storedPlayerId) {
      setUsername(storedUsername);
      setNameInput(storedUsername);
      setPlayerId(storedPlayerId);
    } else {
      const newId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newName = generateRandomName();
      setUsername(newName);
      setNameInput(newName);
      setPlayerId(newId);
    }

    // Load custom equipped items and purchases
    const storedOutfit = localStorage.getItem("fox_blocks_equipped_outfit");
    const storedPet = localStorage.getItem("fox_blocks_equipped_pet");
    const storedMount = localStorage.getItem("fox_blocks_equipped_mount");
    const storedPurchased = localStorage.getItem("fox_blocks_purchased_items");

    if (storedOutfit) setEquippedOutfit(storedOutfit);
    if (storedPet) setEquippedPet(storedPet);
    if (storedMount) setEquippedMount(storedMount);
    if (storedPurchased) {
      try {
        setPurchasedItems(JSON.parse(storedPurchased));
      } catch (e) {
        console.error("Failed to parse purchased items:", e);
      }
    }

    // Load or initialize gold and lastCollectedTime
    const storedGold = localStorage.getItem("fox_blocks_gold");
    if (storedGold) {
      setGold(parseInt(storedGold, 10));
    } else {
      localStorage.setItem("fox_blocks_gold", "600");
    }

    const storedCollected = localStorage.getItem("fox_blocks_last_collected");
    if (storedCollected) {
      setLastCollectedTime(parseInt(storedCollected, 10));
    } else {
      // Set to 1 hour ago so they can immediately test collection on spawn!
      const defaultTime = Date.now() - 3600000;
      setLastCollectedTime(defaultTime);
      localStorage.setItem("fox_blocks_last_collected", defaultTime.toString());
    }
  }, []);

  // Listen to global houses list in Firestore
  useEffect(() => {
    if (!playerId) return;

    const unsubscribe = onSnapshot(collection(db, "houses"), (snapshot) => {
      const houseMap = new Map<string, { ownerId: string; ownerUsername: string }>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        houseMap.set(doc.id, {
          ownerId: data.ownerId || "",
          ownerUsername: data.ownerUsername || ""
        });
      });

      // Build state
      const initialHouses: HouseState[] = HOUSE_COORDS.map((hc, idx) => {
        const hId = `house_${idx + 1}`;
        const syncData = houseMap.get(hId);
        return {
          id: hId,
          ownerId: syncData ? syncData.ownerId : null,
          ownerUsername: syncData ? syncData.ownerUsername : null,
          x: hc.x,
          z: hc.z,
          color: hc.color,
          isForSale: hc.isForSale,
          name: hc.name
        };
      });

      setHouses(initialHouses);

      // Track owned houses for this specific player
      const myOwned = initialHouses
        .filter((h) => h.ownerId === playerId)
        .map((h) => h.id);
      setOwnedHouses(myOwned);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "houses");
    });

    return () => unsubscribe();
  }, [playerId]);

  // Sync player count / active player list
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "players"), (snapshot) => {
      const active: PlayerState[] = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data() as PlayerState;
        // Only count players active in the last 1 minute
        if (now - data.lastActive < 60000) {
          active.push(data);
        }
      });
      setActivePlayers(active);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "players");
    });

    return () => unsubscribe();
  }, []);

  // Listen to the latest chats in real-time to show on-screen (the chat bar page)
  useEffect(() => {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, orderBy("timestamp", "desc"), limit(4));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push(doc.data() as ChatMessage);
      });
      // Reverse so the newest message is at the bottom of our list
      setLatestChats(msgs.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });

    return () => unsubscribe();
  }, []);

  // Save state back to cloud/local storage whenever gold or equipment changes
  useEffect(() => {
    if (!playerId || !isSpawned) return;
    localStorage.setItem("fox_blocks_gold", gold.toString());
    localStorage.setItem("fox_blocks_equipped_outfit", equippedOutfit || "");
    localStorage.setItem("fox_blocks_equipped_pet", equippedPet || "");
    localStorage.setItem("fox_blocks_equipped_mount", equippedMount || "");
    localStorage.setItem("fox_blocks_purchased_items", JSON.stringify(purchasedItems));

    // Sync state to cloud profile
    const syncProfile = async () => {
      try {
        await setDoc(
          doc(db, "players", playerId),
          {
            id: playerId,
            username,
            gold,
            equippedOutfit: equippedOutfit || null,
            equippedPet: equippedPet || null,
            equippedMount: equippedMount || null,
            lastActive: Date.now()
          },
          { merge: true }
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `players/${playerId}`);
      }
    };
    syncProfile();
  }, [gold, playerId, isSpawned, username, equippedOutfit, equippedPet, equippedMount, purchasedItems]);

  // Hourly gold timer countdown logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const difference = now - lastCollectedTime;
      const targetDuration = 3600000; // 1 hour in ms

      if (difference >= targetDuration) {
        setTimeUntilCollect("READY!");
        setIsCollectReady(true);
      } else {
        const remainingMs = targetDuration - difference;
        const totalSec = Math.floor(remainingMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        setTimeUntilCollect(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
        setIsCollectReady(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastCollectedTime]);

  const handleSpawn = () => {
    if (!username.trim()) return;
    localStorage.setItem("fox_blocks_username", username.trim());
    localStorage.setItem("fox_blocks_player_id", playerId);
    setIsSpawned(true);
    showNotification(`Welcome to Fox Blocks, ${username}! Check out houses for sale!`);
  };

  const handleSaveName = async () => {
    const cleanName = nameInput.trim().replace(/[^a-zA-Z0-9_]/g, "");
    if (!cleanName) {
      showNotification("❌ Invalid Username! Only letters, numbers, and underscores.");
      return;
    }
    setUsername(cleanName);
    localStorage.setItem("fox_blocks_username", cleanName);
    showNotification(`✏️ Username successfully updated to ${cleanName}!`);
  };

  const handlePurchaseOrEquip = (item: typeof SHOP_ITEMS[0]) => {
    const isOwned = purchasedItems.includes(item.id);

    if (!isOwned) {
      if (gold < 1000) {
        showNotification("❌ You need 1000 Gold to buy this! Collect gold or watch ads.");
        return;
      }
      // Purchase item
      const newGold = gold - 1000;
      setGold(newGold);
      const newPurchased = [...purchasedItems, item.id];
      setPurchasedItems(newPurchased);
      localStorage.setItem("fox_blocks_purchased_items", JSON.stringify(newPurchased));
      showNotification(`🎉 Purchased ${item.name}! Equipped now.`);

      // Automatically equip it
      if (item.category === "outfit") setEquippedOutfit(item.id);
      if (item.category === "pet") setEquippedPet(item.id);
      if (item.category === "mount") setEquippedMount(item.id);
    } else {
      // Toggle equip/unequip
      if (item.category === "outfit") {
        setEquippedOutfit(equippedOutfit === item.id ? null : item.id);
      } else if (item.category === "pet") {
        setEquippedPet(equippedPet === item.id ? null : item.id);
      } else if (item.category === "mount") {
        setEquippedMount(equippedMount === item.id ? null : item.id);
      }
      showNotification(`Customization update: ${item.name} changed!`);
    }
  };

  const handleBuyHouse = async () => {
    if (!promptedBuyHouse) return;
    if (gold < 500) {
      showNotification("❌ Not enough gold! Watch an ad to earn +100 gold quickly.");
      return;
    }

    const hId = promptedBuyHouse.id;
    try {
      // 1. Save ownership to houses collection
      await setDoc(doc(db, "houses", hId), {
        ownerId: playerId,
        ownerUsername: username
      });

      // 2. Deduct gold and award house
      const newGold = gold - 500;
      setGold(newGold);
      showNotification(`🎉 Purchased ${promptedBuyHouse.name}! Check out the glowing door!`);
      setPromptedBuyHouse(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `houses/${hId}`);
    }
  };

  const handleCollectGold = () => {
    if (!isCollectReady) return;
    if (ownedHouses.length === 0) {
      showNotification("ℹ️ Buy at least 1 house to collect passive gold!");
      return;
    }

    const earned = ownedHouses.length * 20;
    const newGold = gold + earned;
    setGold(newGold);

    const now = Date.now();
    setLastCollectedTime(now);
    localStorage.setItem("fox_blocks_last_collected", now.toString());
    showNotification(`💰 Passively collected +${earned} Gold from your properties!`);
  };

  const handleEarnAdReward = () => {
    const newGold = gold + 100;
    setGold(newGold);
    showNotification("🎁 Rewarded Video completed! +100 Gold added.");
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col justify-between overflow-hidden select-none font-sans text-white">
      {/* Dynamic Sound Notification alert */}
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-orange-500/80 px-4 py-2.5 rounded-full shadow-lg text-xs font-bold text-orange-400 flex items-center gap-2 animate-bounce max-w-[90%] text-center">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* 1. INITIAL ENTRY MENU */}
      {!isSpawned ? (
        <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-amber-950/20 z-50 flex flex-col items-center justify-center p-6 text-center select-text">
          <div className="w-full max-w-sm bg-slate-900/80 border border-slate-700 p-6 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center">
            {/* Voxel Fox Icon Logo */}
            <div className="w-16 h-16 bg-orange-500 border-2 border-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 relative animate-pulse mb-3">
              <div className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full" />
              <span className="text-3xl">🦊</span>
            </div>

            <h1 className="text-2xl font-black font-mono tracking-tight text-white mb-1 uppercase">
              Fox Blocks <span className="text-orange-500 font-extrabold text-xs align-super border border-orange-500/30 px-1 rounded-sm">MVP</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-[280px] mb-6 font-medium leading-relaxed">
              Step into a low-poly 3D Minecraft-style city! Buy properties, passively harvest gold, and explore with active citizens.
            </p>

            <div className="w-full space-y-4 mb-6 text-left">
              <label className="block text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest">
                Citizen Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={18}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="Enter citizen name"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                />
                <button
                  onClick={() => setUsername(generateRandomName())}
                  title="Randomize Name"
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg text-slate-300 hover:text-white transition-colors active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={handleSpawn}
              disabled={!username.trim()}
              className="w-full bg-linear-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 active:scale-98 transition-all"
            >
              <span>Spawn in 3D City</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. CORE GAME HUD (TOP OVERLAYS) */}
          <div className="absolute top-0 inset-x-0 p-4 z-20 flex justify-between items-start pointer-events-none gap-2">
            {/* Left Hand HUD: Gold Tracker & Hourly Collection status */}
            <div className="flex flex-col gap-2 pointer-events-auto">
              <div className="bg-slate-900/80 border border-orange-500/30 px-3 py-2 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-md">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500 flex items-center justify-center animate-spin-slow">
                  <Coins className="w-5 h-5 text-amber-500 fill-amber-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                    Total Gold
                  </span>
                  <span className="text-lg font-black font-mono text-yellow-400 leading-tight">
                    {gold}G
                  </span>
                </div>
              </div>

              {/* Passive gold timer */}
              <div className="bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 backdrop-blur-md">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="text-slate-400 font-semibold">Gold Cycle:</span>
                  <span className={`font-bold ${isCollectReady && ownedHouses.length > 0 ? "text-green-400 animate-pulse" : "text-orange-400"}`}>
                    {timeUntilCollect}
                  </span>
                  <span className="text-[8px] text-slate-500">
                    ({ownedHouses.length * 20}G/hr)
                  </span>
                </div>
              </div>

              {/* HUD Menu button */}
              <button
                onClick={() => {
                  setNameInput(username);
                  setIsMenuOpen(true);
                }}
                className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Menu className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[10px] font-mono font-bold text-slate-300">
                  MENU (CHANGE NAME)
                </span>
              </button>
            </div>
            {/* Middle HUD Floating Menu & Shop Button removed as requested */}

            {/* Right Hand HUD: World directory & active counts */}
            <div className="flex flex-col gap-2 items-end pointer-events-auto max-w-[150px]">
              <div className="bg-slate-900/80 border border-slate-700 px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 backdrop-blur-md">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[10px] font-mono font-bold text-slate-300">
                  {activePlayers.length + 1001} Online
                </span>
              </div>

              {/* Citizen listings */}
              <div className="bg-slate-900/80 border border-slate-700/60 p-2 rounded-lg shadow-sm text-[9px] font-mono space-y-1 w-full max-h-[100px] overflow-y-auto backdrop-blur-xs">
                <div className="text-[8px] uppercase font-bold text-slate-500 pb-1 border-b border-slate-800 flex justify-between items-center">
                  <span>Online Lobby</span>
                  <span className="text-[7px] text-green-400 animate-pulse">● LIVE</span>
                </div>
                <div className="text-orange-400 truncate font-bold">🦊 {username} (You)</div>
                {activePlayers.map((p) => (
                  <div key={p.id} className="text-slate-300 truncate">
                    🦊 {p.username}
                  </div>
                ))}
                {/* Simulated 1000 multiplayers representations */}
                <div className="text-slate-400 truncate">🤖 Steve_842</div>
                <div className="text-slate-400 truncate">🤖 Alex_109</div>
                <div className="text-slate-400 truncate">🤖 VoxelBoy_331</div>
                <div className="text-slate-400 truncate">🤖 SkyRunner_772</div>
                <div className="text-slate-400 truncate">🤖 BlockMaster_505</div>
                <div className="text-slate-400 truncate">🤖 MineLord_182</div>
                <div className="text-slate-500 text-[8px] italic pt-1 border-t border-slate-800 text-center">
                  + 994 more citizens
                </div>
              </div>
            </div>
          </div>

          {/* 3. CORE 3D WORLD STAGE CANVAS */}
          <div className="flex-1 w-full h-full relative z-10">
            <GameCanvas
              playerId={playerId}
              username={username}
              gold={gold}
              setGold={setGold}
              ownedHouses={ownedHouses}
              setOwnedHouses={setOwnedHouses}
              joystickInput={joystickInput}
              jumpTriggered={jumpTriggered}
              onResetJump={() => setJumpTriggered(false)}
              houses={houses}
              setHouses={setHouses}
              onPromptBuyHouse={setPromptedBuyHouse}
              equippedOutfit={equippedOutfit}
              equippedPet={equippedPet}
              equippedMount={equippedMount}
            />

            {/* Realtime Floating MMO Chat Box Overlay (appears at the chat bar Page) */}
            <div className="absolute bottom-36 left-4 right-4 md:left-6 md:right-auto md:w-[340px] max-h-[150px] pointer-events-none z-20 flex flex-col gap-1.5 justify-end overflow-hidden">
              <div className="text-[9px] font-mono font-bold text-slate-400 select-none flex items-center gap-1 opacity-70">
                <MessageSquare className="w-3 h-3 text-orange-400" />
                <span>LIVE CHAT FEED</span>
              </div>
              {latestChats.length === 0 ? (
                <div className="bg-slate-950/40 border border-slate-900/50 px-2.5 py-1.5 rounded-lg text-[9px] font-mono text-slate-500 italic">
                  No messages yet. Send one to start!
                </div>
              ) : (
                latestChats.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className="bg-slate-950/80 border border-slate-800/40 px-3 py-1.5 rounded-lg text-[10px] font-mono text-slate-200 flex items-start gap-1.5 max-w-full shadow-lg backdrop-blur-xs animate-fade-in"
                  >
                    <span className="text-orange-400 font-bold shrink-0">🦊 {msg.username}:</span>
                    <span className="break-all select-text pointer-events-auto">{msg.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Map Property Ownership status bar directory */}
            <div className="absolute top-28 left-4 z-20 bg-slate-900/70 border border-slate-800 rounded-lg p-2 max-w-[170px] max-h-[140px] overflow-y-auto font-mono text-[8px] space-y-1.5">
              <div className="font-bold text-[9px] border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>CITY DIRECTORY</span>
                <span className="bg-orange-500/10 text-orange-400 px-1 rounded-sm">
                  {houses.filter((h) => h.isForSale && !h.ownerId).length} FOR SALE
                </span>
              </div>
              {houses.map((h) => (
                <div key={h.id} className="flex justify-between items-center gap-2">
                  <span className="truncate text-slate-300 max-w-[80px]">{h.name}</span>
                  {h.ownerUsername ? (
                    <span className="text-yellow-400 font-bold max-w-[70px] truncate">
                      👤 {h.ownerUsername}
                    </span>
                  ) : h.isForSale ? (
                    <span className="text-emerald-400 font-bold">SALE 500G</span>
                  ) : (
                    <span className="text-slate-500">PUBLIC</span>
                  )}
                </div>
              ))}
            </div>

            {/* Floating context buy overlay menu */}
            {promptedBuyHouse && (
              <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 border-2 border-emerald-500 p-4 rounded-xl shadow-2xl flex flex-col items-center gap-2 w-72 backdrop-blur-md animate-fade-in text-center">
                <Home className="w-7 h-7 text-emerald-400 animate-bounce" />
                <h3 className="font-mono font-bold text-sm text-white">
                  Buy {promptedBuyHouse.name}?
                </h3>
                <p className="text-[10px] text-slate-400 max-w-[220px]">
                  Only the owner can unlock and walk into this property. Costs <span className="text-yellow-400 font-bold">500 Gold</span>.
                </p>
                <div className="flex gap-2 w-full mt-1.5">
                  <button
                    onClick={() => setPromptedBuyHouse(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 py-1.5 rounded-lg border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBuyHouse}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-xs text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10"
                  >
                    <span>Buy [500G]</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. OVERLAY INTERACTIVE CONTROLS (BOTTOM HUD ROW) */}
          <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 border-t border-slate-800 p-4 z-20 flex flex-col items-center gap-3">
            
            {/* Action Buttons Row */}
            <div className="w-full flex justify-between items-end gap-3 max-w-[420px]">
              
              {/* Virtual Joystick */}
              <Joystick onChange={setJoystickInput} />

              {/* Interactive buttons */}
              <div className="flex-1 flex flex-col gap-2.5 items-end">
                
                {/* Watch Sponsored Ad for gold */}
                <button
                  onClick={() => setIsAdOpen(true)}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-orange-500/40 text-white font-mono font-bold text-[10px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Tv className="w-3.5 h-3.5 text-orange-400" />
                  <span>WATCH AD (+100G)</span>
                </button>

                {/* Main dynamic button row */}
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  
                  {/* Open live global chat */}
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 font-bold text-[9px] py-2 rounded-lg flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all text-orange-400 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>CHAT</span>
                  </button>

                  {/* Jump blocky avatar */}
                  <button
                    onClick={() => setJumpTriggered(true)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setJumpTriggered(true);
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs py-2 rounded-lg flex flex-col items-center justify-center gap-1 shadow-md shadow-orange-500/20 active:scale-95 transition-all font-mono cursor-pointer select-none"
                  >
                    <span>JUMP</span>
                  </button>

                </div>

              </div>

            </div>

            {/* Centered AdMob test banner */}
            <BannerAd />

          </div>
        </>
      )}

      {/* Global Realtime Chat Drawer */}
      {isSpawned && (
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          playerId={playerId}
          username={username}
        />
      )}

      {/* Fullscreen Video Ad Simulator */}
      <RewardedAdModal
        isOpen={isAdOpen}
        onClose={() => setIsAdOpen(false)}
        onEarned={handleEarnAdReward}
      />

      {/* Citizen Menu & Custom Shop Overlay Modal */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col w-screen h-screen overflow-hidden animate-fade-in select-text">
          <div className="w-full h-full flex flex-col bg-slate-900">
            
            {/* Modal Header */}
            <div className="p-4 md:p-6 bg-slate-850 border-b border-slate-800 flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="bg-yellow-500/10 p-1.5 rounded-lg border border-yellow-500/20">
                  <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                </div>
                <div>
                  <h2 className="font-mono font-black text-sm md:text-base uppercase tracking-wider text-white">
                    Citizen Hub & Shop
                  </h2>
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Customization Center</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 p-2 rounded-full border border-slate-700 cursor-pointer transition-all flex items-center justify-center shadow-md hover:scale-105 active:scale-95"
                title="Close Shop"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 select-text text-left">
              
              {/* Profile Details & Name Change */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 shadow-inner">
                <h3 className="text-[10px] font-bold font-mono text-orange-400 uppercase tracking-wider">
                  Citizen Identification Card
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-2.5 items-end">
                  <div className="flex-1 space-y-1 w-full">
                    <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase tracking-widest">
                      Display Username
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                      placeholder="Username"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveName}
                    disabled={nameInput.trim() === username || !nameInput.trim()}
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-xs text-white font-mono font-bold px-4 py-2.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                  >
                    SAVE NAME
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Your floating display name will update in real-time above your voxel head and in other player's lobbies.
                </p>
              </div>

              {/* Voxel Shop section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="text-[11px] font-bold font-mono text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Blocky Customs Shop</span>
                    <span className="text-[8px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1 rounded-sm">1000G EACH</span>
                  </h3>
                  <div className="font-mono text-xs font-black text-yellow-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 fill-yellow-400" />
                    <span>{gold}G</span>
                  </div>
                </div>

                {/* Items category lists */}
                {["pet", "mount", "outfit"].map((cat) => {
                  const catItems = SHOP_ITEMS.filter((item) => item.category === cat);
                  const catTitle = cat === "pet" ? "Loyal Pets" : cat === "mount" ? "Interactive Mounts" : "Gamer Outfits";

                  return (
                    <div key={cat} className="space-y-2.5">
                      <h4 className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest pl-1.5 border-l-2 border-slate-700">
                        {catTitle}
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                        {catItems.map((item) => {
                          const isOwned = purchasedItems.includes(item.id);
                          const isEquipped = 
                            (item.category === "outfit" && equippedOutfit === item.id) ||
                            (item.category === "pet" && equippedPet === item.id) ||
                            (item.category === "mount" && equippedMount === item.id);

                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border flex flex-col justify-between h-34 relative select-none transition-all ${
                                isEquipped
                                  ? "bg-slate-950 border-orange-500 shadow-md shadow-orange-500/10"
                                  : isOwned
                                  ? "bg-slate-950 border-slate-700 hover:border-slate-600"
                                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-800"
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-start gap-1">
                                  <span className="text-xl">{item.emoji}</span>
                                  {isEquipped && (
                                    <span className="text-[7px] font-bold bg-orange-500 text-white font-mono px-1 rounded-sm uppercase tracking-wide">
                                      Active
                                    </span>
                                  )}
                                  {isOwned && !isEquipped && (
                                    <span className="text-[7px] font-bold bg-slate-800 text-slate-400 font-mono px-1 rounded-sm uppercase tracking-wide">
                                      Owned
                                    </span>
                                  )}
                                </div>
                                <h5 className="text-[10px] font-bold text-white truncate mt-1">
                                  {item.name}
                                </h5>
                                <p className="text-[8px] text-slate-500 leading-snug mt-0.5 max-h-[36px] overflow-hidden">
                                  {item.description}
                                </p>
                              </div>

                              <button
                                onClick={() => handlePurchaseOrEquip(item)}
                                className={`w-full text-center py-1.5 text-[9px] font-mono font-bold rounded-lg cursor-pointer transition-colors ${
                                  isEquipped
                                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20"
                                    : isOwned
                                    ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                                    : "bg-slate-850 hover:bg-slate-800 text-yellow-400 border border-yellow-500/30"
                                }`}
                              >
                                {isEquipped ? (
                                  "UNEQUIP"
                                ) : isOwned ? (
                                  "EQUIP"
                                ) : (
                                  `BUY (1000G)`
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
              <p className="text-[9px] text-slate-500 font-mono">
                All customized skins and companions instantly synchronized to multiplayer lobbies.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
