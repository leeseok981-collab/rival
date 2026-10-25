import { WEAPONS, WeaponId } from './weapons';

export type MapId = 'arena' | 'docks' | 'construction';
export type GameMode = 'duel_1v1' | 'squad_arena';
export type RivalArchetypeId = 'striker' | 'phantom' | 'demolisher';

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface RampSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  startY: number;
  endY: number;
  axis: 'z+' | 'z-' | 'x+' | 'x-';
}

export interface PlayerKinematicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  isSliding: boolean;
  slideTimer: number;
  slideCooldown: number;
  slideDirX: number;
  slideDirZ: number;
  airJumpsLeft: number;
  dashTimer: number;
  dashCooldown: number;
  deflectTimer: number;
  deflectCooldown: number;
  gaitPhase: number;
  squashY: number;
}

export interface RivalBotState {
  id: string;
  archetype: RivalArchetypeId;
  nameKo: string;
  nameEn: string;
  roleTitle: string;
  accentHex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  state: 'patrol' | 'chase' | 'flank' | 'kite' | 'windup' | 'recover' | 'ko';
  stateTimer: number;
  windupDuration: number;
  attackCooldown: number;
  hasAttackToken: boolean;
  strafeSign: number;
  strafeFlipTimer: number;
  hitFlashTimer: number;
  koTimer: number;
  gaitPhase: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export interface DifficultyConfig {
  roundNumber: number;
  speedMultiplier: number;
  cooldownMultiplier: number;
  windupDuration: number;
  damageMultiplier: number;
  maxConcurrentAttackers: number;
  botCount: number;
  archetypes: RivalArchetypeId[];
}

export const PLAYER_RADIUS = 0.52;
export const PLAYER_EYE_HEIGHT = 1.68;
export const PLAYER_SLIDE_EYE_HEIGHT = 0.92;
export const GRAVITY = 25.0;
export const BASE_MOVE_SPEED = 9.2;
export const SPRINT_MULTIPLIER = 1.32;
export const JUMP_VELOCITY = 9.8;
export const SLIDE_DURATION = 0.62;
export const SLIDE_BOOST_SPEED = 15.8;

export function createInitialPlayerKinematics(spawnX = 0, spawnY = 0, spawnZ = 22, yaw = 0): PlayerKinematicsState {
  return {
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    pitch: 0,
    grounded: true,
    coyoteTimer: 0.1,
    jumpBufferTimer: 0,
    isSliding: false,
    slideTimer: 0,
    slideCooldown: 0,
    slideDirX: 0,
    slideDirZ: 0,
    airJumpsLeft: 1,
    dashTimer: 0,
    dashCooldown: 0,
    deflectTimer: 0,
    deflectCooldown: 0,
    gaitPhase: 0,
    squashY: 1,
  };
}

/**
 * Computes ground elevation at (x, z) taking into account ramps and elevated platforms.
 */
export function getSupportHeightAt(
  x: number,
  currentY: number,
  z: number,
  colliders: AABB[],
  ramps: RampSurface[]
): number {
  let highestSupport = 0;

  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    if (x >= r.minX - PLAYER_RADIUS * 0.5 && x <= r.maxX + PLAYER_RADIUS * 0.5 &&
        z >= r.minZ - PLAYER_RADIUS * 0.5 && z <= r.maxZ + PLAYER_RADIUS * 0.5) {
      let t = 0;
      if (r.axis === 'z+') {
        t = (z - r.minZ) / Math.max(0.001, r.maxZ - r.minZ);
      } else if (r.axis === 'z-') {
        t = (r.maxZ - z) / Math.max(0.001, r.maxZ - r.minZ);
      } else if (r.axis === 'x+') {
        t = (x - r.minX) / Math.max(0.001, r.maxX - r.minX);
      } else {
        t = (r.maxX - x) / Math.max(0.001, r.maxX - r.minX);
      }
      t = Math.max(0, Math.min(1, t));
      const rampY = r.startY + (r.endY - r.startY) * t;
      if (currentY + 0.85 >= rampY && rampY > highestSupport) {
        highestSupport = rampY;
      }
    }
  }

  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (
      x + PLAYER_RADIUS * 0.75 > b.minX &&
      x - PLAYER_RADIUS * 0.75 < b.maxX &&
      z + PLAYER_RADIUS * 0.75 > b.minZ &&
      z - PLAYER_RADIUS * 0.75 < b.maxZ
    ) {
      // Only treat top of block as walkable support if player feet are near or above it
      if (currentY + 0.65 >= b.maxY && b.maxY > highestSupport) {
        highestSupport = b.maxY;
      }
    }
  }

  return highestSupport;
}

/**
 * Resolves horizontal circle-vs-AABB collisions at the player's current height.
 */
export function resolveHorizontalCollisions(
  x: number,
  y: number,
  z: number,
  radius: number,
  colliders: AABB[],
  arenaHalfExtent = 34
): { x: number; z: number } {
  let rx = Math.max(-arenaHalfExtent, Math.min(arenaHalfExtent, x));
  let rz = Math.max(-arenaHalfExtent, Math.min(arenaHalfExtent, z));

  const bodyMinY = y + 0.35;
  const bodyMaxY = y + 1.6;

  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (bodyMaxY <= b.minY || bodyMinY >= b.maxY) continue;

    const closestX = Math.max(b.minX, Math.min(rx, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(rz, b.maxZ));
    const dx = rx - closestX;
    const dz = rz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        rx += (dx / dist) * overlap;
        rz += (dz / dist) * overlap;
      } else {
        // Inside AABB: push out along shallowest axis
        const penLeft = Math.abs(rx - b.minX);
        const penRight = Math.abs(b.maxX - rx);
        const penFront = Math.abs(rz - b.minZ);
        const penBack = Math.abs(b.maxZ - rz);
        const minPen = Math.min(penLeft, penRight, penFront, penBack);
        if (minPen === penLeft) rx = b.minX - radius;
        else if (minPen === penRight) rx = b.maxX + radius;
        else if (minPen === penFront) rz = b.minZ - radius;
        else rz = b.maxZ + radius;
      }
    }
  }

  return { x: rx, z: rz };
}

export interface StepInput {
  moveForward: number; // -1 to 1 (W = +1, S = -1)
  moveRight: number;   // -1 to 1 (D = +1, A = -1)
  sprintHeld: boolean;
  jumpJustPressed: boolean;
  jumpHeld: boolean;
  slideJustPressed: boolean;
  equippedWeaponId: WeaponId;
}

/**
 * Advances player kinematics by clamped simDt with coyote time, jump buffering,
 * slide boosts, slide-jumps, and AABB/ramp collision resolution.
 */
export function stepPlayerKinematics(
  state: PlayerKinematicsState,
  input: StepInput,
  simDt: number,
  colliders: AABB[],
  ramps: RampSurface[]
): { jumped: boolean; landed: boolean; startedSlide: boolean } {
  const dt = Math.min(Math.max(simDt, 0), 0.05);
  const weapon = WEAPONS[input.equippedWeaponId] || WEAPONS.ar;

  let jumped = false;
  let landed = false;
  let startedSlide = false;

  // Cooldowns
  state.slideCooldown = Math.max(0, state.slideCooldown - dt);
  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.deflectCooldown = Math.max(0, state.deflectCooldown - dt);
  state.deflectTimer = Math.max(0, state.deflectTimer - dt);
  state.dashTimer = Math.max(0, state.dashTimer - dt);

  if (input.jumpJustPressed) {
    state.jumpBufferTimer = 0.12;
  } else {
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  }

  if (state.grounded) {
    state.coyoteTimer = 0.10;
    state.airJumpsLeft = weapon.specialAbility === 'double_jump' ? 1 : 0;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  }

  // Forward and Right unit vectors in XZ plane (Three.js: forward is -sin(yaw), -cos(yaw))
  const fwdX = -Math.sin(state.yaw);
  const fwdZ = -Math.cos(state.yaw);
  const rightX = Math.cos(state.yaw);
  const rightZ = -Math.sin(state.yaw);

  let wishX = fwdX * input.moveForward + rightX * input.moveRight;
  let wishZ = fwdZ * input.moveForward + rightZ * input.moveRight;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-4) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  // Initiate Slide (C / Ctrl while moving)
  if (
    input.slideJustPressed &&
    !state.isSliding &&
    state.slideCooldown <= 0 &&
    state.grounded &&
    wishLen > 0.1
  ) {
    state.isSliding = true;
    state.slideTimer = SLIDE_DURATION;
    state.slideCooldown = 0.85;
    state.slideDirX = wishX;
    state.slideDirZ = wishZ;
    state.vx = wishX * SLIDE_BOOST_SPEED * weapon.speedMult;
    state.vz = wishZ * SLIDE_BOOST_SPEED * weapon.speedMult;
    startedSlide = true;
  }

  if (state.isSliding) {
    state.slideTimer -= dt;
    const slideDecay = Math.max(0.35, state.slideTimer / SLIDE_DURATION);
    const currentSlideSpeed = SLIDE_BOOST_SPEED * slideDecay * weapon.speedMult;
    state.vx = state.slideDirX * currentSlideSpeed;
    state.vz = state.slideDirZ * currentSlideSpeed;
    if (state.slideTimer <= 0 || !state.grounded) {
      state.isSliding = false;
    }
  } else if (state.dashTimer <= 0) {
    const sprintMult = input.sprintHeld && input.moveForward > 0 ? SPRINT_MULTIPLIER : 1.0;
    const targetSpeed = BASE_MOVE_SPEED * weapon.speedMult * sprintMult * (wishLen > 0.05 ? 1 : 0);
    const targetVx = wishX * targetSpeed;
    const targetVz = wishZ * targetSpeed;
    const accel = state.grounded ? 18.0 : 7.5;
    const blend = 1 - Math.exp(-accel * dt);
    state.vx += (targetVx - state.vx) * blend;
    state.vz += (targetVz - state.vz) * blend;
  }

  // Jump (Grounded / Coyote Time / Slide-Jump / Double-Jump)
  if (state.jumpBufferTimer > 0) {
    if (state.coyoteTimer > 0) {
      const wasSliding = state.isSliding;
      state.vy = wasSliding ? JUMP_VELOCITY * 1.12 : JUMP_VELOCITY;
      if (wasSliding) {
        // Slide-jump preserves boosted horizontal speed!
        state.vx = state.slideDirX * SLIDE_BOOST_SPEED * 1.05;
        state.vz = state.slideDirZ * SLIDE_BOOST_SPEED * 1.05;
        state.isSliding = false;
      }
      state.grounded = false;
      state.coyoteTimer = 0;
      state.jumpBufferTimer = 0;
      state.squashY = 1.18;
      jumped = true;
    } else if (state.airJumpsLeft > 0) {
      state.vy = JUMP_VELOCITY * 0.96;
      state.airJumpsLeft -= 1;
      state.jumpBufferTimer = 0;
      state.squashY = 1.15;
      jumped = true;
    }
  }

  // Variable Jump Cut when releasing Space early while ascending
  if (!input.jumpHeld && state.vy > 2.5) {
    state.vy *= Math.pow(0.45, dt * 12);
  }

  // Apply Gravity
  state.vy -= GRAVITY * dt;

  // Integrate Position
  const nextX = state.x + state.vx * dt;
  const nextZ = state.z + state.vz * dt;
  const resolvedXZ = resolveHorizontalCollisions(nextX, state.y, nextZ, PLAYER_RADIUS, colliders);

  const horizDist = Math.hypot(resolvedXZ.x - state.x, resolvedXZ.z - state.z);
  state.x = resolvedXZ.x;
  state.z = resolvedXZ.z;

  if (state.grounded && !state.isSliding) {
    state.gaitPhase += horizDist * 2.1;
  }

  const prevGrounded = state.grounded;
  state.y += state.vy * dt;

  const supportY = getSupportHeightAt(state.x, state.y, state.z, colliders, ramps);
  if (state.y <= supportY) {
    if (!prevGrounded && state.vy < -3.0) {
      landed = true;
      state.squashY = 0.80;
    }
    state.y = supportY;
    state.vy = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  // Exponentially damp squashY back to 1
  state.squashY += (1 - state.squashY) * (1 - Math.exp(-14 * dt));

  return { jumped, landed, startedSlide };
}

/**
 * Triggers Scythe Shadow Dash or Katana Deflect ability.
 */
export function activateWeaponSpecial(state: PlayerKinematicsState, weaponId: WeaponId): 'deflect' | 'scythe_dash' | null {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return null;

  if (weapon.specialAbility === 'deflect' && state.deflectCooldown <= 0) {
    state.deflectTimer = 0.85;
    state.deflectCooldown = weapon.specialCooldown ?? 4.0;
    return 'deflect';
  }

  if (weapon.specialAbility === 'scythe_dash' && state.dashCooldown <= 0) {
    const dirX = -Math.sin(state.yaw) * Math.cos(state.pitch);
    const dirY = Math.max(0.22, Math.sin(state.pitch) + 0.18);
    const dirZ = -Math.cos(state.yaw) * Math.cos(state.pitch);
    state.vx = dirX * 19.5;
    state.vy = dirY * 13.5;
    state.vz = dirZ * 19.5;
    state.grounded = false;
    state.dashTimer = 0.28;
    state.dashCooldown = weapon.specialCooldown ?? 4.2;
    return 'scythe_dash';
  }

  return null;
}

/**
 * Computes weapon hit damage with headshot multiplier and distance falloff.
 */
export function computeShotDamage(
  weaponId: WeaponId,
  distance: number,
  isHeadshot: boolean
): number {
  const w = WEAPONS[weaponId];
  if (!w) return 0;

  let falloff = 1.0;
  if (w.id === 'shotgun') {
    falloff = distance <= 10 ? 1.0 : Math.max(0.25, 1.0 - (distance - 10) / 32);
  } else if (w.id === 'uzi') {
    falloff = distance <= 18 ? 1.0 : Math.max(0.45, 1.0 - (distance - 18) / 50);
  } else if (w.id === 'ar' || w.id === 'revolver' || w.id === 'burst') {
    falloff = distance <= 35 ? 1.0 : Math.max(0.65, 1.0 - (distance - 35) / 95);
  }

  const raw = w.damage * falloff * (isHeadshot ? w.headshotMult : 1.0);
  return Math.max(1, Math.round(raw));
}

/**
 * Computes difficulty parameters for a given round (1-based) and game mode.
 * Scales challenge across play time using 4 knobs:
 * 1) Movement speed multiplier
 * 2) Attack cooldown multiplier
 * 3) Windup duration
 * 4) Archetype composition & bot budget
 */
export function getDifficultyForRound(roundNumber: number, mode: GameMode): DifficultyConfig {
  const clampedRound = Math.max(1, roundNumber);
  const progress = Math.min(1, (clampedRound - 1) / 6);

  const allArchetypes: RivalArchetypeId[] = ['striker', 'phantom', 'demolisher'];
  let archetypes: RivalArchetypeId[];

  if (mode === 'duel_1v1') {
    // Rotate specialist rival each round so player faces all 3 distinct archetypes
    archetypes = [allArchetypes[(clampedRound - 1) % allArchetypes.length]];
  } else {
    // Squad Arena spawns multiple distinct archetypes simultaneously
    if (clampedRound === 1) {
      archetypes = ['striker', 'phantom'];
    } else {
      archetypes = ['striker', 'phantom', 'demolisher'];
    }
  }

  return {
    roundNumber: clampedRound,
    speedMultiplier: 0.92 + progress * 0.28,
    cooldownMultiplier: 1.15 - progress * 0.32,
    windupDuration: Math.max(0.38, 0.62 - progress * 0.18),
    damageMultiplier: 0.88 + progress * 0.27,
    maxConcurrentAttackers: mode === 'duel_1v1' ? 1 : 2,
    botCount: archetypes.length,
    archetypes,
  };
}

export function createRivalBot(
  id: string,
  archetype: RivalArchetypeId,
  x: number,
  y: number,
  z: number,
  roundNumber = 1
): RivalBotState {
  const hpBonus = Math.min(40, (roundNumber - 1) * 8);
  if (archetype === 'striker') {
    return {
      id,
      archetype,
      nameKo: '스트라이커',
      nameEn: 'STRIKER',
      roleTitle: '근접 돌격 · 산탄총 & 카타나',
      accentHex: 0xf43f5e,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      hp: 125 + hpBonus,
      maxHp: 125 + hpBonus,
      state: 'flank',
      stateTimer: 0,
      windupDuration: 0.45,
      attackCooldown: 1.1,
      hasAttackToken: false,
      strafeSign: 1,
      strafeFlipTimer: 1.5,
      hitFlashTimer: 0,
      koTimer: 0,
      gaitPhase: 0,
      targetX: x,
      targetY: y,
      targetZ: z,
    };
  }
  if (archetype === 'phantom') {
    return {
      id,
      archetype,
      nameKo: '팬텀',
      nameEn: 'PHANTOM',
      roleTitle: '원거리 저격 · 레이저 조준 사격',
      accentHex: 0xa855f7,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      hp: 105 + hpBonus,
      maxHp: 105 + hpBonus,
      state: 'kite',
      stateTimer: 0,
      windupDuration: 0.65,
      attackCooldown: 1.6,
      hasAttackToken: false,
      strafeSign: -1,
      strafeFlipTimer: 2.0,
      hitFlashTimer: 0,
      koTimer: 0,
      gaitPhase: 0,
      targetX: x,
      targetY: y,
      targetZ: z,
    };
  }
  return {
    id,
    archetype: 'demolisher',
    nameKo: '데몰리셔',
    nameEn: 'DEMOLISHER',
    roleTitle: '중화기 폭격 · 유탄 & 점사소총',
    accentHex: 0xf59e0b,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    hp: 150 + hpBonus,
    maxHp: 150 + hpBonus,
    state: 'chase',
    stateTimer: 0,
    windupDuration: 0.58,
    attackCooldown: 1.4,
    hasAttackToken: false,
    strafeSign: 1,
    strafeFlipTimer: 1.8,
    hitFlashTimer: 0,
    koTimer: 0,
    gaitPhase: 0,
    targetX: x,
    targetY: y,
    targetZ: z,
  };
}

export interface BotAttackEvent {
  botId: string;
  archetype: RivalArchetypeId;
  damage: number;
  originX: number;
  originY: number;
  originZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  isAreaHazard: boolean;
}

/**
 * Updates all Rival Bots with 3 distinct movement/decision policies:
 * - STRIKER (Flanker/Rusher): sprints and zig-zag flanks into close shotgun/katana range
 * - PHANTOM (Sniper/Kiter): retreats when player gets close (< 14m), strafes high ground, locks laser telegraph
 * - DEMOLISHER (Orbiter/Grenadier): maintains mid-range orbit (14-22m) and lobs telegraphed area explosives
 * Enforces an Attack Token Pool so crowd attacks remain readable and fair.
 */
export function stepRivalBots(
  bots: RivalBotState[],
  player: { x: number; y: number; z: number },
  simDt: number,
  difficulty: DifficultyConfig,
  colliders: AABB[],
  ramps: RampSurface[]
): { attacks: BotAttackEvent[]; windupStartedIds: string[] } {
  const dt = Math.min(Math.max(simDt, 0), 0.05);
  const attacks: BotAttackEvent[] = [];
  const windupStartedIds: string[] = [];

  // Count active tokens held by bots currently in 'windup'
  let activeTokens = 0;
  for (let i = 0; i < bots.length; i++) {
    if (bots[i].hp > 0 && bots[i].state === 'windup') {
      activeTokens++;
    } else {
      bots[i].hasAttackToken = false;
    }
  }

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    bot.hitFlashTimer = Math.max(0, bot.hitFlashTimer - dt);

    if (bot.hp <= 0) {
      bot.state = 'ko';
      bot.hasAttackToken = false;
      bot.koTimer += dt;
      continue;
    }

    bot.attackCooldown = Math.max(0, bot.attackCooldown - dt);
    bot.strafeFlipTimer -= dt;
    if (bot.strafeFlipTimer <= 0) {
      bot.strafeSign *= -1;
      bot.strafeFlipTimer = 1.3 + (i % 3) * 0.45;
    }

    const dx = player.x - bot.x;
    const dz = player.z - bot.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const perpX = -dirZ * bot.strafeSign;
    const perpZ = dirX * bot.strafeSign;

    // Smoothly turn yaw toward player
    const desiredYaw = Math.atan2(-dx, -dz);
    let yawDiff = desiredYaw - bot.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    bot.yaw += yawDiff * Math.min(1, dt * 10);

    // Handle active windup telegraph state
    if (bot.state === 'windup') {
      bot.stateTimer -= dt;
      // Slow movement during telegraph windup so player can read & react
      bot.vx *= Math.exp(-8 * dt);
      bot.vz *= Math.exp(-8 * dt);

      if (bot.stateTimer <= 0) {
        const baseDmg =
          bot.archetype === 'phantom'
            ? 32
            : bot.archetype === 'demolisher'
            ? 24
            : 20;
        attacks.push({
          botId: bot.id,
          archetype: bot.archetype,
          damage: Math.round(baseDmg * difficulty.damageMultiplier),
          originX: bot.x,
          originY: bot.y + 1.45,
          originZ: bot.z,
          targetX: bot.targetX,
          targetY: bot.targetY,
          targetZ: bot.targetZ,
          isAreaHazard: bot.archetype === 'demolisher',
        });
        bot.state = 'recover';
        bot.stateTimer = 0.45;
        bot.hasAttackToken = false;
        activeTokens = Math.max(0, activeTokens - 1);
        bot.attackCooldown =
          (bot.archetype === 'phantom' ? 2.2 : bot.archetype === 'demolisher' ? 1.9 : 1.35) *
          difficulty.cooldownMultiplier;
      }
    } else if (bot.state === 'recover') {
      bot.stateTimer -= dt;
      if (bot.stateTimer <= 0) {
        bot.state =
          bot.archetype === 'striker'
            ? 'flank'
            : bot.archetype === 'phantom'
            ? 'kite'
            : 'chase';
      }
    } else {
      // Distinct Movement Policy per Archetype
      let moveX = 0;
      let moveZ = 0;
      let baseSpeed = 6.5;

      if (bot.archetype === 'striker') {
        // Policy 1: Rusher / Diagonal Flanker — aggressively closes distance with wide strafe weaving
        baseSpeed = 8.4 * difficulty.speedMultiplier;
        if (dist > 6.5) {
          moveX = dirX * 0.82 + perpX * 0.56;
          moveZ = dirZ * 0.82 + perpZ * 0.56;
        } else {
          // Orbit tightly at close range
          moveX = perpX * 0.9 - dirX * 0.2;
          moveZ = perpZ * 0.9 - dirZ * 0.2;
        }
      } else if (bot.archetype === 'phantom') {
        // Policy 2: Sniper / Kiter — backs away if player is closer than 15m, holds long sightlines
        baseSpeed = 6.8 * difficulty.speedMultiplier;
        if (dist < 14.5) {
          moveX = -dirX * 0.85 + perpX * 0.5;
          moveZ = -dirZ * 0.85 + perpZ * 0.5;
        } else if (dist > 28) {
          moveX = dirX * 0.7 + perpX * 0.4;
          moveZ = dirZ * 0.7 + perpZ * 0.4;
        } else {
          moveX = perpX * 0.85;
          moveZ = perpZ * 0.85;
        }
      } else {
        // Policy 3: Demolisher (Mid-range Orbiter / Charger) — maintains 11-20m ring and lobs area blasts
        baseSpeed = 6.2 * difficulty.speedMultiplier;
        if (dist > 19) {
          moveX = dirX * 0.88 + perpX * 0.35;
          moveZ = dirZ * 0.88 + perpZ * 0.35;
        } else if (dist < 10) {
          moveX = -dirX * 0.6 + perpX * 0.8;
          moveZ = -dirZ * 0.6 + perpZ * 0.8;
        } else {
          moveX = perpX * 0.95 + dirX * 0.15;
          moveZ = perpZ * 0.95 + dirZ * 0.15;
        }
      }

      const mLen = Math.hypot(moveX, moveZ);
      if (mLen > 1e-4) {
        bot.vx = (moveX / mLen) * baseSpeed;
        bot.vz = (moveZ / mLen) * baseSpeed;
      }

      // Check if eligible to start an attack telegraph (using Attack Token Pool)
      const inEffectiveRange =
        (bot.archetype === 'striker' && dist <= 18) ||
        (bot.archetype === 'phantom' && dist <= 48) ||
        (bot.archetype === 'demolisher' && dist <= 32);

      if (
        bot.attackCooldown <= 0 &&
        inEffectiveRange &&
        activeTokens < difficulty.maxConcurrentAttackers
      ) {
        bot.state = 'windup';
        bot.windupDuration =
          bot.archetype === 'phantom'
            ? difficulty.windupDuration + 0.15
            : difficulty.windupDuration;
        bot.stateTimer = bot.windupDuration;
        bot.hasAttackToken = true;
        activeTokens++;
        bot.targetX = player.x;
        bot.targetY = player.y + 1.0;
        bot.targetZ = player.z;
        windupStartedIds.push(bot.id);
      }
    }

    // Integrate Bot Position & Collisions
    const nextX = bot.x + bot.vx * dt;
    const nextZ = bot.z + bot.vz * dt;
    const resolved = resolveHorizontalCollisions(nextX, bot.y, nextZ, PLAYER_RADIUS, colliders, 32);
    const stepMoved = Math.hypot(resolved.x - bot.x, resolved.z - bot.z);
    bot.x = resolved.x;
    bot.z = resolved.z;
    bot.gaitPhase += stepMoved * 2.2;

    const groundY = getSupportHeightAt(bot.x, bot.y, bot.z, colliders, ramps);
    bot.y += (groundY - bot.y) * Math.min(1, dt * 14);
  }

  return { attacks, windupStartedIds };
}

export interface MatchScoreState {
  playerRoundsWon: number;
  rivalRoundsWon: number;
  targetRoundsToWin: number;
  currentRound: number;
  winStreak: number;
}

export function checkMatchOutcome(score: MatchScoreState): 'ongoing' | 'victory' | 'defeat' {
  if (score.playerRoundsWon >= score.targetRoundsToWin) return 'victory';
  if (score.rivalRoundsWon >= score.targetRoundsToWin) return 'defeat';
  return 'ongoing';
}
