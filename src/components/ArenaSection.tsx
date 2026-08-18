import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCw, AlertCircle, Crown, ChevronUp } from 'lucide-react';
import { getIdToken } from '../lib/firebase';

interface Entry {
  uid: string;
  displayName: string;
  careerXp: number;
  weeklyXp: number;
  level: number;
  /** Server-verified: lifetime or active trial. Never inferred here. */
  isPro: boolean;
  rank: number;
}

interface Page {
  entries: Entry[];
  totalMembers: number;
  yourRank: number | null;
  yourEntry: Entry | null;
}

/** Tiers derived from the same XP the rest of the app uses. */
const TIERS = [
  { name: 'BRONZE', min: 0, color: '#C97B3C', roman: 'I' },
  { name: 'SILVER', min: 1500, color: '#A8B4C4', roman: 'II' },
  { name: 'GOLD', min: 3000, color: '#E8A33D', roman: 'III' },
  { name: 'PLATINUM', min: 7000, color: '#7FD4E8', roman: 'IV' },
  { name: 'DIAMOND', min: 13000, color: '#7C9CFF', roman: 'V' },
  { name: 'ELITE', min: 25000, color: '#B98BFF', roman: 'VI' },
];

function tierFor(xp: number) {
  let tier = TIERS[0];
  for (const t of TIERS) if (xp >= t.min) tier = t;
  return tier;
}

/** Sub-tier 1–3 within a tier, so progress is visible between big jumps. */
function subTier(xp: number): number {
  const tier = tierFor(xp);
  const idx = TIERS.indexOf(tier);
  const next = TIERS[idx + 1];
  if (!next) return 3;
  const span = (next.min - tier.min) / 3;
  return Math.min(3, Math.floor((xp - tier.min) / span) + 1);
}

const TierBadge: React.FC<{ xp: number; size?: 'sm' | 'lg' }> = ({ xp, size = 'sm' }) => {
  const tier = tierFor(xp);
  const px = size === 'lg' ? 52 : 40;
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 0 40 44" className="absolute inset-0 w-full h-full">
        <polygon
          points="20,2 37,11.5 37,32.5 20,42 3,32.5 3,11.5"
          fill="none"
          stroke={tier.color}
          strokeWidth="2"
          opacity="0.9"
        />
      </svg>
      <span
        className="relative text-[10px] font-mono font-bold"
        style={{ color: tier.color }}
      >
        {tier.roman}
      </span>
    </span>
  );
};

interface ArenaProps {
  /** Compact shows a short preview; full shows the whole board. */
  variant?: 'full' | 'compact';
  onExpand?: () => void;
}

export const ArenaSection: React.FC<ArenaProps> = ({ variant = 'full', onExpand }) => {
  const [mode, setMode] = useState<'career' | 'weekly'>('career');
  const [page, setPage] = useState<Page | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (publishFirst: boolean) => {
      try {
        const token = await getIdToken();
        if (!token) {
          setStatus('error');
          setError('Sign in to see the Arena.');
          return;
        }

        // Publish our own entry first so the board reflects work done since
        // the last visit. The server recomputes it — nothing is sent from here.
        if (publishFirst) {
          await fetch('/api/leaderboard/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {
            /* a failed publish shouldn't block reading the board */
          });
        }

        const res = await fetch(`/api/leaderboard?mode=${mode}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setError(data?.error || 'Leaderboard temporarily unavailable.');
          return;
        }

        setPage(data);
        setStatus('ready');
      } catch (err) {
        // Never substitute placeholder data on failure.
        setStatus('error');
        setError('Leaderboard temporarily unavailable. Check your connection.');
      }
    },
    [mode]
  );

  useEffect(() => {
    setStatus('loading');
    load(true);
  }, [load]);

  // Refresh periodically so rankings stay current without hammering the server.
  useEffect(() => {
    const id = setInterval(() => load(false), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const you = page?.yourEntry || null;
  const value = (e: Entry) => (mode === 'weekly' ? e.weeklyXp : e.careerXp);

  const nextTarget = useMemo(() => {
    if (!page || !you) return null;
    return page.entries.find((e) => e.rank === you.rank - 1) || null;
  }, [page, you]);

  const tier = you ? tierFor(you.careerXp) : TIERS[0];

  if (status === 'error') {
    return (
      <div className="eb-card p-6 text-center">
        <AlertCircle className="w-6 h-6 eb-warn mx-auto" />
        <p className="eb-heading text-base mt-3">Arena unavailable</p>
        <p className="text-xs text-[#8A93A5] mt-1.5 max-w-sm mx-auto leading-relaxed">{error}</p>
        <button
          onClick={() => {
            setStatus('loading');
            load(true);
          }}
          className="eb-btn-ghost px-4 py-2.5 mt-4 text-xs font-mono"
        >
          Try again
        </button>
      </div>
    );
  }

  const members = page?.totalMembers ?? 0;
  const loading = status === 'loading';

  // Compact: top three plus your own row, for the Home screen.
  if (variant === 'compact') {
    const rows = page?.entries.slice(0, 3) || [];
    const showYou = you && you.rank > 3;

    return (
      <div className="eb-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eb-label flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-[#FFB020]" />
            Arena
          </span>
          <button
            onClick={onExpand}
            className="eb-press text-[10px] font-mono font-bold text-[var(--signal-ink)]"
          >
            {members > 0 ? `${members} members` : 'View'} →
          </button>
        </div>

        {loading ? (
          // Skeleton rows keep the layout stable instead of collapsing.
          <div className="space-y-2 mt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 rounded-xl eb-card-sunk animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {rows.map((e) => {
              const t = tierFor(e.careerXp);
              const isYou = you?.uid === e.uid;
              return (
                <div
                  key={e.uid}
                  className={`rounded-xl border p-2.5 flex items-center gap-2.5 ${
                    isYou ? 'border-[var(--signal)] bg-[var(--signal)]/[0.10]' : 'eb-card-sunk'
                  }`}
                >
                  <span
                    className="w-5 text-center text-[11px] font-mono font-bold tabular-nums"
                    style={{
                      color: e.rank === 1 ? '#FFB020' : e.rank === 2 ? '#C7D0DE' : '#C97B3C',
                    }}
                  >
                    {e.rank}
                  </span>
                  <span className="eb-heading text-xs truncate flex-1 min-w-0">
                    {e.displayName}
                  </span>
                  {e.isPro && <Crown className="w-3 h-3 text-[#FFB020] shrink-0" />}
                  <span className="text-xs font-mono font-bold tabular-nums" style={{ color: t.color }}>
                    {value(e).toLocaleString()}
                  </span>
                </div>
              );
            })}

            {showYou && (
              <div className="rounded-xl border border-[var(--signal)] bg-[var(--signal)]/[0.10] p-2.5 flex items-center gap-2.5">
                <span className="w-5 text-center text-[11px] font-mono font-bold text-[var(--signal-ink)] tabular-nums">
                  {you!.rank}
                </span>
                <span className="eb-heading text-xs truncate flex-1 min-w-0">You</span>
                <span className="text-xs font-mono font-bold tabular-nums text-[#F2F4F7]">
                  {value(you!).toLocaleString()}
                </span>
              </div>
            )}

            {rows.length === 0 && (
              <p className="text-[11px] text-[#8A93A5] py-2">
                Complete something today to join the rankings.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="flex items-center gap-1.5">
        {(['career', 'weekly'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`eb-press flex-1 py-2.5 rounded-xl text-[11px] font-mono font-bold border ${
              mode === m ? 'eb-chip-active' : 'text-[#8A93A5] eb-card-sunk'
            }`}
          >
            {m === 'career' ? 'ALL TIME' : 'THIS WEEK'}
          </button>
        ))}
        <button
          onClick={async () => {
            setRefreshing(true);
            await load(true);
            setRefreshing(false);
          }}
          aria-label="Refresh"
          className="eb-press shrink-0 w-11 h-11 rounded-xl eb-card-sunk flex items-center justify-center text-[#8A93A5]"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Your position */}
      <div className="eb-card p-4">
        <span className="eb-label">EliteLife Arena</span>
        {you ? (
          <p className="eb-heading text-lg mt-1">
            You're #{you.rank} of {members} {members === 1 ? 'member' : 'members'}
          </p>
        ) : (
          <p className="text-xs text-[#8A93A5] mt-1.5 leading-relaxed">
            Complete something today to join the rankings.
          </p>
        )}
      </div>

      {/* Next target */}
      {you && (
        <div className="eb-card p-4">
          <span className="eb-label">Next target</span>
          {nextTarget ? (
            <>
              <div className="flex items-end justify-between gap-3 mt-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold text-[var(--signal-ink)]">YOU</p>
                  <p className="eb-stat text-2xl mt-0.5">{value(you).toLocaleString()}</p>
                </div>
                <div className="text-center shrink-0">
                  <p className="eb-label">Gap</p>
                  <p className="text-sm font-mono font-bold text-[#F2F4F7] mt-0.5">
                    {(value(nextTarget) - value(you)).toLocaleString()}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-mono font-bold text-[#8A93A5] truncate">
                    {nextTarget.displayName}
                  </p>
                  <p className="eb-stat text-2xl mt-0.5">{value(nextTarget).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-[10px] text-[#8A93A5] mt-2.5">
                {(value(nextTarget) - value(you)).toLocaleString()} XP to pass them.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <Crown className="w-4 h-4 text-[#FFB020]" />
              <p className="eb-heading text-base">
                {members === 1 ? "You're the only member so far." : "You're #1. Nobody above you."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Rankings */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="eb-label">
            {mode === 'weekly' ? 'This week' : 'All-time rankings'}
          </span>
          <span className="text-[10px] font-mono text-[#8A93A5]">
            {members} {members === 1 ? 'member' : 'members'}
          </span>
        </div>

        {page && page.entries.length === 0 ? (
          <div className="eb-card p-8 text-center">
            <Trophy className="w-6 h-6 text-[#5A6472] mx-auto" />
            <p className="eb-heading text-base mt-3">Nobody ranked yet</p>
            <p className="text-xs text-[#8A93A5] mt-1.5 max-w-xs mx-auto leading-relaxed">
              Finish a task, meet a habit or run a focus session and you'll appear here. XP comes
              from work you complete, not time spent in the app.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {page?.entries.map((e, i) => {
                const isYou = you?.uid === e.uid;
                const t = tierFor(e.careerXp);
                return (
                  <motion.div
                    key={e.uid}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 26,
                      delay: Math.min(i * 0.03, 0.25),
                    }}
                    className={`eb-card-tap eb-shine relative overflow-hidden rounded-2xl border p-3 flex items-center gap-3 ${
                      isYou
                        ? 'border-[var(--signal)] bg-[var(--signal)]/[0.10] shadow-[0_0_22px_-8px_var(--signal)]'
                        : e.rank <= 3
                          ? 'eb-card shadow-[0_0_18px_-10px_currentColor]'
                          : 'eb-card'
                    }`}
                    style={e.rank <= 3 ? { color: t.color } : undefined}
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ background: t.color, opacity: isYou ? 1 : 0.55 }}
                    />

                    <span
                      className="w-7 shrink-0 text-center text-xs font-mono font-bold tabular-nums"
                      style={{
                        color:
                          e.rank === 1
                            ? '#FFB020'
                            : e.rank === 2
                              ? '#C7D0DE'
                              : e.rank === 3
                                ? '#C97B3C'
                                : '#8A93A5',
                      }}
                    >
                      {String(e.rank).padStart(2, '0')}
                    </span>

                    <TierBadge xp={e.careerXp} />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="eb-heading text-sm truncate">{e.displayName}</span>
                        {e.isPro && (
                          <span
                            title="Pro member"
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#FFB020]/15 border border-[#FFB020]/40"
                          >
                            <Crown className="w-2.5 h-2.5 text-[#FFB020]" />
                            <span className="text-[8px] font-mono font-bold text-[#FFB020]">PRO</span>
                          </span>
                        )}
                        {isYou && (
                          <span className="text-[9px] font-mono font-bold text-[var(--signal-ink)] shrink-0">
                            — YOU
                          </span>
                        )}
                      </span>
                      <span
                        className="block text-[10px] font-mono font-bold mt-0.5"
                        style={{ color: t.color }}
                      >
                        {t.name} {subTier(e.careerXp)}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="eb-stat block text-base">
                        {value(e).toLocaleString()}
                      </span>
                      <span className="block text-[8px] font-mono text-[#5A6472] tracking-wide">
                        {mode === 'weekly' ? 'THIS WEEK' : 'CAREER XP'}
                      </span>
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Outside the top 20: show the real position rather than pretending */}
            {you && you.rank > (page?.entries.length ?? 0) && (
              <>
                <p className="text-center text-[10px] font-mono text-[#5A6472] py-1">
                  <ChevronUp className="w-3 h-3 inline" /> your position
                </p>
                <div className="eb-card-tap rounded-2xl border border-[var(--signal)] bg-[var(--signal)]/[0.09] p-3 flex items-center gap-3">
                  <span className="w-7 shrink-0 text-center text-xs font-mono font-bold text-[#8A93A5] tabular-nums">
                    {you.rank}
                  </span>
                  <TierBadge xp={you.careerXp} />
                  <span className="min-w-0 flex-1">
                    <span className="eb-heading text-sm truncate block">{you.displayName}</span>
                    <span
                      className="block text-[10px] font-mono font-bold mt-0.5"
                      style={{ color: tier.color }}
                    >
                      {tier.name} {subTier(you.careerXp)}
                    </span>
                  </span>
                  <span className="eb-stat text-base shrink-0">
                    {value(you).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[#5A6472] text-center leading-relaxed">
        Rankings are calculated on the server from recorded activity. XP cannot be set from the
        app.
      </p>
    </div>
  );
};
