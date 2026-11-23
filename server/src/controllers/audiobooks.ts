import type { Request, Response } from "express";
import { pipeline } from "node:stream";
import * as audiobooks from "../services/audiobooks/audiobooks.js";
import { BadRequestError } from "../utils/errors.js";
import { created, noContent, ok } from "../utils/responses.js";

// ---- Learners: GET /api/v1/audiobooks -----------------------------------------------------

export async function list(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=60");
  ok(res, { audiobooks: await audiobooks.listPublishedAudiobooks() });
}

export async function get(req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=60");
  ok(res, await audiobooks.getPublishedAudiobook(String(req.params.slug)));
}

/** The audio file. Honors Range so the player can seek and resume without downloading it all. */
export async function audio(req: Request, res: Response) {
  const stream = await audiobooks.streamTrackAudio(req.user, String(req.params.slug), String(req.params.trackId), req.headers.range);
  res.status(stream.contentRange ? 206 : 200);
  res.set({
    "Content-Type": stream.contentType,
    "Accept-Ranges": "bytes",
    "Content-Length": String(stream.contentLength ?? stream.totalBytes),
    // A draft is the owner's preview; a published track may be cached briefly, so unpublishing is quick.
    "Cache-Control": stream.isPublic ? "public, max-age=300" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    ...(stream.contentRange ? { "Content-Range": stream.contentRange } : {}),
  });
  pipeline(stream.body, res, () => undefined);
}

// ---- Instructors: /api/v1/teach/audiobooks ------------------------------------------------

export async function teachList(req: Request, res: Response) {
  ok(res, { audiobooks: await audiobooks.listTeachAudiobooks(req.user!) });
}

export async function teachGet(req: Request, res: Response) {
  ok(res, await audiobooks.getTeachAudiobook(req.user!, String(req.params.audiobookId)));
}

export async function teachCreate(req: Request, res: Response) {
  created(res, await audiobooks.createAudiobook(req.user!, req.body));
}

export async function teachUpdate(req: Request, res: Response) {
  ok(res, await audiobooks.updateAudiobook(req.user!, String(req.params.audiobookId), req.body));
}

export async function teachPublish(req: Request, res: Response) {
  ok(res, await audiobooks.setAudiobookPublished(req.user!, String(req.params.audiobookId), true));
}

export async function teachUnpublish(req: Request, res: Response) {
  ok(res, await audiobooks.setAudiobookPublished(req.user!, String(req.params.audiobookId), false));
}

export async function teachDelete(req: Request, res: Response) {
  await audiobooks.deleteAudiobook(req.user!, String(req.params.audiobookId));
  noContent(res);
}

export async function teachAddTrack(req: Request, res: Response) {
  if (!Buffer.isBuffer(req.body)) throw new BadRequestError("Choose an MP3 file to upload.", "AUDIO_REQUIRED");
  const { title, duration } = req.query as unknown as { title: string; duration: number };
  created(res, await audiobooks.addTrack(req.user!, String(req.params.audiobookId), { title, durationSeconds: duration }, req.body));
}

export async function teachRenameTrack(req: Request, res: Response) {
  ok(res, await audiobooks.renameTrack(req.user!, String(req.params.audiobookId), String(req.params.trackId), req.body.title));
}

export async function teachRemoveTrack(req: Request, res: Response) {
  ok(res, await audiobooks.removeTrack(req.user!, String(req.params.audiobookId), String(req.params.trackId)));
}

export async function teachReorderTracks(req: Request, res: Response) {
  ok(res, await audiobooks.reorderTracks(req.user!, String(req.params.audiobookId), req.body.trackIds));
}
