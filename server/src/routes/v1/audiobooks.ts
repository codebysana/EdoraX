import { Router } from "express";
import * as audiobooks from "../../controllers/audiobooks.js";
import { optionalAuth } from "../../middlewares/authenticate.js";
import { validateParams } from "../../middlewares/validate.js";
import { audiobookSlugParams, publicTrackParams } from "../../validations/audiobooks.js";

// Published audiobooks, open to everyone. Drafts are only readable by their owner (and admins),
// which is why the audio route reads the session when there is one.
const router = Router();

router.get("/", audiobooks.list);
router.get("/:slug", validateParams(audiobookSlugParams), audiobooks.get);
router.get("/:slug/tracks/:trackId/audio", optionalAuth, validateParams(publicTrackParams), audiobooks.audio);

export default router;
