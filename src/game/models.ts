import * as THREE from 'three';
import { AABB, MapId, RampSurface, RivalArchetypeId } from './rules';
import { WeaponId, WEAPONS } from './weapons';
import { ProceduralTextureSet } from './textures';

export interface RivalCharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  telegraphRing: THREE.Mesh;
  laserLine: THREE.Line;
  muzzleFlash: THREE.Mesh;
  hitMeshes: THREE.Object3D[];
  materialsToFlash: THREE.MeshStandardMaterial[];
}

/**
 * Builds a composite 11-part Roblox R6/R15 Tactical Rival Character Rig
 * pivoted at bottom-center (y = 0) with varied roughness/metalness and hitboxes.
 */
export function createRivalCharacterRig(
  botId: string,
  archetype: RivalArchetypeId,
  textures: ProceduralTextureSet
): RivalCharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const primaryHex =
    archetype === 'striker' ? 0xe11d48 : archetype === 'phantom' ? 0x9333ea : 0xd97706;
  const darkSlateHex = 0x1e293b;
  const skinHex = 0xfde047; // Classic iconic Roblox yellow-gold head/hands or tactical visor

  // Materials with deliberate roughness variation (>= 0.25 delta between hull, visor, trim)
  const matteFabricMat = new THREE.MeshStandardMaterial({
    color: darkSlateHex,
    roughness: 0.82,
    metalness: 0.12,
  });
  const armorVestMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.42,
    metalness: 0.35,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.55,
    metalness: 0.05,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: primaryHex,
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.85,
  });
  const weaponMetalMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.25,
    metalness: 0.82,
  });

  const materialsToFlash = [matteFabricMat, armorVestMat, skinMat];
  const hitMeshes: THREE.Object3D[] = [];

  // 1. Contact Shadow Disc at y = 0.015
  const shadowGeo = new THREE.PlaneGeometry(1.7, 1.7);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.015;
  root.add(shadowMesh);

  // 2. Left & Right Legs (pivoted at hip y = 0.72)
  const legGeo = new THREE.BoxGeometry(0.32, 0.72, 0.34);
  legGeo.translate(0, -0.36, 0);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.19, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, matteFabricMat);
  leftLegMesh.castShadow = true;
  leftLegMesh.userData = { botId, isHeadshot: false };
  leftLegPivot.add(leftLegMesh);
  bodyGroup.add(leftLegPivot);
  hitMeshes.push(leftLegMesh);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.19, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, matteFabricMat);
  rightLegMesh.castShadow = true;
  rightLegMesh.userData = { botId, isHeadshot: false };
  rightLegPivot.add(rightLegMesh);
  bodyGroup.add(rightLegPivot);
  hitMeshes.push(rightLegMesh);

  // 3. Primary Silhouette: Blocky Roblox Torso + Tactical Chest Rig
  const torsoGeo = new THREE.BoxGeometry(0.74, 0.76, 0.40);
  const torsoMesh = new THREE.Mesh(torsoGeo, matteFabricMat);
  torsoMesh.position.set(0, 1.10, 0);
  torsoMesh.castShadow = true;
  torsoMesh.userData = { botId, isHeadshot: false };
  bodyGroup.add(torsoMesh);
  hitMeshes.push(torsoMesh);

  const vestGeo = new THREE.BoxGeometry(0.78, 0.56, 0.46);
  const vestMesh = new THREE.Mesh(vestGeo, armorVestMat);
  vestMesh.position.set(0, 1.12, 0);
  vestMesh.userData = { botId, isHeadshot: false };
  bodyGroup.add(vestMesh);
  hitMeshes.push(vestMesh);

  // Glowing chest core emblem
  const coreGeo = new THREE.BoxGeometry(0.24, 0.20, 0.48);
  const coreMesh = new THREE.Mesh(coreGeo, visorMat);
  coreMesh.position.set(0, 1.18, 0);
  bodyGroup.add(coreMesh);

  // 4. Head (Classic Roblox Cylinder-Bevel Head + Visor + Archetype Headgear)
  const headGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.52, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 1.76, 0);
  headMesh.castShadow = true;
  headMesh.userData = { botId, isHeadshot: true };
  bodyGroup.add(headMesh);
  hitMeshes.push(headMesh);

  // Generous invisible headshot hitbox proxy so sniper/rifle headshots feel crisp & fair
  const headProxyGeo = new THREE.BoxGeometry(0.68, 0.64, 0.68);
  const headProxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const headProxy = new THREE.Mesh(headProxyGeo, headProxyMat);
  headProxy.position.set(0, 1.78, 0);
  headProxy.userData = { botId, isHeadshot: true };
  bodyGroup.add(headProxy);
  hitMeshes.push(headProxy);

  // Tactical Cyber Visor across eyes
  const visorGeo = new THREE.BoxGeometry(0.48, 0.14, 0.32);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 1.78, -0.18);
  bodyGroup.add(visorMesh);

  // Archetype Silhouette Headgear / Shoulder Accents
  if (archetype === 'striker') {
    // Striker: Crimson Samurai Headband + Dual Katana Back Scabbard
    const bandGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.10, 16);
    const bandMesh = new THREE.Mesh(bandGeo, armorVestMat);
    bandMesh.position.set(0, 1.92, 0);
    bodyGroup.add(bandMesh);
  } else if (archetype === 'phantom') {
    // Phantom: Sniper Hood / Cowl + Tri-Optic Crown
    const hoodGeo = new THREE.BoxGeometry(0.64, 0.58, 0.60);
    const hoodMesh = new THREE.Mesh(hoodGeo, armorVestMat);
    hoodMesh.position.set(0, 1.78, 0.04);
    bodyGroup.add(hoodMesh);
  } else {
    // Demolisher: Heavy Juggernaut Pauldrons + Blast Helmet
    const helmetGeo = new THREE.CylinderGeometry(0.33, 0.34, 0.30, 16);
    const helmetMesh = new THREE.Mesh(helmetGeo, armorVestMat);
    helmetMesh.position.set(0, 1.94, 0);
    bodyGroup.add(helmetMesh);

    const pauldronGeo = new THREE.BoxGeometry(0.32, 0.26, 0.46);
    const leftPauldron = new THREE.Mesh(pauldronGeo, armorVestMat);
    leftPauldron.position.set(-0.56, 1.42, 0);
    const rightPauldron = new THREE.Mesh(pauldronGeo, armorVestMat);
    rightPauldron.position.set(0.56, 1.42, 0);
    bodyGroup.add(leftPauldron, rightPauldron);
  }

  // 5. Left & Right Arms + Equipped 3D Weapon
  const armGeo = new THREE.BoxGeometry(0.28, 0.68, 0.28);
  armGeo.translate(0, -0.30, 0);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.52, 1.42, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
  leftArmMesh.userData = { botId, isHeadshot: false };
  leftArmPivot.add(leftArmMesh);
  bodyGroup.add(leftArmPivot);
  hitMeshes.push(leftArmMesh);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.52, 1.42, 0);
  rightArmPivot.rotation.x = Math.PI * 0.42; // Raised aiming pose
  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  rightArmMesh.userData = { botId, isHeadshot: false };
  rightArmPivot.add(rightArmMesh);

  // Bot's 3D Gun in Right Hand
  const gunBodyGeo = new THREE.BoxGeometry(0.14, 0.18, 0.78);
  const gunBody = new THREE.Mesh(gunBodyGeo, weaponMetalMat);
  gunBody.position.set(0, -0.58, -0.25);
  gunBody.rotation.x = -Math.PI * 0.42;
  rightArmPivot.add(gunBody);

  // Bot Muzzle Flash
  const flashGeo = new THREE.OctahedronGeometry(0.22, 0);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.set(0, -0.58, -0.72);
  muzzleFlash.visible = false;
  rightArmPivot.add(muzzleFlash);

  bodyGroup.add(rightArmPivot);
  hitMeshes.push(rightArmMesh);

  // 6. Telegraph Ring on Ground (Visible Windup Cue)
  const ringGeo = new THREE.RingGeometry(0.75, 1.15, 28);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: primaryHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(ringGeo, ringMat);
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  root.add(telegraphRing);

  // 7. Sniper / Aim Telegraph Laser Sight Line
  const laserPts = [new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(0, 1.45, -20)];
  const laserGeo = new THREE.BufferGeometry().setFromPoints(laserPts);
  const laserMat = new THREE.LineBasicMaterial({
    color: primaryHex,
    transparent: true,
    opacity: 0.9,
  });
  const laserLine = new THREE.Line(laserGeo, laserMat);
  laserLine.frustumCulled = false;
  laserLine.visible = false;
  root.add(laserLine);

  return {
    root,
    bodyGroup,
    headMesh,
    torsoMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    telegraphRing,
    laserLine,
    muzzleFlash,
    hitMeshes,
    materialsToFlash,
  };
}

export interface FirstPersonViewmodelRig {
  root: THREE.Group;
  weaponPivot: THREE.Group;
  muzzleFlash: THREE.Mesh;
  deflectShield: THREE.Mesh;
  rebuildForWeapon: (weaponId: WeaponId) => void;
}

/**
 * Builds the First-Person 3D Viewmodel (Blocky Roblox Hands + Multi-Part 3D Weapon).
 */
export function createFirstPersonViewmodel(): FirstPersonViewmodelRig {
  const root = new THREE.Group();
  const weaponPivot = new THREE.Group();
  root.add(weaponPivot);

  const flashGeo = new THREE.OctahedronGeometry(0.09, 0);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    depthTest: false,
  });
  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.renderOrder = 25;
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  // Katana Deflect Glowing Energy Arc
  const shieldGeo = new THREE.TorusGeometry(0.28, 0.025, 8, 24, Math.PI * 1.2);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.78,
    depthTest: false,
  });
  const deflectShield = new THREE.Mesh(shieldGeo, shieldMat);
  deflectShield.position.set(0, -0.02, -0.52);
  deflectShield.renderOrder = 26;
  deflectShield.visible = false;
  root.add(deflectShield);

  const handMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    roughness: 0.55,
    metalness: 0.05,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
    metalness: 0.1,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.28,
    metalness: 0.85,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.92,
  });

  const rebuildForWeapon = (weaponId: WeaponId) => {
    while (weaponPivot.children.length > 0) {
      weaponPivot.remove(weaponPivot.children[0]);
    }
    weaponPivot.scale.set(0.80, 0.80, 0.80);

    const def = WEAPONS[weaponId] || WEAPONS.ar;
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.accentColor),
      emissive: new THREE.Color(def.accentColor),
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.65,
    });

    // Blocky Right Hand + Forearm
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.16), handMat);
    rightHand.position.set(0.24, -0.18, -0.48);
    const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.115, 0.22), sleeveMat);
    rightSleeve.position.set(0.26, -0.21, -0.32);
    weaponPivot.add(rightHand, rightSleeve);

    if (weaponId === 'katana') {
      // Multi-part Katana assembled in a unified group so hilt, tsuba, and blade align seamlessly
      const katanaGroup = new THREE.Group();
      katanaGroup.position.set(0.24, -0.16, -0.50);
      katanaGroup.rotation.set(0.28, 0.12, -0.16);

      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.022, 0.22, 10), darkMetalMat);
      hilt.position.set(0, 0, 0);

      const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.018, 12), accentMat);
      tsuba.position.set(0, 0.11, 0);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.68, 0.038), steelMat);
      blade.position.set(0, 0.45, 0);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.68, 0.010), accentMat);
      edge.position.set(0, 0.45, -0.018);

      katanaGroup.add(hilt, tsuba, blade, edge);
      weaponPivot.add(katanaGroup);
      muzzleFlash.position.set(0.22, -0.05, -0.68);
      return;
    }

    if (weaponId === 'scythe') {
      // Reaper Scythe: Long Pole + Crescent Neon-Edged Blade
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.92, 8), darkMetalMat);
      pole.position.set(0.24, -0.02, -0.50);
      pole.rotation.x = Math.PI * 0.22;

      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), accentMat);
      collar.position.set(0.24, 0.32, -0.68);

      const scytheBlade = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.12), steelMat);
      scytheBlade.position.set(0.04, 0.34, -0.74);
      scytheBlade.rotation.z = 0.22;

      const scytheEdge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.03), accentMat);
      scytheEdge.position.set(0.04, 0.34, -0.80);
      scytheEdge.rotation.z = 0.22;

      weaponPivot.add(pole, collar, scytheBlade, scytheEdge);
      return;
    }

    if (weaponId === 'fists') {
      // Dual Tactical Boxing/MMA Gloves
      const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.20), handMat);
      leftHand.position.set(-0.22, -0.22, -0.45);
      const leftBand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), accentMat);
      leftBand.position.set(-0.22, -0.22, -0.38);
      const rightBand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.06), accentMat);
      rightBand.position.set(0.24, -0.24, -0.36);
      weaponPivot.add(leftHand, leftBand, rightBand);
      return;
    }

    if (def.slot === 'utility') {
      // Utility item held in hand (Grenade / Medkit / Molotov / Subspace Tripmine)
      if (weaponId === 'tripmine') {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), accentMat);
        core.position.set(0.22, -0.14, -0.48);
        const frame1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.03), darkMetalMat);
        frame1.position.set(0.22, -0.14, -0.48);
        const frame2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), darkMetalMat);
        frame2.position.set(0.22, -0.14, -0.48);
        weaponPivot.add(core, frame1, frame2);
      } else if (weaponId === 'medkit') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.14), accentMat);
        box.position.set(0.22, -0.15, -0.48);
        const crossH = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, 0.03, 0.15),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        crossH.position.set(0.22, -0.15, -0.48);
        const crossV = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.10, 0.15),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        crossV.position.set(0.22, -0.15, -0.48);
        weaponPivot.add(box, crossH, crossV);
      } else {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12), accentMat);
        cyl.position.set(0.22, -0.14, -0.48);
        const pin = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), steelMat);
        pin.position.set(0.22, -0.05, -0.48);
        weaponPivot.add(cyl, pin);
      }
      return;
    }

    // Firearms (AR, Sniper, Shotgun, Burst, Revolver, Uzi, Flare)
    const isLongGun = def.slot === 'primary';
    const bodyLen = weaponId === 'sniper' ? 0.68 : isLongGun ? 0.50 : 0.30;

    // Receiver
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.12, bodyLen),
      darkMetalMat
    );
    receiver.position.set(0.22, -0.16, -0.48);

    // Accent upper rail / trim
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.092, 0.032, bodyLen * 0.88),
      accentMat
    );
    rail.position.set(0.22, -0.095, -0.48);

    // Barrel
    const barrelLen = weaponId === 'sniper' ? 0.45 : isLongGun ? 0.28 : 0.16;
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.020, barrelLen, 10),
      steelMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.22, -0.14, -0.48 - bodyLen / 2 - barrelLen / 2 + 0.04);

    // Magazine
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, 0.08),
      weaponId === 'revolver' ? steelMat : accentMat
    );
    mag.position.set(0.22, -0.26, -0.52);
    mag.rotation.x = 0.22;

    weaponPivot.add(receiver, rail, barrel, mag);

    if (weaponId === 'sniper' || weaponId === 'burst') {
      // Scope tube
      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.028, 0.24, 12),
        darkMetalMat
      );
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0.22, -0.04, -0.46);
      weaponPivot.add(scope);
    } else {
      // Holo Iron Sight
      const sight = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.045, 0.06),
        accentMat
      );
      sight.position.set(0.22, -0.055, -0.46);
      weaponPivot.add(sight);
    }

    if (isLongGun) {
      // Support Left Hand under barrel
      const leftSupport = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.16), handMat);
      leftSupport.position.set(0.16, -0.21, -0.62);
      weaponPivot.add(leftSupport);
    }

    muzzleFlash.position.set(0.22, -0.14, -0.48 - bodyLen / 2 - barrelLen + 0.02);
  };

  rebuildForWeapon('ar');

  return {
    root,
    weaponPivot,
    muzzleFlash,
    deflectShield,
    rebuildForWeapon,
  };
}

export interface BuiltArenaWorld {
  worldGroup: THREE.Group;
  colliders: AABB[];
  ramps: RampSurface[];
  jumpPads: THREE.Vector3[];
  environmentMeshes: THREE.Object3D[];
  skyColor: number;
  fogColor: number;
}

/**
 * Builds the complete Roblox RIVALS 3D Arena with symmetrical competitive cover,
 * elevated central platform + ramps, jump pads, tall spawn vista landmark, and
 * natural outdoor cliffs/skyline beyond the perimeter fence.
 */
export function createArenaEnvironment(
  mapId: MapId,
  textures: ProceduralTextureSet
): BuiltArenaWorld {
  const worldGroup = new THREE.Group();
  const colliders: AABB[] = [];
  const ramps: RampSurface[] = [];
  const jumpPads: THREE.Vector3[] = [];
  const environmentMeshes: THREE.Object3D[] = [];

  const theme =
    mapId === 'docks'
      ? {
          sky: 0x0ea5e9,
          fog: 0xbae6fd,
          floorTint: 0xffffff,
          containerA: 0x0284c7,
          containerB: 0xf97316,
          pillar: 0x475569,
          outerTerrain: 0x0369a1,
        }
      : mapId === 'construction'
      ? {
          sky: 0xf59e0b,
          fog: 0xfef3c7,
          floorTint: 0xffffff,
          containerA: 0xeab308,
          containerB: 0xdc2626,
          pillar: 0x334155,
          outerTerrain: 0x78350f,
        }
      : {
          // Classic RIVALS "Arena" Map: Crisp Daylight Esports Stadium
          sky: 0x38bdf8,
          fog: 0xdbeafe,
          floorTint: 0xffffff,
          containerA: 0xf97316,
          containerB: 0x3b82f6,
          pillar: 0xe2e8f0,
          outerTerrain: 0x334155,
        };

  // Materials
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.floorColor,
    bumpMap: textures.floorBump,
    bumpScale: 0.03,
    roughness: 0.72,
    metalness: 0.08,
  });

  const containerMatA = new THREE.MeshStandardMaterial({
    color: theme.containerA,
    map: textures.containerColor,
    bumpMap: textures.containerBump,
    bumpScale: 0.05,
    roughness: 0.48,
    metalness: 0.25,
  });

  const containerMatB = new THREE.MeshStandardMaterial({
    color: theme.containerB,
    map: textures.containerColor,
    bumpMap: textures.containerBump,
    bumpScale: 0.05,
    roughness: 0.48,
    metalness: 0.25,
  });

  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.crateColor,
    bumpMap: textures.crateBump,
    bumpScale: 0.04,
    roughness: 0.62,
    metalness: 0.12,
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    color: theme.pillar,
    roughness: 0.78,
    metalness: 0.1,
  });

  const trimAccentMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.3,
    metalness: 0.5,
  });

  // 1. Extended Outdoor Surroundings (Natural Cliff / Coast / Skyline beyond playable zone)
  const outerGroundGeo = new THREE.PlaneGeometry(360, 360);
  outerGroundGeo.rotateX(-Math.PI / 2);
  const outerGroundMat = new THREE.MeshStandardMaterial({
    color: theme.outerTerrain,
    roughness: 0.9,
    metalness: 0.05,
  });
  const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
  outerGround.position.y = -0.25;
  worldGroup.add(outerGround);

  // Playable Arena Court Floor (72m x 72m, offset by +0.02 on Y to prevent Z-fighting)
  const courtGeo = new THREE.PlaneGeometry(72, 72);
  courtGeo.rotateX(-Math.PI / 2);
  const courtFloor = new THREE.Mesh(courtGeo, floorMat);
  courtFloor.position.y = 0;
  courtFloor.receiveShadow = true;
  worldGroup.add(courtFloor);
  environmentMeshes.push(courtFloor);

  // Court Markings (Disjoint Y = 0.025 + polygonOffset)
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(66, 0.35).rotateX(-Math.PI / 2), lineMat);
  centerLine.position.y = 0.025;
  const centerRing = new THREE.Mesh(new THREE.RingGeometry(6.8, 7.15, 36).rotateX(-Math.PI / 2), lineMat);
  centerRing.position.y = 0.025;
  worldGroup.add(centerLine, centerRing);

  // Helper to add solid AABB block + mesh
  const addBlock = (
    cx: number,
    minY: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    withRoofTrim = false
  ) => {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, minY + sy / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
    environmentMeshes.push(mesh);

    if (withRoofTrim) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.16, 0.22, sz + 0.16), trimAccentMat);
      trim.position.set(cx, minY + sy + 0.11, cz);
      worldGroup.add(trim);
    }

    colliders.push({
      minX: cx - sx / 2,
      maxX: cx + sx / 2,
      minY,
      maxY: minY + sy,
      minZ: cz - sz / 2,
      maxZ: cz + sz / 2,
    });
  };

  // 2. Central Elevated Bridge Platform (Iconic RIVALS Mid Control Point, y = 0..2.8m)
  addBlock(0, 0, 0, 10, 2.8, 10, concreteMat, true);

  // Ramps leading up to Central Platform from North (-Z) and South (+Z)
  const buildRamp = (
    cx: number,
    cz: number,
    sx: number,
    sz: number,
    endY: number,
    axis: 'z+' | 'z-' | 'x+' | 'x-'
  ) => {
    const length = axis === 'z+' || axis === 'z-' ? sz : sx;
    const slopeAngle = Math.atan2(endY, length);
    const hypot = Math.hypot(length, endY);
    const rampGeo = new THREE.BoxGeometry(
      axis === 'x+' || axis === 'x-' ? hypot : sx,
      0.35,
      axis === 'z+' || axis === 'z-' ? hypot : sz
    );
    const rampMesh = new THREE.Mesh(rampGeo, trimAccentMat);
    rampMesh.position.set(cx, endY / 2 - 0.1, cz);
    if (axis === 'z-') rampMesh.rotation.x = slopeAngle;
    if (axis === 'z+') rampMesh.rotation.x = -slopeAngle;
    if (axis === 'x+') rampMesh.rotation.z = slopeAngle;
    if (axis === 'x-') rampMesh.rotation.z = -slopeAngle;
    rampMesh.receiveShadow = true;
    worldGroup.add(rampMesh);
    environmentMeshes.push(rampMesh);

    ramps.push({
      minX: cx - sx / 2,
      maxX: cx + sx / 2,
      minZ: cz - sz / 2,
      maxZ: cz + sz / 2,
      startY: 0,
      endY,
      axis,
    });
  };

  // South ramp (player side climbing north toward z = 5) & North ramp (rival side climbing south toward z = -5)
  buildRamp(0, 8.5, 4.4, 7.0, 2.8, 'z-');
  buildRamp(0, -8.5, 4.4, 7.0, 2.8, 'z+');

  // 3. Symmetrical Shipping Containers on Left (-X) and Right (+X) Lanes
  addBlock(-13.5, 0, -9, 4.2, 3.6, 9.5, containerMatA, true);
  addBlock(-13.5, 0, 9, 4.2, 3.6, 9.5, containerMatB, true);
  addBlock(13.5, 0, -9, 4.2, 3.6, 9.5, containerMatB, true);
  addBlock(13.5, 0, 9, 4.2, 3.6, 9.5, containerMatA, true);

  // 4. Spawn Cover Walls & Tactical Crate Clusters (Grounded flush at y = 0)
  // Player Spawn Cover (around z = +22, open central lane so player never spawns facing a wall!)
  addBlock(-7.5, 0, 18.5, 4.5, 2.6, 2.2, concreteMat, true);
  addBlock(7.5, 0, 18.5, 4.5, 2.6, 2.2, concreteMat, true);

  // Rival Spawn Cover (around z = -22)
  addBlock(-7.5, 0, -18.5, 4.5, 2.6, 2.2, concreteMat, true);
  addBlock(7.5, 0, -18.5, 4.5, 2.6, 2.2, concreteMat, true);

  // Clustered Tactical Crates against container bases
  const crateCoords = [
    [-8.5, 0, 6.5, 2.0],
    [-8.5, 0, -6.5, 2.0],
    [8.5, 0, 6.5, 2.0],
    [8.5, 0, -6.5, 2.0],
    [-18.5, 0, 0, 2.2],
    [18.5, 0, 0, 2.2],
  ];
  for (const [cx, cy, cz, sz] of crateCoords) {
    addBlock(cx, cy, cz, sz, sz, sz, crateMat);
  }

  // 5. Glowing Jump Pads on Left & Right Mid-Flanks
  const padPositions = [
    new THREE.Vector3(-21, 0.08, 0),
    new THREE.Vector3(21, 0.08, 0),
  ];
  const padBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
  const padGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  for (const pos of padPositions) {
    jumpPads.push(pos.clone());
    const padGroup = new THREE.Group();
    padGroup.position.copy(pos);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.18, 20), padBaseMat);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.21, 20), padGlowMat);
    padGroup.add(base, ring);
    worldGroup.add(padGroup);
  }

  // 6. Tall Silhouette Landmark in Initial Spawn Vista (RIVALS Championship Arch & Broadcast Tower at z = -38)
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, -37);
  const leftTower = new THREE.Mesh(new THREE.BoxGeometry(3.5, 22, 3.5), concreteMat);
  leftTower.position.set(-14, 11, 0);
  const rightTower = new THREE.Mesh(new THREE.BoxGeometry(3.5, 22, 3.5), concreteMat);
  rightTower.position.set(14, 11, 0);
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(34, 4.2, 4.2), containerMatA);
  crossBeam.position.set(0, 21, 0);
  const topAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 10, 8), trimAccentMat);
  topAntenna.position.set(0, 28, 0);
  archGroup.add(leftTower, rightTower, crossBeam, topAntenna);
  worldGroup.add(archGroup);

  // 7. Low Perimeter Safety Railings & Natural Outer Rock Outcrops (InstancedMesh for >20 rocks/pillars)
  const postCount = 32;
  const postGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
  const postInst = new THREE.InstancedMesh(postGeo, concreteMat, postCount);
  const dummy = new THREE.Object3D();
  let pIdx = 0;
  for (let i = 0; i < 8; i++) {
    const offset = -28 + i * 8;
    // 4 sides at ±34.5m
    const coords = [
      [offset, 34.5],
      [offset, -34.5],
      [34.5, offset],
      [-34.5, offset],
    ];
    for (const [px, pz] of coords) {
      if (pIdx < postCount) {
        dummy.position.set(px, 0.9, pz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        postInst.setMatrixAt(pIdx++, dummy.matrix);
      }
    }
  }
  postInst.instanceMatrix.needsUpdate = true;
  postInst.computeBoundingSphere();
  worldGroup.add(postInst);

  // Outer Natural Cliff Outcrops & Skyline Pillars (InstancedMesh with +/-15% scale & tint variation)
  const rockCount = 28;
  const rockGeo = new THREE.DodecahedronGeometry(6, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.88,
    metalness: 0.08,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const tintColor = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2;
    const radius = 58 + (i % 3) * 14;
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const scaleXZ = 0.85 + ((i * 7) % 5) * 0.12;
    const scaleY = 1.2 + ((i * 3) % 4) * 0.65;
    dummy.position.set(rx, scaleY * 2.2 - 1.5, rz);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(scaleXZ, scaleY, scaleXZ);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    tintColor.setHSL(0.58, 0.16, 0.32 + (i % 4) * 0.05);
    rockInst.setColorAt(i, tintColor);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  worldGroup.add(rockInst);

  return {
    worldGroup,
    colliders,
    ramps,
    jumpPads,
    environmentMeshes,
    skyColor: theme.sky,
    fogColor: theme.fog,
  };
}
