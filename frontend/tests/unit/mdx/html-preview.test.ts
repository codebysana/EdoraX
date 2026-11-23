import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HtmlPreview } from "@buildment/learning-ui/components/learn/content-blocks/html-preview";
import { sharedLessonBlocks } from "@buildment/learning-ui/lesson-blocks";

const controls = JSON.stringify([
  { type: "range", name: "pad", label: "Padding", min: 0, max: 60, step: 2, value: 20, unit: "px" },
]);

const draw = (props: Parameters<typeof HtmlPreview>[0]) => renderToStaticMarkup(createElement(HtmlPreview, props));

describe("HtmlPreview", () => {
  it("is registered as a lesson block", () => {
    expect(sharedLessonBlocks.HtmlPreview).toBe(HtmlPreview);
  });

  it("draws the code beside a sandboxed browser frame", () => {
    const html = draw({ title: "Padding", mode: "split", height: "240", address: "page.html", html: "<p>Hello</p>", css: "p { padding: {{pad}}; }", controls });
    expect(html).toContain("<iframe");
    expect(html).toContain('sandbox=""');
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("padding: 20px");
    expect(html).toContain("styles.css");
    expect(html).toContain("Hide code");
    expect(html).toContain('type="range"');
  });

  it("shows only the browser in preview mode", () => {
    const html = draw({ title: "Look", mode: "preview", html: "<p>Hello</p>" });
    expect(html).toContain("<iframe");
    expect(html).not.toContain("Hide code");
    expect(html).not.toContain("index.html code");
  });

  it("refuses to draw content the frame must not run", () => {
    const html = draw({ title: "Bad", html: "<script>alert(1)</script>" });
    expect(html).not.toContain("<iframe");
    expect(html).toContain("cannot be shown");
  });
});
