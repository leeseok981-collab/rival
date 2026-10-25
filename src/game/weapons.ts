export type WeaponSlot = 'primary' | 'secondary' | 'melee' | 'utility';

export type WeaponId =
  | 'ar'
  | 'sniper'
  | 'shotgun'
  | 'burst'
  | 'revolver'
  | 'uzi'
  | 'flare'
  | 'katana'
  | 'scythe'
  | 'fists'
  | 'grenade'
  | 'medkit'
  | 'molotov'
  | 'tripmine';

export interface WeaponDef {
  id: WeaponId;
  slot: WeaponSlot;
  nameKo: string;
  nameEn: string;
  roleClue: string;
  damage: number;
  headshotMult: number;
  fireInterval: number; // seconds between shots/swings
  automatic: boolean;
  magSize: number; // 0 for melee
  reserveAmmo: number; // 0 for melee
  reloadTime: number;
  pellets: number;
  spread: number; // radians
  adsSpreadMult: number;
  adsFov: number; // degrees
  speedMult: number; // movement speed multiplier while held
  range: number; // max effective range in meters
  recoilKick: number;
  accentColor: string;
  specialAbility?: 'deflect' | 'scythe_dash' | 'double_jump' | 'scope' | 'throw_frag' | 'heal' | 'throw_molotov' | 'place_tripmine' | 'shoot_flare';
  specialCooldown?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // === PRIMARY WEAPONS ([1]) ===
  ar: {
    id: 'ar',
    slot: 'primary',
    nameKo: '돌격소총',
    nameEn: 'ASSAULT RIFLE',
    roleClue: '자동 연사 · 전천후 밸런스',
    damage: 18,
    headshotMult: 1.5,
    fireInterval: 0.105,
    automatic: true,
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 1.65,
    pellets: 1,
    spread: 0.016,
    adsSpreadMult: 0.35,
    adsFov: 56,
    speedMult: 1.0,
    range: 120,
    recoilKick: 0.025,
    accentColor: '#38bdf8',
  },
  sniper: {
    id: 'sniper',
    slot: 'primary',
    nameKo: '저격소총',
    nameEn: 'SNIPER RIFLE',
    roleClue: '볼트액션 · 헤드샷 즉사(150)',
    damage: 75,
    headshotMult: 2.0,
    fireInterval: 1.05,
    automatic: false,
    magSize: 5,
    reserveAmmo: 25,
    reloadTime: 2.1,
    pellets: 1,
    spread: 0.032,
    adsSpreadMult: 0.02,
    adsFov: 24,
    speedMult: 0.94,
    range: 180,
    recoilKick: 0.095,
    accentColor: '#a855f7',
    specialAbility: 'scope',
  },
  shotgun: {
    id: 'shotgun',
    slot: 'primary',
    nameKo: '산탄총',
    nameEn: 'SHOTGUN',
    roleClue: '근접 8펠릿 · 강력한 넉백',
    damage: 12,
    headshotMult: 1.45,
    fireInterval: 0.68,
    automatic: false,
    magSize: 7,
    reserveAmmo: 35,
    reloadTime: 1.85,
    pellets: 8,
    spread: 0.068,
    adsSpreadMult: 0.62,
    adsFov: 62,
    speedMult: 1.02,
    range: 42,
    recoilKick: 0.075,
    accentColor: '#f97316',
  },
  burst: {
    id: 'burst',
    slot: 'primary',
    nameKo: '점사소총',
    nameEn: 'BURST RIFLE',
    roleClue: '3점사 정밀 사격 · 중장거리',
    damage: 22,
    headshotMult: 1.55,
    fireInterval: 0.28,
    automatic: true,
    magSize: 24,
    reserveAmmo: 96,
    reloadTime: 1.6,
    pellets: 1,
    spread: 0.011,
    adsSpreadMult: 0.25,
    adsFov: 50,
    speedMult: 1.0,
    range: 140,
    recoilKick: 0.032,
    accentColor: '#2dd4bf',
  },

  // === SECONDARY WEAPONS ([2]) ===
  revolver: {
    id: 'revolver',
    slot: 'secondary',
    nameKo: '리볼버',
    nameEn: 'REVOLVER',
    roleClue: '고화력 6연발 · 정밀 단발',
    damage: 38,
    headshotMult: 1.9,
    fireInterval: 0.34,
    automatic: false,
    magSize: 6,
    reserveAmmo: 36,
    reloadTime: 1.45,
    pellets: 1,
    spread: 0.012,
    adsSpreadMult: 0.25,
    adsFov: 56,
    speedMult: 1.04,
    range: 110,
    recoilKick: 0.06,
    accentColor: '#fbbf24',
  },
  uzi: {
    id: 'uzi',
    slot: 'secondary',
    nameKo: '우지 기관단총',
    nameEn: 'MICRO UZI',
    roleClue: '초고속 연사 · 기동 사격',
    damage: 11,
    headshotMult: 1.45,
    fireInterval: 0.072,
    automatic: true,
    magSize: 26,
    reserveAmmo: 104,
    reloadTime: 1.3,
    pellets: 1,
    spread: 0.034,
    adsSpreadMult: 0.55,
    adsFov: 64,
    speedMult: 1.06,
    range: 65,
    recoilKick: 0.018,
    accentColor: '#60a5fa',
  },
  flare: {
    id: 'flare',
    slot: 'secondary',
    nameKo: '신호탄 총',
    nameEn: 'FLARE GUN',
    roleClue: '소이탄 발사 · 화염 지대 생성',
    damage: 35,
    headshotMult: 1.3,
    fireInterval: 0.9,
    automatic: false,
    magSize: 2,
    reserveAmmo: 10,
    reloadTime: 1.5,
    pellets: 1,
    spread: 0.01,
    adsSpreadMult: 0.4,
    adsFov: 62,
    speedMult: 1.03,
    range: 90,
    recoilKick: 0.05,
    accentColor: '#fb7185',
    specialAbility: 'shoot_flare',
  },

  // === MELEE WEAPONS ([3]) ===
  katana: {
    id: 'katana',
    slot: 'melee',
    nameKo: '카타나',
    nameEn: 'KATANA',
    roleClue: '우클릭/F 탄환 반사 · 이속 +15%',
    damage: 48,
    headshotMult: 1.25,
    fireInterval: 0.42,
    automatic: true,
    magSize: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 74,
    speedMult: 1.15,
    range: 4.2,
    recoilKick: 0.04,
    accentColor: '#22d3ee',
    specialAbility: 'deflect',
    specialCooldown: 4.0,
  },
  scythe: {
    id: 'scythe',
    slot: 'melee',
    nameKo: '사신 낫',
    nameEn: 'SCYTHE',
    roleClue: '우클릭/F 전방 대시 · 광역 베기',
    damage: 56,
    headshotMult: 1.25,
    fireInterval: 0.54,
    automatic: true,
    magSize: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 76,
    speedMult: 1.12,
    range: 4.6,
    recoilKick: 0.05,
    accentColor: '#c084fc',
    specialAbility: 'scythe_dash',
    specialCooldown: 4.2,
  },
  fists: {
    id: 'fists',
    slot: 'melee',
    nameKo: '주먹 격투',
    nameEn: 'FISTS',
    roleClue: '2단 점프 지원 · 이속 +24%',
    damage: 34,
    headshotMult: 1.35,
    fireInterval: 0.28,
    automatic: true,
    magSize: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 75,
    speedMult: 1.24,
    range: 3.6,
    recoilKick: 0.03,
    accentColor: '#facc15',
    specialAbility: 'double_jump',
    specialCooldown: 1.5,
  },

  // === UTILITY WEAPONS ([4]) ===
  grenade: {
    id: 'grenade',
    slot: 'utility',
    nameKo: '수류탄',
    nameEn: 'GRENADE',
    roleClue: '폭발 데미지 80 · 그레네이드 점프',
    damage: 80,
    headshotMult: 1.0,
    fireInterval: 0.8,
    automatic: false,
    magSize: 2,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 72,
    speedMult: 1.05,
    range: 45,
    recoilKick: 0.04,
    accentColor: '#4ade80',
    specialAbility: 'throw_frag',
    specialCooldown: 6.5,
  },
  medkit: {
    id: 'medkit',
    slot: 'utility',
    nameKo: '구급상자',
    nameEn: 'MEDKIT',
    roleClue: '즉시 체력 +65 회복 · 응급 처치',
    damage: 0,
    headshotMult: 1.0,
    fireInterval: 0.9,
    automatic: false,
    magSize: 2,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 72,
    speedMult: 1.02,
    range: 0,
    recoilKick: 0.02,
    accentColor: '#10b981',
    specialAbility: 'heal',
    specialCooldown: 8.0,
  },
  molotov: {
    id: 'molotov',
    slot: 'utility',
    nameKo: '화염병',
    nameEn: 'MOLOTOV',
    roleClue: '착탄 즉시 화염 장판 · 지역 봉쇄',
    damage: 65,
    headshotMult: 1.0,
    fireInterval: 0.85,
    automatic: false,
    magSize: 2,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 72,
    speedMult: 1.05,
    range: 40,
    recoilKick: 0.04,
    accentColor: '#f97316',
    specialAbility: 'throw_molotov',
    specialCooldown: 7.0,
  },
  tripmine: {
    id: 'tripmine',
    slot: 'utility',
    nameKo: '서브스페이스 지뢰',
    nameEn: 'SUBSPACE TRIPMINE',
    roleClue: '감지형 보라색 폭발(85) · 함정 설치',
    damage: 85,
    headshotMult: 1.0,
    fireInterval: 0.75,
    automatic: false,
    magSize: 2,
    reserveAmmo: 0,
    reloadTime: 0,
    pellets: 1,
    spread: 0,
    adsSpreadMult: 1,
    adsFov: 72,
    speedMult: 1.05,
    range: 18,
    recoilKick: 0.03,
    accentColor: '#e879f9',
    specialAbility: 'place_tripmine',
    specialCooldown: 7.5,
  },
};

export interface LoadoutSelection {
  primary: WeaponId;
  secondary: WeaponId;
  melee: WeaponId;
  utility: WeaponId;
}

export const DEFAULT_LOADOUT: LoadoutSelection = {
  primary: 'ar',
  secondary: 'revolver',
  melee: 'katana',
  utility: 'grenade',
};

export const WEAPONS_BY_SLOT: Record<WeaponSlot, WeaponDef[]> = {
  primary: [WEAPONS.ar, WEAPONS.sniper, WEAPONS.shotgun, WEAPONS.burst],
  secondary: [WEAPONS.revolver, WEAPONS.uzi, WEAPONS.flare],
  melee: [WEAPONS.katana, WEAPONS.scythe, WEAPONS.fists],
  utility: [WEAPONS.grenade, WEAPONS.medkit, WEAPONS.molotov, WEAPONS.tripmine],
};
