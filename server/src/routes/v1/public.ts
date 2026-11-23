import { Router } from "express";
import type { Request, Response } from "express";
import { ok } from "../../utils/responses.js";
import { z } from "zod";
import { loadPublicProfile } from "../../services/profile/public-profile.js";
import { DEMO_QUESTION_IDS, answerDemoQuestion } from "../../services/ai/home-demo/service.js";
import { BadRequestError } from "../../utils/errors.js";

// Unauthenticated, read-only Career Identity pages. Only curated public fields are returned; a
// learner who has not opted in (profilePublic) yields 404, never a leak.
const router = Router();

router.get("/profiles/:slug", async (req: Request, res: Response) => {
  ok(res, await loadPublicProfile(String(req.params.slug)));
});

// The home page's AI demo. The body names one preset question by id; any other input is refused,
// so no visitor text ever reaches the model. See services/ai/home-demo for the other guards.
const demoBody = z.object({ questionId: z.enum(DEMO_QUESTION_IDS) }).strict();

router.post("/ai-demo", async (req: Request, res: Response) => {
  const parsed = demoBody.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError("Pick one of the example questions.");
  res.setHeader("Cache-Control", "no-store");
  ok(res, await answerDemoQuestion(parsed.data.questionId));
});

export default router;
