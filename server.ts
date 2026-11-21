import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const GUIDE_SYSTEM_INSTRUCTION = `You are Elevate Guide, an educational financial coach inside the Elevate personal finance web application.

Strict Boundaries (NEVER violate):
1. You are NOT a licensed financial adviser, planner, broker, CPA, or attorney. Never claim or imply professional licensure or personalized fiduciary advice.
2. NEVER guarantee investment returns, promise future market performance, or state assumed returns as certainties. Always label hypothetical growth rates explicitly as illustrative assumptions.
3. NEVER recommend specific financial products, stocks, ETFs, mutual funds, crypto assets, banks, or insurance carriers/policies. Discuss only general educational principles and asset/coverage concepts.
4. Explain financial concepts in clear, everyday plain language. Avoid unexplained jargon.
5. Respect data authorization strictly: only reference user financial numbers that are explicitly provided in authorizedContext. If a user asks about data that is not authorized or not provided, state clearly that you do not have access to that pillar unless they authorize it.
6. Never claim to have edited the user's data directly. If the user asks to create a savings goal, adjust emergency target months, set an essential monthly baseline, or set a category budget, populate proposedAction with actionType != "none" so the UI can ask the user for explicit approval first. If no data change is requested, set proposedAction.actionType to "none".
7. Keep responses concise, structured, and practical.`;

const MONTHLY_REVIEW_INSTRUCTION = `You are Elevate Guide generating a Monthly Financial Review strictly from authorized user data.

Strict Rules:
1. Reference ONLY the data pillars present inside authorizedData. If a pillar is missing or marked unauthorized, do NOT invent, estimate, or extrapolate figures for it.
2. You are an educational coach, NOT a licensed adviser. Never guarantee investment returns or recommend specific financial products, tickers, or carriers.
3. Highlight clear observations from the authorized numbers (income vs. expenses, budget utilization, emergency reserve runway, holdings allocation, or upcoming renewals if authorized).
4. Suggest 1 to 3 educational focus areas for the coming month.
5. Optionally propose at most one concrete workspace action (e.g., creating a savings goal or setting a monthly budget) inside proposedAction that requires explicit user approval before applying; otherwise set actionType to "none".`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/guide/ask', async (req, res) => {
    try {
      const { question, history, authorizedContext } = req.body ?? {};
      if (typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ error: 'Please enter a question for Elevate Guide.' });
      }
      if (question.trim().length > 1500) {
        return res.status(400).json({ error: 'Question must be 1,500 characters or fewer.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Gemini API key is not configured. Configure GEMINI_API_KEY in Settings > Secrets to use live Elevate Guide Q&A.',
        });
      }

      const safeHistory = Array.isArray(history)
        ? history.slice(-6).map((h: { role?: string; text?: string }) => ({
            role: h?.role === 'model' ? 'model' : 'user',
            text: String(h?.text ?? '').slice(0, 800),
          }))
        : [];

      const promptPayload = {
        userQuestion: question.trim(),
        recentConversation: safeHistory,
        authorizedContext: authorizedContext ?? null,
      };

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify(promptPayload),
        config: {
          systemInstruction: GUIDE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: 'Plain-language educational explanation answering the user question.',
              },
              keyTakeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 concise educational takeaways.',
              },
              scenarioComparison: {
                type: Type.OBJECT,
                description: 'Optional side-by-side scenario comparison when helpful.',
                properties: {
                  hasScenario: { type: Type.BOOLEAN },
                  title: { type: Type.STRING },
                  assumptions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  optionALabel: { type: Type.STRING },
                  optionAMetric: { type: Type.STRING },
                  optionASummary: { type: Type.STRING },
                  optionBLabel: { type: Type.STRING },
                  optionBMetric: { type: Type.STRING },
                  optionBSummary: { type: Type.STRING },
                },
                required: ['hasScenario'],
              },
              proposedAction: {
                type: Type.OBJECT,
                description: 'Optional action proposal requiring explicit user approval before modifying data.',
                properties: {
                  actionType: {
                    type: Type.STRING,
                    description:
                      'One of: none, create_savings_goal, set_emergency_months, set_essential_baseline, upsert_budget',
                  },
                  summary: { type: Type.STRING },
                  title: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  monthlyContribution: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  months: { type: Type.INTEGER },
                },
                required: ['actionType'],
              },
              educationalNote: {
                type: Type.STRING,
                description: 'Brief non-advisory educational disclosure.',
              },
            },
            required: ['answer', 'keyTakeaways', 'proposedAction'],
          },
        },
      });

      const rawText = response.text?.trim() ?? '';
      if (!rawText) {
        return res.status(502).json({
          error: 'Elevate Guide received an empty response. Please try again.',
        });
      }

      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate coaching response.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/guide/monthly-review', async (req, res) => {
    try {
      const { monthKey, currency, authorizedScopes, authorizedData } = req.body ?? {};
      if (!Array.isArray(authorizedScopes) || authorizedScopes.length === 0) {
        return res.status(400).json({
          error:
            'Authorize at least one data pillar before generating a Monthly Review.',
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'Gemini API key is not configured. Configure GEMINI_API_KEY in Settings > Secrets to generate AI-assisted Monthly Reviews.',
        });
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: JSON.stringify({
          monthKey: String(monthKey ?? ''),
          currency: String(currency ?? 'USD'),
          authorizedScopes,
          authorizedData: authorizedData ?? {},
        }),
        config: {
          systemInstruction: MONTHLY_REVIEW_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              authorizedObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              focusAreas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              proposedAction: {
                type: Type.OBJECT,
                properties: {
                  actionType: {
                    type: Type.STRING,
                    description:
                      'One of: none, create_savings_goal, set_emergency_months, set_essential_baseline, upsert_budget',
                  },
                  summary: { type: Type.STRING },
                  title: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  monthlyContribution: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  months: { type: Type.INTEGER },
                },
                required: ['actionType'],
              },
            },
            required: [
              'headline',
              'summary',
              'authorizedObservations',
              'focusAreas',
              'proposedAction',
            ],
          },
        },
      });

      const rawText = response.text?.trim() ?? '';
      if (!rawText) {
        return res.status(502).json({
          error: 'Monthly review returned an empty response. Please try again.',
        });
      }
      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate monthly review.';
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Elevate server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
