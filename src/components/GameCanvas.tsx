import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PlayerState, HouseState } from "../types";
import { collection, doc, setDoc, onSnapshot, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";

// Procedural 3D blocky bird model
function createBlockyBird() {
  const birdGroup = new THREE.Group();

  // Color options: bright yellow (canary), cyan (blue jay), red (cardinal), white (seagull), dark slate (crow)
  const birdColors = ["#f59e0b", "#06b6d4", "#ef4444", "#f8fafc", "#475569"];
  const color = birdColors[Math.floor(Math.random() * birdColors.length)];

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const beakMat = new THREE.MeshStandardMaterial({ color: "#fb923c", roughness: 0.4 }); // Orange beak
  const eyeMat = new THREE.MeshBasicMaterial({ color: "#000000" });

  // 1. Body (horizontal cube)
  const bodyGeo = new THREE.BoxGeometry(0.5, 0.4, 0.8);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  birdGroup.add(body);

  // 2. Head (placed at front of body)
  const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 0.2, 0.4);
  head.castShadow = true;
  head.receiveShadow = true;
  birdGroup.add(head);

  // 3. Beak
  const beakGeo = new THREE.BoxGeometry(0.15, 0.1, 0.25);
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, 0.1, 0.62);
  birdGroup.add(beak);

  // 4. Eyes (pixels on sides of head)
  const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.18, 0.22, 0.42);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.18;
  birdGroup.add(leftEye, rightEye);

  // 5. Tail
  const tailGeo = new THREE.BoxGeometry(0.3, 0.05, 0.3);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, -0.05, -0.5);
  birdGroup.add(tail);

  // 6. Flapping Wings (Left & Right with pivots)
  const wingGeo = new THREE.BoxGeometry(0.7, 0.04, 0.4);

  const leftWingPivot = new THREE.Group();
  leftWingPivot.name = "leftWing";
  leftWingPivot.position.set(-0.25, 0.1, 0);
  const leftWingMesh = new THREE.Mesh(wingGeo, bodyMat);
  leftWingMesh.position.x = -0.35; // pivot at shoulder
  leftWingMesh.castShadow = true;
  leftWingPivot.add(leftWingMesh);
  birdGroup.add(leftWingPivot);

  const rightWingPivot = new THREE.Group();
  rightWingPivot.name = "rightWing";
  rightWingPivot.position.set(0.25, 0.1, 0);
  const rightWingMesh = new THREE.Mesh(wingGeo, bodyMat);
  rightWingMesh.position.x = 0.35; // pivot at shoulder
  rightWingMesh.castShadow = true;
  rightWingPivot.add(rightWingMesh);
  birdGroup.add(rightWingPivot);

  return birdGroup;
}

// Procedural 3D forest tree model (leaves stacked tiers)
function createForestTreeMesh(trunkHeight = 4, leavesLevels = 3) {
  const group = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.BoxGeometry(0.8, trunkHeight, 0.8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.9 }); // Dark brown wood
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Leaves levels (stacked green box tiers)
  const leafColorOptions = ["#15803d", "#16a34a", "#047857", "#065f46"];
  const leafColor = leafColorOptions[Math.floor(Math.random() * leafColorOptions.length)];
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 });

  for (let i = 0; i < leavesLevels; i++) {
    const size = 3.5 - i * 0.8;
    const height = 1.4;
    const levelGeo = new THREE.BoxGeometry(size, height, size);
    const levelMesh = new THREE.Mesh(levelGeo, leafMat);
    levelMesh.position.y = trunkHeight + (i * 1.0) + (height / 2);
    levelMesh.castShadow = true;
    levelMesh.receiveShadow = true;
    group.add(levelMesh);
  }

  return group;
}

// Procedural 3D blocky egg model sitting on nest sticks
function createBlockyEggMesh() {
  const eggGroup = new THREE.Group();

  // Main white/cream egg body
  const shellMat = new THREE.MeshStandardMaterial({ color: "#fef08a", roughness: 0.9 });
  const bodyGeo = new THREE.BoxGeometry(0.35, 0.45, 0.35);
  const body = new THREE.Mesh(bodyGeo, shellMat);
  body.castShadow = true;
  body.receiveShadow = true;
  eggGroup.add(body);

  // Colorful spots
  const spotColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b"];
  for (let i = 0; i < 6; i++) {
    const spotGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const spotMat = new THREE.MeshBasicMaterial({ color: spotColors[i % spotColors.length] });
    const spot = new THREE.Mesh(spotGeo, spotMat);
    const angle = Math.random() * Math.PI * 2;
    const h = (Math.random() - 0.5) * 0.35;
    spot.position.set(Math.cos(angle) * 0.18, h, Math.sin(angle) * 0.18);
    eggGroup.add(spot);
  }

  // Little nest underneath
  const nestGroup = new THREE.Group();
  const stickMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.95 });
  const stickGeo = new THREE.BoxGeometry(0.5, 0.06, 0.1);
  for (let j = 0; j < 6; j++) {
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.set(0, -0.22, 0);
    stick.rotation.y = (j / 6) * Math.PI + Math.random() * 0.2;
    stick.position.x = Math.cos(stick.rotation.y) * 0.1;
    stick.position.z = Math.sin(stick.rotation.y) * 0.1;
    nestGroup.add(stick);
  }
  eggGroup.add(nestGroup);

  return eggGroup;
}

interface ParticleSim {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  decay: number;
  colorType: "heart" | "puff" | "shell";
}

function spawnParticleBurst(
  particlesArray: ParticleSim[],
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  type: "heart" | "puff" | "shell",
  count = 8
) {
  const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  let color = "#ef4444"; // heart
  if (type === "puff") color = "#e2e8f0"; // grey puff
  if (type === "shell") color = "#fef08a"; // egg shell

  const mat = new THREE.MeshBasicMaterial({ color });

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.4,
      y + (Math.random() - 0.5) * 0.4,
      z + (Math.random() - 0.5) * 0.4
    );
    scene.add(mesh);

    particlesArray.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        type === "heart" ? 0.02 + Math.random() * 0.04 : (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08
      ),
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      colorType: type
    });
  }
}

// Procedural Minecraft-style character builder supporting custom Outfits, Pets, and Mounts
function buildMinecraftPlayer(
  group: THREE.Group,
  outfit: string | null,
  pet: string | null,
  mount: string | null
) {
  // Clear group first
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  // Define colors based on outfit
  let headColor = "#fbcfe8"; // Peach/Steve skin tone
  let torsoColor = "#06b6d4"; // Cyan shirt
  let legColor = "#2563eb"; // Blue pants
  let armColor = "#fbcfe8"; // Peach skin tone
  let armSleeveColor = "#06b6d4"; // Cyan sleeve

  let hasHelmet = false;
  let helmetColor = "#22d3ee";
  let hasChestplate = false;
  let chestplateColor = "#22d3ee";
  let hasBoots = false;
  let bootsColor = "#22d3ee";

  if (outfit === "outfit_diamond") {
    hasHelmet = true;
    helmetColor = "#22d3ee";
    hasChestplate = true;
    chestplateColor = "#22d3ee";
    hasBoots = true;
    bootsColor = "#22d3ee";
  } else if (outfit === "outfit_gold") {
    hasHelmet = true;
    helmetColor = "#fbbf24";
    hasChestplate = true;
    chestplateColor = "#fbbf24";
    hasBoots = true;
    bootsColor = "#fbbf24";
  } else if (outfit === "outfit_tux") {
    torsoColor = "#0f172a"; // black tuxedo
    legColor = "#0f172a"; // black pants
    armSleeveColor = "#0f172a"; // black sleeve
    armColor = "#fbcfe8";
  }

  const matHead = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.8 });
  const matTorso = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.8 });
  const matLeg = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.8 });
  const matArm = new THREE.MeshStandardMaterial({ color: armColor, roughness: 0.8 });
  const matSleeve = new THREE.MeshStandardMaterial({ color: armSleeveColor, roughness: 0.8 });
  const matBlack = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });
  const matWhite = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });
  const matBrown = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.8 });

  const hasMount = !!mount;
  const mountOffsetY = hasMount ? 0.8 : 0;

  // Render Mount under the player if equipped
  let mountLegs: THREE.Mesh[] = [];
  if (mount) {
    const mountGroup = new THREE.Group();
    mountGroup.name = "mount";

    let mColor = "#f472b6"; // Pink Pig
    if (mount === "mount_horse") mColor = "#b45309"; // Brown Horse
    if (mount === "mount_dragon") mColor = "#1e1b4b"; // Dark Purple/Black Dragon

    const matMount = new THREE.MeshStandardMaterial({ color: mColor, roughness: 0.8 });
    const matMountAccent = new THREE.MeshStandardMaterial({ color: mount === "mount_pig" ? "#f43f5e" : "#0f172a", roughness: 0.8 });

    // Mount body box
    const bodyLength = mount === "mount_dragon" ? 1.8 : 1.4;
    const bodyWidth = mount === "mount_dragon" ? 1.0 : 0.8;
    const bodyHeight = mount === "mount_dragon" ? 0.7 : 0.8;
    const mBodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
    const mBody = new THREE.Mesh(mBodyGeo, matMount);
    mBody.position.y = 0.6;
    mBody.castShadow = true;
    mBody.receiveShadow = true;
    mountGroup.add(mBody);

    // Mount head
    const mHeadGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mHead = new THREE.Mesh(mHeadGeo, matMount);
    if (mount === "mount_pig") {
      mHead.position.set(0, 0.9, 0.7);
      // snout
      const snoutGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1);
      const snout = new THREE.Mesh(snoutGeo, matMountAccent);
      snout.position.set(0, -0.1, 0.3);
      mHead.add(snout);
    } else if (mount === "mount_horse") {
      mHead.position.set(0, 1.3, 0.7);
      // neck
      const neckGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);
      const neck = new THREE.Mesh(neckGeo, matMount);
      neck.position.set(0, -0.4, -0.1);
      mHead.add(neck);
    } else if (mount === "mount_dragon") {
      mHead.position.set(0, 1.1, 0.9);
      // neck
      const neckGeo = new THREE.BoxGeometry(0.4, 0.6, 0.4);
      const neck = new THREE.Mesh(neckGeo, matMount);
      neck.position.set(0, -0.35, -0.2);
      mHead.add(neck);
      // purple eyes
      const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const matEye = new THREE.MeshBasicMaterial({ color: "#d946ef" });
      const eyeL = new THREE.Mesh(eyeGeo, matEye);
      eyeL.position.set(-0.26, 0.05, 0.15);
      const eyeR = new THREE.Mesh(eyeGeo, matEye);
      eyeR.position.set(0.26, 0.05, 0.15);
      mHead.add(eyeL, eyeR);
      // black wings
      const wingGeo = new THREE.BoxGeometry(1.2, 0.1, 0.6);
      const matWing = new THREE.MeshStandardMaterial({ color: "#a855f7", roughness: 0.8 });
      const wingL = new THREE.Mesh(wingGeo, matWing);
      wingL.position.set(-0.9, 0.2, 0);
      wingL.rotation.z = -0.3;
      const wingR = new THREE.Mesh(wingGeo, matWing);
      wingR.position.set(0.9, 0.2, 0);
      wingR.rotation.z = 0.3;
      mountGroup.add(wingL);
      mountGroup.add(wingR);
    }
    mHead.castShadow = true;
    mountGroup.add(mHead);

    // Mount legs
    const mLegGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
    const legFL = new THREE.Mesh(mLegGeo, matMount);
    legFL.position.set(-0.3, 0.25, 0.4);
    const legFR = new THREE.Mesh(mLegGeo, matMount);
    legFR.position.set(0.3, 0.25, 0.4);
    const legBL = new THREE.Mesh(mLegGeo, matMount);
    legBL.position.set(-0.3, 0.25, -0.4);
    const legBR = new THREE.Mesh(mLegGeo, matMount);
    legBR.position.set(0.3, 0.25, -0.4);

    legFL.castShadow = true;
    legFR.castShadow = true;
    legBL.castShadow = true;
    legBR.castShadow = true;

    mountGroup.add(legFL);
    mountGroup.add(legFR);
    mountGroup.add(legBL);
    mountGroup.add(legBR);

    mountLegs.push(legFL, legFR, legBL, legBR);
    group.add(mountGroup);
  }

  // 1. Humanoid Torso (Y-center depends on mount)
  const torsoGeo = new THREE.BoxGeometry(0.8, 1.5, 0.4);
  const torso = new THREE.Mesh(torsoGeo, matTorso);
  torso.position.y = mountOffsetY + 1.85;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torso.name = "torso";
  group.add(torso);

  if (hasChestplate) {
    const cpGeo = new THREE.BoxGeometry(0.88, 1.55, 0.48);
    const matCp = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.5 });
    const cp = new THREE.Mesh(cpGeo, matCp);
    cp.position.y = mountOffsetY + 1.85;
    group.add(cp);
  }

  // 2. Humanoid Head
  const headGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const head = new THREE.Mesh(headGeo, matHead);
  head.position.set(0, mountOffsetY + 2.95, 0);
  head.castShadow = true;
  head.name = "head";

  // Steve hair/cap texture blocks
  const hairGeo = new THREE.BoxGeometry(0.72, 0.2, 0.72);
  const hair = new THREE.Mesh(hairGeo, matBrown);
  hair.position.y = 0.3;
  head.add(hair);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.05);
  const eyeL = new THREE.Mesh(eyeGeo, matBlack);
  eyeL.position.set(-0.18, 0.02, 0.36);
  const eyeR = new THREE.Mesh(eyeGeo, matBlack);
  eyeR.position.set(0.18, 0.02, 0.36);
  head.add(eyeL);
  head.add(eyeR);

  // Nose/Mouth skin tone
  const mouthGeo = new THREE.BoxGeometry(0.2, 0.05, 0.05);
  const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshStandardMaterial({ color: "#ea580c" }));
  mouth.position.set(0, -0.15, 0.36);
  head.add(mouth);

  if (hasHelmet) {
    const helmGeo = new THREE.BoxGeometry(0.78, 0.78, 0.78);
    const matHelm = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.5 });
    const helm = new THREE.Mesh(helmGeo, matHelm);
    helm.position.set(0, mountOffsetY + 2.98, 0.02);
    helm.castShadow = true;
    group.add(helm);
  } else {
    group.add(head);
  }

  // 3. Humanoid Arms (Left & Right)
  const armGeo = new THREE.BoxGeometry(0.25, 1.3, 0.25);
  const sleeveGeo = new THREE.BoxGeometry(0.27, 0.5, 0.27);

  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = "leftArm";
  leftArmGroup.position.set(-0.525, mountOffsetY + 2.35, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, matArm);
  leftArmMesh.position.y = -0.55;
  leftArmMesh.castShadow = true;
  leftArmGroup.add(leftArmMesh);
  const leftSleeveMesh = new THREE.Mesh(sleeveGeo, matSleeve);
  leftSleeveMesh.position.y = -0.2;
  leftArmGroup.add(leftSleeveMesh);
  group.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.name = "rightArm";
  rightArmGroup.position.set(0.525, mountOffsetY + 2.35, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, matArm);
  rightArmMesh.position.y = -0.55;
  rightArmMesh.castShadow = true;
  rightArmGroup.add(rightArmMesh);
  const rightSleeveMesh = new THREE.Mesh(sleeveGeo, matSleeve);
  rightSleeveMesh.position.y = -0.2;
  rightArmGroup.add(rightSleeveMesh);
  group.add(rightArmGroup);

  // 4. Humanoid Legs (Left & Right)
  const legGeo = new THREE.BoxGeometry(0.26, 1.2, 0.26);

  const leftLeg = new THREE.Mesh(legGeo, matLeg);
  leftLeg.name = "leftLeg";
  leftLeg.castShadow = true;
  if (hasMount) {
    leftLeg.position.set(-0.22, mountOffsetY + 0.6, 0.25);
    leftLeg.rotation.x = -Math.PI / 3;
  } else {
    leftLeg.position.set(-0.22, 0.6, 0);
    leftLeg.rotation.x = 0;
  }
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, matLeg);
  rightLeg.name = "rightLeg";
  rightLeg.castShadow = true;
  if (hasMount) {
    rightLeg.position.set(0.22, mountOffsetY + 0.6, 0.25);
    rightLeg.rotation.x = -Math.PI / 3;
  } else {
    rightLeg.position.set(0.22, 0.6, 0);
    rightLeg.rotation.x = 0;
  }
  group.add(rightLeg);

  // 5. Render Pet if equipped
  if (pet) {
    const petGroup = new THREE.Group();
    petGroup.name = "pet";
    petGroup.position.set(-1.1, 0.1, -0.6);

    let pColor = "#cbd5e1"; // Wolf gray
    if (pet === "pet_creeper") pColor = "#22c55e"; // Green Creeper
    if (pet === "pet_ocelot") pColor = "#f59e0b"; // Yellow Ocelot

    const matPet = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.8 });
    const matPetDark = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });

    if (pet === "pet_wolf") {
      const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), matPet);
      pBody.position.y = 0.2;
      pBody.castShadow = true;
      petGroup.add(pBody);
      const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), matPet);
      pHead.position.set(0, 0.35, 0.2);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.15), matWhite);
      snout.position.set(0, -0.05, 0.12);
      pHead.add(snout);
      petGroup.add(pHead);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.25), matPet);
      tail.position.set(0, 0.25, -0.3);
      tail.rotation.x = -0.4;
      petGroup.add(tail);
    } else if (pet === "pet_creeper") {
      const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.14), matPet);
      pBody.position.y = 0.32;
      pBody.castShadow = true;
      petGroup.add(pBody);
      const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), matPet);
      pHead.position.set(0, 0.6, 0);
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), matPetDark);
      eyeL.position.set(-0.06, 0.03, 0.13);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), matPetDark);
      eyeR.position.set(0.06, 0.03, 0.13);
      pHead.add(eyeL, eyeR);
      petGroup.add(pHead);
    } else if (pet === "pet_ocelot") {
      const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.45), matPet);
      pBody.position.y = 0.15;
      pBody.castShadow = true;
      petGroup.add(pBody);
      const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matPet);
      pHead.position.set(0, 0.26, 0.18);
      petGroup.add(pHead);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), matPet);
      tail.position.set(0, 0.2, -0.28);
      tail.rotation.x = -0.5;
      petGroup.add(tail);
    }

    const ftGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
    const f1 = new THREE.Mesh(ftGeo, matPet); f1.position.set(-0.08, 0.075, 0.12);
    const f2 = new THREE.Mesh(ftGeo, matPet); f2.position.set(0.08, 0.075, 0.12);
    const f3 = new THREE.Mesh(ftGeo, matPet); f3.position.set(-0.08, 0.075, -0.12);
    const f4 = new THREE.Mesh(ftGeo, matPet); f4.position.set(0.08, 0.075, -0.12);
    petGroup.add(f1, f2, f3, f4);

    group.add(petGroup);
  }

  // Store configuration so we can check if it changed later
  group.userData = { outfit, pet, mount, mountLegs };
}

export interface BotState {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  speed: number;
  targetX: number;
  targetZ: number;
  equippedOutfit: string | null;
  equippedPet: string | null;
  equippedMount: string | null;
  walkCycle: number;
  isJumping: boolean;
  velocityY: number;
}

interface GameCanvasProps {
  playerId: string;
  username: string;
  gold: number;
  setGold: React.Dispatch<React.SetStateAction<number>>;
  ownedHouses: string[];
  setOwnedHouses: React.Dispatch<React.SetStateAction<string[]>>;
  joystickInput: { x: number; y: number };
  jumpTriggered: boolean;
  onResetJump: () => void;
  houses: HouseState[];
  setHouses: React.Dispatch<React.SetStateAction<HouseState[]>>;
  onPromptBuyHouse: (house: HouseState | null) => void;
  equippedPet: string | null;
  equippedMount: string | null;
  equippedOutfit: string | null;
}

export default function GameCanvas({
  playerId,
  username,
  gold,
  setGold,
  ownedHouses,
  setOwnedHouses,
  joystickInput,
  jumpTriggered,
  onResetJump,
  houses,
  setHouses,
  onPromptBuyHouse,
  equippedPet,
  equippedMount,
  equippedOutfit
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep references to values for standard animation loop use (avoiding stale state capture)
  const stateRef = useRef({
    playerId,
    username,
    gold,
    ownedHouses,
    joystickInput,
    jumpTriggered,
    houses,
    equippedPet,
    equippedMount,
    equippedOutfit
  });

  useEffect(() => {
    stateRef.current = {
      playerId,
      username,
      gold,
      ownedHouses,
      joystickInput,
      jumpTriggered,
      houses,
      equippedPet,
      equippedMount,
      equippedOutfit
    };
  }, [
    playerId,
    username,
    gold,
    ownedHouses,
    joystickInput,
    jumpTriggered,
    houses,
    equippedPet,
    equippedMount,
    equippedOutfit
  ]);

  // Track multiplayer players
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerState[]>([]);
  const otherPlayersGroupRef = useRef<THREE.Group | null>(null);
  const otherPlayerMeshes = useRef<Map<string, THREE.Group>>(new Map());

  // --- Forest Aviary Simulator States & Refs ---
  const [birdStats, setBirdStats] = useState({
    total: 15,
    adults: 15,
    babies: 0,
    maxLimit: 100
  });
  const [activeEggs, setActiveEggs] = useState<{ id: string; treeIndex: number; timeLeft: number }[]>([]);
  const [speedUpMode, setSpeedUpMode] = useState(false);

  const speedUpModeRef = useRef(false);
  const birdStatsCallback = useRef<((stats: any) => void) | null>(null);
  const activeEggsCallback = useRef<((eggs: any) => void) | null>(null);

  useEffect(() => {
    speedUpModeRef.current = speedUpMode;
  }, [speedUpMode]);

  useEffect(() => {
    birdStatsCallback.current = setBirdStats;
    activeEggsCallback.current = setActiveEggs;
  }, []);

  // Track 1000 simulated players (Bots)
  const botsRef = useRef<BotState[]>([]);
  const botMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const botsGroupRef = useRef<THREE.Group | null>(null);

  // Firestore sync for player movement
  useEffect(() => {
    const playersRef = collection(db, "players");
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      const playersList: PlayerState[] = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data() as PlayerState;
        // Ignore self and ignore players inactive for more than 1 minute
        if (data.id !== playerId && now - data.lastActive < 60000) {
          playersList.push(data);
        }
      });
      setOnlinePlayers(playersList);
    });

    return () => unsubscribe();
  }, [playerId]);

  // Main Three.js setups
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bae6fd"); // Sky blue (low-poly vibe)
    scene.fog = new THREE.FogExp2("#bae6fd", 0.015);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 10, 15);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight("#ffffff", 0.7); // Brightened ambient light for "always day" city feeling
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#fffbeb", 1.2); // Intense sunshine
    dirLight.position.set(30, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Beautiful blocky Minecraft-style sun high in the sky to reinforce "always day" voxel theme
    const sunGroup = new THREE.Group();
    const sunGeo = new THREE.BoxGeometry(6, 6, 6);
    const sunMat = new THREE.MeshBasicMaterial({ color: "#fef08a" });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(40, 60, -50);
    sunGroup.add(sunMesh);

    // Glowing sun aura (larger semi-transparent yellow box)
    const auraGeo = new THREE.BoxGeometry(9, 9, 9);
    const auraMat = new THREE.MeshBasicMaterial({ color: "#fef08a", transparent: true, opacity: 0.2 });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.position.set(40, 60, -50);
    sunGroup.add(auraMesh);

    scene.add(sunGroup);

    // 5. Ground Plane (Grass block patterns)
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#4ade80", // bright voxel green
      roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add visual voxel grid overlay
    const gridHelper = new THREE.GridHelper(300, 150, "#22c55e", "#15803d");
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 6. Roads (City Grid Layout)
    const roadMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.9 }); // Dark slate roads
    const stripeMat = new THREE.MeshBasicMaterial({ color: "#fbbf24" }); // Amber yellow dashed lane markings

    // Vertical Roads (Central, West, East Highways)
    const vRoadXs = [-40, 0, 40];
    vRoadXs.forEach((x) => {
      const roadGeo = new THREE.BoxGeometry(10, 0.1, 300);
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.set(x, 0.05, 0);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      // Dash stripes along the vertical roads
      for (let z = -150; z <= 150; z += 15) {
        // Skip intersections (around -50, 0, 50) to keep them clean
        if (Math.abs(z) > 10 && Math.abs(z - 50) > 10 && Math.abs(z + 50) > 10) {
          const stripeGeo = new THREE.BoxGeometry(0.3, 0.12, 4);
          const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
          stripeMesh.position.set(x, 0.06, z);
          scene.add(stripeMesh);
        }
      }
    });

    // Horizontal Roads (North, Center, South Streets)
    const hRoadZs = [-50, 0, 50];
    hRoadZs.forEach((z) => {
      const roadGeo = new THREE.BoxGeometry(300, 0.1, 10);
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.set(0, 0.05, z);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      // Dash stripes along the horizontal roads
      for (let x = -150; x <= 150; x += 15) {
        // Skip intersections (around -40, 0, 40) to keep them clean
        if (Math.abs(x) > 10 && Math.abs(x - 40) > 10 && Math.abs(x + 40) > 10) {
          const stripeGeo = new THREE.BoxGeometry(4, 0.12, 0.3);
          const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
          stripeMesh.position.set(x, 0.06, z);
          scene.add(stripeMesh);
        }
      }
    });

    // 6.5 Street Lamps at Intersections
    const lampPostMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
    const lampBulbMat = new THREE.MeshStandardMaterial({
      color: "#fef08a",
      emissive: "#fbbf24",
      emissiveIntensity: 1.5,
      roughness: 0.1
    });

    const createStreetLamp = (lx: number, lz: number, direction: number) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(lx, 0, lz);

      // black metal post
      const postGeo = new THREE.BoxGeometry(0.3, 6, 0.3);
      const post = new THREE.Mesh(postGeo, lampPostMat);
      post.position.y = 3;
      post.castShadow = true;
      lampGroup.add(post);

      // arm sticking out (rotates to face road)
      const armGeo = new THREE.BoxGeometry(1.5, 0.2, 0.3);
      const arm = new THREE.Mesh(armGeo, lampPostMat);
      arm.position.set(0.6, 5.9, 0);
      lampGroup.add(arm);

      // glowing bulb box
      const bulbGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
      const bulb = new THREE.Mesh(bulbGeo, lampBulbMat);
      bulb.position.set(1.2, 5.7, 0);
      lampGroup.add(bulb);

      // Warm downward lighting
      const pointLight = new THREE.PointLight("#fef08a", 1.2, 12, 1.5);
      pointLight.position.set(1.2, 5.5, 0);
      pointLight.castShadow = false; // Disable local shadows to prevent exceeding WebGL texture unit limits (max 16)
      lampGroup.add(pointLight);

      lampGroup.rotation.y = direction;
      scene.add(lampGroup);
    };

    // Place street lamps at the corners of intersections
    const intersections = [
      { x: -40, z: -50 }, { x: -40, z: 0 }, { x: -40, z: 50 },
      { x: 0, z: -50 }, { x: 0, z: 0 }, { x: 0, z: 50 },
      { x: 40, z: -50 }, { x: 40, z: 0 }, { x: 40, z: 50 }
    ];

    intersections.forEach((inter) => {
      // Place lamps slightly offset on the side, facing inward
      createStreetLamp(inter.x - 5.5, inter.z - 5.5, 0); // facing east
      createStreetLamp(inter.x + 5.5, inter.z + 5.5, Math.PI); // facing west
    });

    // 7. Buildings Bounding Boxes & Renderings
    const buildings: {
      mesh: THREE.Group;
      boundingBox: THREE.Box3;
      id: string;
      isHouse: boolean;
      houseIndex?: number;
    }[] = [];

    // Helper to generate a low-poly house
    const createHouseMesh = (colorHex: string, hasSign: boolean, name: string) => {
      const group = new THREE.Group();

      // House Base (Cube)
      const wallGeo = new THREE.BoxGeometry(6, 4, 6);
      const wallMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
      const walls = new THREE.Mesh(wallGeo, wallMat);
      walls.position.y = 2;
      walls.castShadow = true;
      walls.receiveShadow = true;
      group.add(walls);

      // Pitched Roof (Stairs effect using boxes)
      const roofColor = "#7f1d1d"; // Dark brick red
      for (let i = 0; i < 4; i++) {
        const w = 7.5 - i * 1.5;
        const h = 0.6;
        const d = 7.5;
        const roofLayerGeo = new THREE.BoxGeometry(w, h, d);
        const roofLayerMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.5 });
        const roofLayer = new THREE.Mesh(roofLayerGeo, roofLayerMat);
        roofLayer.position.y = 4 + i * h + h / 2;
        roofLayer.castShadow = true;
        group.add(roofLayer);
      }

      // Door (Wooden block)
      const doorGeo = new THREE.BoxGeometry(1.6, 2.6, 0.3);
      const doorMat = new THREE.MeshStandardMaterial({ color: "#78350f" });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 1.3, 3.01);
      door.name = "door";
      group.add(door);

      // Chimney
      const chimneyGeo = new THREE.BoxGeometry(1, 2, 1);
      const chimneyMat = new THREE.MeshStandardMaterial({ color: "#374151" });
      const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
      chimney.position.set(2, 4.5, -1.5);
      chimney.castShadow = true;
      group.add(chimney);

      // Windows
      const winGeo = new THREE.BoxGeometry(1.2, 1.2, 0.2);
      const winMat = new THREE.MeshStandardMaterial({ color: "#bae6fd", emissive: "#bae6fd", emissiveIntensity: 0.3 });
      const win1 = new THREE.Mesh(winGeo, winMat);
      win1.position.set(-1.8, 2.2, 3.01);
      const win2 = new THREE.Mesh(winGeo, winMat);
      win2.position.set(1.8, 2.2, 3.01);
      group.add(win1);
      group.add(win2);

      // Signboard if "For Sale"
      if (hasSign) {
        const signGroup = new THREE.Group();
        signGroup.position.set(0, 0, 4.5);

        // wooden post
        const postGeo = new THREE.BoxGeometry(0.2, 2.2, 0.2);
        const postMat = new THREE.MeshStandardMaterial({ color: "#b45309" });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.y = 1.1;
        post.castShadow = true;
        signGroup.add(post);

        // board
        const boardGeo = new THREE.BoxGeometry(2.0, 1.0, 0.2);
        const boardMat = new THREE.MeshStandardMaterial({ color: "#fef08a", roughness: 0.9 });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.y = 1.8;
        board.castShadow = true;
        signGroup.add(board);

        // board mini text/stripe lines
        const lineGeo = new THREE.BoxGeometry(1.6, 0.1, 0.22);
        const lineMat = new THREE.MeshBasicMaterial({ color: "#b45309" });
        const l1 = new THREE.Mesh(lineGeo, lineMat);
        l1.position.set(0, 1.9, 0.01);
        const l2 = new THREE.Mesh(lineGeo, lineMat);
        l2.position.set(0, 1.7, 0.01);
        signGroup.add(l1);
        signGroup.add(l2);

        group.add(signGroup);
      }

      return group;
    };

    // Helper to generate a low-poly church
    const createChurchMesh = () => {
      const group = new THREE.Group();

      // Main Hall
      const hallGeo = new THREE.BoxGeometry(10, 8, 16);
      const hallMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.8 });
      const hall = new THREE.Mesh(hallGeo, hallMat);
      hall.position.y = 4;
      hall.castShadow = true;
      hall.receiveShadow = true;
      group.add(hall);

      // Roof
      const roofGeo = new THREE.BoxGeometry(11, 3, 17);
      const roofMat = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.5 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 9.5;
      roof.castShadow = true;
      group.add(roof);

      // Steeple Tower
      const steepleGeo = new THREE.BoxGeometry(4, 16, 4);
      const steepleMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1" });
      const steeple = new THREE.Mesh(steepleGeo, steepleMat);
      steeple.position.set(0, 8, 6);
      steeple.castShadow = true;
      group.add(steeple);

      // Pyramid Roof for Steeple
      const pyramidGeo = new THREE.ConeGeometry(3.5, 6, 4);
      const pyramidMat = new THREE.MeshStandardMaterial({ color: "#1e293b" });
      const pyramid = new THREE.Mesh(pyramidGeo, pyramidMat);
      pyramid.position.set(0, 19, 6);
      pyramid.rotation.y = Math.PI / 4;
      pyramid.castShadow = true;
      group.add(pyramid);

      // Golden Cross on Top
      const crossGroup = new THREE.Group();
      crossGroup.position.set(0, 22.5, 6);

      const crossVGeo = new THREE.BoxGeometry(0.4, 2.5, 0.4);
      const crossHGeo = new THREE.BoxGeometry(1.6, 0.4, 0.4);
      const goldMat = new THREE.MeshStandardMaterial({ color: "#f59e0b", metalness: 0.8, roughness: 0.2 });

      const crossV = new THREE.Mesh(crossVGeo, goldMat);
      const crossH = new THREE.Mesh(crossHGeo, goldMat);
      crossH.position.y = 0.5;

      crossGroup.add(crossV);
      crossGroup.add(crossH);
      group.add(crossGroup);

      // Main Double Doors
      const doorGeo = new THREE.BoxGeometry(3, 4, 0.3);
      const doorMat = new THREE.MeshStandardMaterial({ color: "#451a03" });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 2, 8.01);
      group.add(door);

      return group;
    };

    // Helper to generate a low-poly school
    const createSchoolMesh = () => {
      const group = new THREE.Group();

      // Main Block
      const mainGeo = new THREE.BoxGeometry(18, 10, 10);
      const mainMat = new THREE.MeshStandardMaterial({ color: "#991b1b", roughness: 0.7 }); // Brick red
      const mainBlock = new THREE.Mesh(mainGeo, mainMat);
      mainBlock.position.y = 5;
      mainBlock.castShadow = true;
      mainBlock.receiveShadow = true;
      group.add(mainBlock);

      // Pillars / Portico
      const porticoGeo = new THREE.BoxGeometry(6, 11, 3);
      const porticoMat = new THREE.MeshStandardMaterial({ color: "#f8fafc" });
      const portico = new THREE.Mesh(porticoGeo, porticoMat);
      portico.position.set(0, 5.5, 5.5);
      portico.castShadow = true;
      group.add(portico);

      // Clock at front
      const clockGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 8);
      const clockMat = new THREE.MeshStandardMaterial({ color: "#f8fafc" });
      const clock = new THREE.Mesh(clockGeo, clockMat);
      clock.position.set(0, 9, 7.1);
      clock.rotation.x = Math.PI / 2;
      group.add(clock);

      // Clock hands
      const handGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
      const handMat = new THREE.MeshBasicMaterial({ color: "#000000" });
      const hand = new THREE.Mesh(handGeo, handMat);
      hand.position.set(0, 9, 7.3);
      group.add(hand);

      // School letters or sign shape
      const signGeo = new THREE.BoxGeometry(4, 0.8, 0.2);
      const signMat = new THREE.MeshStandardMaterial({ color: "#1e293b" });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 7, 7.1);
      group.add(sign);

      return group;
    };

    // Create all houses in the city grid
    houses.forEach((h, idx) => {
      const houseMesh = createHouseMesh(h.color, h.isForSale, h.name);
      houseMesh.position.set(h.x, 0, h.z);
      // Face towards the nearest vertical road in the grid
      const closestRoadX = Math.round(h.x / 40) * 40;
      if (h.x < closestRoadX) {
        houseMesh.rotation.y = Math.PI / 2; // Face east
      } else {
        houseMesh.rotation.y = -Math.PI / 2; // Face west
      }

      scene.add(houseMesh);

      // Create Axis-Aligned Bounding Box for collision detection
      const bbox = new THREE.Box3(
        new THREE.Vector3(h.x - 3.5, 0, h.z - 3.5),
        new THREE.Vector3(h.x + 3.5, 8, h.z + 3.5)
      );

      buildings.push({
        mesh: houseMesh,
        boundingBox: bbox,
        id: h.id,
        isHouse: true,
        houseIndex: idx
      });
    });

    // Create Church (Public)
    const churchMesh = createChurchMesh();
    churchMesh.position.set(0, 0, -75);
    scene.add(churchMesh);
    buildings.push({
      mesh: churchMesh,
      boundingBox: new THREE.Box3(
        new THREE.Vector3(-6, 0, -85),
        new THREE.Vector3(6, 25, -65)
      ),
      id: "church",
      isHouse: false
    });

    // Create School (Public)
    const schoolMesh = createSchoolMesh();
    schoolMesh.position.set(0, 0, 75);
    schoolMesh.rotation.y = Math.PI; // Face the road
    scene.add(schoolMesh);
    buildings.push({
      mesh: schoolMesh,
      boundingBox: new THREE.Box3(
        new THREE.Vector3(-10, 0, 65),
        new THREE.Vector3(10, 15, 85)
      ),
      id: "school",
      isHouse: false
    });

    // --- Create Forest on the East Side of the City ---
    const forestTrees: {
      id: string;
      x: number;
      z: number;
      topY: number;
      mesh: THREE.Group;
      hasEgg: boolean;
    }[] = [];

    const treePositions = [
      { x: 85, z: -110 }, { x: 105, z: -125 }, { x: 125, z: -115 },
      { x: 95, z: -90 }, { x: 115, z: -85 }, { x: 135, z: -100 },
      { x: 80, z: -60 }, { x: 100, z: -50 }, { x: 120, z: -65 }, { x: 140, z: -45 },
      { x: 85, z: -20 }, { x: 110, z: -15 }, { x: 130, z: -30 }, { x: 145, z: -10 },
      { x: 90, z: 15 }, { x: 115, z: 25 }, { x: 135, z: 10 },
      { x: 80, z: 40 }, { x: 105, z: 55 }, { x: 125, z: 45 }, { x: 140, z: 60 },
      { x: 95, z: 85 }, { x: 115, z: 75 }, { x: 135, z: 90 },
      { x: 85, z: 115 }, { x: 105, z: 110 }, { x: 125, z: 125 }, { x: 145, z: 120 }
    ];

    treePositions.forEach((pos, idx) => {
      const trunkH = 3.5 + Math.random() * 2.5;
      const levels = 3 + Math.floor(Math.random() * 2);
      const treeMesh = createForestTreeMesh(trunkH, levels);
      treeMesh.position.set(pos.x, 0, pos.z);
      scene.add(treeMesh);

      // Top Y is trunk height + levels * spacing + half level height
      const topY = trunkH + (levels - 1) * 1.0 + 1.4;

      const bbox = new THREE.Box3(
        new THREE.Vector3(pos.x - 1.2, 0, pos.z - 1.2),
        new THREE.Vector3(pos.x + 1.2, trunkH + 2, pos.z + 1.2)
      );

      buildings.push({
        mesh: treeMesh,
        boundingBox: bbox,
        id: `forest_tree_${idx}`,
        isHouse: false
      });

      forestTrees.push({
        id: `forest_tree_${idx}`,
        x: pos.x,
        z: pos.z,
        topY,
        mesh: treeMesh,
        hasEgg: false
      });
    });

    // --- Create Flying Birds in the Sky with Life Cycle States ---
    interface BirdSimState {
      id: string;
      mesh: THREE.Group;
      leftWing: THREE.Group | null;
      rightWing: THREE.Group | null;
      speed: number;
      circleRadius: number;
      centerX: number;
      centerZ: number;
      height: number;
      angle: number;
      flapSpeed: number;
      flapPhase: number;
      heightOffsetSpeed: number;
      heightOffsetPhase: number;
      
      // Custom Life Cycle State
      isBaby: boolean;
      ageProgress: number; // 0 to 1
      matingCooldown: number; // in seconds
      state: "flying" | "seeking_partner" | "mating" | "flying_to_nest" | "nesting" | "dead";
      gender: "M" | "F";
      partnerId: string | null;
      targetTreeId: string | null;
      stateTimer: number; // in seconds
      deathYRotationSpeed: number;
    }

    const birds: BirdSimState[] = [];
    const numInitialBirds = 15;

    for (let i = 0; i < numInitialBirds; i++) {
      const birdMesh = createBlockyBird();
      scene.add(birdMesh);

      const angle = (i / numInitialBirds) * Math.PI * 2 + Math.random() * 0.5;
      const circleRadius = 45 + Math.random() * 55; // broad sweeping paths
      const height = 18 + Math.random() * 16; // fly at various heights (Y: 18 to 34)
      const flapSpeed = 0.14 + Math.random() * 0.12;
      const speed = 0.003 + Math.random() * 0.004; // gentle circling speed

      const leftWing = birdMesh.getObjectByName("leftWing") as THREE.Group;
      const rightWing = birdMesh.getObjectByName("rightWing") as THREE.Group;

      birds.push({
        id: `bird_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mesh: birdMesh,
        leftWing,
        rightWing,
        speed,
        circleRadius,
        centerX: (Math.random() - 0.5) * 30,
        centerZ: (Math.random() - 0.5) * 30,
        height,
        angle,
        flapSpeed,
        flapPhase: Math.random() * Math.PI * 2,
        heightOffsetSpeed: 0.015 + Math.random() * 0.02,
        heightOffsetPhase: Math.random() * Math.PI * 2,
        
        isBaby: false,
        ageProgress: 1.0,
        matingCooldown: 5 + Math.random() * 25, // staggered cooldowns
        state: "flying",
        gender: i % 2 === 0 ? "M" : "F",
        partnerId: null,
        targetTreeId: null,
        stateTimer: 0,
        deathYRotationSpeed: 0
      });
    }

    const eggs: {
      id: string;
      mesh: THREE.Group;
      treeId: string;
      treeIndex: number;
      x: number;
      y: number;
      z: number;
      createdAt: number;
      hatchTime: number;
    }[] = [];

    const activeParticles: ParticleSim[] = [];
    let lastSecondTime = Date.now();

    // Setup global sandbox action triggers
    const handleForceMating = () => {
      const potentialMates = birds.filter((b) => !b.isBaby && b.state === "flying" && b.matingCooldown <= 10);
      if (potentialMates.length >= 2) {
        let male = potentialMates.find((b) => b.gender === "M");
        let female = potentialMates.find((b) => b.gender === "F" && b.id !== male?.id);
        if (!male || !female) {
          male = potentialMates[0];
          female = potentialMates[1];
        }
        if (male && female) {
          male.state = "seeking_partner";
          male.partnerId = female.id;
          male.matingCooldown = 0;

          female.state = "seeking_partner";
          female.partnerId = male.id;
          female.matingCooldown = 0;
        }
      }
    };

    const handleForceHatch = () => {
      eggs.forEach((egg) => {
        egg.hatchTime = 0;
      });
    };

    window.addEventListener("trigger-force-mating", handleForceMating);
    window.addEventListener("trigger-force-hatch", handleForceHatch);

    // 8. Player Character (Procedurally voxel-modeled Minecraft player!)
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    // Initial position in center of small city
    const playerPos = { x: 0, y: 0, z: 0 };
    let playerVelocityY = 0;
    let isJumping = false;
    let playerRotY = Math.PI / 2; // Face sideways initially

    // Build Initial Minecraft Player
    buildMinecraftPlayer(
      playerGroup,
      stateRef.current.equippedOutfit,
      stateRef.current.equippedPet,
      stateRef.current.equippedMount
    );

    // 9. Swipe / Camera Rotation Controller on right side of screen
    let cameraTheta = Math.PI / 8; // Start at a diagonal offset
    let isIntroPanning = true;
    const targetSidewaysTheta = Math.PI / 2; // Smoothly rotate to sideways
    let cameraPhi = Math.PI / 3; // Vertical angle
    let cameraDistance = 14;

    let isSwiping = false;
    let prevTouchX = 0;
    let prevTouchY = 0;

    const onRightPanelTouchStart = (clientX: number, clientY: number) => {
      isIntroPanning = false; // Stop auto-pan on manual input
      // Swipe works anywhere, but we prefer checking if it's the right 60% of the screen
      if (clientX > window.innerWidth * 0.35) {
        isSwiping = true;
        prevTouchX = clientX;
        prevTouchY = clientY;
      }
    };

    const onRightPanelTouchMove = (clientX: number, clientY: number) => {
      if (!isSwiping) return;
      const dx = clientX - prevTouchX;
      const dy = clientY - prevTouchY;

      cameraTheta -= dx * 0.007;
      cameraPhi = Math.max(0.1, Math.min(Math.PI / 2.1, cameraPhi + dy * 0.007));

      prevTouchX = clientX;
      prevTouchY = clientY;
    };

    const onRightPanelTouchEnd = () => {
      isSwiping = false;
    };

    // Bind camera swipe listeners
    const handleMouseDown = (e: MouseEvent) => {
      onRightPanelTouchStart(e.clientX, e.clientY);
    };
    const handleMouseMove = (e: MouseEvent) => {
      onRightPanelTouchMove(e.clientX, e.clientY);
    };
    const handleMouseUp = () => {
      onRightPanelTouchEnd();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onRightPanelTouchStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onRightPanelTouchMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      onRightPanelTouchEnd();
    };

    // Keyboard listener for desktop WASD and spacebar
    const keysPressed: { [key: string]: boolean } = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed[k] = true;
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        stateRef.current.jumpTriggered = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed[k] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    // 10. Multi-Player Group Container
    const otherPlayersGroup = new THREE.Group();
    scene.add(otherPlayersGroup);
    otherPlayersGroupRef.current = otherPlayersGroup;

    // Initialize 1000 simulated players (Bots)
    if (botsRef.current.length === 0) {
      const outfits = [null, "outfit_diamond", "outfit_gold", "outfit_tux"];
      const pets = [null, "pet_fox", "pet_creeper", "pet_ocelot"];
      const mounts = [null, "mount_pig", "mount_horse", "mount_dragon"];
      const botNames = [
        "Steve", "Alex", "Blocky", "Fox", "Pixel", "Crafty", "Gamer", "Miner", "Builder", "Citizen",
        "Hero", "Shadow", "Raptor", "Ninja", "Dino", "Wanderer", "Chief", "Ghost", "Rogue", "Spike",
        "Blaze", "Frost", "Nova", "Cosmo", "Echo", "Turbo", "Spark", "Onyx", "Rusty", "Rocky",
        "Ziggy", "VoxelBoy", "MineLord", "BlockMaster", "GoldDigger", "SkyRunner", "CityWanderer",
        "DiamondGuy", "CreeperFan", "PigRider", "HorseRacer", "DragonFlyer"
      ];
      
      const temp: BotState[] = [];
      for (let i = 1; i <= 1000; i++) {
        const name = `${botNames[Math.floor(Math.random() * botNames.length)]}_${Math.floor(Math.random() * 900 + 100)}`;
        const x = (Math.random() - 0.5) * 280; // keep within city boundaries
        const z = (Math.random() - 0.5) * 280;
        temp.push({
          id: `bot_${i}`,
          username: name,
          x,
          y: 0,
          z,
          ry: Math.random() * Math.PI * 2,
          speed: 0.04 + Math.random() * 0.08,
          targetX: (Math.random() - 0.5) * 280,
          targetZ: (Math.random() - 0.5) * 280,
          equippedOutfit: outfits[Math.floor(Math.random() * outfits.length)],
          equippedPet: pets[Math.floor(Math.random() * pets.length)],
          equippedMount: mounts[Math.floor(Math.random() * mounts.length)],
          walkCycle: Math.random() * Math.PI * 2,
          isJumping: false,
          velocityY: 0
        });
      }
      botsRef.current = temp;
    }

    const botsGroup = new THREE.Group();
    scene.add(botsGroup);
    botsGroupRef.current = botsGroup;

    // Firebase update throttler
    let lastFirebaseUpdateTime = 0;
    const updateFirebasePosition = async (x: number, y: number, z: number, ry: number) => {
      const now = Date.now();
      if (now - lastFirebaseUpdateTime < 150) return; // limit to once per 150ms
      lastFirebaseUpdateTime = now;

      try {
        const pRef = doc(db, "players", stateRef.current.playerId);
        await setDoc(
          pRef,
          {
            id: stateRef.current.playerId,
            username: stateRef.current.username,
            gold: stateRef.current.gold,
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            z: Number(z.toFixed(2)),
            ry: Number(ry.toFixed(2)),
            equippedOutfit: stateRef.current.equippedOutfit || null,
            equippedPet: stateRef.current.equippedPet || null,
            equippedMount: stateRef.current.equippedMount || null,
            lastActive: now
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `players/${stateRef.current.playerId}`);
      }
    };

    // 11. Core Animation Loop
    let animationFrameId: number;
    let localJumpTriggered = false;
    let walkCycleTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rebuild local player if equipped items changed
      const currentOutfit = stateRef.current.equippedOutfit;
      const currentPet = stateRef.current.equippedPet;
      const currentMount = stateRef.current.equippedMount;
      if (
        playerGroup.userData.outfit !== currentOutfit ||
        playerGroup.userData.pet !== currentPet ||
        playerGroup.userData.mount !== currentMount
      ) {
        buildMinecraftPlayer(playerGroup, currentOutfit, currentPet, currentMount);
      }

      const currentInput = stateRef.current.joystickInput;

      // Merge Keyboard controls into input
      let inputX = currentInput.x;
      let inputY = currentInput.y;

      let keyX = 0;
      let keyY = 0;
      if (keysPressed["w"] || keysPressed["arrowup"]) keyY += 1.0;
      if (keysPressed["s"] || keysPressed["arrowdown"]) keyY -= 1.0;
      if (keysPressed["a"] || keysPressed["arrowleft"]) keyX -= 1.0;
      if (keysPressed["d"] || keysPressed["arrowright"]) keyX += 1.0;

      // Normalize diagonal keyboard speed
      const keyLength = Math.sqrt(keyX * keyX + keyY * keyY);
      if (keyLength > 0) {
        inputX = keyX / keyLength;
        inputY = keyY / keyLength;
      }

      const isMoving = Math.abs(inputX) > 0.1 || Math.abs(inputY) > 0.1;

      // Calculate forward direction relative to current camera angle
      const forwardAngle = cameraTheta + Math.PI / 2; // offset for forward orientation

      // Movement Vector
      let moveDirX = 0;
      let moveDirZ = 0;

      const hasMount = !!currentMount;
      const leftLegMesh = playerGroup.getObjectByName("leftLeg");
      const rightLegMesh = playerGroup.getObjectByName("rightLeg");
      const leftArmMesh = playerGroup.getObjectByName("leftArm");
      const rightArmMesh = playerGroup.getObjectByName("rightArm");
      const petMesh = playerGroup.getObjectByName("pet");

      if (isMoving) {
        // Translate joystick/keyboard relative to camera angle
        const sin = Math.sin(forwardAngle);
        const cos = Math.cos(forwardAngle);

        // Multiply baseline speed by 5x (0.15 * 5 = 0.75)
        const speedMultiplier = 0.75;

        // Input Y is forward/backward
        moveDirX += cos * inputY * speedMultiplier;
        moveDirZ -= sin * inputY * speedMultiplier;

        // Input X is strafe left/right
        moveDirX += sin * inputX * speedMultiplier;
        moveDirZ += cos * inputX * speedMultiplier;

        // Face in movement direction
        playerRotY = Math.atan2(moveDirX, moveDirZ);

        // Animate legs swinging faster at 5x running speed
        walkCycleTime += 0.2 * 2.5;
        const swing = Math.sin(walkCycleTime) * 0.4;

        if (!hasMount) {
          if (leftLegMesh) leftLegMesh.rotation.x = swing;
          if (rightLegMesh) rightLegMesh.rotation.x = -swing;
        } else {
          if (leftLegMesh) {
            leftLegMesh.rotation.x = -Math.PI / 3;
            leftLegMesh.position.y = 1.4; // 0.8 + 0.6
          }
          if (rightLegMesh) {
            rightLegMesh.rotation.x = -Math.PI / 3;
            rightLegMesh.position.y = 1.4; // 0.8 + 0.6
          }
        }
        if (leftArmMesh) leftArmMesh.rotation.x = swing;
        if (rightArmMesh) rightArmMesh.rotation.x = -swing;

        if (hasMount && playerGroup.userData.mountLegs) {
          playerGroup.userData.mountLegs.forEach((leg: THREE.Mesh, i: number) => {
            leg.rotation.x = Math.sin(walkCycleTime + (i % 2 === 0 ? 0 : Math.PI)) * 0.4;
          });
        }
        if (petMesh) {
          petMesh.position.y = 0.1 + Math.abs(Math.sin(walkCycleTime * 1.5)) * 0.15;
        }
      } else {
        // Reset legs/arms
        if (!hasMount) {
          if (leftLegMesh) leftLegMesh.rotation.x = 0;
          if (rightLegMesh) rightLegMesh.rotation.x = 0;
        } else {
          if (leftLegMesh) {
            leftLegMesh.rotation.x = -Math.PI / 3;
            leftLegMesh.position.y = 1.4;
          }
          if (rightLegMesh) {
            rightLegMesh.rotation.x = -Math.PI / 3;
            rightLegMesh.position.y = 1.4;
          }
        }
        if (leftArmMesh) leftArmMesh.rotation.x = 0;
        if (rightArmMesh) rightArmMesh.rotation.x = 0;

        if (hasMount && playerGroup.userData.mountLegs) {
          playerGroup.userData.mountLegs.forEach((leg: THREE.Mesh) => {
            leg.rotation.x = 0;
          });
        }
        if (petMesh) {
          petMesh.position.y = 0.1;
        }
      }

      // Physics/Jump
      if (stateRef.current.jumpTriggered && !isJumping) {
        playerVelocityY = 0.22;
        isJumping = true;
        onResetJump(); // tell parent to clear trigger
      }

      // Apply Gravity
      playerVelocityY -= 0.012;
      playerPos.y += playerVelocityY;

      // Ground limit
      if (playerPos.y <= 0) {
        playerPos.y = 0;
        playerVelocityY = 0;
        isJumping = false;
      }

      // Proposed next coordinates
      const nextX = playerPos.x + moveDirX;
      const nextZ = playerPos.z + moveDirZ;

      // Bounding check for player against buildings
      let collides = false;
      const playerBBox = new THREE.Box3(
        new THREE.Vector3(nextX - 0.7, playerPos.y, nextZ - 0.7),
        new THREE.Vector3(nextX + 0.7, playerPos.y + 2.0, nextZ + 0.7)
      );

      // Houses collisions & triggers
      let nearBuyableHouse: HouseState | null = null;

      buildings.forEach((b) => {
        if (b.boundingBox.intersectsBox(playerBBox)) {
          // Check if it's an owned house and whether we are the owner
          if (b.isHouse && b.houseIndex !== undefined) {
            const houseState = stateRef.current.houses[b.houseIndex];
            const isOwner = houseState.ownerId === stateRef.current.playerId;
            // If we are not the owner, we cannot pass through the doors!
            if (!isOwner) {
              collides = true;
            } else {
              // Owner can walk in! To allow walk in, we don't trigger solid collision
              // unless we collide with the actual sides, but for simple MVP, owner bypasses solid box!
              // Let's animate door swinging open if owner is near!
              const doorMesh = b.mesh.getObjectByName("door");
              if (doorMesh) {
                // Animate rotation
                doorMesh.rotation.y = THREE.MathUtils.lerp(doorMesh.rotation.y, Math.PI / 2.2, 0.1);
              }
            }
          } else {
            collides = true; // Church and school are solid
          }
        } else {
          // If not intersecting, close the door if it was open
          if (b.isHouse) {
            const doorMesh = b.mesh.getObjectByName("door");
            if (doorMesh) {
              doorMesh.rotation.y = THREE.MathUtils.lerp(doorMesh.rotation.y, 0, 0.1);
            }
          }
        }

        // Distance check for "For Sale" signs (interaction range: 5 units)
        if (b.isHouse && b.houseIndex !== undefined) {
          const houseState = stateRef.current.houses[b.houseIndex];
          if (houseState.isForSale && !houseState.ownerId) {
            const dist = Math.sqrt(Math.pow(playerPos.x - hCoords[b.houseIndex].x, 2) + Math.pow(playerPos.z - hCoords[b.houseIndex].z, 2));
            if (dist < 5.0) {
              nearBuyableHouse = houseState;
            }
          }
        }
      });

      // Update parent prompt
      onPromptBuyHouse(nearBuyableHouse);

      if (!collides) {
        playerPos.x = nextX;
        playerPos.z = nextZ;
      }

      // Constrain player to stay inside reasonable boundaries
      playerPos.x = Math.max(-100, Math.min(100, playerPos.x));
      playerPos.z = Math.max(-100, Math.min(100, playerPos.z));

      // Update Player Group position/rotation
      playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
      playerGroup.rotation.y = playerRotY;

      // Handle entrance smooth sideways camera turn transition
      if (isIntroPanning) {
        const diff = targetSidewaysTheta - cameraTheta;
        if (Math.abs(diff) > 0.002) {
          cameraTheta += diff * 0.025; // Smooth camera pan
        } else {
          cameraTheta = targetSidewaysTheta;
          isIntroPanning = false;
        }
      }

      // Update Camera to follow player (orbital)
      const targetCamX = playerPos.x + cameraDistance * Math.sin(cameraTheta) * Math.cos(cameraPhi);
      const targetCamY = playerPos.y + cameraDistance * Math.sin(cameraPhi) + 1.5;
      const targetCamZ = playerPos.z + cameraDistance * Math.cos(cameraTheta) * Math.cos(cameraPhi);

      camera.position.set(targetCamX, targetCamY, targetCamZ);
      camera.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);

      // Trigger Firebase Sync on move
      if (isMoving || isJumping) {
        updateFirebasePosition(playerPos.x, playerPos.y, playerPos.z, playerRotY);
      }

      // --- Update 1000 Bots (Simulated Multiplayers) ---
      const bGroup = botsGroupRef.current;
      if (bGroup) {
        const renderCutoffDist = 85; // Distance within which bots are visible in 3D (fog range)
        const bots = botsRef.current;
        const bMeshes = botMeshes.current;

        // Bot messages pool
        const BOT_MESSAGES = [
          "Wow, the 3D City feels so huge with 1000 citizens around!",
          "Is Cozy Cottage still for sale? I might buy it soon!",
          "Just earned gold by wandering the streets!",
          "My dragon mount is super fast on the East Highway!",
          "Who is jumping near the central avenue?",
          "Anyone want to meet up at the Town Library?",
          "This real-time city chat is super cool!",
          "Diamond boots are worth every gold coin!",
          "I love checking out the Obsidian Spire!",
          "Did you know you can watch an ad to get 500 gold?",
          "Let's race down the West Highway!",
          "I'm saving up for the legendary tux outfit!",
          "My pet fox is following me everywhere!",
          "Are there 1000 citizens roaming around here? It's beautiful!",
          "I'm climbing the police depot roof right now!",
          "Let's make a giant pixel art in the city!",
          "The city directory is full of awesome properties!",
          "Shadow Hold looks mysterious, is it owned?",
          "Beautiful day to be a citizen in Fox Blocks!",
          "Is anyone else saving up gold? I'm at 1000G!",
          "Fox Blocks is the best 3D block game ever!",
          "I'm riding my horse down the North Street intersection!",
          "Let's hang out on the Central Avenue grass plot!"
        ];

        // We can stagger our bot chat timers randomly
        // Let's allow a bot to chat globally once in a while
        // To make it fully interactive, we do a random selection
        const now = Date.now();
        if (Math.random() < 0.0006) { // small random chance to send a message
          const randomBot = bots[Math.floor(Math.random() * bots.length)];
          const randomMsg = BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)];
          // Send to Firebase to sync across everyone in real-time!
          addDoc(collection(db, "chats"), {
            id: `bot_msg_${now}_${Math.floor(Math.random() * 1000)}`,
            senderId: randomBot.id,
            username: randomBot.username,
            text: randomMsg,
            timestamp: now
          }).catch((err) => {
            console.error("Bot chat failed", err);
          });
        }

        bots.forEach((bot) => {
          // 1. Math simulation (update coordinates)
          const dx = bot.targetX - bot.x;
          const dz = bot.targetZ - bot.z;
          const distToTarget = Math.sqrt(dx * dx + dz * dz);

          if (distToTarget < 3 || Math.random() < 0.002) {
            bot.targetX = (Math.random() - 0.5) * 280;
            bot.targetZ = (Math.random() - 0.5) * 280;
          } else {
            const moveX = (dx / distToTarget) * bot.speed;
            const moveZ = (dz / distToTarget) * bot.speed;
            bot.x += moveX;
            bot.z += moveZ;
            bot.ry = Math.atan2(moveX, moveZ);
            bot.walkCycle += 0.15;
          }

          // Random Jumping
          if (bot.isJumping) {
            bot.velocityY -= 0.012;
            bot.y += bot.velocityY;
            if (bot.y <= 0) {
              bot.y = 0;
              bot.velocityY = 0;
              bot.isJumping = false;
            }
          } else if (Math.random() < 0.003) {
            bot.isJumping = true;
            bot.velocityY = 0.15 + Math.random() * 0.1;
          }

          // 2. 3D Distance Culling
          const distToPlayer = Math.sqrt(
            Math.pow(bot.x - playerPos.x, 2) + Math.pow(bot.z - playerPos.z, 2)
          );

          const hasMesh = bMeshes.has(bot.id);

          if (distToPlayer <= renderCutoffDist) {
            // Should render
            let botMesh = bMeshes.get(bot.id);
            if (!botMesh) {
              botMesh = new THREE.Group();
              bGroup.add(botMesh);
              bMeshes.set(bot.id, botMesh);
              // Build the standard character model
              buildMinecraftPlayer(botMesh, bot.equippedOutfit, bot.equippedPet, bot.equippedMount);
            }

            // Update position, rotation
            botMesh.position.set(bot.x, bot.y, bot.z);
            botMesh.rotation.y = bot.ry;

            // Animate walking
            const swing = Math.sin(bot.walkCycle) * 0.4;
            const leftLeg = botMesh.getObjectByName("leftLeg");
            const rightLeg = botMesh.getObjectByName("rightLeg");
            const leftArm = botMesh.getObjectByName("leftArm");
            const rightArm = botMesh.getObjectByName("rightArm");
            const pet = botMesh.getObjectByName("pet");
            const hasMount = !!bot.equippedMount;

            if (!hasMount) {
              if (leftLeg) leftLeg.rotation.x = swing;
              if (rightLeg) rightLeg.rotation.x = -swing;
            } else {
              if (leftLeg) {
                leftLeg.rotation.x = -Math.PI / 3;
                leftLeg.position.y = 1.4;
              }
              if (rightLeg) {
                rightLeg.rotation.x = -Math.PI / 3;
                rightLeg.position.y = 1.4;
              }
            }
            if (leftArm) leftArm.rotation.x = swing;
            if (rightArm) rightArm.rotation.x = -swing;
            if (pet) {
              pet.position.y = 0.1 + Math.abs(Math.sin(bot.walkCycle * 1.5)) * 0.15;
            }
          } else {
            // Should not render (cull outside visibility range)
            if (hasMesh) {
              const mesh = bMeshes.get(bot.id);
              if (mesh) {
                bGroup.remove(mesh);
              }
              bMeshes.delete(bot.id);
            }
          }
        });
      }

      // --- Update Flying Birds, Eggs, Particles and Life Cycle State Machine ---
      const nowTime = Date.now();

      // Run 1-second interval checks for state timers & matchmaking
      if (nowTime - lastSecondTime >= 1000) {
        lastSecondTime = nowTime;

        // Decrement mating cooldowns and states
        birds.forEach((bird) => {
          if (bird.matingCooldown > 0) {
            bird.matingCooldown -= speedUpModeRef.current ? 6 : 1;
            if (bird.matingCooldown < 0) bird.matingCooldown = 0;
          }
          if (bird.stateTimer > 0) {
            bird.stateTimer -= speedUpModeRef.current ? 6 : 1;
            if (bird.stateTimer < 0) bird.stateTimer = 0;
          }
        });

        // Trigger active eggs React state update
        if (activeEggsCallback.current) {
          const eggsList = eggs.map((egg) => {
            const timeLeft = Math.max(0, Math.ceil((egg.hatchTime - nowTime) / 1000));
            return {
              id: egg.id,
              treeIndex: egg.treeIndex,
              timeLeft
            };
          });
          activeEggsCallback.current(eggsList);
        }

        // Trigger bird population stats React state update
        if (birdStatsCallback.current) {
          const living = birds.filter((b) => b.state !== "dead");
          const total = living.length;
          const babies = living.filter((b) => b.isBaby).length;
          const adults = total - babies;
          birdStatsCallback.current({
            total,
            adults,
            babies,
            maxLimit: 100
          });
        }

        // Sky Matchmaking: Find pairs to mate!
        // Don't start matchmaking if population already at or near max limit (100)
        if (birds.length < 100) {
          const readyMates = birds.filter(
            (b) => !b.isBaby && b.state === "flying" && b.matingCooldown === 0
          );

          // Find opposite gender pairs
          for (let i = 0; i < readyMates.length; i++) {
            const birdA = readyMates[i];
            if (birdA.state !== "flying" || birdA.partnerId) continue;

            const birdB = readyMates.find(
              (b) =>
                b.id !== birdA.id &&
                b.state === "flying" &&
                b.matingCooldown === 0 &&
                !b.partnerId &&
                b.gender !== birdA.gender
            );

            if (birdB) {
              // Lock them together!
              birdA.state = "seeking_partner";
              birdA.partnerId = birdB.id;
              birdB.state = "seeking_partner";
              birdB.partnerId = birdA.id;
            }
          }
        }
      }

      // --- Update Eggs & Hatching ---
      const survivingEggs = eggs.filter((egg) => {
        // Accelerate egg hatching if speedUpMode is active
        const limitTime = egg.createdAt + 10000; // 10s hatch
        if (speedUpModeRef.current && egg.hatchTime > limitTime) {
          egg.hatchTime = limitTime;
        }

        if (nowTime >= egg.hatchTime) {
          // Egg hatches!
          scene.remove(egg.mesh);
          spawnParticleBurst(activeParticles, scene, egg.x, egg.y, egg.z, "shell", 12);

          // Create cute baby bird mesh
          const chickMesh = createBlockyBird();
          chickMesh.scale.set(0.35, 0.35, 0.35); // tiny chick
          chickMesh.position.set(egg.x, egg.y, egg.z);
          scene.add(chickMesh);

          const leftWing = chickMesh.getObjectByName("leftWing") as THREE.Group;
          const rightWing = chickMesh.getObjectByName("rightWing") as THREE.Group;

          birds.push({
            id: `bird_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            mesh: chickMesh,
            leftWing,
            rightWing,
            speed: 0.003 + Math.random() * 0.004,
            circleRadius: 40 + Math.random() * 40,
            centerX: (Math.random() - 0.5) * 30,
            centerZ: (Math.random() - 0.5) * 30,
            height: 18 + Math.random() * 14,
            angle: Math.random() * Math.PI * 2,
            flapSpeed: 0.16 + Math.random() * 0.12,
            flapPhase: Math.random() * Math.PI * 2,
            heightOffsetSpeed: 0.02 + Math.random() * 0.02,
            heightOffsetPhase: Math.random() * Math.PI * 2,
            
            isBaby: true,
            ageProgress: 0.0,
            matingCooldown: 99999, // baby can't mate
            state: "nesting",
            gender: Math.random() < 0.5 ? "M" : "F",
            partnerId: null,
            targetTreeId: egg.treeId,
            stateTimer: 4, // sit on nest for 4 seconds
            deathYRotationSpeed: 0
          });

          // Enforce rule: "when I new chick hatches then one aldult bird dies and disappears"
          // Select an adult flying bird to die
          const adultToDie = birds.find((b) => !b.isBaby && b.state === "flying");
          if (adultToDie) {
            adultToDie.state = "dead";
            adultToDie.deathYRotationSpeed = 0.08 + Math.random() * 0.12;
          }

          // Un-reserve tree
          const tree = forestTrees[egg.treeIndex];
          if (tree) {
            tree.hasEgg = false;
          }

          return false; // remove from eggs array
        }
        return true;
      });

      if (survivingEggs.length !== eggs.length) {
        eggs.length = 0;
        eggs.push(...survivingEggs);
      }

      // --- Update Individual Birds (State Machine & Flight Vectors) ---
      birds.forEach((bird) => {
        // Flap wings animation
        bird.flapPhase += bird.flapSpeed * (bird.isBaby ? 1.5 : 1.0);
        const wingFlap = Math.sin(bird.flapPhase) * 0.55;
        if (bird.leftWing) bird.leftWing.rotation.z = wingFlap;
        if (bird.rightWing) bird.rightWing.rotation.z = -wingFlap;

        // Growth Simulation for chicks
        if (bird.isBaby && bird.state !== "dead") {
          const growRate = speedUpModeRef.current ? (1 / 10) : (1 / 120); // 10s vs 120s to grow fully
          bird.ageProgress += growRate / 60; // 60fps estimation
          if (bird.ageProgress >= 1.0) {
            bird.ageProgress = 1.0;
            bird.isBaby = false; // matured into adult!
            bird.matingCooldown = speedUpModeRef.current ? 5 : 45;
          }
          const s = 0.35 + bird.ageProgress * 0.65;
          bird.mesh.scale.set(s, s, s);
        }

        // STATE: DEAD SPIRAL
        if (bird.state === "dead") {
          bird.mesh.position.y -= 0.16;
          bird.mesh.rotation.y += bird.deathYRotationSpeed;
          bird.mesh.rotation.x += 0.08;

          if (bird.mesh.position.y <= 0.2) {
            // Explode when hitting ground
            spawnParticleBurst(activeParticles, scene, bird.mesh.position.x, 0.4, bird.mesh.position.z, "puff", 10);
            scene.remove(bird.mesh);
          }
        }

        // STATE: FLYING (Standard Circular Trajectory)
        else if (bird.state === "flying") {
          bird.angle += bird.speed;
          if (bird.angle > Math.PI * 2) bird.angle -= Math.PI * 2;

          const bx = bird.centerX + bird.circleRadius * Math.cos(bird.angle);
          const bz = bird.centerZ + bird.circleRadius * Math.sin(bird.angle);

          bird.heightOffsetPhase += bird.heightOffsetSpeed;
          const by = bird.height + Math.sin(bird.heightOffsetPhase) * 1.5;

          bird.mesh.position.set(bx, by, bz);

          // Face vector
          const nextAngle = bird.angle + 0.01;
          const nextX = bird.centerX + bird.circleRadius * Math.cos(nextAngle);
          const nextZ = bird.centerZ + bird.circleRadius * Math.sin(nextAngle);
          bird.mesh.rotation.y = Math.atan2(nextX - bx, nextZ - bz);
          bird.mesh.rotation.x = Math.cos(bird.heightOffsetPhase) * 0.06;
        }

        // STATE: SEEKING PARTNER
        else if (bird.state === "seeking_partner" && bird.partnerId) {
          const partner = birds.find((b) => b.id === bird.partnerId);
          if (partner) {
            const dx = partner.mesh.position.x - bird.mesh.position.x;
            const dy = partner.mesh.position.y - bird.mesh.position.y;
            const dz = partner.mesh.position.z - bird.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > 1.2) {
              const approachSpeed = 0.35;
              bird.mesh.position.x += (dx / dist) * approachSpeed;
              bird.mesh.position.y += (dy / dist) * approachSpeed;
              bird.mesh.position.z += (dz / dist) * approachSpeed;
              bird.mesh.rotation.y = Math.atan2(dx, dz);
            } else {
              // Met! Start mating (co-ordinated by male)
              if (bird.gender === "M") {
                bird.state = "mating";
                bird.stateTimer = 4;
                partner.state = "mating";
                partner.stateTimer = 4;

                const mx = (bird.mesh.position.x + partner.mesh.position.x) / 2;
                const my = (bird.mesh.position.y + partner.mesh.position.y) / 2;
                const mz = (bird.mesh.position.z + partner.mesh.position.z) / 2;
                spawnParticleBurst(activeParticles, scene, mx, my, mz, "heart", 8);
              }
            }
          } else {
            bird.state = "flying";
            bird.partnerId = null;
          }
        }

        // STATE: MATING SPIRAL
        else if (bird.state === "mating") {
          bird.mesh.rotation.y += 0.15;
          if (Math.random() < 0.15) {
            spawnParticleBurst(activeParticles, scene, bird.mesh.position.x, bird.mesh.position.y + 0.3, bird.mesh.position.z, "heart", 1);
          }

          if (bird.stateTimer <= 0) {
            if (bird.gender === "F") {
              const tree = forestTrees.find((t) => !t.hasEgg);
              if (tree) {
                bird.state = "flying_to_nest";
                bird.targetTreeId = tree.id;
                tree.hasEgg = true;
              } else {
                bird.state = "flying";
                bird.matingCooldown = speedUpModeRef.current ? 5 : 45;
              }
            } else {
              bird.state = "flying";
              bird.matingCooldown = speedUpModeRef.current ? 5 : 45;
            }
            bird.partnerId = null;
          }
        }

        // STATE: FLYING TO FOREST TREE NEST
        else if (bird.state === "flying_to_nest" && bird.targetTreeId) {
          const tree = forestTrees.find((t) => t.id === bird.targetTreeId);
          if (tree) {
            const dx = tree.x - bird.mesh.position.x;
            const dy = tree.topY - bird.mesh.position.y;
            const dz = tree.z - bird.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > 1.0) {
              const flightSpeed = 0.3;
              bird.mesh.position.x += (dx / dist) * flightSpeed;
              bird.mesh.position.y += (dy / dist) * flightSpeed;
              bird.mesh.position.z += (dz / dist) * flightSpeed;
              bird.mesh.rotation.y = Math.atan2(dx, dz);
            } else {
              bird.state = "nesting";
              bird.stateTimer = 3;
            }
          } else {
            bird.state = "flying";
            bird.targetTreeId = null;
          }
        }

        // STATE: NESTING (Sitting on Tree top)
        else if (bird.state === "nesting") {
          if (bird.targetTreeId) {
            const tree = forestTrees.find((t) => t.id === bird.targetTreeId);
            if (tree) {
              bird.mesh.position.set(tree.x, tree.topY, tree.z);
            }
          }

          if (bird.stateTimer <= 0) {
            if (bird.isBaby) {
              // Chick completed sitting phase, takes off!
              bird.state = "flying";
              bird.targetTreeId = null;
            } else {
              // Mother lays egg!
              if (bird.targetTreeId) {
                const treeIndex = forestTrees.findIndex((t) => t.id === bird.targetTreeId);
                const tree = forestTrees[treeIndex];
                if (tree) {
                  const eggMesh = createBlockyEggMesh();
                  eggMesh.position.set(tree.x, tree.topY - 0.2, tree.z);
                  scene.add(eggMesh);

                  const hatchTime = Date.now() + (speedUpModeRef.current ? 10 * 1000 : 30 * 60 * 1000);

                  eggs.push({
                    id: `egg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    mesh: eggMesh,
                    treeId: tree.id,
                    treeIndex,
                    x: tree.x,
                    y: tree.topY,
                    z: tree.z,
                    createdAt: Date.now(),
                    hatchTime
                  });
                }
              }

              bird.state = "flying";
              bird.matingCooldown = speedUpModeRef.current ? 6 : 60;
              bird.targetTreeId = null;
            }
          }
        }
      });

      // Filter dead/removed birds from collection
      const livingBirds = birds.filter((b) => {
        if (b.state === "dead" && b.mesh.position.y <= 0.2) {
          return false;
        }
        return true;
      });

      if (livingBirds.length !== birds.length) {
        birds.length = 0;
        birds.push(...livingBirds);
      }

      // --- Update Particles ---
      const survivingParticles = activeParticles.filter((p) => {
        p.mesh.position.add(p.velocity);
        p.life -= p.decay;

        p.mesh.scale.set(p.life, p.life, p.life);
        if (p.colorType !== "heart") {
          p.velocity.y -= 0.003; // gravity for dust puffs
        }

        if (p.life <= 0) {
          scene.remove(p.mesh);
          return false;
        }
        return true;
      });

      if (survivingParticles.length !== activeParticles.length) {
        activeParticles.length = 0;
        activeParticles.push(...survivingParticles);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 12. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("trigger-force-mating", handleForceMating);
      window.removeEventListener("trigger-force-hatch", handleForceHatch);
      
      // Clean up flying birds, eggs and active particles
      birds.forEach((bird) => {
        scene.remove(bird.mesh);
      });
      eggs.forEach((egg) => {
        scene.remove(egg.mesh);
      });
      activeParticles.forEach((p) => {
        scene.remove(p.mesh);
      });

      renderer.dispose();
      botMeshes.current.clear();
    };
  }, [houses]);

  // Handle other players rendering in real-time
  useEffect(() => {
    const group = otherPlayersGroupRef.current;
    if (!group) return;

    // Clear removed players
    otherPlayerMeshes.current.forEach((mesh, id) => {
      const exists = onlinePlayers.some((p) => p.id === id);
      if (!exists) {
        group.remove(mesh);
        otherPlayerMeshes.current.delete(id);
      }
    });

    // Add or update other players
    onlinePlayers.forEach((p) => {
      let playerMesh = otherPlayerMeshes.current.get(p.id);

      const pOutfit = p.equippedOutfit || null;
      const pPet = p.equippedPet || null;
      const pMount = p.equippedMount || null;

      if (!playerMesh) {
        playerMesh = new THREE.Group();
        group.add(playerMesh);
        otherPlayerMeshes.current.set(p.id, playerMesh);
        // Build first time
        buildMinecraftPlayer(playerMesh, pOutfit, pPet, pMount);
      } else {
        // Rebuild if equipped items changed
        if (
          playerMesh.userData.outfit !== pOutfit ||
          playerMesh.userData.pet !== pPet ||
          playerMesh.userData.mount !== pMount
        ) {
          buildMinecraftPlayer(playerMesh, pOutfit, pPet, pMount);
        }
      }

      // Smooth interpolation to target coords
      // Lerp positions
      playerMesh.position.x = THREE.MathUtils.lerp(playerMesh.position.x, p.x, 0.15);
      playerMesh.position.y = THREE.MathUtils.lerp(playerMesh.position.y, p.y, 0.15);
      playerMesh.position.z = THREE.MathUtils.lerp(playerMesh.position.z, p.z, 0.15);
      playerMesh.rotation.y = THREE.MathUtils.lerp(playerMesh.rotation.y, p.ry, 0.15);

      // Animate walking animations for online players
      const otherIsMoving = Math.abs(p.x - playerMesh.position.x) > 0.05 || Math.abs(p.z - playerMesh.position.z) > 0.05;
      const walkCycle = (Date.now() / 150) % (Math.PI * 2);

      const hasMount = !!pMount;
      const leftLegMesh = playerMesh.getObjectByName("leftLeg");
      const rightLegMesh = playerMesh.getObjectByName("rightLeg");
      const leftArmMesh = playerMesh.getObjectByName("leftArm");
      const rightArmMesh = playerMesh.getObjectByName("rightArm");
      const petMesh = playerMesh.getObjectByName("pet");

      if (otherIsMoving) {
        const swing = Math.sin(walkCycle) * 0.4;
        if (!hasMount) {
          if (leftLegMesh) leftLegMesh.rotation.x = swing;
          if (rightLegMesh) rightLegMesh.rotation.x = -swing;
        } else {
          if (leftLegMesh) {
            leftLegMesh.rotation.x = -Math.PI / 3;
            leftLegMesh.position.y = 1.4; // 0.8 + 0.6
          }
          if (rightLegMesh) {
            rightLegMesh.rotation.x = -Math.PI / 3;
            rightLegMesh.position.y = 1.4; // 0.8 + 0.6
          }
        }
        if (leftArmMesh) leftArmMesh.rotation.x = swing;
        if (rightArmMesh) rightArmMesh.rotation.x = -swing;

        if (hasMount && playerMesh.userData.mountLegs) {
          playerMesh.userData.mountLegs.forEach((leg: THREE.Mesh, i: number) => {
            leg.rotation.x = Math.sin(walkCycle + (i % 2 === 0 ? 0 : Math.PI)) * 0.4;
          });
        }
        if (petMesh) {
          petMesh.position.y = 0.1 + Math.abs(Math.sin(walkCycle * 1.5)) * 0.15;
        }
      } else {
        if (!hasMount) {
          if (leftLegMesh) leftLegMesh.rotation.x = 0;
          if (rightLegMesh) rightLegMesh.rotation.x = 0;
        } else {
          if (leftLegMesh) {
            leftLegMesh.rotation.x = -Math.PI / 3;
            leftLegMesh.position.y = 1.4;
          }
          if (rightLegMesh) {
            rightLegMesh.rotation.x = -Math.PI / 3;
            rightLegMesh.position.y = 1.4;
          }
        }
        if (leftArmMesh) leftArmMesh.rotation.x = 0;
        if (rightArmMesh) rightArmMesh.rotation.x = 0;

        if (hasMount && playerMesh.userData.mountLegs) {
          playerMesh.userData.mountLegs.forEach((leg: THREE.Mesh) => {
            leg.rotation.x = 0;
          });
        }
        if (petMesh) {
          petMesh.position.y = 0.1;
        }
      }
    });
  }, [onlinePlayers]);

  // Coordinate references for the 10 Houses
  const hCoords = [
    { x: -12, z: -45 },
    { x: -12, z: -25 },
    { x: -12, z: -5 },
    { x: -12, z: 15 },
    { x: -12, z: 35 },
    { x: 12, z: -45 },
    { x: 12, z: -25 },
    { x: 12, z: -5 },
    { x: 12, z: 15 },
    { x: 12, z: 35 }
  ];

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Forest Aviary & Life Cycle Panel */}
      <div className="absolute top-16 left-4 z-20 w-72 bg-slate-900/90 border border-emerald-500/30 text-emerald-100 p-4 rounded-xl shadow-xl font-mono text-xs backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
            <span className="text-base">🌲</span> FOREST AVIARY
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/20">
            SIMULATOR
          </span>
        </div>

        <div className="space-y-3">
          {/* Bird Population */}
          <div className="bg-emerald-950/20 border border-emerald-500/10 rounded-lg p-2.5">
            <div className="flex justify-between text-[11px] text-emerald-400 font-semibold mb-1">
              <span>BIRD POPULATION</span>
              <span>{birdStats.total} / {birdStats.maxLimit}</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-emerald-500/10">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(birdStats.total / birdStats.maxLimit) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-emerald-300">
              <div className="flex justify-between bg-slate-900/40 px-1.5 py-1 rounded">
                <span>Adults:</span>
                <span className="font-bold text-emerald-400">{birdStats.adults}</span>
              </div>
              <div className="flex justify-between bg-slate-900/40 px-1.5 py-1 rounded">
                <span>Chicks:</span>
                <span className="font-bold text-emerald-400">{birdStats.babies}</span>
              </div>
            </div>
          </div>

          {/* Time Scale Controller */}
          <div className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-emerald-500/10">
            <div>
              <div className="font-bold text-[10px] text-emerald-400">ACCELERATE SIMULATION</div>
              <div className="text-[9px] text-emerald-500/70">10s hatch / fast mating</div>
            </div>
            <button
              onClick={() => setSpeedUpMode(!speedUpMode)}
              className={`px-3 py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer select-none border shadow-sm ${
                speedUpMode 
                  ? "bg-amber-500/20 border-amber-500 text-amber-300 hover:bg-amber-500/30" 
                  : "bg-emerald-500/20 border-emerald-500 text-emerald-300 hover:bg-emerald-500/30"
              }`}
            >
              {speedUpMode ? "⚡ ACTIVE" : "NORMAL"}
            </button>
          </div>

          {/* Active Eggs */}
          <div>
            <div className="font-bold text-[10px] text-emerald-400 mb-1.5 flex justify-between">
              <span>ACTIVE EGGS IN FOREST</span>
              <span className="text-emerald-500">({activeEggs.length})</span>
            </div>
            
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {activeEggs.length === 0 ? (
                <div className="text-center py-4 bg-slate-950/20 rounded border border-dashed border-emerald-500/10 text-[10px] text-emerald-500/50">
                  No eggs in nests. Wait for birds to mate in the sky!
                </div>
              ) : (
                activeEggs.map((egg) => {
                  const mins = Math.floor(egg.timeLeft / 60);
                  const secs = egg.timeLeft % 60;
                  const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;
                  // Coordinate display
                  const coords = [
                    { x: 85, z: -110 }, { x: 105, z: -125 }, { x: 125, z: -115 },
                    { x: 95, z: -90 }, { x: 115, z: -85 }, { x: 135, z: -100 },
                    { x: 80, z: -60 }, { x: 100, z: -50 }, { x: 120, z: -65 }, { x: 140, z: -45 },
                    { x: 85, z: -20 }, { x: 110, z: -15 }, { x: 130, z: -30 }, { x: 145, z: -10 },
                    { x: 90, z: 15 }, { x: 115, z: 25 }, { x: 135, z: 10 },
                    { x: 80, z: 40 }, { x: 105, z: 55 }, { x: 125, z: 45 }, { x: 140, z: 60 },
                    { x: 95, z: 85 }, { x: 115, z: 75 }, { x: 135, z: 90 },
                    { x: 85, z: 115 }, { x: 105, z: 110 }, { x: 125, z: 125 }, { x: 145, z: 120 }
                  ];
                  const c = coords[egg.treeIndex] || { x: 0, z: 0 };
                  return (
                    <div 
                      key={egg.id} 
                      className="flex items-center justify-between bg-slate-950/50 border border-emerald-500/15 p-2 rounded"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🪺</span>
                        <div>
                          <div className="font-semibold text-[10px]">Nest on Tree #{egg.treeIndex + 1}</div>
                          <div className="text-[8px] text-emerald-500/70">X:{c.x}, Z:{c.z}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-amber-400 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 text-[10px]">
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("trigger-force-mating"));
              }}
              className="py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded text-[10px] font-bold text-center cursor-pointer transition-colors"
            >
              ❤️ Force Mating
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("trigger-force-hatch"));
              }}
              disabled={activeEggs.length === 0}
              className={`py-1.5 rounded text-[10px] font-bold text-center transition-colors border ${
                activeEggs.length > 0 
                  ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/25 text-amber-300 cursor-pointer" 
                  : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              🐣 Hatch All Eggs
            </button>
          </div>
        </div>
      </div>

      {/* Floating UI overlays for player usernames */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden font-mono text-[9px]">
        {/* Render other player tags */}
        {onlinePlayers.map((p) => (
          <div
            key={p.id}
            className="absolute bg-slate-900/85 border border-orange-500/30 text-white px-2 py-0.5 rounded-full shadow-md text-center transform -translate-x-1/2 -translate-y-full flex flex-col items-center"
            style={{
              // Approximate projection mapping calculated in simplified 2D space relative to player (center is ~50%, 50%)
              // We can estimate projection, or simply list who is online in a small top list if direct rendering in 3D is complex,
              // but rendering floating indicators above heads is beautiful!
              // For robustness, let's also list active players in a small sidebar so users are guaranteed to see who is online!
              display: "none" // We will list them in a nice side panel to guarantee absolute visibility and clean UI!
            }}
          >
            <span>🦊 {p.username}</span>
            <span className="text-[7px] text-yellow-400 leading-none">{p.gold}G</span>
          </div>
        ))}

        {/* Floating owner tags above houses */}
        {houses.map((h, idx) => {
          if (!h.ownerUsername) return null;
          return (
            <div
              key={h.id}
              className="absolute bg-slate-900/90 text-white border border-yellow-500/40 px-2.5 py-1 rounded-sm shadow-sm"
              style={{
                // Will display in side panel too for fully reliable ownership status
                display: "none"
              }}
            >
              <span className="font-bold text-[9px] text-yellow-400">Owner: {h.ownerUsername}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
