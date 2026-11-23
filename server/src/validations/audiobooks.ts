import { z } from "zod";
import { id } from "./common.js";

export const MAX_AUDIOBOOK_TRACK_SECONDS = 6 * 60 * 60;

const category = z.enum(["TECH", "SOFT_SKILLS", "CLOUD_DEVOPS"]);

export const audiobookIdParams = z.object({ audiobookId: id });
export const audiobookSlugParams = z.object({ slug: z.string().trim().min(1).max(120) });
export const audiobookTrackParams = z.object({ audiobookId: id, trackId: id });
export const publicTrackParams = z.object({ slug: z.string().trim().min(1).max(120), trackId: id });

export const createAudiobookBody = z.object({
  title: z.string().trim().min(2, "Give the audiobook a title.").max(120),
  description: z.string().trim().max(2000).optional(),
  authorName: z.string().trim().min(1).max(80).optional(),
  category: category.default("TECH"),
});

export const updateAudiobookBody = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).nullable(),
    authorName: z.string().trim().min(1).max(80),
    category,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update.");

/** Track details travel in the query because the request body is the raw audio file. */
export const uploadTrackQuery = z.object({
  title: z.string().trim().min(1, "Give the chapter a title.").max(160),
  duration: z.coerce.number().positive().max(MAX_AUDIOBOOK_TRACK_SECONDS),
});

export const renameTrackBody = z.object({ title: z.string().trim().min(1).max(160) });
export const reorderTracksBody = z.object({ trackIds: z.array(id).min(1).max(500) });
