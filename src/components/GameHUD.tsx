import React from 'react';
import { LiveHudSnapshot, RivalsSimulationHandle } from './RivalsCanvas';
import {
  LoadoutSelection,
  WEAPONS,
  WEAPONS_BY_SLOT,
  WeaponId,
  WeaponSlot,
} from '../game/weapons';
import { WeaponSvgIcon } from './WeaponIcons';

interface GameHUDProps {
  hud: LiveHudSnapshot;
  loadout: LoadoutSelection;
  isMuted: boolean;
  showLoadoutDrawer: boolean;
  onToggleMute: () => void;
  onToggleLoadoutDrawer: () => void;
  onSelectLoadoutWeapon: (slot: WeaponSlot, weaponId: WeaponId) => void;
  onPauseClick: () => void;
  onRestartClick: () => void;
  simHandleRef: React.MutableRefObject<RivalsSimulationHandle | null>;
}

const SLOTS_ORDER: Array<{ slot: WeaponSlot; keyLabel: string; labelKo: string }> = [
  { slot: 'primary', keyLabel: '1', labelKo: '주무기' },
  { slot: 'secondary', keyLabel: '2', labelKo: '보조무기' },
  { slot: 'melee', keyLabel: '3', labelKo: '근접무기' },
  { slot: 'utility', keyLabel: '4', labelKo: '유틸리티' },
];

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  loadout,
  isMuted,
  showLoadoutDrawer,
  onToggleMute,
  onToggleLoadoutDrawer,
  onSelectLoadoutWeapon,
  onPauseClick,
  onRestartClick,
  simHandleRef,
}) => {
  const activeWeapon = WEAPONS[hud.activeWeaponId] || WEAPONS.ar;
  const minutes = Math.floor(hud.roundTimerSec / 60);
  const seconds = hud.roundTimerSec % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Calculate 5 discrete vitality sockets (20 HP each)
  const sockets = [0, 1, 2, 3, 4].map((idx) => {
    const thresholdFull = (idx + 1) * 20;
    const thresholdHalf = idx * 20 + 8;
    if (hud.hp >= thresholdFull) return 'full';
    if (hud.hp >= thresholdHalf) return 'cracked';
    return 'empty';
  });

  const isLowHp = hud.hp > 0 && hud.hp <= 30;
  const isSniperScoped = hud.isAds && hud.activeWeaponId === 'sniper';

  return (
    <div
      className="fixed inset-0 pointer-events-none z-10 overflow-hidden select-none"
      data-testid="rivals-playing-hud"
    >
      {/* Low HP Peripheral Danger Vignette */}
      {isLowHp && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px 28px rgba(225, 29, 72, 0.48)',
          }}
        />
      )}

      {/* Sniper Scope Reticle Overlay when Right-Click ADS with Sniper */}
      {isSniperScoped && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <svg viewBox="0 0 400 400" className="w-[min(78vw,78vh)] h-[min(78vw,78vh)]">
            <circle cx="200" cy="200" r="185" fill="none" stroke="#a855f7" strokeWidth="3" />
            <line x1="15" y1="200" x2="385" y2="200" stroke="#e2e8f0" strokeWidth="1.2" />
            <line x1="200" y1="15" x2="200" y2="385" stroke="#e2e8f0" strokeWidth="1.2" />
            <circle cx="200" cy="200" r="4" fill="#f43f5e" />
          </svg>
        </div>
      )}

      {/* 3D-Projected Enemy Overhead Nameplates & Health Bars */}
      {hud.botOverheads.map(
        (b) =>
          b.visible && (
            <div
              key={b.id}
              className="fixed -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center"
              style={{
                left: `${b.screenX}%`,
                top: `${b.screenY}%`,
              }}
            >
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700/80 mb-1">
                <span className="font-display text-xs font-bold tracking-wider text-white">
                  {b.nameKo}
                </span>
                <span className="text-[11px] text-slate-300 font-mono-tabular">
                  {b.hp} HP
                </span>
                {b.isWindup && (
                  <span className="text-[10px] font-bold text-amber-400">
                    조준 경보!
                  </span>
                )}
              </div>
              <div className="w-24 h-2 bg-slate-950/95 border border-slate-700 rounded-sm overflow-hidden">
                <div
                  className="h-full transition-transform duration-75 origin-left bg-rose-500"
                  style={{
                    transform: `scaleX(${Math.max(0, Math.min(1, b.hp / b.maxHp))})`,
                  }}
                />
              </div>
            </div>
          )
      )}

      {/* Floating 3D Damage Numbers */}
      {hud.damageNumbers.map((dn) => (
        <div
          key={dn.id}
          className="fixed -translate-x-1/2 -translate-y-1/2 pointer-events-none font-display font-bold stroke-text-sm"
          style={{
            left: `${dn.x}%`,
            top: `${dn.y}%`,
            color: dn.isDeflect ? '#22d3ee' : dn.isHeadshot ? '#facc15' : '#ffffff',
            fontSize: dn.isHeadshot || dn.isDeflect ? '22px' : '17px',
            opacity: Math.max(0, 1 - dn.age / 0.75),
          }}
        >
          -{dn.amount}
          {dn.isHeadshot ? ' CRIT!' : dn.isDeflect ? ' 반사!' : ''}
        </div>
      ))}

      {/* Center (0, 0) Crosshair, Hitmarker & Gaze-Routed Reload/Deflect Arc */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="w-14 h-14 overflow-visible">
          {/* Reload Progress Ring */}
          {hud.isReloading && (
            <circle
              cx="32"
              cy="32"
              r="18"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeDasharray={113}
              strokeDashoffset={113 * (1 - hud.reloadProgress)}
              strokeLinecap="round"
            />
          )}

          {/* Katana Deflect Active Shield Ring */}
          {hud.deflectActive && (
            <circle
              cx="32"
              cy="32"
              r="22"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="3.5"
              strokeDasharray="16 8"
            />
          )}

          {/* Dynamic Crosshair Ticks */}
          {!isSniperScoped && (
            <g stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round">
              <line x1="32" y1="19" x2="32" y2="25" />
              <line x1="32" y1="39" x2="32" y2="45" />
              <line x1="19" y1="32" x2="25" y2="32" />
              <line x1="39" y1="32" x2="45" y2="32" />
              <circle cx="32" cy="32" r="1.6" fill="#38bdf8" stroke="none" />
            </g>
          )}

          {/* Instant Hitmarker X */}
          {hud.hitmarkerType !== 'none' && (
            <g
              stroke={
                hud.hitmarkerType === 'kill'
                  ? '#f43f5e'
                  : hud.hitmarkerType === 'headshot'
                  ? '#facc15'
                  : hud.hitmarkerType === 'deflect'
                  ? '#22d3ee'
                  : '#ffffff'
              }
              strokeWidth="3"
              strokeLinecap="round"
            >
              <line x1="21" y1="21" x2="27" y2="27" />
              <line x1="43" y1="21" x2="37" y2="27" />
              <line x1="21" y1="43" x2="27" y2="37" />
              <line x1="43" y1="43" x2="37" y2="37" />
            </g>
          )}
        </svg>

        {hud.isReloading && (
          <span className="absolute top-12 whitespace-nowrap text-[11px] font-bold tracking-wider text-sky-300 stroke-text-sm">
            재장전 중...
          </span>
        )}
        {hud.deflectActive && (
          <span className="absolute -top-8 whitespace-nowrap text-xs font-bold tracking-wider text-cyan-300 stroke-text-sm">
            카타나 탄환 반사 활성화!
          </span>
        )}
      </div>

      {/* Round Start / Round Won Announcement Banner */}
      {hud.roundBannerText && (
        <div className="fixed left-1/2 top-24 -translate-x-1/2 pointer-events-none flex flex-col items-center text-center">
          <div
            className="px-6 py-2 rounded-lg border border-amber-400/50 shadow-lg"
            style={{ backgroundColor: 'rgba(9, 14, 24, 0.92)' }}
          >
            <div className="font-display text-2xl md:text-3xl font-bold tracking-wider text-amber-400 stroke-text">
              {hud.roundBannerText}
            </div>
            {hud.roundBannerSub && (
              <div className="text-xs md:text-sm font-semibold text-slate-200 mt-0.5">
                {hud.roundBannerSub}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLUSTER 1 (TOP-CENTER): RIVALS Round Scoreboard & Match Timer */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div
          className="flex items-center gap-4 px-5 py-2 rounded-xl border border-slate-700/80 shadow-xl"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          {/* Player Team Score & Round Pips */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold tracking-wider text-sky-400">
                YOU · 블루
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: hud.targetRoundsToWin }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-xs border ${
                      i < hud.playerRoundsWon
                        ? 'bg-sky-400 border-sky-200'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
            <span
              className="font-display font-mono-tabular text-3xl font-bold text-white stroke-text-sm"
              data-testid="hud-player-score"
            >
              {hud.playerRoundsWon}
            </span>
          </div>

          {/* Center Round Clock & Streak */}
          <div className="flex flex-col items-center px-3 border-x border-slate-800">
            <span className="text-[10px] font-bold tracking-widest text-amber-400">
              ROUND {hud.currentRound}
            </span>
            <span className="font-mono-tabular text-lg font-bold text-slate-100">
              {formattedTime}
            </span>
          </div>

          {/* Rival Team Score & Round Pips */}
          <div className="flex items-center gap-2.5">
            <span
              className="font-display font-mono-tabular text-3xl font-bold text-white stroke-text-sm"
              data-testid="hud-rival-score"
            >
              {hud.rivalRoundsWon}
            </span>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold tracking-wider text-rose-400">
                RIVAL · 레드
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: hud.targetRoundsToWin }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-xs border ${
                      i < hud.rivalRoundsWon
                        ? 'bg-rose-500 border-rose-300'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top-Right Compact Utility Controls (Mute [M], Armory [B], Pause [P], Restart [R]) */}
      <div className="fixed top-3 right-4 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleLoadoutDrawer();
          }}
          aria-label="로드아웃 무기고 열기 (B)"
          className="h-10 px-3 rounded-lg border border-amber-400/60 text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
          </svg>
          <span>무기 교체 [B]</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={isMuted ? '사운드 켜기 (M)' : '사운드 끄기 (M)'}
          className="w-10 h-10 rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-rose-400" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-sky-400" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onRestartClick();
          }}
          aria-label="매치 다시 시작 (R)"
          className="w-10 h-10 rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPauseClick();
          }}
          aria-label="일시정지 (P / Esc)"
          className="w-10 h-10 rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.2">
            <path d="M9 6v12M15 6v12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* CLUSTER 2 (BOTTOM-LEFT): Vitality Pips, Trailing Ghost HP Bar & Tactical Arena Minimap */}
      <div className="fixed bottom-4 left-4 flex items-end gap-3">
        {/* Live Navigable Arena Radar */}
        <div
          className="w-24 h-24 rounded-xl border border-slate-700/90 p-1.5 relative overflow-hidden shrink-0 hidden sm:block"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          <svg viewBox="-36 -36 72 72" className="w-full h-full">
            {/* Real Arena Layout Geometry on Minimap */}
            <rect x="-34" y="-34" width="68" height="68" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
            <rect x="-5" y="-5" width="10" height="10" fill="#334155" />
            <rect x="-15.5" y="-13.5" width="4.2" height="9.5" fill="#475569" />
            <rect x="-15.5" y="4" width="4.2" height="9.5" fill="#475569" />
            <rect x="11.3" y="-13.5" width="4.2" height="9.5" fill="#475569" />
            <rect x="11.3" y="4" width="4.2" height="9.5" fill="#475569" />

            {/* Rival Bot Positions */}
            {hud.botPositions.map(
              (bp, i) =>
                bp.hp > 0 && (
                  <circle
                    key={i}
                    cx={bp.x}
                    cy={bp.z}
                    r="3.2"
                    fill="#f43f5e"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                )
            )}

            {/* Player Position & Heading Cone */}
            <g transform={`translate(${hud.playerPos.x}, ${hud.playerPos.z}) rotate(${(-hud.playerPos.yaw * 180) / Math.PI})`}>
              <polygon points="0,-7 -4.5,3 4.5,3" fill="rgba(56, 189, 248, 0.38)" />
              <circle cx="0" cy="0" r="2.8" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* Vitality Readout Card (~3:1 Hero-to-Kicker hierarchy + Trailing Ghost Bar) */}
        <div
          className="px-4 py-3 rounded-xl border border-slate-700/90 min-w-[230px]"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          <div className="flex items-baseline justify-between gap-4 mb-1.5">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path
                  d="M12 21s-7-4.35-9.5-8.5C.5 9 2.5 4.5 6.5 4.5c2.2 0 3.9 1.2 5.5 3 1.6-1.8 3.3-3 5.5-3 4 0 6 4.5 4 8-2.5 4.15-9.5 8.5-9.5 8.5z"
                  fill={isLowHp ? '#f43f5e' : '#10b981'}
                  stroke="#090d16"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                HP · 체력
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span
                className={`font-display font-mono-tabular text-3xl font-bold stroke-text-sm ${
                  isLowHp ? 'text-rose-400' : 'text-white'
                }`}
                data-testid="hud-player-hp"
              >
                {hud.hp}
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-slate-400">
                / {hud.maxHp}
              </span>
            </div>
          </div>

          {/* 5 Discrete Vitality Sockets (Full / Cracked / Empty) */}
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {sockets.map((st, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-xs border ${
                  st === 'full'
                    ? 'bg-emerald-400 border-emerald-200'
                    : st === 'cracked'
                    ? 'bg-amber-400 border-amber-200'
                    : 'bg-slate-900 border-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Continuous Bar with Delayed Trailing Damage Ghost Bar */}
          <div className="w-full h-2.5 bg-slate-900 rounded-xs overflow-hidden relative border border-slate-800">
            {/* Ghost Damage Trail */}
            <div
              className="absolute inset-y-0 left-0 bg-amber-400/80 origin-left transition-transform duration-150"
              style={{
                width: '100%',
                transform: `scaleX(${Math.max(0, Math.min(1, hud.ghostHp / hud.maxHp))})`,
              }}
            />
            {/* Live HP Fill */}
            <div
              className={`absolute inset-y-0 left-0 origin-left ${
                isLowHp ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{
                width: '100%',
                transform: `scaleX(${Math.max(0, Math.min(1, hud.hp / hud.maxHp))})`,
              }}
            />
          </div>

          {/* Movement / Special Ability Status Line */}
          <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2">
            <span>{hud.isSliding ? '슬라이드 가속 중!' : '기동: 정상 (C 슬라이드)'}</span>
            {activeWeapon.specialAbility && (
              <span className="font-mono-tabular font-semibold text-sky-300">
                특수기 [우클릭/F]: {Math.round(hud.specialCooldownRatio * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CLUSTER 3 (BOTTOM-RIGHT): 4-Slot RIVALS Loadout Dock & Active Ammo Readout */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* Active Weapon Hero Ammo Counter */}
        <div
          className="px-4 py-2.5 rounded-xl border border-slate-700/90 flex items-center gap-4"
          style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
        >
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-bold tracking-wider text-sky-400">
              {activeWeapon.nameKo} · {activeWeapon.nameEn}
            </span>
            <span className="text-[11px] text-slate-300">{activeWeapon.roleClue}</span>
          </div>

          <div className="pl-3 border-l border-slate-800 flex items-baseline gap-1.5">
            {activeWeapon.magSize > 0 ? (
              <>
                <span
                  className="font-display font-mono-tabular text-3xl font-bold text-white stroke-text-sm"
                  data-testid="hud-active-ammo"
                >
                  {hud.ammoInMag[hud.activeSlot]}
                </span>
                <span className="font-mono-tabular text-sm font-semibold text-slate-400">
                  / {hud.ammoReserve[hud.activeSlot]}
                </span>
              </>
            ) : (
              <span
                className="font-display text-lg font-bold text-cyan-300"
                data-testid="hud-active-ammo"
              >
                무제한 근접
              </span>
            )}
          </div>
        </div>

        {/* 4-Slot Weapon Bar ([1] Primary, [2] Secondary, [3] Melee, [4] Utility) */}
        <div className="grid grid-cols-4 gap-2">
          {SLOTS_ORDER.map(({ slot, keyLabel, labelKo }) => {
            const wId = loadout[slot];
            const wDef = WEAPONS[wId];
            const isSelected = hud.activeSlot === slot;
            const mag = hud.ammoInMag[slot];

            return (
              <button
                key={slot}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  simHandleRef.current?.switchSlot(slot);
                }}
                aria-label={`${keyLabel}번 슬롯 ${wDef.nameKo} 선택`}
                className={`px-3 py-2 rounded-xl border transition-transform flex flex-col items-start min-w-[104px] cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 -translate-y-1 shadow-lg'
                    : 'border-slate-700/80 hover:border-slate-500'
                }`}
                style={{
                  backgroundColor: isSelected
                    ? 'rgba(23, 37, 68, 0.95)'
                    : 'rgba(10, 15, 28, 0.88)',
                }}
              >
                <div className="w-full flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    [{keyLabel}]
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">{labelKo}</span>
                </div>

                <div className="w-full flex items-center justify-between gap-2 my-0.5">
                  <WeaponSvgIcon weaponId={wId} className="w-6 h-6 shrink-0" />
                  <span className="font-mono-tabular text-xs font-bold text-slate-200">
                    {wDef.magSize > 0 ? `${mag}` : 'READY'}
                  </span>
                </div>

                <span className="text-xs font-bold text-white truncate w-full text-left mt-0.5">
                  {wDef.nameKo}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible In-Match Loadout Armory Modal / Dock ([B] Toggle) */}
      {showLoadoutDrawer && (
        <div className="fixed inset-x-0 bottom-36 flex justify-center pointer-events-auto px-4 z-20">
          <div
            className="w-full max-w-4xl rounded-2xl border border-amber-400/50 p-5 shadow-2xl"
            style={{ backgroundColor: 'rgba(9, 14, 26, 0.96)' }}
            role="dialog"
            aria-label="라이벌 4슬롯 로드아웃 무기고"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  RIVALS LOADOUT ARMORY · 라운드 무기고
                </h2>
                <p className="text-xs text-slate-300">
                  주무기 · 보조무기 · 근접무기 · 유틸리티를 즉시 교체할 수 있습니다
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleLoadoutDrawer}
                className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 cursor-pointer"
              >
                무기고 닫기 [B]
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {SLOTS_ORDER.map(({ slot, keyLabel, labelKo }) => (
                <div key={slot} className="flex flex-col gap-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>
                      [{keyLabel}] {labelKo}
                    </span>
                  </div>
                  {WEAPONS_BY_SLOT[slot].map((w) => {
                    const active = loadout[slot] === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onSelectLoadoutWeapon(slot, w.id)}
                        className={`p-2.5 rounded-xl border text-left transition-colors flex items-center gap-2.5 cursor-pointer ${
                          active
                            ? 'border-amber-400 bg-slate-800/95'
                            : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                        }`}
                      >
                        <WeaponSvgIcon weaponId={w.id} className="w-7 h-7 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{w.nameKo}</div>
                          <div className="text-[11px] text-slate-300 truncate">{w.roleClue}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
