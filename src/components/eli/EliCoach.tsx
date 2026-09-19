import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { EliFace } from './EliFace';
import {
  EliAction,
  EliContext,
  EliMemory,
  loadEliMemory,
  pickSuggestion,
  saveEliMemory,
  suppressSuggestion,
} from '../../lib/eli';
import { soundFx } from '../../utils/audio';

interface Props {
  /** The signed-in account, or null. Scopes suppression per account. */
  userId: string | null;
  /** Live data, already subscribed by the caller for this account. */
  context: EliContext;
  /** Carry out an action using the app's existing navigation. */
  onAction: (action: EliAction) => void;
  /** Opens the existing full chat. */
  onAsk: () => void;
  /** Hidden while a full-screen surface owns the display. */
  hidden?: boolean;
  /**
   * True once this account's data has actually arrived.
   *
   * The launch briefing waits for it: opening on the first render would judge
   * an empty list and either say nothing or say the wrong thing.
   */
  ready?: boolean;
}

/** How long after the data is ready the launch briefing appears. */
const LAUNCH_DELAY_MS = 1800;
/** How long the small "no messages" note stays up. */
const EMPTY_NOTE_MS = 2600;

/**
 * ELI — a quiet contextual layer over what the app already knows.
 *
 * The button is always there; the glow is not. It appears only when the
 * context engine has found something real to say, which is what keeps this
 * from becoming another badge demanding attention.
 *
 * The suggestion is recomputed from live data rather than stored, so it
 * corrects itself: complete the task ELI is asking about and the message is
 * not stale or dismissed, it simply no longer exists.
 */
export const EliCoach: React.FC<Props> = ({
  userId,
  context,
  onAction,
  onAsk,
  hidden = false,
  ready = true,
}) => {
  const [open, setOpen] = useState(false);
  /** The small note shown instead of the panel when there is nothing to say. */
  const [emptyNote, setEmptyNote] = useState(false);
  /**
   * Set when a press turned into a drag.
   *
   * Releasing a drag also fires a click on the element underneath, which
   * would open the panel every time the button was merely moved. A ref, not
   * state, because it has to be read in the very same event it was set in.
   */
  const dragged = useRef(false);
  const [memory, setMemory] = useState<EliMemory>({});
  /**
   * Re-evaluated on a slow tick as well as on data changes.
   *
   * Several rules depend on the time of day — an evening summary, a streak
   * that is only at risk once it is late — and those would otherwise not
   * appear until something else happened to trigger a render.
   */
  const [tick, setTick] = useState(0);

  // Suppression is per account, and reloaded when the account changes so one
  // person's dismissals never apply to another's session.
  useEffect(() => {
    setMemory(loadEliMemory(userId));
    setOpen(false);
  }, [userId]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 120_000);
    return () => window.clearInterval(id);
  }, []);

  const suggestion = useMemo(
    () => pickSuggestion(context, memory, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, memory, tick]
  );

  /**
   * The launch briefing.
   *
   * Once per app launch, per account, ELI opens by itself if it has something
   * real to say — remaining tasks, an overdue item, a streak at risk. Tracked
   * in sessionStorage, so reopening the app briefs again but moving between
   * screens does not. With nothing to say, it stays closed: an empty panel on
   * launch would be noise.
   */
  useEffect(() => {
    if (!ready || hidden || !suggestion) return;

    const key = `elitelife_eli_briefed_${userId || 'guest'}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* storage unavailable — fall through and brief once this render */
    }

    const id = window.setTimeout(() => {
      try {
        sessionStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
      setOpen(true);
    }, LAUNCH_DELAY_MS);

    return () => window.clearTimeout(id);
  }, [ready, hidden, suggestion?.id, userId]);

  useEffect(() => {
    if (!emptyNote) return;
    const id = window.setTimeout(() => setEmptyNote(false), EMPTY_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [emptyNote]);

  /** Closes the sheet if what it was showing has ceased to be true. */
  useEffect(() => {
    if (open && !suggestion) setOpen(false);
  }, [open, suggestion]);

  const remember = (next: EliMemory) => {
    setMemory(next);
    saveEliMemory(userId, next);
  };

  const snooze = (minutes: number) => {
    if (!suggestion) return;
    remember(suppressSuggestion(memory, suggestion.id, minutes));
    setOpen(false);
  };

  // Escape closes, matching every other dismissable surface in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  const toneColor =
    suggestion?.tone === 'warn'
      ? 'var(--warn)'
      : suggestion?.tone === 'praise'
        ? 'var(--done)'
        : 'var(--signal-ink)';

  return (
    <>
      {/* The persistent entry point. Sits above the tab bar, clear of it. */}
      <motion.button
        // Draggable anywhere on screen, and back home on release: it can be
        // moved out of the way of whatever is underneath it for a moment,
        // but never ends up lost somewhere the user did not mean it to stay.
        drag
        dragSnapToOrigin
        dragMomentum={false}
        dragElastic={0.9}
        dragTransition={{ bounceStiffness: 420, bounceDamping: 26 }}
        whileDrag={{ scale: 1.1 }}
        whileTap={{ scale: 0.94 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={() => {
          // Cleared after the click that follows a drag has been swallowed.
          window.setTimeout(() => {
            dragged.current = false;
          }, 0);
        }}
        onClick={() => {
          if (dragged.current) return;
          soundFx.playClick();
          if (suggestion) {
            setEmptyNote(false);
            setOpen((v) => !v);
          } else {
            // Nothing to say: a small note, not a whole panel announcing it.
            setOpen(false);
            setEmptyNote((v) => !v);
          }
        }}
        aria-label={suggestion ? 'ELI has a suggestion' : 'ELI — no new messages'}
        aria-expanded={open}
        className="eli-fab"
        data-has-news={suggestion ? 'true' : 'false'}
      >
        <EliFace size={30} alert={!!suggestion} />
        {suggestion && <span className="eli-fab-dot" />}
      </motion.button>

      <AnimatePresence>
        {emptyNote && !open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            role="status"
            className="eli-note"
          >
            <span>No new messages</span>
            <button
              onClick={() => {
                soundFx.playClick();
                setEmptyNote(false);
                onAsk();
              }}
              className="eli-note-link"
            >
              Ask ELI
              <ArrowRight className="w-3 h-3 shrink-0" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[93]"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              role="dialog"
              aria-label="ELI"
              className="eli-panel"
            >
              <div className="flex items-start gap-3">
                <span className="eli-avatar">
                  <EliFace size={22} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight">ELI</p>
                  <p className="t-meta mt-0.5">Your EliteLife Coach</p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ color: 'var(--ink-dim)' }}
                >
                  <X className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {/* One message. Never a list, never a feed. */}
              {suggestion ? (
                <>
                  <p
                    className="text-[14.5px] leading-relaxed mt-3.5"
                    style={{ color: 'var(--ink)' }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-2 mb-[2px]"
                      style={{ background: toneColor }}
                    />
                    {suggestion.message}
                  </p>

                  {/* What to do about it. */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {suggestion.actions.map((action) => (
                      <button
                        key={`${action.id}-${action.label}`}
                        onClick={() => {
                          soundFx.playClick();
                          // Acted on, so it should not reappear immediately
                          // even if the underlying fact takes a moment to
                          // change — starting a focus session does not
                          // complete the task.
                          remember(suppressSuggestion(memory, suggestion.id, 30));
                          setOpen(false);
                          onAction(action);
                        }}
                        className="eli-action"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  {/* Declining, kept deliberately quiet and on its own line:
                      as pills beside the real actions these wrapped onto a
                      second row and read as equal choices. */}
                  <div className="flex items-center gap-4 mt-3">
                    <button onClick={() => snooze(suggestion.snoozeMinutes)} className="eli-quiet">
                      Later
                    </button>
                    <button onClick={() => snooze(60 * 24)} className="eli-quiet">
                      Not now
                    </button>
                  </div>
                </>
              ) : (
                <p className="t-sub mt-3.5">
                  Nothing needs your attention right now. I will say something when it does.
                </p>
              )}

              <div className="eli-divider" />

              <button
                onClick={() => {
                  soundFx.playClick();
                  setOpen(false);
                  onAsk();
                }}
                className="eli-ask"
              >
                <span>Ask ELI anything</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
