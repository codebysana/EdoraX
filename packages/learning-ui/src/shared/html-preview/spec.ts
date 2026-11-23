// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
/**
 * Contract for the HTML and CSS preview block (the ```preview fence in a lesson).
 *
 * The author writes read-only HTML and CSS. The reader draws it in a sandboxed
 * frame that looks like a small browser window, next to the code or on its own.
 * This file is pure: the remark plugin and the component both use it, so the two
 * always agree on what a valid example is.
 *
 * Fence format:
 *
 *   ```preview
 *   title: Same words, with CSS
 *   mode: split            (split = code beside the browser, preview = browser only)
 *   height: 280            (browser height in pixels, 120 to 700)
 *   address: practice-page (text shown in the address bar)
 *   slider: pad | Padding | 0 | 60 | 2 | 20 | px
 *   select: display | display | block,inline,none | block
 *   ---html
 *   <h1>Hello</h1>
 *   ---css
 *   h1 { padding: {{pad}}; }
 *   ```
 *
 * A control name used as {{name}} in the HTML or CSS is replaced by the current
 * value, so the learner sees real code change when they move a control.
 */

export type PreviewMode = "split" | "preview";

export type PreviewControl =
  | { type: "range"; name: string; label: string; min: number; max: number; step: number; value: number; unit: string }
  | { type: "select"; name: string; label: string; options: string[]; value: string };

export type HtmlPreviewSpec = {
  title: string;
  mode: PreviewMode;
  height: number;
  address: string;
  html: string;
  css: string;
  controls: PreviewControl[];
};

export const PREVIEW_MIN_HEIGHT = 120;
export const PREVIEW_MAX_HEIGHT = 700;
export const PREVIEW_DEFAULT_HEIGHT = 280;
export const PREVIEW_MAX_SOURCE = 12000;

const NAME = /^[a-z][a-z0-9-]{0,23}$/;

/** What the preview frame will refuse to draw. The sandbox and the page policy block these too. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/<\s*script/i, "script tags"],
  [/<\s*(iframe|object|embed|frame|frameset|applet)/i, "embedded content tags"],
  [/<\s*(link|meta|base)\b/i, "link, meta and base tags"],
  [/\son[a-z]+\s*=/i, "event handler attributes such as onclick"],
  [/javascript\s*:/i, "javascript: addresses"],
  [/@import/i, "@import"],
  [/expression\s*\(/i, "CSS expressions"],
  [/(?:src|href|action|poster|srcset)\s*=\s*["']?\s*(?:https?:)?\/\//i, "web addresses in src or href"],
  [/url\(\s*["']?\s*(?:https?:)?\/\//i, "web addresses in CSS url()"],
  [/url\(\s*["']?\s*(?!data:image\/)(?!#)[a-z]+:/i, "url() addresses other than data images"],
];

export function findForbiddenPreviewContent(source: string): string | null {
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(source)) return label;
  }
  return null;
}

function parseNumber(value: string, label: string): number {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) throw new Error(`preview control "${label}": "${value.trim()}" is not a number`);
  return n;
}

function parseControl(kind: "slider" | "select", rest: string): PreviewControl {
  const parts = rest.split("|").map((part) => part.trim());
  const name = parts[0] ?? "";
  if (!NAME.test(name)) throw new Error(`preview control name "${name}" must be lowercase letters, digits or hyphens, starting with a letter`);
  if (kind === "slider") {
    if (parts.length < 6) throw new Error(`preview slider "${name}" needs: name | label | min | max | step | start | unit`);
    const min = parseNumber(parts[2]!, name);
    const max = parseNumber(parts[3]!, name);
    const step = parseNumber(parts[4]!, name);
    const value = parseNumber(parts[5]!, name);
    if (!(min < max) || step <= 0 || value < min || value > max) throw new Error(`preview slider "${name}" has an invalid range`);
    return { type: "range", name, label: parts[1] || name, min, max, step, value, unit: parts[6] ?? "" };
  }
  if (parts.length < 4) throw new Error(`preview select "${name}" needs: name | label | option1,option2 | start`);
  const options = parts[2]!.split(",").map((option) => option.trim()).filter(Boolean);
  if (options.length < 2 || options.length > 8) throw new Error(`preview select "${name}" needs 2 to 8 options`);
  const value = parts[3]!;
  if (!options.includes(value)) throw new Error(`preview select "${name}" start value "${value}" is not one of its options`);
  return { type: "select", name, label: parts[1] || name, options, value };
}

/** Parse the body of a ```preview fence. Throws an Error with a plain message when it is invalid. */
export function parseHtmlPreviewFence(body: string): HtmlPreviewSpec {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const spec: HtmlPreviewSpec = { title: "", mode: "split", height: PREVIEW_DEFAULT_HEIGHT, address: "index.html", html: "", css: "", controls: [] };
  let section: "head" | "html" | "css" = "head";
  const html: string[] = [];
  const css: string[] = [];
  for (const line of lines) {
    const marker = /^---\s*(html|css)\s*$/i.exec(line);
    if (marker) {
      section = marker[1]!.toLowerCase() as "html" | "css";
      continue;
    }
    if (section === "html") html.push(line);
    else if (section === "css") css.push(line);
    else {
      if (!line.trim()) continue;
      const m = /^([a-z]+)\s*:\s*(.*)$/i.exec(line.trim());
      if (!m) throw new Error(`preview: cannot read the line "${line.trim()}" above ---html`);
      const key = m[1]!.toLowerCase();
      const value = m[2]!.trim();
      if (key === "title") spec.title = value;
      else if (key === "address") spec.address = value.slice(0, 60);
      else if (key === "mode") {
        if (value !== "split" && value !== "preview") throw new Error(`preview mode must be "split" or "preview", not "${value}"`);
        spec.mode = value;
      } else if (key === "height") {
        const n = parseNumber(value, "height");
        spec.height = Math.min(PREVIEW_MAX_HEIGHT, Math.max(PREVIEW_MIN_HEIGHT, Math.round(n)));
      } else if (key === "slider" || key === "select") spec.controls.push(parseControl(key, value));
      else throw new Error(`preview: unknown setting "${key}"`);
    }
  }
  spec.html = html.join("\n").replace(/^\n+|\s+$/g, "");
  spec.css = css.join("\n").replace(/^\n+|\s+$/g, "");
  if (!spec.html) throw new Error("preview needs an ---html section");
  if (spec.html.length + spec.css.length > PREVIEW_MAX_SOURCE) throw new Error(`preview source is longer than ${PREVIEW_MAX_SOURCE} characters`);
  const names = new Set<string>();
  for (const control of spec.controls) {
    if (names.has(control.name)) throw new Error(`preview control "${control.name}" is defined twice`);
    names.add(control.name);
  }
  const bad = findForbiddenPreviewContent(`${spec.html}\n${spec.css}`);
  if (bad) throw new Error(`preview cannot contain ${bad}`);
  return spec;
}

export function previewDefaults(controls: PreviewControl[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const control of controls) {
    values[control.name] = control.type === "range" ? String(control.value) : control.value;
  }
  return values;
}

export function controlText(control: PreviewControl, value: string): string {
  return control.type === "range" ? `${value}${control.unit}` : value;
}

/** Replace {{name}} with the current control value (with its unit for sliders). */
export function fillPreviewTemplate(source: string, controls: PreviewControl[], values: Record<string, string>): string {
  return source.replace(/\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/g, (match, name: string) => {
    const control = controls.find((candidate) => candidate.name === name);
    if (!control) return match;
    const value = values[name] ?? (control.type === "range" ? String(control.value) : control.value);
    return controlText(control, value);
  });
}

const POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";

/** The complete document drawn inside the sandboxed frame. */
export function buildPreviewDocument(html: string, css: string): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${POLICY}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    "<style>a{pointer-events:none}</style>",
    `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
    `</head><body>${html}</body></html>`,
  ].join("");
}
