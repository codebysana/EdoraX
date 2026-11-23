import { serverApiFetchOrNotFound } from "@/lib/api-server";
import { AudiobookEditor } from "@/components/teach/audiobooks/audiobook-editor";
import type { TeachAudiobook } from "@/shared/api/audiobooks";

export const metadata = { title: "Edit audiobook | Teach Workspace" };

export default async function TeachAudiobookPage({ params }: { params: Promise<{ audiobookId: string }> }) {
  const { audiobookId } = await params;
  const book = await serverApiFetchOrNotFound<TeachAudiobook>(`/api/v1/teach/audiobooks/${encodeURIComponent(audiobookId)}`);
  return <AudiobookEditor initial={book} />;
}
