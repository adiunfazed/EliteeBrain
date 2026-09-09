import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Mic, Square, RotateCcw, AlertTriangle } from 'lucide-react';
import { getIdToken } from '../../lib/firebase';
import { soundFx } from '../../utils/audio';

interface Props {
  onBack: () => void;
}

/**
 * Speaking prompts.
 *
 * Chosen to need no preparation and to produce enough speech to assess —
 * "describe your commute" yields more usable material than a yes/no question.
 */
const PROMPTS = [
  'Explain what you are working on right now, to someone who knows nothing about it.',
  'Describe the best day you have had this month, and why it was good.',
  'Argue for something you believe, then argue the opposite.',
  'Explain how to do something you are good at, step by step.',
  'Describe a problem you are stuck on and what you have tried.',
  'Talk about what you want to be different in six months.',
  'Explain a decision you made recently and the reasoning behind it.',
];

type Phase = 'idle' | 'listening' | 'reviewing' | 'done';

/**
 * Voice coach.
 *
 * Uses the browser's own speech recognition — no audio is uploaded, only the
 * transcript, and only when the user asks for feedback. The microphone is
 * requested when they tap Start, never on mount.
 */
export const VoiceCoachScreen: React.FC<Props> = ({ onBack }) => {
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  /** Text from sessions that have already ended. */
  const committedRef = useRef('');
  /** Text from the session currently running. */
  const sessionRef = useRef('');
  /** True once the user pressed Done, so auto-restart stops. */
  const stoppedByUser = useRef(false);
  /** Guards against two recognition instances running at once. */
  const runningRef = useRef(false);

  useEffect(() => {
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));

    // Leaving the screen must release the microphone, or it keeps listening
    // in the background.
    return () => {
      stoppedByUser.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* nothing running */
      }
    };
  }, []);

  // Elapsed timer, so the user can see they are being heard.
  useEffect(() => {
    if (phase !== 'listening') return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = () => {
    if (runningRef.current) return;
    const w = window as any;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!Recognition) {
      setError('This browser cannot listen. Chrome on Android or Safari on iOS both work.');
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      committedRef.current = '';
      sessionRef.current = '';
      stoppedByUser.current = false;
      setTranscript('');
      setSeconds(0);
      setError(null);
      setFeedback(null);

      recognition.onresult = (event: any) => {
        // Rebuild this session's text from its own results array — correct
        // within a session, since re-reading the same finals is idempotent.
        let sessionFinals = '';
        let interim = '';

        for (let i = 0; i < event.results.length; i++) {
          const chunk = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) sessionFinals += chunk + ' ';
          else interim += chunk;
        }

        sessionRef.current = sessionFinals;

        // Text from previous sessions is held separately. The restart begins
        // a fresh results array, so mixing the two was what repeated words.
        const full = `${committedRef.current} ${sessionFinals} ${interim}`;
        setTranscript(full.replace(/\s+/g, ' ').trim());
      };

      recognition.onerror = (event: any) => {
        // Denial is a choice, not a fault — say what to do about it rather
        // than reporting an error code.
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setError('Microphone access was declined. Allow it in your browser settings to use this.');
        } else if (event.error === 'no-speech') {
          setError('Nothing was heard. Try speaking a little louder.');
        } else {
          setError('Listening stopped unexpectedly. Try again.');
        }
        setPhase('idle');
      };

      recognition.onend = () => {
        // Commit this session's text before the next one clears the results
        // array, or everything said so far is lost on restart.
        committedRef.current = `${committedRef.current} ${sessionRef.current}`.trim();
        sessionRef.current = '';

        if (stoppedByUser.current) {
          setPhase('reviewing');
          return;
        }

        // Chrome ends recognition after a few seconds of silence even with
        // continuous set, which cut people off mid-thought.
        try {
          recognition.start();
        } catch {
          setPhase('reviewing');
        }
      };

      recognitionRef.current = recognition;
      runningRef.current = true;
      recognition.start();
      setPhase('listening');
      soundFx.playClick();
    } catch {
      setError('Could not start listening on this device.');
    }
  };

  const stop = () => {
    stoppedByUser.current = true;
    runningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setPhase('reviewing');
  };

  const getFeedback = async () => {
    const text = transcript.trim();
    if (text.length < 40) {
      setError('That is too short to give useful feedback on. Try speaking for longer.');
      return;
    }

    setPhase('done');
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Sign in to get feedback.');
        return;
      }

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userMessage:
            `I spoke on this prompt: "${prompt}"\n\n` +
            `Below is a transcript of what I said. Rate my delivery honestly.\n\n` +
            `Give exactly this structure:\n` +
            `RATING\n<score>/10 — one line why.\n\n` +
            `WHAT WORKED\nTwo specific things about clarity, structure or word choice.\n\n` +
            `WHAT DID NOT\nTwo specific weaknesses. Be direct.\n\n` +
            `DO THIS NEXT TIME\nTwo concrete changes.\n\n` +
            `The transcript comes from speech-to-text, so ignore punctuation, ` +
            `capitalisation and obvious mis-transcriptions. Judge the substance and ` +
            `structure of what was said, not the typing.\n\nTranscript:\n${text}`,
          mode: 'chat',
          history: [],
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Could not get feedback right now.');
        return;
      }

      setFeedback(data.reply || null);
    } catch {
      setError('Network problem getting feedback.');
    }
  };

  const reset = () => {
    setPhase('idle');
    setTranscript('');
    setFeedback(null);
    setError(null);
    setSeconds(0);
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="max-w-lg mx-auto pb-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="icon-btn">
          <ArrowLeft className="w-4 h-4 shrink-0" />
        </button>
        <span className="t-meta flex-1 min-w-0">Coach</span>
      </div>

      <h1 className="t-title mt-6">Voice coach</h1>

      {!supported ? (
        <div
          className="rounded-2xl p-5 mt-6"
          style={{
            background: 'color-mix(in oklab, var(--warn) 10%, transparent)',
            border: '1px solid color-mix(in oklab, var(--warn) 35%, var(--rule))',
          }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 eb-warn" />
          <p className="t-body mt-3">This browser cannot listen.</p>
          <p className="t-sub mt-2 leading-relaxed">
            Chrome on Android and Safari on iOS both support it. Everything else in Coach works
            here as normal.
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background:
                'linear-gradient(160deg, color-mix(in oklab, var(--signal) 14%, var(--surface)), var(--surface))',
              border: '1px solid color-mix(in oklab, var(--signal) 35%, var(--rule))',
            }}
          >
            <p className="eb-label">Speak on this</p>
            <p className="t-body mt-2.5 leading-relaxed">{prompt}</p>
          </div>

          {phase === 'listening' && (
            <div className="flex flex-col items-center mt-8">
              <motion.span
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'color-mix(in oklab, var(--signal) 20%, transparent)' }}
              >
                <Mic className="w-8 h-8 shrink-0" style={{ color: 'var(--signal-ink)' }} />
              </motion.span>
              <p className="t-figure text-2xl mt-4">{mmss}</p>
              <p className="t-sub mt-1">Listening</p>
            </div>
          )}

          {transcript && (
            <div
              className="rounded-2xl p-4 mt-6 max-h-52 overflow-y-auto"
              style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
            >
              <p className="eb-label">What you said</p>
              <p className="t-sub mt-2 leading-relaxed">{transcript}</p>
            </div>
          )}

          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 mt-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
            >
              <p className="eb-label">Feedback</p>
              <p className="t-body mt-2.5 whitespace-pre-wrap leading-relaxed">{feedback}</p>
            </motion.div>
          )}

          {error && (
            <p className="t-sub eb-warn mt-5" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 mt-7">
            {phase === 'idle' && (
              <button onClick={start} className="btn-lg flex-1">
                <Mic className="w-4 h-4 shrink-0" />
                Start speaking
              </button>
            )}

            {phase === 'listening' && (
              <button onClick={stop} className="btn-lg flex-1">
                <Square className="w-4 h-4 shrink-0" />
                Done
              </button>
            )}

            {phase === 'reviewing' && (
              <>
                <button onClick={reset} className="btn-quiet flex-1">
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  Again
                </button>
                <button onClick={getFeedback} className="btn-lg flex-1">
                  Get feedback
                </button>
              </>
            )}

            {phase === 'done' && (
              <button onClick={reset} className="btn-quiet flex-1">
                <RotateCcw className="w-4 h-4 shrink-0" />
                New prompt
              </button>
            )}
          </div>

          <p className="t-sub text-center mt-5 leading-relaxed">
            Your voice is processed on this device. Only the transcript is sent, and only when
            you ask for feedback.
          </p>
        </>
      )}
    </div>
  );
};
