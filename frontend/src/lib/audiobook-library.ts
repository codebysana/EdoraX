import "server-only";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/api-server";
import { audiobookFromApi, type Audiobook } from "@/lib/audiobooks";
import type { AudiobookListResponse, PublicAudiobook } from "@/shared/api/audiobooks";

// The Audiobooks area: books instructors upload and publish, read from the API. Course narration is
// not part of it. Each book is public, so these calls send no session.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type AudiobookLibrary = { books: Audiobook[]; catalogReachable: boolean };

/** Never throws: with the API down the page still renders, saying the books could not be loaded. */
export async function loadAudiobookLibrary(): Promise<AudiobookLibrary> {
  try {
    const { audiobooks } = await serverApiFetch<AudiobookListResponse>("/api/v1/audiobooks", { token: null });
    return { books: audiobooks.map(audiobookFromApi), catalogReachable: true };
  } catch {
    return { books: [], catalogReachable: false };
  }
}

/** One book, or null when it does not exist or is not published. */
export async function loadAudiobook(slug: string): Promise<Audiobook | null> {
  if (!SLUG.test(slug)) return null;
  try {
    return audiobookFromApi(await serverApiFetch<PublicAudiobook>(`/api/v1/audiobooks/${slug}`, { token: null }));
  } catch (error) {
    // An unreachable API throws, so the page shows the error screen rather than "not found".
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
