import { test, expect, type Page } from '@playwright/test';
import { courses, courseDetail } from '../fixtures';
import { parseLesson } from '../../src/learning/parse-lesson';

const document = parseLesson(`Change one thing at a time when you debug. Then run the test again.

A queue keeps work in order, so the first job in is the first job out.`);

type Seed = { id: string; color: string; quote: string; prefix: string | null; suffix: string | null; occurrence: number; note: string | null };

/** A fake desktop bridge with an in-memory highlight list, so the whole reader and notebook flow runs in the browser. */
async function setup(page: Page, seed: Seed[] = []) {
  await page.addInitScript(
    ({ courses, courseDetail, document, seed }) => {
      let signedIn = true;
      const store: Seed[] = [...seed];
      let counter = store.length;
      const calls: string[] = [];
      (window as any).__calls = calls;
      (window as any).__store = store;
      const chapter = { id: 'chapter-a', slug: 'lesson-one', title: 'Debugging basics' };
      const modules = () => [
        {
          id: 'module',
          order: 1,
          title: 'Basics',
          completedCount: 0,
          chapters: [{ id: chapter.id, slug: chapter.slug, title: chapter.title, status: 'IN_PROGRESS', blockCount: 0 }],
        },
      ];
      // Screens this test does not look at (home, questions, streaks) get a harmless "not mocked" answer instead of crashing the app.
      const fallback = (): any =>
        new Proxy(async () => ({ ok: false, code: 'NOT_MOCKED', message: 'Not mocked in this test.' }), {
          get: (_target, key) => (key === 'then' || typeof key === 'symbol' ? undefined : fallback()),
        });
      const withFallback = <T extends object>(base: T): T =>
        new Proxy(base, { get: (target, key) => (key in target ? (target as any)[key] : typeof key === 'symbol' ? undefined : fallback()) });
      const bridge = {
        ...window.buildment,
        webOrigin: async () => 'https://edorax.com',
        offline: {
          onStatus: () => () => {},
          status: async () => ({ available: false, downloadedAt: null, chapters: 0, pending: 0 }),
          sync: async () => ({ pending: 0, message: null }),
        },
        authStatus: async () => ({ ok: true, data: { signedIn: true } }),
        listCourses: async () => ({ ok: true, courses }),
        courseDetail: async () => ({ ok: true, data: { ...courseDetail, signedIn, access: 'active' } }),
        signIn: async () => {
          signedIn = true;
          return { ok: true, data: { signedIn: true } };
        },
        signOut: async () => ({ ok: true, data: { signedIn: false } }),
        cancelSignIn: async () => {},
        enroll: async () => ({ ok: true, data: { lifecycle: 'ACTIVE' } }),
        startLearning: async () => ({ ok: true, data: { href: '/courses/systems/lesson-one' } }),
        learning: {
          upgradeCurriculum: async () => ({ ok: true, data: { success: true, releaseId: 'rel-1' } }),
          lesson: async () => ({
            ok: true,
            data: {
              course: { id: courses[0].id, slug: courses[0].slug, title: courses[0].title, projectGoal: null },
              chapter: { ...chapter, lessonLabel: '01.01', estimatedMinutes: 5, readerMode: 'DEFAULT', isMilestone: false, blockCount: 0 },
              prev: null,
              next: null,
              modules: modules(),
              track: null,
              locked: false,
              previous: null,
              content: {
                source: '',
                learningLogAnswers: {},
                checklistState: {},
                chapterComplete: false,
                canMarkComplete: true,
                checkpointsCompleted: 0,
                checkpointsTotal: 0,
                nextLocked: false,
                reflectionPending: false,
                recap: { checks: '', open: '', next: '' },
                streakMilestone: null,
                headingNotes: {},
                highlights: [],
                predictGate: false,
                predictRevealed: true,
                helpThread: null,
              },
              document,
            },
          }),
          overview: async () => ({
            ok: true,
            data: {
              course: { ...courses[0], status: 'PUBLISHED' },
              access: 'active',
              coupon: null,
              track: null,
              enrollment: { percentComplete: 0, chaptersCompleted: 0, pendingReviews: 0, status: 'IN_PROGRESS' },
              rating: null,
              ratingDismissed: false,
              syllabus: { modules: modules(), chapterCount: 1, continueHref: '/courses/systems/lesson-one', defaultOpenModuleId: 'module' },
            },
          }),
          saveLog: async () => ({ ok: true, data: null }),
          checklist: async () => ({ ok: true, data: null }),
          highlights: {
            chapter: async () => ({ ok: true, data: [...store] }),
            all: async () => ({
              ok: true,
              data: store.map((h) => ({
                ...h,
                chapterId: chapter.id,
                chapterSlug: chapter.slug,
                chapterTitle: chapter.title,
                courseSlug: courses[0].slug,
                courseTitle: courses[0].title,
              })),
            }),
            create: async (_chapterId: string, input: any) => {
              calls.push('create');
              const row = { id: 'h' + ++counter, prefix: null, suffix: null, note: null, color: 'YELLOW', ...input };
              store.push(row);
              return { ok: true, data: row };
            },
            update: async (id: string, patch: any) => {
              calls.push('update:' + JSON.stringify(patch));
              const row = store.find((h) => h.id === id)!;
              if (patch.color) row.color = patch.color;
              if (patch.note !== undefined) row.note = patch.note;
              return { ok: true, data: { ...row } };
            },
            remove: async (id: string) => {
              calls.push('remove');
              store.splice(store.findIndex((h) => h.id === id), 1);
              return { ok: true, data: null };
            },
          },
        },
      } as any;
      bridge.learning = withFallback(bridge.learning);
      window.buildment = withFallback(bridge);
    },
    { courses, courseDetail, document, seed },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: 'Preview ' + courses[0].title, exact: true }).click();
  await page.getByRole('link', { name: 'Start learning', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Debugging basics', exact: true })).toBeVisible();
}

/** Selects text the way a reader does and waits for the toolbar. */
async function select(page: Page, text: string) {
  await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.querySelector('.lesson-prose')!, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const at = node.nodeValue!.indexOf(text);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + text.length);
      const sel = getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    throw new Error('text not found: ' + text);
  }, text);
  await expect(page.getByRole('toolbar', { name: 'Highlight the selected text' })).toBeVisible();
}

const calls = (page: Page) => page.evaluate(() => (window as any).__calls as string[]);

test('Add note highlights the text and opens the note in one step, and the note saves by itself', async ({ page }) => {
  await setup(page);
  await select(page, 'one thing at a time');
  await page.getByRole('button', { name: 'Add note' }).click();
  const card = page.getByRole('dialog', { name: 'Highlight note' });
  await expect(card).toBeVisible();
  await expect(page.getByLabel('Your note')).toBeFocused();
  await expect(card.getByText('one thing at a time')).toBeVisible();
  expect(await calls(page)).toEqual(['create']);

  await page.getByLabel('Your note').fill('Fix one cause per run');
  await expect(card.getByText('Saves when you stop typing')).toBeVisible();
  // No click needed: the note is saved a moment after typing stops.
  await expect(card.getByText('Saved', { exact: true })).toBeVisible();
  expect(await calls(page)).toEqual(['create', 'update:{"note":"Fix one cause per run"}']);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(card).toBeHidden();
  const mark = page.locator('mark.hl-mark');
  await expect(mark).toHaveText('one thing at a time');
  await expect(mark).toHaveAttribute('title', 'Fix one cause per run');
  await expect(mark).toHaveClass(/decoration-dotted/);
});

test('closing the card keeps a note that was just typed, and Ctrl+Enter finishes', async ({ page }) => {
  await setup(page);
  await select(page, 'first job in');
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByLabel('Your note').fill('FIFO');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('dialog', { name: 'Highlight note' })).toBeHidden();
  expect((await calls(page)).at(-1)).toBe('update:{"note":"FIFO"}');
  // Focus goes back to the highlight so a keyboard reader keeps their place, and Enter opens it again.
  await expect(page.locator('mark.hl-mark[data-hl-first]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Your note')).toHaveValue('FIFO');
});

test('a colour click only highlights; colour can be changed and a highlight with a note asks before it is deleted', async ({ page }) => {
  await setup(page);
  await select(page, 'run the test again');
  await page.getByRole('button', { name: 'Highlight green' }).click();
  await expect(page.getByRole('dialog', { name: 'Highlight note' })).toHaveCount(0);
  expect(await calls(page)).toEqual(['create']);
  const mark = page.locator('mark.hl-mark');
  await expect(mark).toHaveClass(/bg-green-200/);

  await mark.click();
  const card = page.getByRole('dialog', { name: 'Highlight note' });
  await card.getByRole('button', { name: 'Pink highlight' }).click();
  await expect(mark).toHaveClass(/bg-pink-200/);
  await page.getByLabel('Your note').fill('Run it twice');
  await card.getByRole('button', { name: 'Delete highlight' }).click();
  await expect(card.getByText('Delete this highlight and its note?')).toBeVisible();
  await card.getByRole('button', { name: 'Keep' }).click();
  await expect(mark).toHaveCount(1);
  await card.getByRole('button', { name: 'Delete highlight' }).click();
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(mark).toHaveCount(0);
});

test('selecting the same text again opens the existing highlight instead of failing', async ({ page }) => {
  await setup(page);
  await select(page, 'keeps work in order');
  await page.getByRole('button', { name: 'Highlight blue' }).click();
  await expect(page.locator('mark.hl-mark')).toHaveCount(1);
  await select(page, 'keeps work in order');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByRole('dialog', { name: 'Highlight note' })).toBeVisible();
  expect((await calls(page)).filter((call) => call === 'create')).toHaveLength(1);
});

test('the chapter list shows highlights in reading order with their notes', async ({ page }) => {
  await setup(page, [
    { id: 'b', color: 'BLUE', quote: 'first job in', prefix: 'order, so the ', suffix: ' is the first job out.', occurrence: 0, note: 'FIFO' },
    { id: 'a', color: 'YELLOW', quote: 'one thing at a time', prefix: 'Change ', suffix: ' when you debug.', occurrence: 0, note: null },
  ]);
  await expect(page.locator('mark.hl-mark')).toHaveCount(2);
  await page.getByRole('button', { name: /Highlights, 2 saved, 1 with notes/ }).click();
  const items = page.getByRole('region', { name: 'Highlights in this chapter' }).getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('one thing at a time');
  await expect(items.nth(0).getByRole('button', { name: 'Add note' })).toBeVisible();
  await expect(items.nth(1)).toContainText('FIFO');
  await items.nth(1).getByRole('button', { name: 'Edit note' }).click();
  await expect(page.getByLabel('Your note')).toHaveValue('FIFO');
});

test('the notebook searches, edits a note in place, and opens the chapter at the highlight', async ({ page }) => {
  await setup(page, [
    { id: 'b', color: 'BLUE', quote: 'first job in', prefix: 'order, so the ', suffix: ' is the first job out.', occurrence: 0, note: 'FIFO' },
    { id: 'a', color: 'YELLOW', quote: 'one thing at a time', prefix: 'Change ', suffix: ' when you debug.', occurrence: 0, note: null },
  ]);
  await page.getByRole('button', { name: /Highlights, 2 saved/ }).click();
  await page.getByRole('button', { name: /Open all my highlights and notes/ }).click();
  await expect(page.getByRole('heading', { name: 'My highlights and notes' })).toBeVisible();
  await expect(page.getByText('2 highlights, 1 with note')).toBeVisible();

  const notes = page.getByRole('region', { name: 'Highlights and notes' }).getByRole('listitem');
  await page.getByRole('searchbox', { name: 'Search highlights and notes' }).fill('fifo');
  await expect(notes).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'With notes' }).click();
  await expect(notes).toHaveCount(1);
  await page.getByRole('button', { name: 'With notes' }).click();

  const plain = notes.filter({ hasText: 'one thing at a time' });
  await plain.getByRole('button', { name: 'Add note' }).click();
  await plain.getByLabel('Note').fill('Small steps');
  await plain.getByLabel('Note').press('Control+Enter');
  await expect(plain.getByText('Small steps')).toBeVisible();
  expect((await calls(page)).at(-1)).toBe('update:{"note":"Small steps"}');

  await plain.getByRole('button', { name: 'Open in chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Debugging basics', exact: true })).toBeVisible();
  // The highlight has a note, so its card opens on arrival to show it.
  await expect(page.getByRole('dialog', { name: 'Highlight note' })).toBeVisible();
  await expect(page.getByLabel('Your note')).toHaveValue('Small steps');
});

test('a selection that is too long says so instead of doing nothing', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const prose = document.querySelector('.lesson-prose')!;
    const p = prose.querySelector('p')!;
    p.textContent = 'word '.repeat(150);
  });
  await page.evaluate(() => {
    const p = document.querySelector('.lesson-prose p')!;
    const range = document.createRange();
    range.selectNodeContents(p);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await expect(page.getByText('Select 500 characters or fewer.')).toBeVisible();
});
