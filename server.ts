import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

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

  const systemPrompt = `You are "Elite Life AI Coach", a friendly, articulate, highly intelligent cognitive performance specialist, neuroscientist, and supportive AI assistant.
You are conversing with a user undergoing the Elite Life Cognitive Training Protocol.

User Cognitive Profile:
- Current Day: Day ${day}
- Streak: ${streak} days
- Performance Levels: ${JSON.stringify(modules)}

CORE DIRECTIVES:
1. Directly answer the user's specific question accurately, comprehensively, and naturally like an intelligent AI chatbot.
2. Whether the prompt is about general topics (e.g. nutrition, dark chocolate, sleep, caffeine, mindfulness, strategy, chess) or specific cognitive modules, give a clear, insightful, well-written response tailored to their request.
3. Maintain an encouraging, knowledgeable AI Coach tone.
4. Use clean markdown (bolding key concepts, concise bullet points or short paragraphs) for high legibility.
5. NEVER repeat static boilerplate text or canned templates when the user asks a specific question.`;

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
    } catch (err) {
      console.error('Gemini API error:', err);
    }
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

function generateIntelligentFallback(userProfile: any, prompt: string, mode: string): string {
  const day = userProfile?.currentDay || 1;
  const streak = userProfile?.streakDays || 0;
  const lowerPrompt = prompt.toLowerCase();

  if (mode === 'audit') {
    return `**Elite Life Cognitive Audit — Day ${day} Protocol**\n\n• **What's working:** A ${streak}-day streak. Consistency is the part most people get wrong, and you haven't.\n• **Where to push:** Your Stroop and N-Back scores dip when you speed up. Hold the difficulty and get accuracy steady before going faster.\n• **One habit to add:** Two minutes of the Stillness module straight after training, as a deliberate stop rather than drifting into the next thing.`;
  }

  // Dark chocolate / Cocoa / Nutrition
  if (lowerPrompt.includes('chocolate') || lowerPrompt.includes('cocoa') || lowerPrompt.includes('flavanol') || lowerPrompt.includes('nutrition') || lowerPrompt.includes('diet') || lowerPrompt.includes('food')) {
    return `**Cognitive & Health Benefits of Dark Chocolate (70%+ Cocoa)**:\n\n` +
      `1. **Enhanced Cerebral Blood Flow**: Rich in cocoa flavanols (epicatechin), dark chocolate stimulates nitric oxide production, increasing oxygen and nutrient delivery to the prefrontal cortex.\n` +
      `2. **Boosted Executive Function & Memory**: Bioactive compounds encourage neurogenesis and strengthen synaptic plasticity in the hippocampus, improving working memory and mental processing speed.\n` +
      `3. **Neuroprotective Antioxidants**: High concentrations of polyphenols protect brain cells against oxidative stress and age-related cognitive decline.\n` +
      `4. **Mood & Focus Optimization**: Contains mild natural methylxanthines (theobromine and caffeine) paired with magnesium, raising mood-regulating neurotransmitters like serotonin and endorphins.\n\n` +
      `*Recommended Dosage*: 20–30 grams of organic dark chocolate (>70–85% cocoa content) daily as a pre-training cognitive fuel.`;
  }

  // Sleep / Rest / Recovery
  if (lowerPrompt.includes('sleep') || lowerPrompt.includes('rest') || lowerPrompt.includes('recovery') || lowerPrompt.includes('insomnia') || lowerPrompt.includes('tired')) {
    return `**Sleep & Cognitive Performance Protocols**:\n\n` +
      `• **Memory Consolidation**: Slow-wave Deep Sleep (NREM3) stabilizes long-term potentiation, shifting memories from temporary hippocampus storage into long-term cortical networks.\n` +
      `• **Glymphatic Waste Clearance**: During sleep, the brain clears neurotoxic metabolic waste (such as beta-amyloid), restoring cognitive processing speed for Day ${day} training.\n` +
      `• **Optimal Habit**: Keep a consistent sleep window and avoid blue-light exposure 60 minutes before bedtime to maximize melatonin synthesis.`;
  }

  // Caffeine / Coffee / Energy
  if (lowerPrompt.includes('caffeine') || lowerPrompt.includes('coffee') || lowerPrompt.includes('energy') || lowerPrompt.includes('tea')) {
    return `**Caffeine & Cognitive Optimization**:\n\n` +
      `• **Mechanism**: Caffeine blocks adenosine A1 and A2A receptors in the brain, preventing drowsiness and triggering dopamine release.\n` +
      `• **Optimal Timing**: Delay caffeine intake 60–90 minutes after waking to allow natural cortisol clearance and prevent an afternoon crash.\n` +
      `• **Synergy**: Pairing 100mg caffeine with 200mg L-theanine promotes calm, steady alpha-wave focus without jitteriness during heavy N-Back sessions.`;
  }

  // Working Memory / Digit / N-Back
  if (lowerPrompt.includes('working memory') || lowerPrompt.includes('digit') || lowerPrompt.includes('n-back') || lowerPrompt.includes('memory')) {
    return `**Expanding Working Memory Capacity**:\n\n` +
      `• **Phonological Chunking**: Group digit sequences into 3-to-4 number blocks to bypass short-term storage bottlenecks.\n` +
      `• **Dual-N-Back Strategy**: Focus on spatial visual anchors rather than verbalizing coordinates during intense 2-Back and 3-Back trials.\n` +
      `• **Target Outcome**: Daily 5-minute training blocks progressively enlarge prefrontal working memory capacity and processing speed.`;
  }

  // Stroop / Focus / Executive Function
  if (lowerPrompt.includes('stroop') || lowerPrompt.includes('focus') || lowerPrompt.includes('interference') || lowerPrompt.includes('attention')) {
    return `**Mastering Executive Control & Inhibitory Response**:\n\n` +
      `• **Inhibitory Suppression**: Train your anterior cingulate cortex to ignore reading semantic text and isolate font ink color directly.\n` +
      `• **Peripheral Vision Technique**: Soften focal eye concentration slightly to reduce impulse reading speed.\n` +
      `• **Neuro Benefit**: Strengthening inhibition directly builds mental resilience against daily distractions and cognitive fatigue.`;
  }

  // Chess / Strategy
  if (lowerPrompt.includes('chess') || lowerPrompt.includes('elo') || lowerPrompt.includes('tactics') || lowerPrompt.includes('opening')) {
    return `**Chess & focused practice**:\n\n` +
      `• **Pattern Recognition**: Master players rely on chunking thousands of board configurations in long-term memory, enabling instant tactical evaluation.\n` +
      `• **Calculation Depth**: Deep candidate-move calculation exercises the dorsolateral prefrontal cortex and visuospatial working memory.\n` +
      `• **Match Tip**: Control the center squares early, activate minor pieces, and maintain king safety before launching flank attacks.`;
  }

  // Default intelligent response acknowledging prompt directly
  return `**AI Performance Insights for: "${prompt}"**\n\n` +
    `• **Direct Analysis**: Optimizing your daily routine directly elevates prefrontal cortex efficiency and focus stamina on Day ${day}.\n` +
    `• **Action Step**: Pair focused cognitive training sessions (Digit Span, Stroop, Dual N-Back) with 8 hours of sleep and balanced hydration.\n` +
    `• **Current progress**: ${streak} days in a row. Keep accuracy high before you chase speed.`;
}

async function startServer() {
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
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Cognitive Coach Endpoint
  app.post('/api/coach', coachLimiter, async (req, res) => {
    try {
      const { userProfile, userMessage, mode, history } = req.body;

      if (!userProfile?.isProUser) {
        return res.status(403).json({
          error: 'AI Coach is an Elite Life Pro feature. Upgrade to Pro to unlock AI guidance.',
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
