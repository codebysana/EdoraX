# HTML and CSS preview block

A lesson can show real HTML and CSS in a window that looks like a small browser, with the code beside it or hidden. Write a fenced block with the language `preview`.

````
```preview
title: Padding and margin
mode: split
height: 260
address: practice-page.html
slider: pad | Padding | 0 | 60 | 2 | 20 | px
select: shape | Corners | 0px,8px,24px | 8px
---html
<p class="card">Hello</p>
---css
.card { padding: {{pad}}; border-radius: {{shape}}; }
```
````

| Setting | Meaning |
|---|---|
| `mode: split` | Code on the left, browser on the right, with a Hide code button. |
| `mode: preview` | The browser alone, no code. |
| `height` | Browser height in pixels, 120 to 700 (default 280). |
| `address` | Text in the fake address bar. |
| `slider: name \| label \| min \| max \| step \| start \| unit` | A slider. `{{name}}` in the HTML or CSS becomes the value plus the unit. |
| `select: name \| label \| a,b,c \| start` | A dropdown. `{{name}}` becomes the chosen option. |
| `---html`, `---css` | The page body and the style sheet. The CSS is shown as `styles.css`. |

## How it works

- `server/src/shared/html-preview/spec.ts` parses and checks the fence. `server/src/shared/mdx/remark-html-preview.ts` turns it into an `HtmlPreview` element. An invalid fence throws, so it is caught when the course is validated or compiled.
- `packages/learning-ui/src/components/learn/content-blocks/html-preview.tsx` draws it, in the web reader and the desktop app.

## Safety

The example is read-only author content, never learner input. It is drawn in an iframe with `sandbox=""` (no scripts, no forms, no popups, no same-origin access), a content policy of `default-src 'none'` (no network), and links switched off. The source is also refused when it contains script tags, `on...=` attributes, iframe, link, meta, base, `@import`, `javascript:` addresses, or web addresses in `src`, `href` or `url()`. Images must be `data:` images. The check runs when the course is parsed and again when the block is drawn.

Not covered: the frame is its own small window, so `vh`, `vw`, `position: fixed` and `position: sticky` behave as in a real browser inside it. It cannot show the page `title` or `head` content.
