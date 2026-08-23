import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Crown, RefreshCw, AlertCircle, Trophy } from 'lucide-react';
import { getIdToken } from '../lib/firebase';
import { tierFor, tierLabel } from '../lib/tiers';

interface Entry {
  uid: string;
  displayName: string;
  careerXp: number;
  weeklyXp: number;
  level: number;
  isPro: boolean;
  photoURL?: string;
  rank: number;
}

interface Page {
  entries: Entry[];
  totalMembers: number;
  yourRank: number | null;
  yourEntry: Entry | null;
}

interface Props {
  onBack: () => void;
}

/** First letter of a name, for accounts with no provider avatar. */
function initialOf(name: string): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

/**
 * Avatar. Uses the provider photo when one exists, otherwise a coloured
 * initial derived from the uid — stable per user, so it never changes between
 * loads the way a random colour would.
 */
const Avatar: React.FC<{ entry: Entry; size: number }> = ({ entry, size }) => {
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < entry.uid.length; i++) h = (h * 31 + entry.uid.charCodeAt(i)) % 360;
    return h;
  }, [entry.uid]);

  const [failed, setFailed] = useState(false);

  if (entry.photoURL && !failed) {
    return (
      <img
        src={entry.photoURL}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border border-[var(--rule)]"
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, hsl(${hue} 55% 32%), hsl(${hue} 45% 20%))`,
        fontSize: size * 0.4,
      }}
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white border border-white/10"
    >
      {initialOf(entry.displayName)}
    </span>
  );
};

const POSITION_LABEL = ['1ST', '2ND', '3RD'];
const MEDAL = ['#FFB020', '#C7D0DE', '#C97B3C'];

export const LeaderboardScreen: React.FC<Props> = ({ onBack }) => {
  const [mode, setMode] = useState<'career' | 'weekly'>('career');
  const [page, setPage] = useState<Page | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (publish: boolean) => {
      try {
        const token = await getIdToken();
        if (!token) {
          setStatus('error');
          setError('Sign in to see the leaderboard.');
          return;
        }

        if (publish) {
          await fetch('/api/leaderboard/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
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
      } catch {
        // Never substitute placeholder users on failure.
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

  useEffect(() => {
    const id = setInterval(() => load(false), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const you = page?.yourEntry || null;
  const value = (e: Entry) => (mode === 'weekly' ? e.weeklyXp : e.careerXp);

  const entries = page?.entries || [];
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Visual order places #1 in the centre, #2 left, #3 right.
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as Entry[];

  return (
    <div className="max-w-2xl mx-auto pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-11 h-11 rounded-xl border border-[var(--rule)] flex items-center justify-center text-[#8A93A5] shrink-0"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
        </button>
        <span className="t-meta flex-1 min-w-0">
          {status === 'loading'
            ? 'Loading…'
            : `${page?.totalMembers ?? 0} ${page?.totalMembers === 1 ? 'member' : 'members'}`}
        </span>
        <button
          onClick={async () => {
            setRefreshing(true);
            await load(true);
            setRefreshing(false);
          }}
          aria-label="Refresh"
          className="w-11 h-11 rounded-xl border border-[var(--rule)] flex items-center justify-center text-[#8A93A5] shrink-0"
        >
          <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <h1 className="t-display text-center mt-6">Leaderboard</h1>
      <p className="t-sub text-center mt-2">Ranked by XP earned from work you complete</p>

      {/* Scope. Region and Guild are shown but disabled: the data does not
          exist, and inventing it would make the ranking meaningless. */}
      <div className="flex items-center gap-1.5 mt-6 p-1 rounded-2xl bg-[var(--surface-sunk)]">
        {([
          { id: 'global', label: 'Global', enabled: true },
          { id: 'region', label: 'Region', enabled: false },
          { id: 'guild', label: 'Guild', enabled: false },
        ] as const).map((t) => (
          <button
            key={t.id}
            disabled={!t.enabled}
            title={t.enabled ? undefined : 'Coming soon'}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
              t.id === 'global'
                ? 'bg-[var(--signal)] text-white'
                : 'text-[#7E8899] disabled:opacity-40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* All-time vs this week */}
      <div className="flex items-center gap-1.5 mt-2.5">
        {(['career', 'weekly'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 min-h-[42px] rounded-xl text-[13px] font-semibold border transition-colors ${
              mode === m
                ? 'border-[var(--signal)] text-[var(--signal-ink)] bg-[var(--signal)]/10'
                : 'border-[var(--rule)] text-[#7E8899]'
            }`}
          >
            {m === 'career' ? 'All time' : 'This week'}
          </button>
        ))}
      </div>

      {/* States */}
      {status === 'error' && (
        <div className="panel text-center mt-6 py-10">
          <AlertCircle className="w-6 h-6 shrink-0 eb-warn mx-auto" />
          <p className="t-section mt-3">Leaderboard unavailable</p>
          <p className="t-sub mt-2 max-w-sm mx-auto">{error}</p>
          <button
            onClick={() => {
              setStatus('loading');
              load(true);
            }}
            className="btn-quiet mt-5"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="mt-8 space-y-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="panel h-44 animate-pulse" />
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="panel panel-tight h-16 animate-pulse" />
          ))}
        </div>
      )}

      {status === 'ready' && entries.length === 0 && (
        <div className="panel text-center mt-6 py-12">
          <Trophy className="w-7 h-7 shrink-0 text-[#7E8899] mx-auto" />
          <p className="t-section mt-3">Nobody ranked yet</p>
          <p className="t-sub mt-2 max-w-xs mx-auto">
            Finish a task, meet a habit or run a focus session to appear here.
          </p>
        </div>
      )}

      {status === 'ready' && entries.length > 0 && (
        <>
          {/* Podium — #1 centre and tallest, #2 left, #3 right. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-8 items-end">
            {podiumOrder.map((e) => {
              const place = e.rank - 1;
              const isFirst = e.rank === 1;
              const isYou = you?.uid === e.uid;
              const t = tierFor(e.careerXp);

              return (
                <motion.div
                  key={e.uid}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 240,
                    damping: 22,
                    delay: isFirst ? 0 : 0.1,
                  }}
                  className={`relative rounded-2xl border p-3 sm:p-4 text-center min-w-0 ${
                    isFirst ? 'pt-6 pb-5' : 'pt-4'
                  }`}
                  style={{
                    background: isFirst
                      ? 'linear-gradient(180deg, color-mix(in oklab, var(--signal) 18%, var(--surface)), var(--surface))'
                      : 'var(--surface)',
                    borderColor: isYou
                      ? 'var(--signal)'
                      : isFirst
                        ? 'color-mix(in oklab, var(--signal) 45%, var(--rule))'
                        : 'var(--rule)',
                    boxShadow: isFirst
                      ? '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 14px 34px -18px color-mix(in oklab, var(--signal) 80%, transparent)'
                      : '0 1px 0 0 rgba(255,255,255,0.04) inset',
                  }}
                >
                  {isFirst && (
                    <Crown
                      className="w-5 h-5 shrink-0 mx-auto mb-2"
                      style={{ color: MEDAL[0] }}
                    />
                  )}

                  <div className="flex justify-center">
                    <Avatar entry={e} size={isFirst ? 60 : 46} />
                  </div>

                  <p
                    className="font-semibold mt-2.5 leading-tight break-words"
                    style={{ fontSize: isFirst ? 15 : 13 }}
                  >
                    {e.displayName}
                  </p>

                  {isYou && (
                    <p className="text-[11px] font-bold text-[var(--signal-ink)] mt-0.5">YOU</p>
                  )}

                  <p
                    className="text-[11px] font-semibold mt-1.5"
                    style={{ color: t.color }}
                  >
                    {tierLabel(t)}
                  </p>

                  <p
                    className="font-display font-extrabold tabular-nums mt-2 leading-none"
                    style={{ fontSize: isFirst ? 22 : 18 }}
                  >
                    {value(e).toLocaleString()}
                  </p>

                  <p
                    className="text-[11px] font-bold mt-2.5 tracking-wider"
                    style={{ color: MEDAL[place] }}
                  >
                    {POSITION_LABEL[place]}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Ranks 4 and below */}
          {rest.length > 0 && (
            <div className="space-y-2 mt-5">
              {rest.map((e, i) => {
                const isYou = you?.uid === e.uid;
                const t = tierFor(e.careerXp);

                return (
                  <motion.div
                    key={e.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: Math.min(i * 0.02, 0.3) }}
                    className="rounded-2xl border p-3 flex items-center gap-3 min-w-0 transition-colors"
                    style={{
                      background: isYou
                        ? 'color-mix(in oklab, var(--signal) 12%, var(--surface))'
                        : 'var(--surface)',
                      borderColor: isYou ? 'var(--signal)' : 'var(--rule)',
                      boxShadow: isYou
                        ? '0 0 22px -10px var(--signal)'
                        : '0 1px 0 0 rgba(255,255,255,0.03) inset',
                    }}
                  >
                    <span className="w-7 shrink-0 text-center text-[13px] font-bold tabular-nums text-[#7E8899]">
                      {e.rank}
                    </span>

                    <Avatar entry={e} size={38} />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[14px] font-semibold truncate">
                          {e.displayName}
                        </span>
                        {isYou && (
                          <span className="text-[11px] font-bold text-[var(--signal-ink)] shrink-0">
                            YOU
                          </span>
                        )}
                        {e.isPro && (
                          <Crown className="w-3 h-3 shrink-0" style={{ color: MEDAL[0] }} />
                        )}
                      </span>
                      <span
                        className="block text-[11px] font-semibold mt-0.5"
                        style={{ color: t.color }}
                      >
                        {tierLabel(t)}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block font-display font-extrabold text-[15px] tabular-nums leading-none">
                        {value(e).toLocaleString()}
                      </span>
                      <span className="block text-[11px] text-[#7E8899] mt-1">XP</span>
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Outside the visible list: show the real position, never pretend. */}
          {you && you.rank > entries.length && (
            <>
              <p className="t-sub text-center py-3">Your position</p>
              <div
                className="rounded-2xl border p-3 flex items-center gap-3 min-w-0"
                style={{
                  background: 'color-mix(in oklab, var(--signal) 12%, var(--surface))',
                  borderColor: 'var(--signal)',
                }}
              >
                <span className="w-7 shrink-0 text-center text-[13px] font-bold tabular-nums text-[#7E8899]">
                  {you.rank}
                </span>
                <Avatar entry={you} size={38} />
                <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">
                  {you.displayName}
                </span>
                <span className="font-display font-extrabold text-[15px] tabular-nums shrink-0">
                  {value(you).toLocaleString()}
                </span>
              </div>
            </>
          )}

          <p className="t-sub text-center mt-6 leading-relaxed">
            Rankings are calculated on the server from recorded activity.
          </p>
        </>
      )}
    </div>
  );
};
