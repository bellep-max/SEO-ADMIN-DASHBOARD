/**
 * Keyword idea generation — TS port of device-agent/keyword_research.py
 * (idea-mining + DeepSeek enrichment). Two free + one optional-AI source:
 *
 *  1. Google autocomplete (free, no key)  — mines intent-rich variants of a seed,
 *     with a popularity proxy = how broadly each suggestion surfaced.
 *  2. DeepSeek enrichment (optional, DEEPSEEK_API_KEY) — labels intent +
 *     commercial-intent + a one-line reason per idea.
 *  3. DeepSeek "AI search" (optional) — conversational questions a person would
 *     ask an AI assistant for this local service.
 *
 * Measured keyword difficulty (the reference's 3rd stage) needs the phone fleet
 * and is intentionally out of scope here.
 */

const AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

// Local modifiers prepended/appended to the seed to mine intent-rich variants for free.
const PREFIX_MODIFIERS = ["best", "affordable", "cheap", "top", "licensed", "near me", "24 hour"];
const SUFFIX_MODIFIERS = ["near me", "prices", "cost", "reviews", "open now", "for toddlers"];
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export interface KeywordIdea {
  keyword: string;
  /** Autocomplete popularity proxy in [0,1]; null for AI-generated questions. */
  popularity: number | null;
  intent: string;
  commercialIntent: number;
  reasoning: string;
  /** True for conversational AI-search questions (vs autocomplete ideas). */
  aiSearch: boolean;
}

function clip01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/\w+/g) ?? []));
}
function sharesToken(seed: string, kw: string): boolean {
  const a = tokens(seed), b = tokens(kw);
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/** Bounded-concurrency map (autocomplete is ~45 calls; keep it quick + gentle). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Google's free suggest endpoint. client=firefox returns [query, [suggestions]]. */
async function autocomplete(query: string, gl: string, hl: string, timeoutMs = 8000): Promise<string[]> {
  const params = new URLSearchParams({ client: "firefox", hl, gl, q: query });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, {
      headers: { "User-Agent": "Mozilla/5.0 (keyword-research)" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = JSON.parse(await res.text());
    return Array.isArray(data) && data.length > 1 && Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Mine autocomplete for seed variants; popularity proxy blends breadth + earliness. */
async function generateIdeas(seed: string, city: string, gl: string, hl: string, maxIdeas: number): Promise<KeywordIdea[]> {
  seed = seed.trim().toLowerCase();
  const cityFirst = (city || "").split(",")[0].trim();

  let queries = [seed, `${seed} `, ...ALPHABET.map((c) => `${seed} ${c}`),
    ...PREFIX_MODIFIERS.map((m) => `${m} ${seed}`), ...SUFFIX_MODIFIERS.map((m) => `${seed} ${m}`)];
  if (cityFirst) queries.push(`${seed} in ${cityFirst}`, `${seed} ${cityFirst}`, `best ${seed} ${cityFirst}`);
  queries = [...new Set(queries)];

  const freq = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;
  // Results arrive per-query; fold them in query order to keep `firstSeen` stable.
  const perQuery = await mapPool(queries, 6, (q) => autocomplete(q, gl, hl));
  for (const suggestions of perQuery) {
    for (const s of suggestions) {
      order++;
      const key = s.trim().toLowerCase();
      if (!key || (!key.includes(seed) && !sharesToken(seed, key))) continue;
      freq.set(key, (freq.get(key) ?? 0) + 1);
      if (!firstSeen.has(key)) firstSeen.set(key, order);
    }
  }
  if (freq.size === 0) return [];

  const maxFreq = Math.max(...freq.values());
  const ideas: KeywordIdea[] = [];
  for (const [kw, f] of freq) {
    const breadth = f / maxFreq;
    const early = 1.0 - Math.min(firstSeen.get(kw)!, 200) / 200.0;
    const popularity = Math.round((0.7 * breadth + 0.3 * early) * 10000) / 10000;
    ideas.push({ keyword: kw, popularity, intent: "unknown", commercialIntent: 0.5, reasoning: "", aiSearch: false });
  }
  ideas.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  return ideas.slice(0, maxIdeas);
}

async function deepseekChat(messages: Array<{ role: string; content: string }>, apiKey: string, temperature = 0.3, timeoutMs = 60000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, temperature, response_format: { type: "json_object" } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "{}";
  } finally {
    clearTimeout(timer);
  }
}

/** One DeepSeek call: intent + commercial-intent + reason per keyword (in place). */
async function enrichKeywords(ideas: KeywordIdea[], seed: string, location: string, apiKey: string | undefined): Promise<void> {
  if (!apiKey || ideas.length === 0) return;
  const sys = "You are a local-SEO keyword analyst. For each keyword, return its search intent and a "
    + "commercial-intent score. Respond with a JSON object: "
    + '{"results":[{"keyword":..., "intent":"informational|navigational|commercial|transactional", '
    + '"commercial_intent":0.0-1.0, "reasoning":"<=12 words why it matters for this local business"}]}';
  const user = `Business seed: ${seed}\nLocation: ${location}\nKeywords:\n` + ideas.map((i) => `- ${i.keyword}`).join("\n");
  try {
    const content = await deepseekChat([{ role: "system", content: sys }, { role: "user", content: user }], apiKey);
    const parsed = JSON.parse(content).results ?? [];
    const byKw = new Map<string, Record<string, unknown>>(parsed.map((r: Record<string, unknown>) => [String(r.keyword ?? "").trim().toLowerCase(), r]));
    for (const it of ideas) {
      const r = byKw.get(it.keyword);
      if (!r) continue;
      it.intent = typeof r.intent === "string" ? r.intent : "unknown";
      it.commercialIntent = clip01(r.commercial_intent);
      it.reasoning = typeof r.reasoning === "string" ? r.reasoning : "";
    }
  } catch {
    // Degrade silently — ideas keep their neutral defaults.
  }
}

/** Conversational queries someone would ask an AI assistant — the "AI search" list. */
async function generateAiSearch(seed: string, location: string, apiKey: string | undefined, n = 8): Promise<KeywordIdea[]> {
  if (!apiKey) return [];
  const sys = "Generate natural, conversational questions a person would ask an AI assistant "
    + "(ChatGPT, Gemini) when looking for this local service. Respond as JSON: "
    + '{"results":[{"keyword":"<question>","intent":"commercial|informational",'
    + '"commercial_intent":0.0-1.0,"reasoning":"<=12 words"}]}';
  const user = `Service: ${seed}\nLocation: ${location}\nProduce ${n} distinct questions.`;
  try {
    const content = await deepseekChat([{ role: "system", content: sys }, { role: "user", content: user }], apiKey, 0.7);
    const out = JSON.parse(content).results ?? [];
    return out
      .map((r: Record<string, unknown>): KeywordIdea => ({
        keyword: String(r.keyword ?? "").trim(),
        popularity: null,
        intent: typeof r.intent === "string" ? r.intent : "informational",
        commercialIntent: clip01(r.commercial_intent ?? 0.6),
        reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
        aiSearch: true,
      }))
      .filter((r: KeywordIdea) => r.keyword);
  } catch {
    return [];
  }
}

/** Public: seed → ranked autocomplete ideas (+ optional DeepSeek enrichment / AI-search). */
export async function suggestKeywords(
  seed: string,
  opts: { location?: string; gl?: string; hl?: string; maxIdeas?: number; includeAiSearch?: boolean } = {},
): Promise<{ ideas: KeywordIdea[]; aiSearch: KeywordIdea[]; enriched: boolean }> {
  const location = opts.location ?? "";
  const gl = opts.gl ?? "us";
  const hl = opts.hl ?? "en";
  const apiKey = process.env.DEEPSEEK_API_KEY;

  const ideas = await generateIdeas(seed, location, gl, hl, opts.maxIdeas ?? 25);
  await enrichKeywords(ideas, seed, location, apiKey);
  const aiSearch = opts.includeAiSearch ? await generateAiSearch(seed, location, apiKey) : [];
  return { ideas, aiSearch, enriched: !!apiKey };
}
