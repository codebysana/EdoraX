import "server-only";
import type { CatalogCourseSummary } from "@/shared/api/catalog";

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/**
 * The public course list for the home page. It is the same for every visitor, so it is
 * fetched without a session and kept for an hour, which keeps the home page fast. If the
 * API is down the page still renders, just without the course cards.
 */
export async function getHomeCatalog(): Promise<CatalogCourseSummary[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/catalog`, { next: { revalidate: 3600 }, headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: { courses?: CatalogCourseSummary[] }; courses?: CatalogCourseSummary[] };
    return body.data?.courses ?? body.courses ?? [];
  } catch {
    return [];
  }
}
