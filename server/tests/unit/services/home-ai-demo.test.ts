import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../src/config/env.js";
import { DEMO_LESSON, DEMO_QUESTIONS, answerDemoQuestion, resetHomeDemo } from "../../../src/services/ai/home-demo/service.js";

function fakeClient(text = "A live answer.", fail = false) {
  const create = vi.fn(async () => {
    if (fail) throw new Error("upstream down");
    return { content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 20 } };
  });
  return { create, client: { messages: { create } } as never };
}

beforeEach(() => resetHomeDemo());

describe("home page AI demo", () => {
  it("answers a preset question live, grounded in the fixed lesson", async () => {
    const { create, client } = fakeClient();
    const result = await answerDemoQuestion("why-address", { client, available: true, now: () => 0 });
    expect(result).toMatchObject({ questionId: "why-address", answer: "A live answer.", live: true });
    const params = (create.mock.calls[0] as unknown[])[0] as { system: string; messages: { content: string }[] };
    expect(params.system).toContain("time to live");
    expect(params.system).toContain(DEMO_LESSON.split("\n")[0].replace("## ", ""));
    expect(params.messages[0].content).toContain(DEMO_QUESTIONS[0].question);
  });

  it("reuses the cached answer instead of calling the model again", async () => {
    const { create, client } = fakeClient();
    await answerDemoQuestion("dns-down", { client, available: true, now: () => 0 });
    await answerDemoQuestion("dns-down", { client, available: true, now: () => 60_000 });
    expect(create).toHaveBeenCalledTimes(1);
    await answerDemoQuestion("dns-down", { client, available: true, now: () => env.HOME_AI_DEMO_CACHE_MINUTES * 60_000 + 1 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("shares one model call between visitors asking at the same moment", async () => {
    const { create, client } = fakeClient();
    await Promise.all([1, 2, 3].map(() => answerDemoQuestion("every-time", { client, available: true, now: () => 0 })));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns the saved answer when the demo is unavailable, without calling the model", async () => {
    const { create, client } = fakeClient();
    const result = await answerDemoQuestion("explain-simply", { client, available: false });
    expect(result.live).toBe(false);
    expect(result.answer).toBe(DEMO_QUESTIONS.find((q) => q.id === "explain-simply")!.saved);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the saved answer when the provider fails", async () => {
    const { client } = fakeClient("", true);
    const result = await answerDemoQuestion("why-address", { client, available: true, now: () => 0 });
    expect(result.live).toBe(false);
    expect(result.answer).toBe(DEMO_QUESTIONS[0].saved);
  });

  it("stops calling the model once the daily cap is reached", async () => {
    const { create, client } = fakeClient();
    const limit = env.HOME_AI_DEMO_DAILY_LIMIT;
    env.HOME_AI_DEMO_DAILY_LIMIT = 2;
    try {
      const results = [];
      for (const q of DEMO_QUESTIONS) results.push(await answerDemoQuestion(q.id, { client, available: true, now: () => 0 }));
      expect(create).toHaveBeenCalledTimes(2);
      expect(results.map((r) => r.live)).toEqual([true, true, false, false]);
      // A new UTC day starts a fresh count.
      await answerDemoQuestion("dns-down", { client, available: true, now: () => 86_400_000 });
      expect(create).toHaveBeenCalledTimes(3);
    } finally {
      env.HOME_AI_DEMO_DAILY_LIMIT = limit;
    }
  });
});
