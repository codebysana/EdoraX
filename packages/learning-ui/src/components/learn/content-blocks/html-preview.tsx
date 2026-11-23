"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "../../../lib/utils";
import {
  PREVIEW_DEFAULT_HEIGHT,
  PREVIEW_MAX_HEIGHT,
  PREVIEW_MIN_HEIGHT,
  buildPreviewDocument,
  controlText,
  fillPreviewTemplate,
  findForbiddenPreviewContent,
  previewDefaults,
  type PreviewControl,
  type PreviewMode,
} from "../../../shared/html-preview/spec";
import { DarkCodePane } from "./dark-code-pane";

export type HtmlPreviewProps = {
  title?: string;
  mode?: string;
  height?: string | number;
  address?: string;
  html?: string;
  css?: string;
  /** JSON text of the controls the remark plugin read from the fence. */
  controls?: string;
};

function readControls(text: string | undefined): PreviewControl[] {
  if (!text) return [];
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? (value as PreviewControl[]) : [];
  } catch {
    return [];
  }
}

function CodeFile({ name, code }: { name: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--code-border)]">
      <div className="border-b border-[var(--code-border)] bg-[var(--code-surface)] px-3 py-1.5">
        <span className="rounded bg-[var(--code-border)]/40 px-2 py-0.5 font-mono text-xs text-[var(--code-lang-fg)]">{name}</span>
      </div>
      <DarkCodePane className="max-h-[420px] overflow-y-auto p-3">
        <pre className="m-0 whitespace-pre" tabIndex={0} aria-label={`${name} code`}>
          <code>{code}</code>
        </pre>
      </DarkCodePane>
    </div>
  );
}

/**
 * A read-only HTML and CSS example drawn in a sandboxed frame that looks like a
 * small browser window. The frame has no scripts, no network and no way to
 * leave the page. The code is shown beside it (mode "split") or hidden (mode
 * "preview"). Optional controls change a value in the code and redraw it.
 */
export function HtmlPreview({ title, mode: modeProp, height: heightProp, address, html = "", css = "", controls: controlsText }: HtmlPreviewProps) {
  const mode: PreviewMode = modeProp === "preview" ? "preview" : "split";
  const controls = useMemo(() => readControls(controlsText), [controlsText]);
  const [values, setValues] = useState<Record<string, string>>(() => previewDefaults(controls));
  const [showCode, setShowCode] = useState(true);
  const baseId = useId();

  const rawHeight = Number(heightProp);
  const height = Number.isFinite(rawHeight)
    ? Math.min(PREVIEW_MAX_HEIGHT, Math.max(PREVIEW_MIN_HEIGHT, Math.round(rawHeight)))
    : PREVIEW_DEFAULT_HEIGHT;

  const shownHtml = fillPreviewTemplate(html, controls, values);
  const shownCss = fillPreviewTemplate(css, controls, values);
  const problem = findForbiddenPreviewContent(`${shownHtml}\n${shownCss}`);
  const srcDoc = useMemo(() => (problem ? "" : buildPreviewDocument(shownHtml, shownCss)), [problem, shownHtml, shownCss]);

  const codeVisible = mode === "split" && showCode;
  const label = title || "Browser preview";

  return (
    <section className="not-prose my-10" aria-label={label} data-learn-panel="html-preview">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Example</p>
          {title ? <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{title}</h3> : null}
        </div>
        {mode === "split" ? (
          <button
            type="button"
            onClick={() => setShowCode((current) => !current)}
            aria-pressed={showCode}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            {showCode ? "Hide code" : "Show code"}
          </button>
        ) : null}
      </header>

      <div className={cn("grid gap-4", codeVisible && "lg:grid-cols-2")}>
        {codeVisible ? (
          <div className="flex min-w-0 flex-col gap-3">
            <CodeFile name="index.html" code={shownHtml} />
            {shownCss ? <CodeFile name="styles.css" code={shownCss} /> : null}
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-muted px-3 py-2" aria-hidden="true">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">{address || "index.html"}</span>
            </div>
            {problem ? (
              <p className="p-4 text-sm text-muted-foreground" role="status">
                This example cannot be shown because it contains {problem}.
              </p>
            ) : (
              <iframe
                title={`${label}: result in a browser window`}
                sandbox=""
                srcDoc={srcDoc}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="block w-full border-0 bg-white"
                style={{ height }}
              />
            )}
          </div>

          {controls.length > 0 ? (
            <div className="mt-3 grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2">
              {controls.map((control) => {
                const id = `${baseId}-${control.name}`;
                const value = values[control.name] ?? "";
                return (
                  <div key={control.name} className="flex flex-col gap-1">
                    <label htmlFor={id} className="flex justify-between text-sm font-medium text-foreground">
                      <span>{control.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{controlText(control, value)}</span>
                    </label>
                    {control.type === "range" ? (
                      <input
                        id={id}
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={value}
                        onChange={(event) => setValues((current) => ({ ...current, [control.name]: event.target.value }))}
                        className="w-full"
                      />
                    ) : (
                      <select
                        id={id}
                        value={value}
                        onChange={(event) => setValues((current) => ({ ...current, [control.name]: event.target.value }))}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        {control.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            This window is a safe copy of a browser. Links and scripts are switched off.
          </p>
        </div>
      </div>
    </section>
  );
}
