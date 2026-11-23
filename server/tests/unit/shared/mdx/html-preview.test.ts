import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import {
  buildPreviewDocument,
  findForbiddenPreviewContent,
  fillPreviewTemplate,
  parseHtmlPreviewFence,
  previewDefaults,
} from "../../../../src/shared/html-preview/spec.js";
import { remarkHtmlPreview } from "../../../../src/shared/mdx/remark-html-preview.js";
import { readerRemarkPlugins } from "../../../../src/shared/mdx/reader-plugins.js";
import { mdxComponentAllowlist } from "../../../../src/shared/mdx/component-allowlist.js";

const FENCE = `title: Padding
mode: split
height: 240
address: practice-page.html
slider: pad | Padding | 0 | 60 | 2 | 20 | px
select: shape | Corners | 0px,8px,24px | 8px
---html
<p class="card">Hello</p>
---css
.card { padding: {{pad}}; border-radius: {{shape}}; }
`;

describe("parseHtmlPreviewFence", () => {
  it("reads settings, controls, html and css", () => {
    const spec = parseHtmlPreviewFence(FENCE);
    expect(spec.title).toBe("Padding");
    expect(spec.mode).toBe("split");
    expect(spec.height).toBe(240);
    expect(spec.address).toBe("practice-page.html");
    expect(spec.html).toBe('<p class="card">Hello</p>');
    expect(spec.css).toContain(".card");
    expect(spec.controls).toHaveLength(2);
    expect(spec.controls[0]).toMatchObject({ type: "range", name: "pad", min: 0, max: 60, step: 2, value: 20, unit: "px" });
    expect(spec.controls[1]).toMatchObject({ type: "select", name: "shape", options: ["0px", "8px", "24px"], value: "8px" });
  });

  it("uses defaults and clamps the height", () => {
    const spec = parseHtmlPreviewFence("height: 5000\n---html\n<p>x</p>");
    expect(spec.mode).toBe("split");
    expect(spec.height).toBe(700);
    expect(spec.css).toBe("");
    expect(spec.address).toBe("index.html");
  });

  it("rejects a missing html section", () => {
    expect(() => parseHtmlPreviewFence("title: x\n---css\np{}")).toThrow(/---html/);
  });

  it("rejects an unknown mode, setting or bad control", () => {
    expect(() => parseHtmlPreviewFence("mode: wide\n---html\n<p>x</p>")).toThrow(/mode/);
    expect(() => parseHtmlPreviewFence("colour: red\n---html\n<p>x</p>")).toThrow(/unknown setting/);
    expect(() => parseHtmlPreviewFence("slider: Bad Name | x | 0 | 1 | 1 | 0\n---html\n<p>x</p>")).toThrow(/control name/);
    expect(() => parseHtmlPreviewFence("slider: a | x | 5 | 1 | 1 | 2 | px\n---html\n<p>x</p>")).toThrow(/range/);
    expect(() => parseHtmlPreviewFence("select: a | x | one | one\n---html\n<p>x</p>")).toThrow(/options/);
    expect(() => parseHtmlPreviewFence("select: a | x | one,two | three\n---html\n<p>x</p>")).toThrow(/start value/);
  });

  it("rejects the same control twice", () => {
    const twice = "slider: a | A | 0 | 9 | 1 | 1\nslider: a | B | 0 | 9 | 1 | 1\n---html\n<p>x</p>";
    expect(() => parseHtmlPreviewFence(twice)).toThrow(/twice/);
  });

  it("rejects forbidden content", () => {
    expect(() => parseHtmlPreviewFence("---html\n<script>alert(1)</script>")).toThrow(/script/);
  });
});

describe("findForbiddenPreviewContent", () => {
  it.each([
    ["<script>x</script>", "script tags"],
    ["<iframe src=a></iframe>", "embedded content tags"],
    ['<link rel="stylesheet" href="a.css">', "link, meta and base tags"],
    ['<p onclick="x()">', "event handler attributes such as onclick"],
    ['<a href="javascript:alert(1)">x</a>', "javascript: addresses"],
    ["<style>@import url(a.css);</style>", "@import"],
    ['<img src="https://example.com/a.png">', "web addresses in src or href"],
    ['<div style="background:url(http://a/b)">', "web addresses in CSS url()"],
  ])("refuses %s", (source, label) => {
    expect(findForbiddenPreviewContent(source)).toBe(label);
  });

  it("allows plain markup, anchors and data images", () => {
    expect(findForbiddenPreviewContent('<a href="#about">x</a><img src="data:image/svg+xml;utf8,%3Csvg%3E" alt="x"><p style="color:red">y</p>')).toBeNull();
  });
});

describe("templates and the frame document", () => {
  const { controls } = parseHtmlPreviewFence(FENCE);

  it("fills {{name}} with the current value and the slider unit", () => {
    expect(fillPreviewTemplate("a {{pad}} b {{shape}} c {{other}}", controls, { pad: "30", shape: "24px" })).toBe("a 30px b 24px c {{other}}");
    expect(previewDefaults(controls)).toEqual({ pad: "20", shape: "8px" });
  });

  it("builds a document with a locked-down policy and an escaped style end tag", () => {
    const doc = buildPreviewDocument("<p>x</p>", "p{color:red}</style><script>x</script>");
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("<\\/style><script>");
    expect(doc.match(/<\/style>/g)).toHaveLength(2);
  });
});

describe("remarkHtmlPreview", () => {
  const treeWith = (lang: string, value: string): Root =>
    ({ type: "root", children: [{ type: "code", lang, value }] }) as unknown as Root;

  it("turns a preview fence into an HtmlPreview element", () => {
    const tree = treeWith("preview", FENCE);
    remarkHtmlPreview()(tree);
    const node = tree.children[0] as unknown as { type: string; name: string; attributes: Array<{ name: string; value: string }> };
    expect(node.type).toBe("mdxJsxFlowElement");
    expect(node.name).toBe("HtmlPreview");
    const attr = (name: string) => node.attributes.find((a) => a.name === name)?.value;
    expect(attr("mode")).toBe("split");
    expect(attr("height")).toBe("240");
    expect(attr("html")).toBe('<p class="card">Hello</p>');
    expect(JSON.parse(attr("controls")!)).toHaveLength(2);
  });

  it("leaves other fences alone and throws on an invalid preview", () => {
    const other = treeWith("css", "p{}");
    remarkHtmlPreview()(other);
    expect((other.children[0] as { type: string }).type).toBe("code");
    expect(() => remarkHtmlPreview()(treeWith("preview", "title: no html"))).toThrow();
  });

  it("is part of the reader plugins and the component allowlist", () => {
    expect(readerRemarkPlugins).toContain(remarkHtmlPreview);
    expect(mdxComponentAllowlist.has("HtmlPreview")).toBe(true);
  });
});
