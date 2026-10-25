import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialPlayerKinematics,
  stepPlayerKinematics,
  activateWeaponSpecial,
  computeShotDamage,
  getDifficultyForRound,
  createRivalBot,
  stepRivalBots,
  checkMatchOutcome,
  AABB,
} from './rules';

test('player movement, slide boost, and slide-jump conserve momentum', () => {
  const player = createInitialPlayerKinematics(0, 0, 20, 0);
  const colliders: AABB[] = [];

  // Move forward and trigger slide
  const res = stepPlayerKinematics(
    player,
    {
      moveForward: 1,
      moveRight: 0,
      sprintHeld: true,
      jumpJustPressed: false,
      jumpHeld: false,
      slideJustPressed: true,
      equippedWeaponId: 'katana',
    },
    0.016,
    colliders,
    []
  );

  assert.equal(res.startedSlide, true);
  assert.equal(player.isSliding, true);
  assert.ok(player.vz < -14, 'Sliding forward in -Z should boost speed > 14 m/s');

  // Jump during slide (Slide-Jump)
  const jumpRes = stepPlayerKinematics(
    player,
    {
      moveForward: 1,
      moveRight: 0,
      sprintHeld: true,
      jumpJustPressed: true,
      jumpHeld: true,
      slideJustPressed: false,
      equippedWeaponId: 'katana',
    },
    0.016,
    colliders,
    []
  );

  assert.equal(jumpRes.jumped, true);
  assert.equal(player.isSliding, false);
  assert.ok(player.vy > 9.5, 'Slide-jump should grant upward velocity');
  assert.ok(player.vz < -15, 'Slide-jump should preserve high horizontal momentum');
});

test('weapon damage and sniper headshot instant-kill calculation', () => {
  const arBody = computeShotDamage('ar', 15, false);
  const arHead = computeShotDamage('ar', 15, true);
  assert.equal(arBody, 18);
  assert.equal(arHead, 27);

  const sniperBody = computeShotDamage('sniper', 40, false);
  const sniperHead = computeShotDamage('sniper', 40, true);
  assert.equal(sniperBody, 75);
  assert.equal(sniperHead, 150);

  // Shotgun distance falloff check
  const shotgunClose = computeShotDamage('shotgun', 5, false);
  const shotgunFar = computeShotDamage('shotgun', 35, false);
  assert.ok(shotgunClose > shotgunFar);
});

test('katana deflect and scythe dash special abilities trigger and apply cooldowns', () => {
  const p = createInitialPlayerKinematics(0, 0, 0, 0);
  const deflectAct = activateWeaponSpecial(p, 'katana');
  assert.equal(deflectAct, 'deflect');
  assert.ok(p.deflectTimer > 0.8);
  assert.ok(p.deflectCooldown >= 4.0);

  // Cannot re-trigger while on cooldown
  assert.equal(activateWeaponSpecial(p, 'katana'), null);

  const dashAct = activateWeaponSpecial(p, 'scythe');
  assert.equal(dashAct, 'scythe_dash');
  assert.ok(p.vy > 2.0);
  assert.ok(p.dashCooldown >= 4.0);
});

test('3 rival bot archetypes follow distinct movement policies and obey attack token pool', () => {
  const striker = createRivalBot('b1', 'striker', 0, 0, -20, 1);
  const phantom = createRivalBot('b2', 'phantom', 0, 0, -8, 1); // Close to player at (0,0,0), should kite backward
  const demolisher = createRivalBot('b3', 'demolisher', 10, 0, -15, 1);

  striker.attackCooldown = 0;
  phantom.attackCooldown = 0;
  demolisher.attackCooldown = 0;

  const diff = getDifficultyForRound(2, 'squad_arena');
  const stepOut = stepRivalBots(
    [striker, phantom, demolisher],
    { x: 0, y: 0, z: 0 },
    0.04,
    diff,
    [],
    []
  );

  // Striker at z=-20 moves closer toward player at z=0 (z increases)
  assert.ok(striker.z > -20, 'Striker rusher should advance toward player');
  // Phantom at z=-8 (<14.5m from player at z=0) kites away unless it immediately entered windup
  // And attack token pool limits simultaneous windups to diff.maxConcurrentAttackers (2)
  assert.ok(stepOut.windupStartedIds.length <= diff.maxConcurrentAttackers);
});

test('match score state detects First-to-5 victory and defeat accurately', () => {
  assert.equal(
    checkMatchOutcome({
      playerRoundsWon: 4,
      rivalRoundsWon: 3,
      targetRoundsToWin: 5,
      currentRound: 8,
      winStreak: 1,
    }),
    'ongoing'
  );
  assert.equal(
    checkMatchOutcome({
      playerRoundsWon: 5,
      rivalRoundsWon: 3,
      targetRoundsToWin: 5,
      currentRound: 8,
      winStreak: 2,
    }),
    'victory'
  );
  assert.equal(
    checkMatchOutcome({
      playerRoundsWon: 2,
      rivalRoundsWon: 5,
      targetRoundsToWin: 5,
      currentRound: 7,
      winStreak: 0,
    }),
    'defeat'
  );
});
