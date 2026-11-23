/**
 * Remark plugin that turns ```preview fences into
 * <HtmlPreview title mode height address html css controls /> nodes in the MDX
 * tree. The fence format is documented in ../html-preview/spec.ts. An invalid
 * fence throws, so the mistake is caught when the course is imported or
 * compiled and never reaches a learner.
 */
import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import { parseHtmlPreviewFence } from "../html-preview/spec.js";

export function remarkHtmlPreview(): (tree: Root) => void {
  return (tree: Root) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (node.lang !== "preview") return;
      if (!parent || index == null) return;
      const spec = parseHtmlPreviewFence(node.value);
      const attribute = (name: string, value: string) => ({ type: "mdxJsxAttribute", name, value });
      const mdxNode: Record<string, unknown> = {
        type: "mdxJsxFlowElement",
        name: "HtmlPreview",
        attributes: [
          attribute("title", spec.title),
          attribute("mode", spec.mode),
          attribute("height", String(spec.height)),
          attribute("address", spec.address),
          attribute("html", spec.html),
          attribute("css", spec.css),
          attribute("controls", JSON.stringify(spec.controls)),
        ],
        children: [],
      };
      parent.children.splice(index, 1, mdxNode as unknown as Code);
    });
  };
}
