import { serverApiFetch } from "@/lib/api-server";
import { HighlightsLibrary } from "@/components/learn/highlights-library";
import type { UserHighlightView } from "@/server/actions/highlights";

export const dynamic = "force-dynamic";

export default async function HighlightsPage() {
  let highlights: UserHighlightView[];
  try {
    highlights = await serverApiFetch<UserHighlightView[]>("/api/v1/learner/highlights");
  } catch {
    return (
      <div className="p-6" role="alert">
        <h1 className="text-xl font-semibold">My Highlights</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your highlights could not be loaded. This is not the same as having none. Reload the page to try again.
        </p>
      </div>
    );
  }
  return <HighlightsLibrary initial={highlights} />;
}
