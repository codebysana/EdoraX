import Anthropic from "@anthropic-ai/sdk";
import { env, homeAiDemoAvailable } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";
import { buildMessages, buildSystemPrompt, modelSettings } from "../chapter-qa/prompt.js";

// The home page's live AI demo: a visitor picks one of a few preset questions about a fixed
// lesson and the chapter tutor answers it. It is locked down so it cannot be misused:
// - only the question ids below are accepted, so nobody can send their own text to the model;
// - the lesson and the rules are fixed here, on the server, and the key never leaves it;
// - each answer is cached, so the model runs at most once per question per cache period;
// - a daily cap stops all model calls for the rest of the UTC day once reached;
// - any problem (no key, cap reached, provider error) returns a saved answer instead of an error.
// Together these bound the cost to a few calls an hour, whatever the traffic.

export const DEMO_COURSE = "Networking, Hands On";
export const DEMO_CHAPTER = "Names are for people. Addresses are for machines.";

export const DEMO_LESSON = `## Names are for people. Addresses are for machines.

When you type edorax.com and press Go, your phone has a name, not a place to send anything. Every machine on the internet is reached by an IP address, a string of numbers such as 203.0.113.10.

So before anything else happens, your phone asks a name server, the Domain Name System (DNS), which address goes with the name. Only with that answer can it open a connection to the server and ask for the page.

## The lookup

Your phone first asks a resolver, usually run by your internet provider or a public service. If the resolver does not already know the answer, it asks the servers responsible for .com, and they point it to the servers responsible for edorax.com, which give the address.

## Caching

Asking every time would be slow, so answers are cached. Each DNS answer comes with a time to live (TTL), for example 300 seconds. Your phone and the resolver keep the answer until the TTL runs out, then ask again. That is why most page loads skip the lookup entirely.

## When DNS fails

If no name server answers, the phone cannot turn the name into an address, so the site does not load even though the server itself is fine. The browser shows an error such as "server not found". Sites that are already cached keep working until their TTL runs out.`;

export const DEMO_QUESTIONS = [
  {
    id: "why-address",
    question: "Why can't my phone just use the name?",
    saved:
      "Because the internet delivers data to addresses, not names. edorax.com is easy for people to remember, but routers only know how to move data towards an IP address, such as 203.0.113.10. So your phone first asks DNS which address goes with the name, and only then can it connect to the server and ask for the page.",
  },
  {
    id: "dns-down",
    question: "What happens if the name server is down?",
    saved:
      "Your phone cannot turn the name into an address, so it cannot connect, even if the website's server is working fine. The browser shows an error such as \"server not found\". Sites whose answers are already cached keep working until their time to live (TTL) runs out, which is why an outage can seem to hit some sites before others.",
  },
  {
    id: "every-time",
    question: "Is DNS asked every single time I open a site?",
    saved:
      "No. Each DNS answer comes with a time to live (TTL), for example 300 seconds. Your phone and the resolver keep the answer until it expires, so most page loads skip the lookup entirely. Only when the TTL runs out does your phone ask again.",
  },
  {
    id: "explain-simply",
    question: "Explain it like I'm new to this.",
    saved:
      "Think of what your phone does in two steps. First it asks DNS, \"What is the address for edorax.com?\" and gets back numbers such as 203.0.113.10. Then it uses that address to connect to the server and ask for the page. The name is for you; the address is what the network actually uses.",
  },
] as const;

export type DemoQuestionId = (typeof DEMO_QUESTIONS)[number]["id"];
export const DEMO_QUESTION_IDS = DEMO_QUESTIONS.map((q) => q.id) as [DemoQuestionId, ...DemoQuestionId[]];

export type DemoAnswer = { questionId: DemoQuestionId; question: string; answer: string; live: boolean };

const REQUEST_TIMEOUT_MS = 20_000;

type Cached = { answer: string; at: number };
const cache = new Map<DemoQuestionId, Cached>();
const pending = new Map<DemoQuestionId, Promise<string | null>>();
let day = "";
let callsToday = 0;

/** For tests: forget cached answers and today's count. */
export function resetHomeDemo(): void {
  cache.clear();
  pending.clear();
  day = "";
  callsToday = 0;
}

export type HomeDemoDeps = { client?: Pick<Anthropic, "messages">; now?: () => number; available?: boolean };

let sharedClient: Anthropic | null = null;
function anthropicClient(): Anthropic {
  sharedClient ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  return sharedClient;
}

/** Counts a model call against today's cap. False when the cap is already reached. */
function takeCall(now: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    callsToday = 0;
  }
  if (callsToday >= env.HOME_AI_DEMO_DAILY_LIMIT) return false;
  callsToday++;
  return true;
}

async function generate(id: DemoQuestionId, question: string, deps: HomeDemoDeps, now: number): Promise<string | null> {
  if (!takeCall(now)) return null;
  try {
    const message = await (deps.client ?? anthropicClient()).messages.create({
      model: env.LEARNER_QA_MODEL,
      ...modelSettings("low"),
      system: buildSystemPrompt({ courseTitle: DEMO_COURSE, chapterTitle: DEMO_CHAPTER, source: DEMO_LESSON }),
      messages: buildMessages(question),
    });
    if (message.stop_reason === "refusal") return null;
    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    logger.warn({ status: error instanceof Anthropic.APIError ? error.status : undefined, questionId: id }, "home AI demo call failed");
    return null;
  }
}

/** The answer to one preset question: cached, freshly generated, or the saved one. Never throws. */
export async function answerDemoQuestion(id: DemoQuestionId, deps: HomeDemoDeps = {}): Promise<DemoAnswer> {
  const preset = DEMO_QUESTIONS.find((q) => q.id === id)!;
  const now = (deps.now ?? Date.now)();
  const saved: DemoAnswer = { questionId: id, question: preset.question, answer: preset.saved, live: false };
  if (!(deps.available ?? homeAiDemoAvailable)) return saved;

  const hit = cache.get(id);
  if (hit && now - hit.at < env.HOME_AI_DEMO_CACHE_MINUTES * 60_000) {
    return { questionId: id, question: preset.question, answer: hit.answer, live: true };
  }

  // Visitors who ask the same question at the same moment share one model call.
  let call = pending.get(id);
  if (!call) {
    call = generate(id, preset.question, deps, now).finally(() => pending.delete(id));
    pending.set(id, call);
  }
  const answer = await call;
  if (!answer) return hit ? { questionId: id, question: preset.question, answer: hit.answer, live: true } : saved;
  cache.set(id, { answer, at: now });
  return { questionId: id, question: preset.question, answer, live: true };
}
