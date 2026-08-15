import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { initAdmin, isAdminAvailable, verifyUser } from './serverAuth';

async function generateCoachReply(
  userProfile: any,
  userMessage: string,
  mode: string,
  history?: any[]
): Promise<string> {
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
- Never repeat a previous answer. If they rephrase, engage with the new angle.`;

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
      console.error(
        'Gemini API error:',
        err?.status || '',
        err?.message || err,
        err?.statusText || ''
      );
    }
  } else {
    console.warn('GEMINI_API_KEY is not set — the coach will use offline replies.');
  }

  // 2. Fall back to Grok (xAI) if a key is configured. Note: paid, no free tier.
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

  // 4. Offline fallback so the coach always returns something useful.
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
      grokKey: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
      firebaseAdmin: isAdminAvailable(),
      coachReady: !!process.env.GEMINI_API_KEY && isAdminAvailable(),
    });
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
        return res.status(401).json({
          error: idToken
            ? 'Your session has expired. Sign out and back in, then try again.'
            : 'Sign-in did not reach the server. Refresh the page and try again.',
        });
      }

      if (!verified.isPro) {
        return res.status(403).json({
          error:
            verified.status === 'expired'
              ? 'Your free month has ended. Unlock Pro to keep using the AI Coach.'
              : 'The AI Coach is a Pro feature. Start your free month to unlock it.',
        });
      }

      const reply = await generateCoachReply(userProfile, userMessage, mode, history);
      res.json({ reply });
    } catch (err: any) {
      console.error('AI Coach Server Error:', err);
      res.status(500).json({
        error: 'The AI Coach is unavailable right now. Please try again shortly.',
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
