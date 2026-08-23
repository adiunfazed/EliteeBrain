import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { initAdmin, isAdminAvailable, verifyUser, lastVerifyFailure } from './serverAuth';
import { getLeaderboard, syncLeaderboardEntry } from './serverLeaderboard';
import { buildCoachContext, describeContext } from './serverCoachContext';
import {
  initPush,
  saveSubscription,
  removeSubscription,
  runScheduledReminders,
  sendToUser,
} from './serverPush';

/**
 * Groq models in preference order. Meta's Llama chat models were retired in
 * June 2026, so a single hardcoded id is a liability — the first that responds
 * is used, and a 404 moves to the next.
 */
const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];

/** Reason the last provider attempt failed, for accurate error reporting. */
let lastProviderError: string | null = null;

async function generateCoachReply(
  userProfile: any,
  userMessage: string,
  mode: string,
  history?: any[],
  context: any = null
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const day = userProfile?.currentDay || 1;
  const streak = userProfile?.streakDays || 0;
  const modules = userProfile?.modules || {};

  const systemPrompt = `You are the EliteLife coach — a practical, direct assistant helping someone plan their day, build habits, focus, and follow through on goals.

What you know about them:
- Day ${day} of their protocol, ${streak}-day streak
- Training module levels: ${JSON.stringify(modules)}

How to talk:
- Answer the actual question. If they ask "what am I doing wrong", respond to THAT, not to a generic topic you recognise in it.
- Write like a person texting a friend who happens to be good at this. Short sentences. No lecture.
- 2-4 sentences for most questions. Only go longer if they ask for a plan or breakdown.
- No headings. No bold-everything. Bullets only for an actual list of steps.
- Never open with a title like "**AI Performance Insights**" or restate their question back at them.
- If you need more context to be useful, ask one short question instead of guessing.
- Be honest. If something won't help much, say so. Don't inflate.
- No medical or clinical claims, no promises about IQ or guaranteed results.
- Never repeat a previous answer. If they rephrase, engage with the new angle.
- You can see their real data below. Use specifics from it — name the actual
  task, habit or block. Never invent activity that is not listed, and if the
  data does not answer their question, say so and ask.${describeContext(context)}`;

  lastProviderError = null;

  let prompt = userMessage || '';
  if (mode === 'audit') {
    prompt = `Generate my comprehensive Elite Life Cognitive Audit. Analyze my current module levels and daily streak, identify where I'm doing well and where I'm weakest, and suggest 3 concrete daily habits.`;
  }

  // 1. Attempt Gemini first — highest free daily request allowance.
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history.slice(-6)) {
          contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (err: any) {
      // Surface the real cause — a bad key, quota exhaustion and a network
      // failure all previously looked identical from the outside.
      const status = err?.status || err?.code || '';
      const msg = err?.message || String(err);
      console.error('Gemini API error:', status, msg, err?.statusText || '');
      lastProviderError = `Gemini: ${status ? status + ' ' : ''}${msg}`.slice(0, 300);
    }
  } else {
    console.warn('GEMINI_API_KEY is not set — the coach will use offline replies.');
  }

  // 2. Fall back to Groq (groq.com) — free tier, no card, very fast.
  if (groqKey) {
    let modelIndex = 0;
    while (modelIndex < GROQ_MODELS.length) {
    const model = process.env.GROQ_MODEL || GROQ_MODELS[modelIndex];
    try {
      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history.slice(-6)) {
          messages.push({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      }
      messages.push({ role: 'user', content: prompt });

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 900,
        }),
      });

      if (groqRes.ok) {
        const groqData: any = await groqRes.json();
        const text = groqData?.choices?.[0]?.message?.content;
        if (text) return text.trim();
        lastProviderError = 'Groq returned an empty reply.';
      } else {
        const body = await groqRes.text().catch(() => '');
        // 404 means the model was retired — try the next one rather than
        // failing the whole request.
        if (groqRes.status === 404 && modelIndex < GROQ_MODELS.length - 1) {
          console.warn(`Groq model ${model} unavailable, trying next.`);
          modelIndex++;
          continue;
        }
        lastProviderError = `Groq: ${groqRes.status} ${body.slice(0, 200)}`;
        console.error('Groq API error:', groqRes.status, body.slice(0, 300));
      }
      break;
    } catch (err: any) {
      lastProviderError = `Groq: ${err?.message || err}`;
      console.error('Groq API error:', err?.message || err);
      break;
    }
    }
  }

  // 3. Fall back to Grok (xAI) if a key is configured. Note: paid, no free tier.
  if (grokKey) {
    try {
      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history.slice(-6)) {
          messages.push({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      }
      messages.push({ role: 'user', content: prompt });

      const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages,
          temperature: 0.7,
        }),
      });

      if (grokRes.ok) {
        const grokData: any = await grokRes.json();
        const text = grokData?.choices?.[0]?.message?.content;
        if (text) return text.trim();
      } else {
        console.warn('Grok API returned status:', grokRes.status);
      }
    } catch (err) {
      console.error('Grok API error:', err);
    }
  }

  // Every provider failed. Report why rather than returning a canned reply
  // that hides the cause.
  if (lastProviderError) {
    throw new Error(lastProviderError);
  }
  if (!geminiKey && !groqKey && !grokKey) {
    throw new Error(
      'No AI provider is configured. Set GEMINI_API_KEY or GROQ_API_KEY in Render.'
    );
  }
  return generateIntelligentFallback(userProfile, prompt, mode);
}

/**
 * Offline reply.
 *
 * Used only when no AI provider responds. It deliberately does NOT imitate an
 * AI answer — the old version returned topic-matched essays, so a user asking
 * two different questions got two confident, unrelated lectures and no
 * indication anything had failed.
 */
function generateIntelligentFallback(userProfile: any, prompt: string, mode: string): string {
  const streak = userProfile?.streakDays || 0;

  if (mode === 'audit') {
    return (
      `I can't reach the AI right now, so here's what your own data says.\n\n` +
      `You're on a ${streak}-day streak. Open Progress to see which area has the least ` +
      `follow-through this week — that's usually the one worth fixing first.\n\n` +
      `Try the audit again in a minute.`
    );
  }

  return (
    `I couldn't reach the AI just now, so I don't want to guess at an answer.\n\n` +
    `Try again in a moment. If it keeps happening, the API key may need checking.`
  );
}

async function startServer() {
  // Initialise before any request can arrive.
  initAdmin();

  // One clear line stating what is and isn't configured. Diagnosing "the coach
  // doesn't work" previously meant guessing between a missing key, a bad key,
  // and an exhausted quota.
  console.log(
    '[EliteLife config]',
    `gemini=${process.env.GEMINI_API_KEY ? 'set' : 'MISSING'}`,
    `groq=${process.env.GROQ_API_KEY ? 'set' : 'not set'}`,
    `grok=${process.env.GROK_API_KEY || process.env.XAI_API_KEY ? 'set' : 'not set'}`,
    `firebaseAdmin=${isAdminAvailable() ? 'active' : 'MISSING'}`
  );

  const app = express();
  // Cloud Run / most hosts inject PORT. Listening on a hardcoded port makes the
  // container fail its health check and the deployment is marked "not ready".
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);

  // Security headers. CSP is left off because the app loads QR images from
  // quickchart.io and fonts/Firebase from Google origins; enable it once you
  // have pinned those origins.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Firebase signInWithPopup opens Google's consent screen in a popup and
      // reads the result back through window.opener. Helmet's default of
      // "same-origin" severs that link, and the SDK reports the failure as
      // "popup closed by user". "same-origin-allow-popups" keeps the isolation
      // benefit while letting our own popups reply.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      // Social crawlers need to fetch the OG image cross-origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(compression());

  // Cap body size — the coach endpoint accepts chat history and would otherwise
  // accept an unbounded payload.
  app.use(express.json({ limit: '128kb' }));

  // The coach endpoint spends real money on every call. Without a limit, one
  // script can drain the Gemini budget in minutes.
  const coachLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many coach requests. Please wait a moment and try again.' },
  });


  // Health check
  /**
   * Configuration status. Reports only whether things are set, never their
   * values, so it is safe to open in a browser.
   */
  app.get('/api/status', (req, res) => {
    res.json({
      geminiKey: !!process.env.GEMINI_API_KEY,
      groqKey: !!process.env.GROQ_API_KEY,
      grokKey: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
      firebaseAdmin: isAdminAvailable(),
      coachReady:
        (!!process.env.GEMINI_API_KEY || !!process.env.GROQ_API_KEY) && isAdminAvailable(),
    });
  });

  /**
   * Owner-only AI probe. Requires ADMIN_PROBE_KEY so it cannot be abused, and
   * bypasses the entitlement gate so a provider fault can be diagnosed
   * separately from an authentication fault.
   */
  app.post('/api/probe', coachLimiter, async (req, res) => {
    const key = req.headers['x-probe-key'];
    if (!process.env.ADMIN_PROBE_KEY || key !== process.env.ADMIN_PROBE_KEY) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      const reply = await generateCoachReply(
        { streakDays: 0, currentDay: 1, modules: {} },
        String(req.body?.message || 'Say hello in one short sentence.'),
        'chat',
        []
      );
      res.json({ ok: true, reply });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  /**
   * Leaderboard read. Returns real entries only — on failure it errors rather
   * than substituting placeholder users.
   */
  app.get('/api/leaderboard', async (req, res) => {
    if (!isAdminAvailable()) {
      return res.status(503).json({ error: 'Leaderboard temporarily unavailable.' });
    }
    try {
      const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
      const verified = await verifyUser(idToken);
      const mode = req.query.mode === 'weekly' ? 'weekly' : 'career';

      const page = await getLeaderboard(verified?.uid || null, mode, 20);
      res.json(page);
    } catch (err: any) {
      console.error('Leaderboard read failed:', err?.message || err);
      res.status(500).json({ error: 'Leaderboard temporarily unavailable.' });
    }
  });

  /**
   * Publish the caller's entry. XP is recomputed server-side from their stored
   * activity, so a client cannot submit a number of its own choosing.
   */
  app.post('/api/leaderboard/sync', coachLimiter, async (req, res) => {
    if (!isAdminAvailable()) {
      return res.status(503).json({ error: 'Leaderboard temporarily unavailable.' });
    }
    try {
      const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
      const verified = await verifyUser(idToken);
      if (!verified) return res.status(401).json({ error: 'Sign in to join the leaderboard.' });

      // Note: the request body is ignored entirely. Only the verified uid is
      // used, and every number is derived from the database.
      const entry = await syncLeaderboardEntry(verified.uid);
      res.json(entry);
    } catch (err: any) {
      console.error('Leaderboard sync failed:', err?.message || err);
      res.status(500).json({ error: 'Could not update your ranking.' });
    }
  });

  /**
   * Owner-only entitlement dump. Guessing why a badge doesn't appear wastes
   * rounds; this shows exactly which fields each account actually has.
   * Returns booleans and dates only — no emails, no payment identifiers.
   */
  app.get('/api/probe/entitlements', async (req, res) => {
    const key = req.headers['x-probe-key'];
    if (!process.env.ADMIN_PROBE_KEY || key !== process.env.ADMIN_PROBE_KEY) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!isAdminAvailable()) {
      return res.status(503).json({ error: 'Admin unavailable.' });
    }
    try {
      const { getFirestore } = await import('firebase-admin/firestore');
      const { resolveEntitlement, readField, readDisplayName } = await import('./serverEntitlement');
      const snap = await getFirestore().collection('users').get();

      const rows = snap.docs.map((d) => {
        const data = d.data();
        const ent = resolveEntitlement(data);
        return {
          name: readDisplayName(data),
          isPro: ent.isPro,
          status: ent.status,
          topLevel: {
            lifetimePro: data?.lifetimePro ?? null,
            trialStartedAt: data?.trialStartedAt ?? null,
            proPlanType: data?.proPlanType ?? null,
            isProUser: data?.isProUser ?? null,
          },
          inProfileData: {
            type: typeof data?.profileData,
            lifetimePro: readField({ profileData: data?.profileData }, 'lifetimePro') ?? null,
            trialStartedAt: readField({ profileData: data?.profileData }, 'trialStartedAt') ?? null,
          },
        };
      });

      res.json({ count: rows.length, users: rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  /** The public VAPID key, needed by the browser to subscribe. */
  app.get('/api/push/key', (req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'Push not configured.' });
    res.json({ key });
  });

  /** Register a device. Stored under the verified user, never trusting a uid
      supplied by the client. */
  app.post('/api/push/subscribe', async (req, res) => {
    if (!isAdminAvailable()) return res.status(503).json({ error: 'Unavailable.' });
    try {
      const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
      const verified = await verifyUser(idToken);
      if (!verified) return res.status(401).json({ error: 'Sign in first.' });

      const { endpoint, keys, utcOffsetMinutes } = req.body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Invalid subscription.' });
      }

      await saveSubscription(verified.uid, {
        endpoint,
        keys,
        // Clamped to the real range of world offsets so a bad value cannot
        // shift someone's reminders to an absurd hour.
        utcOffsetMinutes: Math.max(-780, Math.min(840, Number(utcOffsetMinutes) || 0)),
        createdAt: new Date().toISOString(),
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Subscribe failed:', err?.message || err);
      res.status(500).json({ error: 'Could not register this device.' });
    }
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    if (!isAdminAvailable()) return res.status(503).json({ error: 'Unavailable.' });
    try {
      const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
      const verified = await verifyUser(idToken);
      if (!verified) return res.status(401).json({ error: 'Sign in first.' });

      const { endpoint } = req.body || {};
      if (endpoint) await removeSubscription(verified.uid, endpoint);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Could not remove this device.' });
    }
  });

  /** Send a test push to the caller's own devices. */
  app.post('/api/push/test', coachLimiter, async (req, res) => {
    if (!isAdminAvailable()) return res.status(503).json({ error: 'Unavailable.' });
    try {
      const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
      const verified = await verifyUser(idToken);
      if (!verified) return res.status(401).json({ error: 'Sign in first.' });

      const sent = await sendToUser(verified.uid, {
        title: 'EliteLife',
        body: 'Notifications are working.',
        tag: 'test',
      });
      res.json({ sent });
    } catch (err: any) {
      res.status(500).json({ error: 'Could not send.' });
    }
  });

  /**
   * Scheduler pass. Called every 15 minutes; decides per user whether
   * anything is worth sending right now. Key-protected so it cannot be
   * invoked by anyone who finds the URL.
   */
  app.post('/api/push/run-daily', async (req, res) => {
    const key = req.headers['x-cron-key'];
    if (!process.env.CRON_KEY || key !== process.env.CRON_KEY) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!isAdminAvailable()) return res.status(503).json({ error: 'Unavailable.' });

    try {
      const result = await runScheduledReminders();
      res.json(result);
    } catch (err: any) {
      console.error('Daily reminders failed:', err?.message || err);
      res.status(500).json({ error: 'Run failed.' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Cognitive Coach Endpoint
  app.post('/api/coach', coachLimiter, async (req, res) => {
    try {
      const { userProfile, userMessage, mode, history } = req.body;

      // Access is decided by a verified Firebase ID token, never by what the
      // browser claims. Posting {"userProfile":{"isProUser":true}} does nothing.
      const idToken =
        (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
      const verified = await verifyUser(idToken);

      if (!isAdminAvailable()) {
        // Fail CLOSED. Falling back to trusting the client would reopen the
        // exact hole this replaced.
        console.error('Coach request refused: server-side verification unavailable.');
        return res.status(503).json({
          error: 'The AI Coach is temporarily unavailable. Please try again later.',
        });
      }

      if (!verified) {
        // Distinguish "no token sent" from "token rejected" — they need
        // different fixes and the generic message hid which was happening.
        // Firebase error codes are usually strings but can arrive as numbers,
        // and calling .includes() on a number threw inside the error handler —
        // turning a clean 401 into a confusing 500.
        const code = String(lastVerifyFailure?.code ?? '');
        // Report the real cause. "Session expired" was shown for every
        // failure mode, including ones a re-login could never fix.
        const reason = lastVerifyFailure?.reason;
        const message = reason === 'db_unavailable'
          ? `The server signed you in but could not read your account (Firestore error ${code || 'unknown'}). This is a server configuration problem, not your account.`
          : !idToken
          ? 'Sign-in did not reach the server. Refresh the page and try again.'
          : code.includes('expired')
            ? 'Your session expired. Refresh the page and try again.'
            : code.includes('argument')
              ? 'Your sign-in token was not readable. Sign out and back in.'
              : `Could not verify your sign-in (${code || 'unknown'}). Sign out and back in.`;
        return res.status(401).json({ error: message, code });
      }

      if (!verified.isPro) {
        return res.status(403).json({
          error:
            verified.status === 'expired'
              ? 'Your free month has ended. Unlock Pro to keep using the AI Coach.'
              : 'The AI Coach is a Pro feature. Start your free month to unlock it.',
        });
      }

      // Context is read from the database, not from the request. The client
      // cannot invent a history for the coach to react to.
      const context = await buildCoachContext(verified.uid);
      const reply = await generateCoachReply(userProfile, userMessage, mode, history, context);
      res.json({ reply });
    } catch (err: any) {
      const detail = err?.message || String(err);
      console.error('AI Coach Server Error:', err?.status || '', detail, err?.stack || '');
      res.status(500).json({
        error: `The AI Coach hit an error: ${detail}`,
        detail,
      });
    }
  });

  // NOTE: the /api/subscription/* endpoints were removed. The frontend never
  // called them (payments run through Firestore + admin approval), and they
  // contained a payment verifier that approved any request plus a stray
  // hardcoded UPI ID. Dead code on a payment path is pure attack surface.

  // Vite middleware for development or static serving for production.
  // Default to PRODUCTION: vite is a devDependency and is pruned from a
  // production install, so an unset NODE_ENV would crash the container here.
  if (process.env.NODE_ENV === 'development') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // Hashed asset filenames change whenever content changes, so they can be
    // cached forever. index.html must never be cached or users get stale builds.
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );

    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server execution error:', err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
