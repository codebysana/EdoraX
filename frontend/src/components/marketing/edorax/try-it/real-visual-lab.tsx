"use client";

import { HldBoard, type RunScore } from "@buildment/learning-ui/labs/HldBoard";
import { getLabSpec } from "@buildment/learning-ui/labs/registry";

export const LANDING_LAB_SLUG = "hld-m4-three-tiers";

/**
 * The real visual lab, shown inside the hero's lab window. This module pulls in the
 * board and its drawing library, so it is only loaded when a visitor opens the Visual
 * lab tab. The board's own button still takes it full screen.
 */
export default function RealVisualLab({ onRunDone }: { onRunDone: (score: RunScore) => void }) {
  const spec = getLabSpec(LANDING_LAB_SLUG);
  if (!spec || spec.family !== "hld") return null;
  return <HldBoard spec={spec} onRunDone={onRunDone} />;
}
