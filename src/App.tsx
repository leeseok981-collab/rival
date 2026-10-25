import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppGameState,
  LiveHudSnapshot,
  RivalsCanvas,
  RivalsSimulationHandle,
} from './components/RivalsCanvas';
import { GameHUD } from './components/GameHUD';
import {
  DEFAULT_LOADOUT,
  LoadoutSelection,
  WEAPONS,
  WEAPONS_BY_SLOT,
  WeaponId,
  WeaponSlot,
} from './game/weapons';
import { GameMode, MapId } from './game/rules';
import { soundFX } from './game/audio';
import { WeaponSvgIcon } from './components/WeaponIcons';

const INITIAL_HUD: LiveHudSnapshot = {
  hp: 100,
  maxHp: 100,
  ghostHp: 100,
  activeSlot: 'primary',
  activeWeaponId: 'ar',
  ammoInMag: { primary: 30, secondary: 6, melee: 0, utility: 2 },
  ammoReserve: { primary: 120, secondary: 36, melee: 0, utility: 0 },
  isReloading: false,
  reloadProgress: 0,
  isAds: false,
  isSliding: false,
  deflectActive: false,
  specialCooldownRatio: 1,
  roundTimerSec: 90,
  playerRoundsWon: 0,
  rivalRoundsWon: 0,
  targetRoundsToWin: 5,
  currentRound: 1,
  winStreak: 0,
  roundBannerText: null,
  roundBannerSub: null,
  hitmarkerType: 'none',
  damageNumbers: [],
  botOverheads: [],
  playerPos: { x: 0, z: 23, yaw: 0 },
  botPositions: [],
  stats: {
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    totalDamage: 0,
    eliminations: 0,
    deflectCount: 0,
    matchElapsedSec: 0,
  },
};

export default function App() {
  const [gameState, setGameState] = useState<AppGameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        document.body.dataset.state = 'playing';
        return 'playing';
      }
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.state = 'title';
    }
    return 'title';
  });

  const [mapId, setMapId] = useState<MapId>('arena');
  const [gameMode, setGameMode] = useState<GameMode>('duel_1v1');
  const [loadout, setLoadout] = useState<LoadoutSelection>(DEFAULT_LOADOUT);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showLoadoutDrawer, setShowLoadoutDrawer] = useState<boolean>(false);
  const [hud, setHud] = useState<LiveHudSnapshot>(INITIAL_HUD);
  const [matchOutcome, setMatchOutcome] = useState<'victory' | 'defeat'>('victory');
  const [finalSnapshot, setFinalSnapshot] = useState<LiveHudSnapshot>(INITIAL_HUD);
  const [bestStreak, setBestStreak] = useState<number>(0);

  const simHandleRef = useRef<RivalsSimulationHandle | null>(null);

  // Sync state machine to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const startMatchFromTitleOrEnd = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setShowLoadoutDrawer(false);
    simHandleRef.current?.resetMatch();
    setGameState('playing');
  }, []);

  // Title-to-Start keyboard handshake (Enter / Space in 'title') and Mute shortcut (M)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        soundFX.isMuted = !soundFX.isMuted;
        setIsMuted(soundFX.isMuted);
      }
      if (gameState === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startMatchFromTitleOrEnd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, startMatchFromTitleOrEnd]);

  const handleToggleMute = useCallback(() => {
    soundFX.isMuted = !soundFX.isMuted;
    setIsMuted(soundFX.isMuted);
  }, []);

  const handleSelectLoadoutWeapon = useCallback((slot: WeaponSlot, weaponId: WeaponId) => {
    setLoadout((prev) => ({
      ...prev,
      [slot]: weaponId,
    }));
  }, []);

  const handleMatchEnd = useCallback((outcome: 'victory' | 'defeat', snap: LiveHudSnapshot) => {
    setMatchOutcome(outcome);
    setFinalSnapshot(snap);
    setBestStreak((prev) => Math.max(prev, snap.winStreak));
    document.body.dataset.state = 'gameover';
    setGameState('gameover');
  }, []);

  const handleRequestPauseToggle = useCallback(() => {
    setGameState((prev) => {
      const next = prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev;
      document.body.dataset.state = next;
      return next;
    });
  }, []);

  const handleRestartMatch = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    simHandleRef.current?.resetMatch();
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const accuracyPct =
    finalSnapshot.stats.shotsFired > 0
      ? Math.round((finalSnapshot.stats.shotsHit / finalSnapshot.stats.shotsFired) * 100)
      : 0;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Persistent 60fps Three.js WebGL Viewport Container */}
      <RivalsCanvas
        gameState={gameState}
        mapId={mapId}
        gameMode={gameMode}
        loadout={loadout}
        onHudUpdate={setHud}
        onMatchEnd={handleMatchEnd}
        onRequestPauseToggle={handleRequestPauseToggle}
        onToggleLoadoutDrawer={() => setShowLoadoutDrawer((v) => !v)}
        simHandleRef={simHandleRef}
      />

      {/* PLAYING HUD OVERLAY */}
      {gameState === 'playing' && (
        <GameHUD
          hud={hud}
          loadout={loadout}
          isMuted={isMuted}
          showLoadoutDrawer={showLoadoutDrawer}
          onToggleMute={handleToggleMute}
          onToggleLoadoutDrawer={() => setShowLoadoutDrawer((v) => !v)}
          onSelectLoadoutWeapon={handleSelectLoadoutWeapon}
          onPauseClick={() => {
            document.body.dataset.state = 'paused';
            setGameState('paused');
          }}
          onRestartClick={handleRestartMatch}
          simHandleRef={simHandleRef}
        />
      )}

      {/* TITLE SCREEN OVERLAY (Asymmetric Left-Third Composition over Calm Negative Space) */}
      {gameState === 'title' && (
        <div
          className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-10"
          style={{
            background:
              'linear-gradient(90deg, rgba(6, 10, 20, 0.92) 0%, rgba(6, 10, 20, 0.72) 42%, rgba(6, 10, 20, 0.08) 78%, rgba(6, 10, 20, 0.0) 100%)',
          }}
        >
          {/* Left-Third Focal Column */}
          <div className="w-full max-w-lg pointer-events-auto flex flex-col gap-5 my-auto">
            {/* Custom Inline SVG Title Lockup for ROBLOX RIVALS */}
            <div className="flex flex-col items-start">
              <svg
                viewBox="0 0 420 112"
                className="w-full max-w-[390px] h-auto overflow-visible"
                role="img"
                aria-label="RIVALS 로블록스 라이벌 타이틀 엠블럼"
              >
                {/* Crossed Katana & Duel Crest Backdrop */}
                <polygon
                  points="14,18 404,10 388,96 4,102"
                  fill="#0f172a"
                  stroke="#fbbf24"
                  strokeWidth="3.5"
                />
                <polygon points="22,26 112,24 96,90 14,92" fill="#e11d48" />
                <polygon points="118,24 394,18 380,88 104,90" fill="#1e293b" />

                {/* Iconic Crossed Swords Icon inside Red Crest */}
                <path
                  d="M38 76L88 34M46 34L84 76"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx="64" cy="56" r="8" fill="#fbbf24" />

                {/* Bold Angular Esports Lettering */}
                <text
                  x="126"
                  y="73"
                  fill="#ffffff"
                  fontFamily="'Chakra Petch', sans-serif"
                  fontWeight="700"
                  fontStyle="italic"
                  fontSize="56"
                  letterSpacing="3"
                >
                  RIVALS
                </text>
                <text
                  x="128"
                  y="92"
                  fill="#38bdf8"
                  fontFamily="'Plus Jakarta Sans', 'Noto Sans KR', sans-serif"
                  fontWeight="800"
                  fontSize="12"
                  letterSpacing="3"
                >
                  ROBLOX ARENA DUEL FPS · 5선승 라운드 매치
                </text>
              </svg>
            </div>

            {/* Mode & Arena Map Segmented Controls */}
            <div
              className="p-4 rounded-2xl border border-slate-700/80 flex flex-col gap-3.5 shadow-xl"
              style={{ backgroundColor: 'rgba(11, 17, 32, 0.92)' }}
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-300">매치 모드 선택</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGameMode('duel_1v1')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      gameMode === 'duel_1v1'
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                    }`}
                  >
                    1v1 라이벌 듀얼 (5선승)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode('squad_arena')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      gameMode === 'squad_arena'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                    }`}
                  >
                    다중 아키타입 결투 (1v3)
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-300">아레나 맵 선택</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'arena', label: '아레나 (Arena)' },
                      { id: 'docks', label: '부두 (Docks)' },
                      { id: 'construction', label: '건설현장 (Yard)' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMapId(m.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        mapId === m.id
                          ? 'bg-white text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-Slot Pre-Match Loadout Selector */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-300">
                  4슬롯 시작 로드아웃 커스텀
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { slot: 'primary', title: '1. 주무기' },
                      { slot: 'secondary', title: '2. 보조무기' },
                      { slot: 'melee', title: '3. 근접무기' },
                      { slot: 'utility', title: '4. 유틸리티' },
                    ] as const
                  ).map(({ slot, title }) => {
                    const currentId = loadout[slot];
                    const options = WEAPONS_BY_SLOT[slot];
                    return (
                      <div
                        key={slot}
                        className="p-2 rounded-xl bg-slate-900/95 border border-slate-800 flex flex-col gap-1"
                      >
                        <span className="text-[11px] font-semibold text-slate-400">{title}</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {options.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => handleSelectLoadoutWeapon(slot, w.id)}
                              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                currentId === w.id
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {w.nameKo}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Primary Start Action Button (data-start="true") */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={startMatchFromTitleOrEnd}
                className="flex-1 py-4 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-slate-950 font-display text-xl font-bold tracking-wider transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>아레나 매치 시작 (PLAY NOW)</span>
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </button>
            </div>
          </div>

          {/* Single Flat Borderless Control-Hint Line in Bottom Safe Margin */}
          <div className="w-full text-left text-xs font-medium text-slate-300 tracking-wide">
            WASD 이동 · Shift 질주 · C 슬라이드 · Space 점프 · 좌클릭 사격 · 우클릭 조준/카타나 반사 · 1-4 무기교체 · B 무기고 · Esc 일시정지
          </div>
        </div>
      )}

      {/* PAUSE MODAL CARD ('paused') */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(6, 10, 20, 0.78)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 p-6 shadow-2xl flex flex-col gap-5"
            style={{ backgroundColor: 'rgba(11, 17, 32, 0.96)' }}
            role="dialog"
            aria-label="게임 일시정지 메뉴"
          >
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                MATCH PAUSED · 일시정지
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                ROUND {hud.currentRound} 진행 중 · 스코어 {hud.playerRoundsWon} : {hud.rivalRoundsWon}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">현재 장착</div>
                <div className="font-display text-base font-bold text-sky-400 mt-0.5 flex items-center gap-1.5">
                  <WeaponSvgIcon weaponId={hud.activeWeaponId} className="w-4 h-4" />
                  <span>{WEAPONS[hud.activeWeaponId]?.nameKo}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">누적 데미지</div>
                <div className="font-mono-tabular text-lg font-bold text-white mt-0.5">
                  {hud.stats.totalDamage}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">헤드샷 / 반사</div>
                <div className="font-mono-tabular text-lg font-bold text-amber-400 mt-0.5">
                  {hud.stats.headshots} / {hud.stats.deflectCount}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRequestPauseToggle}
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                매치 계속하기 (Resume)
              </button>
              <button
                type="button"
                onClick={handleRestartMatch}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-colors cursor-pointer"
              >
                라운드 처음부터 다시 시작 (Restart)
              </button>
              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'title';
                  setGameState('title');
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 transition-colors cursor-pointer"
              >
                타이틀 화면으로 이동 (Title)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL CARD ('gameover') */}
      {gameState === 'gameover' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(6, 10, 20, 0.84)' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-amber-400/60 p-7 shadow-2xl flex flex-col gap-5"
            style={{ backgroundColor: 'rgba(11, 17, 32, 0.97)' }}
            role="dialog"
            aria-label={matchOutcome === 'victory' ? '매치 승리 결과' : '매치 패배 결과'}
          >
            <div className="flex items-center justify-between">
              <div>
                <span
                  className={`text-xs font-bold tracking-widest uppercase ${
                    matchOutcome === 'victory' ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {matchOutcome === 'victory'
                    ? 'RIVALS CHAMPION · 5선승 달성!'
                    : 'MATCH DEFEAT · 라이벌 승리'}
                </span>
                <h2 className="font-display text-3xl font-bold text-white mt-0.5">
                  {matchOutcome === 'victory' ? 'VICTORY · 매치 승리!' : 'DEFEAT · 매치 종료'}
                </h2>
              </div>

              <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 font-display font-mono-tabular text-2xl font-bold text-white">
                {finalSnapshot.playerRoundsWon} : {finalSnapshot.rivalRoundsWon}
              </div>
            </div>

            {/* 3 Tabular-Nums Mastery / Progress Metric Tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">총 데미지 / 처치</div>
                <div className="font-mono-tabular text-xl font-bold text-white mt-1">
                  {finalSnapshot.stats.totalDamage} / {finalSnapshot.stats.eliminations}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">명중률 / 헤드샷</div>
                <div className="font-mono-tabular text-xl font-bold text-sky-400 mt-1">
                  {accuracyPct}% · {finalSnapshot.stats.headshots}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">최고 연승 / 매치 시간</div>
                <div className="font-mono-tabular text-xl font-bold text-amber-400 mt-1">
                  {Math.max(bestStreak, finalSnapshot.winStreak)}연승 ·{' '}
                  {Math.round(finalSnapshot.stats.matchElapsedSec)}s
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={startMatchFromTitleOrEnd}
                className="flex-1 py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base transition-colors cursor-pointer"
              >
                {matchOutcome === 'victory' ? '다음 매치 시작 (Play Again)' : '재도전하기 (Try Again)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'title';
                  setGameState('title');
                }}
                className="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors cursor-pointer"
              >
                타이틀로
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
