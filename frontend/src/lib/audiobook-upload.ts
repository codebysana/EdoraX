import { parseApiResponse } from "@/lib/api-client";
import type { TeachAudiobook } from "@/shared/api/audiobooks";

export const MAX_AUDIOBOOK_FILE_BYTES = 50 * 1024 * 1024;

/** "03 - the big idea.mp3" reads as "The big idea". */
export function chapterTitleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/^[\s\d._-]+/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Untitled chapter";
}

/** The length of an audio file in seconds, read in the browser before upload. */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = () => {
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const seconds = audio.duration;
      done();
      if (Number.isFinite(seconds) && seconds > 0) resolve(Math.round(seconds));
      else reject(new Error("Could not read the length of this audio file."));
    };
    audio.onerror = () => {
      done();
      reject(new Error("This file could not be read as audio."));
    };
    audio.src = url;
  });
}

export async function uploadAudiobookChapter(audiobookId: string, file: File, title: string): Promise<TeachAudiobook> {
  if (!/\.mp3$/i.test(file.name) && file.type !== "audio/mpeg") throw new Error("Choose an MP3 file.");
  if (!file.size || file.size > MAX_AUDIOBOOK_FILE_BYTES) throw new Error("Choose an MP3 file smaller than 50 MB.");
  const duration = await readAudioDuration(file);
  const query = new URLSearchParams({ title, duration: String(duration) });
  const response = await fetch(`/api/v1/teach/audiobooks/${encodeURIComponent(audiobookId)}/tracks?${query}`, {
    method: "POST",
    headers: { "Content-Type": "audio/mpeg", Accept: "application/json" },
    body: file,
    credentials: "same-origin",
  });
  return parseApiResponse<TeachAudiobook>(response);
}
