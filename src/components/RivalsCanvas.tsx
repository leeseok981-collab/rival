import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AABB,
  activateWeaponSpecial,
  checkMatchOutcome,
  computeShotDamage,
  createInitialPlayerKinematics,
  createRivalBot,
  GameMode,
  getDifficultyForRound,
  MapId,
  MatchScoreState,
  PLAYER_EYE_HEIGHT,
  PLAYER_SLIDE_EYE_HEIGHT,
  RampSurface,
  RivalBotState,
  stepPlayerKinematics,
  stepRivalBots,
} from '../game/rules';
import { LoadoutSelection, WeaponDef, WeaponId, WeaponSlot, WEAPONS } from '../game/weapons';
import { getProceduralTextures } from '../game/textures';
import {
  createArenaEnvironment,
  createFirstPersonViewmodel,
  createRivalCharacterRig,
  RivalCharacterRig,
} from '../game/models';
import { soundFX } from '../game/audio';

export type AppGameState = 'title' | 'playing' | 'paused' | 'gameover';

export interface FloatingDamageNumber {
  id: number;
  x: number; // screen % 0..100
  y: number; // screen % 0..100
  amount: number;
  isHeadshot: boolean;
  isDeflect?: boolean;
  age: number;
}

export interface BotHudOverhead {
  id: string;
  nameKo: string;
  nameEn: string;
  roleTitle: string;
  hp: number;
  maxHp: number;
  screenX: number;
  screenY: number;
  visible: boolean;
  isWindup: boolean;
  accentHex: number;
}

export interface LiveHudSnapshot {
  hp: number;
  maxHp: number;
  ghostHp: number;
  activeSlot: WeaponSlot;
  activeWeaponId: WeaponId;
  ammoInMag: Record<WeaponSlot, number>;
  ammoReserve: Record<WeaponSlot, number>;
  isReloading: boolean;
  reloadProgress: number; // 0..1
  isAds: boolean;
  isSliding: boolean;
  deflectActive: boolean;
  specialCooldownRatio: number; // 0..1 (1 = ready)
  roundTimerSec: number;
  playerRoundsWon: number;
  rivalRoundsWon: number;
  targetRoundsToWin: number;
  currentRound: number;
  winStreak: number;
  roundBannerText: string | null;
  roundBannerSub: string | null;
  hitmarkerType: 'none' | 'body' | 'headshot' | 'kill' | 'deflect';
  damageNumbers: FloatingDamageNumber[];
  botOverheads: BotHudOverhead[];
  playerPos: { x: number; z: number; yaw: number };
  botPositions: Array<{ x: number; z: number; hp: number; archetype: string }>;
  stats: {
    shotsFired: number;
    shotsHit: number;
    headshots: number;
    totalDamage: number;
    eliminations: number;
    deflectCount: number;
    matchElapsedSec: number;
  };
}

export interface RivalsSimulationHandle {
  switchSlot: (slot: WeaponSlot) => void;
  triggerPrimaryFire: () => void;
  triggerSpecialAction: () => void;
  triggerReload: () => void;
  resetMatch: () => void;
}

interface RivalsCanvasProps {
  gameState: AppGameState;
  mapId: MapId;
  gameMode: GameMode;
  loadout: LoadoutSelection;
  onHudUpdate: (snapshot: LiveHudSnapshot) => void;
  onMatchEnd: (outcome: 'victory' | 'defeat', finalSnapshot: LiveHudSnapshot) => void;
  onRequestPauseToggle: () => void;
  onToggleLoadoutDrawer: () => void;
  simHandleRef: React.MutableRefObject<RivalsSimulationHandle | null>;
}

// Pre-allocated scratch helpers outside render loop (Zero-GC discipline)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();

interface ActiveProjectileOrZone {
  active: boolean;
  kind: 'frag' | 'molotov' | 'tripmine' | 'flare' | 'fire_zone';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  timer: number;
  tickTimer: number;
  radius: number;
  damage: number;
  mesh: THREE.Mesh;
}

export const RivalsCanvas: React.FC<RivalsCanvasProps> = ({
  gameState,
  mapId,
  gameMode,
  loadout,
  onHudUpdate,
  onMatchEnd,
  onRequestPauseToggle,
  onToggleLoadoutDrawer,
  simHandleRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest React props/callbacks in refs so HUD state updates never tear down the WebGL canvas
  const gameStateRef = useRef<AppGameState>(gameState);
  const mapIdRef = useRef<MapId>(mapId);
  const gameModeRef = useRef<GameMode>(gameMode);
  const loadoutRef = useRef<LoadoutSelection>(loadout);
  const onHudUpdateRef = useRef(onHudUpdate);
  const onMatchEndRef = useRef(onMatchEnd);
  const onRequestPauseToggleRef = useRef(onRequestPauseToggle);
  const onToggleLoadoutDrawerRef = useRef(onToggleLoadoutDrawer);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState !== 'playing' && typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [gameState]);

  useEffect(() => {
    onHudUpdateRef.current = onHudUpdate;
    onMatchEndRef.current = onMatchEnd;
    onRequestPauseToggleRef.current = onRequestPauseToggle;
    onToggleLoadoutDrawerRef.current = onToggleLoadoutDrawer;
  }, [onHudUpdate, onMatchEnd, onRequestPauseToggle, onToggleLoadoutDrawer]);

  const rebuildMapRef = useRef<((m: MapId) => void) | null>(null);
  const applyLoadoutChangeRef = useRef<((l: LoadoutSelection) => void) | null>(null);

  useEffect(() => {
    mapIdRef.current = mapId;
    rebuildMapRef.current?.(mapId);
  }, [mapId]);

  useEffect(() => {
    loadoutRef.current = loadout;
    applyLoadoutChangeRef.current?.(loadout);
  }, [loadout]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL (SwiftShader / llvmpipe) per Three.js skill directive
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initRect = container.getBoundingClientRect();
    const initW = Math.max(320, initRect.width || window.innerWidth);
    const initH = Math.max(240, initRect.height || window.innerHeight);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'rivals-webgl-canvas');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, initW / initH, 0.1, 240);
    scene.add(camera);

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Balanced 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.85);
    hemiLight.position.set(0, 45, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(28, 48, 24);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 36;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 110;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-25, 22, -30);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = getProceduralTextures(maxAniso);

    // First-Person Viewmodel attached to Camera
    const fpViewmodel = createFirstPersonViewmodel();
    camera.add(fpViewmodel.root);

    // Bullet Tracer Line (pooled single reusable beam)
    const tracerPoints = [new THREE.Vector3(), new THREE.Vector3()];
    const tracerGeo = new THREE.BufferGeometry().setFromPoints(tracerPoints);
    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    const bulletTracer = new THREE.Line(tracerGeo, tracerMat);
    bulletTracer.frustumCulled = false;
    bulletTracer.visible = false;
    scene.add(bulletTracer);
    let tracerTimer = 0;

    // 4. Zero-GC Pooled Particle Ring Buffer (InstancedMesh of 180 particles)
    const PARTICLE_CAP = 180;
    const partGeo = new THREE.OctahedronGeometry(0.11, 0);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleMesh = new THREE.InstancedMesh(partGeo, partMat, PARTICLE_CAP);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    const partActive = new Uint8Array(PARTICLE_CAP);
    const partPos = new Float32Array(PARTICLE_CAP * 3);
    const partVel = new Float32Array(PARTICLE_CAP * 3);
    const partLife = new Float32Array(PARTICLE_CAP);
    const partMaxLife = new Float32Array(PARTICLE_CAP);
    const partSize = new Float32Array(PARTICLE_CAP);
    let partCursor = 0;

    for (let i = 0; i < PARTICLE_CAP; i++) {
      _mat4.makeScale(0, 0, 0);
      particleMesh.setMatrixAt(i, _mat4);
      particleMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    particleMesh.instanceMatrix.needsUpdate = true;

    const spawnParticles = (
      x: number,
      y: number,
      z: number,
      count: number,
      hexColor: number,
      speed = 6.5,
      size = 1.0,
      life = 0.42
    ) => {
      _color.setHex(hexColor);
      for (let c = 0; c < count; c++) {
        const idx = partCursor;
        partCursor = (partCursor + 1) % PARTICLE_CAP;
        partActive[idx] = 1;
        const i3 = idx * 3;
        partPos[i3] = x + (Math.random() - 0.5) * 0.25;
        partPos[i3 + 1] = y + (Math.random() - 0.5) * 0.25;
        partPos[i3 + 2] = z + (Math.random() - 0.5) * 0.25;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const spd = speed * (0.45 + Math.random() * 0.75);
        partVel[i3] = Math.cos(theta) * Math.sin(phi) * spd;
        partVel[i3 + 1] = Math.abs(Math.cos(phi)) * spd + 1.8;
        partVel[i3 + 2] = Math.sin(theta) * Math.sin(phi) * spd;

        partLife[idx] = life * (0.75 + Math.random() * 0.45);
        partMaxLife[idx] = partLife[idx];
        partSize[idx] = size * (0.7 + Math.random() * 0.6);
        particleMesh.setColorAt(idx, _color);
      }
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    };

    // Pooled Throwables / Ground Hazard Zones (Max 8)
    const PROJECTILE_POOL_SIZE = 8;
    const projectilePool: ActiveProjectileOrZone[] = [];
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
      const pMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.28, 16),
        new THREE.MeshStandardMaterial({
          color: 0x4ade80,
          emissive: 0x22c55e,
          emissiveIntensity: 0.6,
          roughness: 0.3,
        })
      );
      pMesh.visible = false;
      scene.add(pMesh);
      projectilePool.push({
        active: false,
        kind: 'frag',
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        timer: 0,
        tickTimer: 0,
        radius: 4.0,
        damage: 75,
        mesh: pMesh,
      });
    }

    // World & Arena Containers
    let currentArenaGroup: THREE.Group | null = null;
    let colliders: AABB[] = [];
    let ramps: RampSurface[] = [];
    let jumpPads: THREE.Vector3[] = [];
    let environmentMeshes: THREE.Object3D[] = [];

    const buildArena = (mId: MapId) => {
      if (currentArenaGroup) {
        scene.remove(currentArenaGroup);
      }
      const built = createArenaEnvironment(mId, textures);
      currentArenaGroup = built.worldGroup;
      colliders = built.colliders;
      ramps = built.ramps;
      jumpPads = built.jumpPads;
      environmentMeshes = built.environmentMeshes;
      scene.background = new THREE.Color(built.skyColor);
      scene.fog = new THREE.FogExp2(built.fogColor, 0.0085);
      scene.add(currentArenaGroup);
    };

    buildArena(mapIdRef.current);
    rebuildMapRef.current = buildArena;

    // Rival Bot Rigs Pool (up to 3 simultaneous archetypes: Striker, Phantom, Demolisher)
    const botGroupContainer = new THREE.Group();
    scene.add(botGroupContainer);
    let botsState: RivalBotState[] = [];
    let botRigs = new Map<string, RivalCharacterRig>();
    let raycastTargets: THREE.Object3D[] = [];

    // Simulation & Match State
    const playerKin = createInitialPlayerKinematics(0, 0, 23, 0);
    let playerHp = 100;
    const playerMaxHp = 100;
    let ghostHp = 100;

    let activeSlot: WeaponSlot = 'primary';
    const getWeaponForSlot = (slot: WeaponSlot): WeaponDef => {
      const id = loadoutRef.current[slot];
      return WEAPONS[id] || WEAPONS.ar;
    };

    let ammoInMag: Record<WeaponSlot, number> = {
      primary: WEAPONS[loadoutRef.current.primary].magSize,
      secondary: WEAPONS[loadoutRef.current.secondary].magSize,
      melee: 0,
      utility: WEAPONS[loadoutRef.current.utility].magSize,
    };
    let ammoReserve: Record<WeaponSlot, number> = {
      primary: WEAPONS[loadoutRef.current.primary].reserveAmmo,
      secondary: WEAPONS[loadoutRef.current.secondary].reserveAmmo,
      melee: 0,
      utility: 0,
    };

    let fireCooldown = 0;
    let isReloading = false;
    let reloadTimer = 0;
    let reloadDuration = 1.6;
    let isAds = false;
    let recoilPitchOffset = 0;
    let viewmodelKickZ = 0;
    let viewmodelSwingAngle = 0;
    let fpFlashTimer = 0;

    // Hitstop, Trauma Shake, Round Banner, and Match Score
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let roundTimerSec = 90;
    let roundTransitionTimer = 0;
    let roundBannerText: string | null = 'ROUND 1 · FIGHT!';
    let roundBannerSub: string | null = '먼저 5라운드를 승리하세요!';
    let bannerClearTimer = 2.4;
    let hitmarkerType: 'none' | 'body' | 'headshot' | 'kill' | 'deflect' = 'none';
    let hitmarkerTimer = 0;

    let floatingNumbers: FloatingDamageNumber[] = [];
    let nextDmgId = 1;

    const matchScore: MatchScoreState = {
      playerRoundsWon: 0,
      rivalRoundsWon: 0,
      targetRoundsToWin: 5,
      currentRound: 1,
      winStreak: 0,
    };

    const matchStats = {
      shotsFired: 0,
      shotsHit: 0,
      headshots: 0,
      totalDamage: 0,
      eliminations: 0,
      deflectCount: 0,
      matchElapsedSec: 0,
    };

    const spawnBotsForRound = (roundNum: number) => {
      // Clear previous bot rigs
      while (botGroupContainer.children.length > 0) {
        botGroupContainer.remove(botGroupContainer.children[0]);
      }
      botRigs.clear();
      botsState = [];
      raycastTargets = [...environmentMeshes];

      const diff = getDifficultyForRound(roundNum, gameModeRef.current);
      const spawnOffsets = [
        [0, 2.8, -2.5],
        [-6.5, 0, -10.5],
        [6.5, 0, -10.5],
      ];

      diff.archetypes.forEach((arch, idx) => {
        const id = `rival_${roundNum}_${idx}`;
        const [sx, sy, sz] = spawnOffsets[idx % spawnOffsets.length];
        const bState = createRivalBot(id, arch, sx, sy, sz, roundNum);
        botsState.push(bState);

        const rig = createRivalCharacterRig(id, arch, textures);
        rig.root.position.set(sx, sy, sz);
        botGroupContainer.add(rig.root);
        botRigs.set(id, rig);
        raycastTargets.push(...rig.hitMeshes);
      });
    };

    const refillAmmoForRound = () => {
      const l = loadoutRef.current;
      ammoInMag = {
        primary: WEAPONS[l.primary].magSize,
        secondary: WEAPONS[l.secondary].magSize,
        melee: 0,
        utility: WEAPONS[l.utility].magSize,
      };
      ammoReserve = {
        primary: WEAPONS[l.primary].reserveAmmo,
        secondary: WEAPONS[l.secondary].reserveAmmo,
        melee: 0,
        utility: 0,
      };
      isReloading = false;
      reloadTimer = 0;
    };

    const startRound = (roundNum: number, playAudio = true) => {
      // Reset player at South Spawn (0, 0, +21) looking North (yaw = 0) along open central sightline
      Object.assign(playerKin, createInitialPlayerKinematics(0, 0, 21, 0));
      playerHp = playerMaxHp;
      ghostHp = playerMaxHp;
      roundTimerSec = 90;
      roundTransitionTimer = 0;
      refillAmmoForRound();
      fpViewmodel.rebuildForWeapon(getWeaponForSlot(activeSlot).id);

      // Clear active projectiles/zones
      for (const p of projectilePool) {
        p.active = false;
        p.mesh.visible = false;
      }

      spawnBotsForRound(roundNum);
      const primaryBot = botsState[0];
      roundBannerText = `ROUND ${roundNum}`;
      roundBannerSub = primaryBot
        ? `VS ${primaryBot.nameKo} (${primaryBot.roleTitle})`
        : 'RIVALS ARENA DUEL';
      bannerClearTimer = 2.4;
      if (playAudio && gameStateRef.current === 'playing') {
        soundFX.playRoundBanner('start');
      }
    };

    const resetEntireMatch = () => {
      matchScore.playerRoundsWon = 0;
      matchScore.rivalRoundsWon = 0;
      matchScore.currentRound = 1;
      matchStats.shotsFired = 0;
      matchStats.shotsHit = 0;
      matchStats.headshots = 0;
      matchStats.totalDamage = 0;
      matchStats.eliminations = 0;
      matchStats.deflectCount = 0;
      matchStats.matchElapsedSec = 0;
      activeSlot = 'primary';
      startRound(1);
    };

    applyLoadoutChangeRef.current = () => {
      refillAmmoForRound();
      fpViewmodel.rebuildForWeapon(getWeaponForSlot(activeSlot).id);
    };

    // Initialize Round 1 on setup
    startRound(1);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 5. Unified Input Hub (Held vs JustPressed Edge Triggers + Focus-Loss Clear)
    const keysHeld = new Set<string>();
    const keysJustPressed = new Set<string>();
    let mouseLeftHeld = false;
    let mouseLeftJustPressed = false;
    let mouseRightHeld = false;
    let mouseRightJustPressed = false;

    const clearAllInputs = () => {
      keysHeld.clear();
      keysJustPressed.clear();
      mouseLeftHeld = false;
      mouseLeftJustPressed = false;
      mouseRightHeld = false;
      mouseRightJustPressed = false;
      isAds = false;
    };

    const switchSlot = (slot: WeaponSlot) => {
      if (activeSlot === slot) return;
      activeSlot = slot;
      isReloading = false;
      reloadTimer = 0;
      isAds = false;
      const w = getWeaponForSlot(slot);
      fpViewmodel.rebuildForWeapon(w.id);
      viewmodelKickZ = 0.08;
    };

    const startReload = () => {
      const w = getWeaponForSlot(activeSlot);
      if (w.magSize <= 0 || isReloading) return;
      if (ammoInMag[activeSlot] >= w.magSize || ammoReserve[activeSlot] <= 0) return;
      isReloading = true;
      reloadDuration = w.reloadTime;
      reloadTimer = w.reloadTime;
      isAds = false;
    };

    const raycaster = new THREE.Raycaster();

    const addFloatingDamage = (worldPos: THREE.Vector3, amount: number, isHeadshot: boolean, isDeflect = false) => {
      _projVec.copy(worldPos).project(camera);
      if (_projVec.z >= -1 && _projVec.z <= 1) {
        const sx = ((_projVec.x + 1) / 2) * 100;
        const sy = ((-_projVec.y + 1) / 2) * 100;
        floatingNumbers.push({
          id: nextDmgId++,
          x: Math.max(8, Math.min(92, sx + (Math.random() - 0.5) * 4)),
          y: Math.max(12, Math.min(85, sy - 3)),
          amount,
          isHeadshot,
          isDeflect,
          age: 0,
        });
        if (floatingNumbers.length > 12) floatingNumbers.shift();
      }
    };

    const damageBot = (
      bot: RivalBotState,
      dmg: number,
      hitPoint: THREE.Vector3,
      isHeadshot: boolean,
      isDeflect = false
    ) => {
      if (bot.hp <= 0) return;
      bot.hp = Math.max(0, bot.hp - dmg);
      bot.hitFlashTimer = 0.065;
      matchStats.totalDamage += dmg;
      if (isHeadshot) matchStats.headshots++;

      const rig = botRigs.get(bot.id);
      if (rig) {
        rig.materialsToFlash.forEach((m) => {
          m.emissive.setHex(isHeadshot ? 0xfacc15 : 0xffffff);
          m.emissiveIntensity = 0.85;
        });
      }

      const killed = bot.hp <= 0;
      if (killed) {
        matchStats.eliminations++;
        hitstopTimer = 0.055; // Crisp sim-level hitstop on elimination
        cameraTrauma = Math.min(1, cameraTrauma + 0.35);
        spawnParticles(hitPoint.x, hitPoint.y, hitPoint.z, 24, isHeadshot ? 0xfacc15 : bot.accentHex, 9.5, 1.35, 0.55);
      } else {
        if (isHeadshot) hitstopTimer = 0.035;
        spawnParticles(hitPoint.x, hitPoint.y, hitPoint.z, isHeadshot ? 14 : 7, isHeadshot ? 0xfacc15 : 0xf43f5e, 6.5, 1.0, 0.32);
      }

      hitmarkerType = killed ? 'kill' : isDeflect ? 'deflect' : isHeadshot ? 'headshot' : 'body';
      hitmarkerTimer = 0.22;
      soundFX.playHitmarker(isHeadshot, killed);
      addFloatingDamage(hitPoint, dmg, isHeadshot, isDeflect);
    };

    const spawnThrowable = (kind: 'frag' | 'molotov' | 'tripmine' | 'flare') => {
      const slot = projectilePool.find((p) => !p.active) || projectilePool[0];
      slot.active = true;
      slot.kind = kind;
      slot.x = camera.position.x;
      slot.y = camera.position.y - 0.15;
      slot.z = camera.position.z;

      camera.getWorldDirection(_vec3A);
      const speed = kind === 'flare' ? 32 : kind === 'tripmine' ? 12 : 20;
      slot.vx = _vec3A.x * speed;
      slot.vy = _vec3A.y * speed + (kind === 'flare' ? 1.5 : 4.8);
      slot.vz = _vec3A.z * speed;
      slot.timer = kind === 'frag' ? 1.55 : kind === 'tripmine' ? 14.0 : 4.0;
      slot.tickTimer = 0;
      slot.radius = kind === 'tripmine' ? 4.2 : 4.5;
      slot.damage = kind === 'tripmine' ? 85 : kind === 'frag' ? 80 : 35;

      const mat = slot.mesh.material as THREE.MeshStandardMaterial;
      const hex =
        kind === 'tripmine'
          ? 0xe879f9
          : kind === 'molotov' || kind === 'flare'
          ? 0xf97316
          : 0x4ade80;
      mat.color.setHex(hex);
      mat.emissive.setHex(hex);
      slot.mesh.scale.set(1, 1, 1);
      slot.mesh.position.set(slot.x, slot.y, slot.z);
      slot.mesh.visible = true;
    };

    const fireEquippedWeapon = () => {
      if (fireCooldown > 0 || isReloading || roundTransitionTimer > 0) return;
      const w = getWeaponForSlot(activeSlot);

      // Check ammo for firearms/utility
      if (w.magSize > 0) {
        if (ammoInMag[activeSlot] <= 0) {
          startReload();
          return;
        }
        ammoInMag[activeSlot] -= 1;
      }

      fireCooldown = w.fireInterval;
      soundFX.playWeaponFire(w.id);

      // Utility actions
      if (w.slot === 'utility') {
        if (w.id === 'medkit') {
          playerHp = Math.min(playerMaxHp, playerHp + 65);
          spawnParticles(playerKin.x, playerKin.y + 1.2, playerKin.z, 18, 0x10b981, 5.0, 1.1, 0.5);
        } else if (w.id === 'grenade') {
          spawnThrowable('frag');
        } else if (w.id === 'molotov') {
          spawnThrowable('molotov');
        } else if (w.id === 'tripmine') {
          spawnThrowable('tripmine');
        }
        viewmodelKickZ = 0.12;
        return;
      }

      if (w.id === 'flare') {
        spawnThrowable('flare');
      }

      // Melee Swing (Katana / Scythe / Fists)
      if (w.slot === 'melee') {
        viewmodelSwingAngle = 0.85;
        viewmodelKickZ = 0.14;
        matchStats.shotsFired++;

        // Wide melee cone check against all bots within w.range
        camera.getWorldDirection(_vec3A);
        let hitAny = false;
        for (const bot of botsState) {
          if (bot.hp <= 0) continue;
          _vec3B.set(bot.x - camera.position.x, (bot.y + 1.2) - camera.position.y, bot.z - camera.position.z);
          const dist = _vec3B.length();
          if (dist <= w.range + 0.8) {
            _vec3B.normalize();
            if (_vec3A.dot(_vec3B) > 0.35 || dist < 2.2) {
              hitAny = true;
              _vec3C.set(bot.x, bot.y + 1.4, bot.z);
              damageBot(bot, w.damage, _vec3C, false);
            }
          }
        }
        if (hitAny) matchStats.shotsHit++;
        return;
      }

      // Hitscan Firearms (AR, Sniper, Shotgun, Burst, Revolver, Uzi)
      matchStats.shotsFired++;
      fpFlashTimer = 0.055;
      fpViewmodel.muzzleFlash.visible = true;
      fpViewmodel.muzzleFlash.rotation.z = Math.random() * Math.PI;
      viewmodelKickZ = Math.min(0.18, viewmodelKickZ + w.recoilKick * 2.2);
      recoilPitchOffset = Math.min(0.12, recoilPitchOffset + w.recoilKick * 0.45);
      cameraTrauma = Math.min(1, cameraTrauma + w.recoilKick * 1.6);

      const effSpread = w.spread * (isAds ? w.adsSpreadMult : 1.0);
      let registeredHitThisTrigger = false;

      for (let p = 0; p < w.pellets; p++) {
        camera.getWorldDirection(_vec3A);
        if (effSpread > 0) {
          _vec3A.x += (Math.random() - 0.5) * effSpread * 2;
          _vec3A.y += (Math.random() - 0.5) * effSpread * 2;
          _vec3A.z += (Math.random() - 0.5) * effSpread * 2;
          _vec3A.normalize();
        }

        raycaster.set(camera.position, _vec3A);
        raycaster.far = w.range;
        const hits = raycaster.intersectObjects(raycastTargets, false);

        if (hits.length > 0) {
          const firstHit = hits[0];
          const uData = firstHit.object.userData as { botId?: string; isHeadshot?: boolean };

          // Update visual tracer beam on first pellet
          if (p === 0) {
            const posAttr = bulletTracer.geometry.getAttribute('position') as THREE.BufferAttribute;
            posAttr.setXYZ(0, camera.position.x + _vec3A.x * 0.6, camera.position.y - 0.12 + _vec3A.y * 0.6, camera.position.z + _vec3A.z * 0.6);
            posAttr.setXYZ(1, firstHit.point.x, firstHit.point.y, firstHit.point.z);
            posAttr.needsUpdate = true;
            bulletTracer.visible = true;
            tracerTimer = 0.055;
          }

          if (uData && uData.botId) {
            const targetBot = botsState.find((b) => b.id === uData.botId);
            if (targetBot && targetBot.hp > 0) {
              registeredHitThisTrigger = true;
              const isHead = Boolean(uData.isHeadshot);
              const dmg = computeShotDamage(w.id, firstHit.distance, isHead);
              damageBot(targetBot, dmg, firstHit.point, isHead);
            }
          } else {
            // Environment spark
            spawnParticles(firstHit.point.x, firstHit.point.y, firstHit.point.z, 4, 0xfef08a, 4.5, 0.75, 0.24);
          }
        } else if (p === 0) {
          const posAttr = bulletTracer.geometry.getAttribute('position') as THREE.BufferAttribute;
          posAttr.setXYZ(0, camera.position.x + _vec3A.x * 0.6, camera.position.y - 0.12, camera.position.z + _vec3A.z * 0.6);
          posAttr.setXYZ(1, camera.position.x + _vec3A.x * 60, camera.position.y + _vec3A.y * 60, camera.position.z + _vec3A.z * 60);
          posAttr.needsUpdate = true;
          bulletTracer.visible = true;
          tracerTimer = 0.045;
        }
      }

      if (registeredHitThisTrigger) {
        matchStats.shotsHit++;
      }

      if (ammoInMag[activeSlot] <= 0 && ammoReserve[activeSlot] > 0) {
        startReload();
      }
    };

    const triggerSpecialOrAds = () => {
      const w = getWeaponForSlot(activeSlot);
      if (w.specialAbility === 'deflect' || w.specialAbility === 'scythe_dash') {
        const res = activateWeaponSpecial(playerKin, w.id);
        if (res === 'deflect') {
          soundFX.playDeflectClang();
        } else if (res === 'scythe_dash') {
          soundFX.playJumpOrSlide(true);
          cameraTrauma = Math.min(1, cameraTrauma + 0.25);
        }
      } else {
        isAds = !isAds;
      }
    };

    simHandleRef.current = {
      switchSlot,
      triggerPrimaryFire: fireEquippedWeapon,
      triggerSpecialAction: triggerSpecialOrAds,
      triggerReload: startReload,
      resetMatch: resetEntireMatch,
    };

    // Event Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
          e.preventDefault();
          onRequestPauseToggleRef.current();
          return;
        }
      }
      if (gameStateRef.current !== 'playing') return;

      if (e.code === 'KeyB') {
        e.preventDefault();
        onToggleLoadoutDrawerRef.current();
        return;
      }

      if (!keysHeld.has(e.code)) {
        keysJustPressed.add(e.code);
      }
      keysHeld.add(e.code);

      if (e.code === 'Digit1') switchSlot('primary');
      else if (e.code === 'Digit2') switchSlot('secondary');
      else if (e.code === 'Digit3') switchSlot('melee');
      else if (e.code === 'Digit4' || e.code === 'KeyG') switchSlot('utility');
      else if (e.code === 'KeyR') startReload();
      else if (e.code === 'KeyF') triggerSpecialOrAds();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;
      // Only lock pointer on real user gesture if not locked
      if (e.isTrusted && !document.pointerLockElement && e.target === renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
      }
      if (e.button === 0) {
        if (!mouseLeftHeld) mouseLeftJustPressed = true;
        mouseLeftHeld = true;
      } else if (e.button === 2) {
        if (!mouseRightHeld) mouseRightJustPressed = true;
        mouseRightHeld = true;
        const w = getWeaponForSlot(activeSlot);
        if (w.specialAbility === 'deflect' || w.specialAbility === 'scythe_dash') {
          triggerSpecialOrAds();
        } else {
          isAds = true;
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseLeftHeld = false;
      else if (e.button === 2) {
        mouseRightHeld = false;
        isAds = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const sensitivity = isAds ? 0.0014 : 0.0024;
      if (document.pointerLockElement === renderer.domElement) {
        playerKin.yaw -= e.movementX * sensitivity;
        playerKin.pitch = Math.max(
          -Math.PI * 0.44,
          Math.min(Math.PI * 0.44, playerKin.pitch - e.movementY * sensitivity)
        );
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onWindowBlur = () => {
      clearAllInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearAllInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    // ResizeObserver for accurate viewport scaling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    // 6. Main Simulation & Render Loop with Software-WebGL afterDraw Pacing
    let frameId = 0;
    let isDisposed = false;
    const clock = new THREE.Clock();
    let titleTourAngle = 0;
    let lastHudEmitTime = 0;

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isDisposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (isDisposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05); // Clamped dt <= 0.05s per game_title_and_hud.md
      const elapsed = clock.elapsedTime;

      const modeState = gameStateRef.current;

      if (modeState === 'title') {
        // Stage Approach 1: Live World Camera Tour / Parallax Pan over the 3D Arena
        fpViewmodel.root.visible = false;
        titleTourAngle += dt * 0.24;
        const camX = Math.sin(titleTourAngle) * 21;
        const camZ = Math.cos(titleTourAngle) * 21 + 2;
        const camY = 8.2 + Math.sin(titleTourAngle * 1.5) * 1.6;
        camera.position.set(camX, camY, camZ);
        camera.lookAt(0, 3.4, 0);

        // Animate idle Rival Champions on the elevated central arena platform (y = 2.8)
        botsState.forEach((b, idx) => {
          const rig = botRigs.get(b.id);
          if (rig) {
            rig.root.position.set((idx - (botsState.length - 1) * 0.5) * 3.2, 2.8, 0);
            rig.root.rotation.y = titleTourAngle + Math.sin(elapsed * 1.5 + idx) * 0.25;
            rig.leftArmPivot.rotation.x = Math.sin(elapsed * 2 + idx) * 0.15;
          }
        });
      } else if (modeState === 'playing') {
        fpViewmodel.root.visible = true;
        matchStats.matchElapsedSec += dt;

        // Tick visual-only timers in real dt even during hitstop
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        }
        const simDt = hitstopTimer > 0 ? 0 : dt;

        cameraTrauma = Math.max(0, cameraTrauma - dt * 1.85);
        recoilPitchOffset *= Math.exp(-14 * dt);
        viewmodelKickZ *= Math.exp(-16 * dt);
        viewmodelSwingAngle *= Math.exp(-14 * dt);

        if (fpFlashTimer > 0) {
          fpFlashTimer -= dt;
          if (fpFlashTimer <= 0) fpViewmodel.muzzleFlash.visible = false;
        }
        if (tracerTimer > 0) {
          tracerTimer -= dt;
          if (tracerTimer <= 0) bulletTracer.visible = false;
        }
        if (hitmarkerTimer > 0) {
          hitmarkerTimer -= dt;
          if (hitmarkerTimer <= 0) hitmarkerType = 'none';
        }
        if (bannerClearTimer > 0) {
          bannerClearTimer -= dt;
          if (bannerClearTimer <= 0) {
            roundBannerText = null;
            roundBannerSub = null;
          }
        }

        // Smoothly trail ghostHp behind actual playerHp
        if (ghostHp > playerHp) {
          ghostHp = Math.max(playerHp, ghostHp - 28 * dt);
        } else {
          ghostHp = playerHp;
        }

        // Keyboard Camera Look Fallback (Arrow keys / Q & E so non-PointerLock & Playwright tests can aim smoothly)
        const turnSpeed = 2.1;
        if (keysHeld.has('ArrowLeft') || keysHeld.has('KeyQ')) playerKin.yaw += turnSpeed * dt;
        if (keysHeld.has('ArrowRight') || keysHeld.has('KeyE')) playerKin.yaw -= turnSpeed * dt;
        if (keysHeld.has('ArrowUp')) playerKin.pitch = Math.min(0.75, playerKin.pitch + 1.3 * dt);
        if (keysHeld.has('ArrowDown')) playerKin.pitch = Math.max(-0.75, playerKin.pitch - 1.3 * dt);

        if (simDt > 0) {
          // Step Player Kinematics
          const moveForward = (keysHeld.has('KeyW') ? 1 : 0) - (keysHeld.has('KeyS') ? 1 : 0);
          const moveRight = (keysHeld.has('KeyD') ? 1 : 0) - (keysHeld.has('KeyA') ? 1 : 0);
          const jumpJust = keysJustPressed.has('Space');
          const jumpHeld = keysHeld.has('Space');
          const slideJust =
            keysJustPressed.has('KeyC') ||
            keysJustPressed.has('ControlLeft') ||
            keysJustPressed.has('ControlRight');

          const activeWeapon = getWeaponForSlot(activeSlot);
          const kinEvents = stepPlayerKinematics(
            playerKin,
            {
              moveForward,
              moveRight,
              sprintHeld: keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight'),
              jumpJustPressed: jumpJust,
              jumpHeld,
              slideJustPressed: slideJust,
              equippedWeaponId: activeWeapon.id,
            },
            simDt,
            colliders,
            ramps
          );

          if (kinEvents.jumped) soundFX.playJumpOrSlide(false);
          if (kinEvents.startedSlide) soundFX.playJumpOrSlide(true);

          // Check Jump Pads
          for (const pad of jumpPads) {
            if (Math.hypot(playerKin.x - pad.x, playerKin.z - pad.z) < 1.75 && playerKin.y < 1.2) {
              playerKin.vy = 16.5;
              playerKin.grounded = false;
              soundFX.playJumpOrSlide(false);
              spawnParticles(pad.x, pad.y + 0.3, pad.z, 12, 0x38bdf8, 6.0, 1.0, 0.4);
            }
          }

          // Weapon Reload & Fire Cooldowns
          fireCooldown = Math.max(0, fireCooldown - simDt);
          if (isReloading) {
            reloadTimer -= simDt;
            if (reloadTimer <= 0) {
              isReloading = false;
              const needed = activeWeapon.magSize - ammoInMag[activeSlot];
              const taken = Math.min(needed, ammoReserve[activeSlot]);
              ammoInMag[activeSlot] += taken;
              ammoReserve[activeSlot] -= taken;
            }
          }

          // Trigger Fire (One-shot edge vs Automatic held)
          const wantsFire = activeWeapon.automatic ? mouseLeftHeld : mouseLeftJustPressed;
          if (wantsFire) {
            fireEquippedWeapon();
          }

          // Update Throwables & Hazard Zones
          for (const p of projectilePool) {
            if (!p.active) continue;
            p.timer -= simDt;

            if (p.kind === 'fire_zone') {
              p.tickTimer -= simDt;
              p.mesh.rotation.y += simDt * 2.5;
              if (p.tickTimer <= 0) {
                p.tickTimer = 0.35;
                spawnParticles(p.x + (Math.random() - 0.5) * 3, p.y + 0.2, p.z + (Math.random() - 0.5) * 3, 4, 0xf97316, 3.5, 1.1, 0.35);
                for (const b of botsState) {
                  if (b.hp > 0 && Math.hypot(b.x - p.x, b.z - p.z) <= p.radius) {
                    _vec3C.set(b.x, b.y + 1.2, b.z);
                    damageBot(b, 12, _vec3C, false);
                  }
                }
              }
              if (p.timer <= 0) {
                p.active = false;
                p.mesh.visible = false;
              }
              continue;
            }

            // Integrate flying projectile
            p.vy -= 18.0 * simDt;
            p.x += p.vx * simDt;
            p.y += p.vy * simDt;
            p.z += p.vz * simDt;

            if (p.y <= 0.18) {
              p.y = 0.18;
              if (p.kind === 'molotov' || p.kind === 'flare') {
                // Convert into burning ground zone
                p.kind = 'fire_zone';
                p.vx = 0;
                p.vy = 0;
                p.vz = 0;
                p.timer = 4.2;
                p.tickTimer = 0.1;
                p.mesh.scale.set(12, 0.25, 12);
                soundFX.playExplosion(false);
                spawnParticles(p.x, p.y + 0.3, p.z, 18, 0xf97316, 7.5, 1.2, 0.5);
              } else if (p.kind === 'tripmine') {
                // Settle on floor and arm proximity trigger
                p.vx = 0;
                p.vy = 0;
                p.vz = 0;
                for (const b of botsState) {
                  if (b.hp > 0 && Math.hypot(b.x - p.x, b.z - p.z) <= p.radius) {
                    p.timer = 0; // Detonate!
                  }
                }
              } else {
                // Frag bounce
                p.vy = Math.abs(p.vy) * 0.45;
                p.vx *= 0.65;
                p.vz *= 0.65;
              }
            }

            p.mesh.position.set(p.x, p.y, p.z);

            if (p.timer <= 0) {
              // Detonate Frag or Subspace Tripmine!
              const isSubspace = p.kind === 'tripmine';
              soundFX.playExplosion(isSubspace);
              cameraTrauma = Math.min(1, cameraTrauma + 0.42);
              spawnParticles(p.x, p.y + 0.4, p.z, 26, isSubspace ? 0xe879f9 : 0xf97316, 11.0, 1.4, 0.55);

              for (const b of botsState) {
                if (b.hp <= 0) continue;
                const dBot = Math.hypot(b.x - p.x, b.z - p.z);
                if (dBot <= p.radius + 1.5) {
                  const falloff = Math.max(0.35, 1 - dBot / (p.radius + 2.0));
                  _vec3C.set(b.x, b.y + 1.3, b.z);
                  damageBot(b, Math.round(p.damage * falloff), _vec3C, false);
                }
              }

              // Grenade Jump impulse if player is close!
              const dPlayer = Math.hypot(playerKin.x - p.x, playerKin.z - p.z);
              if (dPlayer < 5.5) {
                playerKin.vy = Math.max(playerKin.vy, 13.5);
                playerKin.grounded = false;
              }

              p.active = false;
              p.mesh.visible = false;
            }
          }

          // Step Rival Bots AI & Attack Telegraphs
          if (roundTransitionTimer <= 0) {
            const diff = getDifficultyForRound(matchScore.currentRound, gameModeRef.current);
            const botOut = stepRivalBots(
              botsState,
              { x: playerKin.x, y: playerKin.y, z: playerKin.z },
              simDt,
              diff,
              colliders,
              ramps
            );

            for (const wId of botOut.windupStartedIds) {
              const b = botsState.find((bot) => bot.id === wId);
              if (b) soundFX.playTelegraphWarning(b.archetype);
            }

            for (const atk of botOut.attacks) {
              const attacker = botsState.find((b) => b.id === atk.botId);
              const rig = botRigs.get(atk.botId);
              if (rig) {
                rig.muzzleFlash.visible = true;
                setTimeout(() => {
                  rig.muzzleFlash.visible = false;
                }, 60);
              }

              // Check if Player Katana Deflect is active!
              if (playerKin.deflectTimer > 0 && attacker && attacker.hp > 0) {
                matchStats.deflectCount++;
                soundFX.playDeflectClang();
                hitstopTimer = 0.045;
                _vec3C.set(attacker.x, attacker.y + 1.5, attacker.z);
                damageBot(attacker, Math.round(atk.damage * 1.35), _vec3C, false, true);
                continue;
              }

              // Check line-of-sight or distance dodging so player movement/sliding can evade telegraphed shots
              const dodgeSpeed = Math.hypot(playerKin.vx, playerKin.vz);
              const distFromTarget = Math.hypot(playerKin.x - atk.targetX, playerKin.z - atk.targetZ);
              const evaded = playerKin.isSliding || distFromTarget > 2.2 || (dodgeSpeed > 10.5 && Math.random() < 0.45);

              if (!evaded) {
                playerHp = Math.max(0, playerHp - atk.damage);
                cameraTrauma = Math.min(1, cameraTrauma + 0.32);
                soundFX.playPlayerHurt();
              }
            }
          }

          // Round Timer & Round Win / Loss Evaluation
          if (roundTransitionTimer <= 0) {
            roundTimerSec = Math.max(0, roundTimerSec - simDt);
            const allBotsEliminated = botsState.length > 0 && botsState.every((b) => b.hp <= 0);

            if (allBotsEliminated) {
              matchScore.playerRoundsWon++;
              matchScore.winStreak++;
              roundTransitionTimer = 2.4;
              roundBannerText = 'ROUND WON!';
              roundBannerSub = `라이벌 제압 완료 · 스코어 ${matchScore.playerRoundsWon} : ${matchScore.rivalRoundsWon}`;
              bannerClearTimer = 2.3;
              soundFX.playRoundBanner('win');
            } else if (playerHp <= 0 || roundTimerSec <= 0) {
              matchScore.rivalRoundsWon++;
              matchScore.winStreak = 0;
              roundTransitionTimer = 2.4;
              roundBannerText = 'ROUND LOST';
              roundBannerSub = `다음 라운드 정비 · 스코어 ${matchScore.playerRoundsWon} : ${matchScore.rivalRoundsWon}`;
              bannerClearTimer = 2.3;
              soundFX.playRoundBanner('lose');
            }
          } else {
            roundTransitionTimer -= simDt;
            if (roundTransitionTimer <= 0) {
              const outcome = checkMatchOutcome(matchScore);
              if (outcome !== 'ongoing') {
                onMatchEndRef.current(outcome, buildHudSnapshot());
              } else {
                matchScore.currentRound++;
                startRound(matchScore.currentRound);
              }
            }
          }
        }

        // Update 3D Bot Rigs (Gait Cycle, Hit Flash Recovery, KO Topple, Telegraph Ring & Laser)
        for (const bot of botsState) {
          const rig = botRigs.get(bot.id);
          if (!rig) continue;

          if (bot.hitFlashTimer <= 0) {
            rig.materialsToFlash.forEach((m) => {
              m.emissiveIntensity = 0;
            });
          }

          rig.root.position.set(bot.x, bot.y, bot.z);
          rig.root.rotation.y = bot.yaw;

          if (bot.hp <= 0) {
            // KO Topple transition (0.4s backward fall)
            const topple = Math.min(1, bot.koTimer / 0.35);
            rig.bodyGroup.rotation.x = -topple * (Math.PI * 0.46);
            rig.bodyGroup.position.y = topple * 0.25;
            rig.telegraphRing.visible = false;
            rig.laserLine.visible = false;
          } else {
            rig.bodyGroup.rotation.x = 0;
            rig.bodyGroup.position.y = Math.abs(Math.sin(bot.gaitPhase)) * 0.06;
            const swing = Math.sin(bot.gaitPhase) * 0.55;
            rig.leftLegPivot.rotation.x = swing;
            rig.rightLegPivot.rotation.x = -swing;
            rig.leftArmPivot.rotation.x = -swing * 0.5;

            if (bot.state === 'windup') {
              rig.telegraphRing.visible = true;
              const pulse = 0.8 + Math.sin(elapsed * 22) * 0.25;
              rig.telegraphRing.scale.set(pulse, pulse, 1);

              // Laser line aimed toward locked target
              rig.laserLine.visible = true;
              const lAttr = rig.laserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
              lAttr.setXYZ(0, 0, 1.45, 0);
              // Transform world target into bot local space
              _vec3A.set(bot.targetX - bot.x, bot.targetY - bot.y, bot.targetZ - bot.z);
              _vec3A.applyAxisAngle(_vec3B.set(0, 1, 0), -bot.yaw);
              lAttr.setXYZ(1, _vec3A.x, _vec3A.y, _vec3A.z);
              lAttr.needsUpdate = true;
            } else {
              rig.telegraphRing.visible = false;
              rig.laserLine.visible = false;
            }
          }
        }

        // Update Camera Position, Slide Height, Squash, Trauma Shake & ADS FOV
        const targetEyeH = playerKin.isSliding ? PLAYER_SLIDE_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
        const bobOffset =
          playerKin.grounded && !playerKin.isSliding
            ? Math.sin(playerKin.gaitPhase) * 0.042
            : 0;
        camera.position.set(
          playerKin.x,
          playerKin.y + targetEyeH * playerKin.squashY + bobOffset,
          playerKin.z
        );

        const shakeMag = cameraTrauma * cameraTrauma * 0.045;
        const shakeYaw = (Math.random() - 0.5) * shakeMag;
        const shakePitch = (Math.random() - 0.5) * shakeMag;
        const slideRoll = playerKin.isSliding ? -0.055 : 0;

        _euler.set(
          playerKin.pitch + recoilPitchOffset + shakePitch,
          playerKin.yaw + shakeYaw,
          slideRoll,
          'YXZ'
        );
        camera.quaternion.setFromEuler(_euler);

        // Smooth FOV Damping (ADS Zoom vs Slide/Sprint Speed Widening)
        const activeWeapon = getWeaponForSlot(activeSlot);
        const baseFov = playerKin.isSliding || playerKin.dashTimer > 0 ? 84 : 75;
        const targetFov = isAds ? activeWeapon.adsFov : baseFov;
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 14, dt);
        camera.updateProjectionMatrix();

        // Update First-Person Viewmodel Sway, ADS Centering, Reload Tilt & Deflect Shield
        const adsX = isAds ? -0.22 : 0;
        const adsY = isAds ? 0.055 : 0;
        const swayX = Math.cos(playerKin.gaitPhase * 0.5) * (isAds ? 0.003 : 0.014);
        const swayY = Math.abs(Math.sin(playerKin.gaitPhase)) * (isAds ? 0.003 : 0.016);
        fpViewmodel.weaponPivot.position.set(
          THREE.MathUtils.damp(fpViewmodel.weaponPivot.position.x, adsX + swayX, 16, dt),
          THREE.MathUtils.damp(fpViewmodel.weaponPivot.position.y, adsY - swayY, 16, dt),
          viewmodelKickZ
        );

        const reloadTilt = isReloading ? -0.55 : 0;
        fpViewmodel.weaponPivot.rotation.set(
          reloadTilt - viewmodelSwingAngle,
          viewmodelSwingAngle * 0.45,
          isReloading ? 0.35 : 0
        );

        fpViewmodel.deflectShield.visible = playerKin.deflectTimer > 0;
        if (playerKin.deflectTimer > 0) {
          fpViewmodel.deflectShield.rotation.z = elapsed * 12;
        }
      }

      // Update Pooled Instanced Particles
      let anyParticleUpdated = false;
      for (let i = 0; i < PARTICLE_CAP; i++) {
        if (!partActive[i]) continue;
        anyParticleUpdated = true;
        partLife[i] -= dt;
        if (partLife[i] <= 0) {
          partActive[i] = 0;
          _mat4.makeScale(0, 0, 0);
          particleMesh.setMatrixAt(i, _mat4);
          continue;
        }
        const i3 = i * 3;
        partVel[i3 + 1] -= 15.0 * dt;
        partPos[i3] += partVel[i3] * dt;
        partPos[i3 + 1] = Math.max(0.05, partPos[i3 + 1] + partVel[i3 + 1] * dt);
        partPos[i3 + 2] += partVel[i3 + 2] * dt;

        const s = (partLife[i] / partMaxLife[i]) * partSize[i];
        _vec3A.set(partPos[i3], partPos[i3 + 1], partPos[i3 + 2]);
        _quat.identity();
        _scaleVec.set(s, s, s);
        _mat4.compose(_vec3A, _quat, _scaleVec);
        particleMesh.setMatrixAt(i, _mat4);
      }
      if (anyParticleUpdated) {
        particleMesh.instanceMatrix.needsUpdate = true;
      }

      // Age Floating Damage Numbers
      if (floatingNumbers.length > 0) {
        floatingNumbers.forEach((fn) => {
          fn.age += dt;
          fn.y -= dt * 14;
        });
        floatingNumbers = floatingNumbers.filter((fn) => fn.age < 0.75);
      }

      // Clear single-frame edge triggers
      keysJustPressed.clear();
      mouseLeftJustPressed = false;
      mouseRightJustPressed = false;

      // Render Scene
      renderer.render(scene, camera);

      // Throttle React HUD Snapshot Updates (~15Hz)
      if (elapsed - lastHudEmitTime >= 0.065) {
        lastHudEmitTime = elapsed;
        onHudUpdateRef.current(buildHudSnapshot());
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    function buildHudSnapshot(): LiveHudSnapshot {
      const w = getWeaponForSlot(activeSlot);
      const overheads: BotHudOverhead[] = botsState.map((b) => {
        _projVec.set(b.x, b.y + 2.35, b.z).project(camera);
        const inFront = _projVec.z >= -1 && _projVec.z <= 1;
        return {
          id: b.id,
          nameKo: b.nameKo,
          nameEn: b.nameEn,
          roleTitle: b.roleTitle,
          hp: Math.max(0, Math.round(b.hp)),
          maxHp: b.maxHp,
          screenX: ((_projVec.x + 1) / 2) * 100,
          screenY: ((-_projVec.y + 1) / 2) * 100,
          visible:
            inFront &&
            b.hp > 0 &&
            _projVec.x >= -0.95 &&
            _projVec.x <= 0.95 &&
            _projVec.y >= -0.95 &&
            _projVec.y <= 0.95,
          isWindup: b.state === 'windup',
          accentHex: b.accentHex,
        };
      });

      let specialRatio = 1;
      if (w.specialAbility === 'deflect' && w.specialCooldown) {
        specialRatio = 1 - playerKin.deflectCooldown / w.specialCooldown;
      } else if (w.specialAbility === 'scythe_dash' && w.specialCooldown) {
        specialRatio = 1 - playerKin.dashCooldown / w.specialCooldown;
      }

      return {
        hp: Math.max(0, Math.round(playerHp)),
        maxHp: playerMaxHp,
        ghostHp: Math.max(0, Math.round(ghostHp)),
        activeSlot,
        activeWeaponId: w.id,
        ammoInMag: { ...ammoInMag },
        ammoReserve: { ...ammoReserve },
        isReloading,
        reloadProgress: isReloading ? Math.max(0, 1 - reloadTimer / reloadDuration) : 0,
        isAds,
        isSliding: playerKin.isSliding,
        deflectActive: playerKin.deflectTimer > 0,
        specialCooldownRatio: Math.max(0, Math.min(1, specialRatio)),
        roundTimerSec: Math.ceil(roundTimerSec),
        playerRoundsWon: matchScore.playerRoundsWon,
        rivalRoundsWon: matchScore.rivalRoundsWon,
        targetRoundsToWin: matchScore.targetRoundsToWin,
        currentRound: matchScore.currentRound,
        winStreak: matchScore.winStreak,
        roundBannerText,
        roundBannerSub,
        hitmarkerType,
        damageNumbers: [...floatingNumbers],
        botOverheads: overheads,
        playerPos: { x: playerKin.x, z: playerKin.z, yaw: playerKin.yaw },
        botPositions: botsState.map((b) => ({
          x: b.x,
          z: b.z,
          hp: b.hp,
          archetype: b.archetype,
        })),
        stats: { ...matchStats },
      };
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950"
      aria-label="RIVALS 3D Arena Viewport"
    />
  );
};
