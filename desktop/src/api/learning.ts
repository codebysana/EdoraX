import type {
  CourseOverview,
  UpdateCourseTrackResult,
} from '../../../server/src/shared/api/catalog';
import type { Result } from '../domain/catalog';
import type { Lesson, BlockState, AnswerResult } from '../domain/learning';
import type { AiInterviewSessionResult } from '../../../server/src/shared/api/ai';
import type {
  HighlightColor,
  HighlightView,
  UserHighlightView,
} from '@buildment/learning-ui/components/learn/highlight-types';
import { parseLesson } from '../learning/parse-lesson';
import { isRecord } from './validation';
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<Result<unknown>>;
const segment = (value: string) => encodeURIComponent(value);
function valid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}
const invalid = {
  ok: false as const,
  code: 'INVALID_INPUT',
  message: 'Invalid lesson request.',
};
const colors = ['YELLOW', 'GREEN', 'BLUE', 'PINK'];
const NOTE_MAX = 5000;
function isHighlight(value: unknown): value is HighlightView {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.quote === 'string' &&
    typeof value.color === 'string' &&
    colors.includes(value.color) &&
    typeof value.occurrence === 'number' &&
    (value.note === null || typeof value.note === 'string')
  );
}
function isUserHighlight(value: unknown): value is UserHighlightView {
  return (
    isHighlight(value) &&
    typeof (value as Record<string, unknown>).chapterId === 'string' &&
    typeof (value as Record<string, unknown>).chapterSlug === 'string' &&
    typeof (value as Record<string, unknown>).chapterTitle === 'string' &&
    typeof (value as Record<string, unknown>).courseSlug === 'string' &&
    typeof (value as Record<string, unknown>).courseTitle === 'string'
  );
}
const badHighlight = {
  ok: false as const,
  code: 'INVALID_RESPONSE',
  message: 'The highlight could not be read.',
};
const optionalText = (value: unknown, max: number) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.length <= max);

export function createLearningClient(request: Request) {
  return {
    async downloadChapter(course: string, chapter: string): Promise<Result<{
      releaseId: string;
      lesson: Lesson;
      blocks: Record<string, BlockState>;
    }>> {
      if (!valid(course) || !valid(chapter)) return invalid;
      const result = await request(
        '/api/v1/courses/' + segment(course) + '/chapters/' + segment(chapter) + '/download',
      );
      if (!result.ok) return result;
      const data = result.data;
      if (!isRecord(data) || typeof data.releaseId !== 'string' ||
          !isRecord(data.lesson) || !isRecord(data.lesson.chapter) ||
          (data.lesson.content !== null &&
            (!isRecord(data.lesson.content) || typeof data.lesson.content.source !== 'string')) ||
          !isRecord(data.blocks))
        return { ok: false, code: 'INVALID_RESPONSE', message: 'Could not download this lesson.' };
      try {
        const document = parseLesson(isRecord(data.lesson.content) ? data.lesson.content.source as string : '');
        return { ok: true, data: {
          releaseId: data.releaseId,
          lesson: { ...data.lesson, document } as Lesson,
          blocks: data.blocks as Record<string, BlockState>,
        } };
      } catch {
        return { ok: false, code: 'INVALID_CONTENT', message: 'This lesson has invalid content.' };
      }
    },
    async lesson(course: string, chapter: string): Promise<Result<Lesson>> {
      if (!valid(course) || !valid(chapter)) return invalid;
      const result = await request(
        '/api/v1/courses/' + segment(course) + '/chapters/' + segment(chapter),
      );
      if (!result.ok) return result;
      const data = result.data;
      if (
        !isRecord(data) ||
        !isRecord(data.chapter) ||
        !Array.isArray(data.modules) ||
        (data.content !== null &&
          (!isRecord(data.content) || typeof data.content.source !== 'string'))
      )
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          message: 'The lesson could not be read.',
        };
      try {
        const document = parseLesson(
          isRecord(data.content) ? String(data.content.source) : '',
        );
        return { ok: true, data: { ...data, document } as Lesson };
      } catch {
        return {
          ok: false,
          code: 'INVALID_CONTENT',
          message:
            'This lesson has invalid content. Please contact your instructor.',
        };
      }
    },
    async overview(course: string): Promise<Result<CourseOverview>> {
      if (!valid(course)) return invalid;
      const result = await request(
        '/api/v1/courses/' + segment(course) + '/overview',
      );
      if (!result.ok) return result;
      if (
        !isRecord(result.data) ||
        !isRecord(result.data.course) ||
        !['active', 'none', 'payment_required'].includes(
          String(result.data.access),
        ) ||
        (result.data.access === 'active' &&
          (!isRecord(result.data.enrollment) ||
            !isRecord(result.data.syllabus) ||
            !Array.isArray(result.data.syllabus.modules)))
      )
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          message: 'Could not read the course overview.',
        };
      return { ok: true, data: result.data as CourseOverview };
    },
    async upgradeCurriculum(
      course: string,
    ): Promise<Result<{ success: boolean; releaseId: string }>> {
      if (!valid(course)) return invalid;
      const result = await request(
        '/api/v1/courses/' + segment(course) + '/upgrade-curriculum',
        'POST',
      );
      if (!result.ok) return result;
      return {
        ok: true,
        data: result.data as { success: boolean; releaseId: string },
      };
    },
    async updateTrack(
      course: string,
      kind: 'variant' | 'specialisation',
      slug: string,
    ): Promise<Result<UpdateCourseTrackResult>> {
      if (
        !valid(course) ||
        !valid(slug) ||
        !['variant', 'specialisation'].includes(kind)
      )
        return invalid;
      const result = await request(
        '/api/v1/courses/' + segment(course) + '/track/' + kind,
        'PUT',
        { [kind + 'Slug']: slug },
      );
      if (!result.ok) return result;
      if (
        !isRecord(result.data) ||
        typeof result.data.courseSlug !== 'string' ||
        !isRecord(result.data.track)
      )
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          message: 'Could not confirm your course choice.',
        };
      return { ok: true, data: result.data as UpdateCourseTrackResult };
    },
    async block(id: string): Promise<Result<BlockState>> {
      if (!valid(id)) return invalid;
      const result = await request('/api/v1/blocks/' + segment(id) + '/state');
      if (!result.ok) return result;
      if (
        !isRecord(result.data) ||
        typeof result.data.type !== 'string' ||
        !isRecord(result.data.config)
      )
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          message: 'Could not load this exercise.',
        };
      return { ok: true, data: result.data as BlockState };
    },
    async aiInterview(
      id: string,
      action: 'start' | 'answer' | 'finish' | 'abandon',
      payload: unknown,
    ): Promise<Result<AiInterviewSessionResult>> {
      if (
        !valid(id) ||
        !['start', 'answer', 'finish', 'abandon'].includes(action) ||
        !isRecord(payload)
      )
        return invalid;
      const result = await request(
        `/api/v1/blocks/${segment(id)}/ai-interview/${action}`,
        'POST',
        payload,
      );
      if (!result.ok) return result;
      if (!isRecord(result.data) || !isRecord(result.data.session))
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          message: 'Could not load the interview response.',
        };
      return { ok: true, data: result.data as AiInterviewSessionResult };
    },
    async answer(
      id: string,
      payload: Record<string, unknown>,
    ): Promise<Result<AnswerResult>> {
      if (!valid(id) || !isRecord(payload)) return invalid;
      const result = await request(
        '/api/v1/blocks/' + segment(id) + '/respond',
        'POST',
        payload,
      );
      if (!result.ok) return result;
      if (!isRecord(result.data))
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          message: 'Could not confirm your answer.',
        };
      return { ok: true, data: result.data as AnswerResult };
    },
    async quiz(id: string) {
      if (!valid(id)) return invalid;
      return request('/api/v1/chapters/' + segment(id) + '/quiz');
    },
    async submitQuiz(
      id: string,
      answers: Array<{ blockId: string; selected: string[] }>,
    ) {
      if (!valid(id) || !Array.isArray(answers)) return invalid;
      return request(
        '/api/v1/chapters/' + segment(id) + '/quiz/submit',
        'POST',
        { answers },
      );
    },
    async complete(id: string) {
      if (!valid(id)) return invalid;
      return request('/api/v1/chapters/' + segment(id) + '/complete', 'POST');
    },
    async saveLog(id: string, answers: Record<string, string>) {
      if (!valid(id) || !isRecord(answers)) return invalid;
      return request(
        '/api/v1/chapters/' + segment(id) + '/learning-log',
        'PUT',
        { answers },
      );
    },
    async checklist(id: string, item: string, checked: boolean) {
      if (!valid(id) || !valid(item) || typeof checked !== 'boolean')
        return invalid;
      return request(
        '/api/v1/chapters/' + segment(id) + '/checklist/' + segment(item),
        'PUT',
        { checked },
      );
    },
    highlights: {
      async chapter(chapterId: string): Promise<Result<HighlightView[]>> {
        if (!valid(chapterId)) return invalid;
        const result = await request(
          '/api/v1/chapters/' + segment(chapterId) + '/highlights',
        );
        if (!result.ok) return result;
        if (!Array.isArray(result.data) || !result.data.every(isHighlight))
          return badHighlight;
        return { ok: true, data: result.data };
      },
      async all(): Promise<Result<UserHighlightView[]>> {
        const result = await request('/api/v1/learner/highlights');
        if (!result.ok) return result;
        if (!Array.isArray(result.data) || !result.data.every(isUserHighlight))
          return badHighlight;
        return { ok: true, data: result.data };
      },
      async create(
        chapterId: string,
        input: {
          color?: HighlightColor;
          quote: string;
          prefix?: string | null;
          suffix?: string | null;
          occurrence?: number;
          note?: string | null;
        },
      ): Promise<Result<HighlightView>> {
        if (
          !valid(chapterId) ||
          !isRecord(input) ||
          typeof input.quote !== 'string' ||
          !input.quote.trim() ||
          input.quote.length > 500 ||
          (input.color !== undefined && !colors.includes(input.color)) ||
          !optionalText(input.prefix, 100) ||
          !optionalText(input.suffix, 100) ||
          !optionalText(input.note, NOTE_MAX) ||
          (input.occurrence !== undefined &&
            !(Number.isInteger(input.occurrence) && input.occurrence >= 0 && input.occurrence <= 1000))
        )
          return invalid;
        const result = await request(
          '/api/v1/chapters/' + segment(chapterId) + '/highlights',
          'POST',
          {
            color: input.color,
            quote: input.quote,
            prefix: input.prefix,
            suffix: input.suffix,
            occurrence: input.occurrence,
            note: input.note,
          },
        );
        if (!result.ok) return result;
        return isHighlight(result.data)
          ? { ok: true, data: result.data }
          : badHighlight;
      },
      async update(
        id: string,
        patch: { color?: HighlightColor; note?: string | null },
      ): Promise<Result<HighlightView>> {
        if (
          !valid(id) ||
          !isRecord(patch) ||
          (patch.color !== undefined && !colors.includes(patch.color)) ||
          !optionalText(patch.note, NOTE_MAX)
        )
          return invalid;
        const result = await request(
          '/api/v1/learner/highlights/' + segment(id),
          'PATCH',
          { color: patch.color, note: patch.note },
        );
        if (!result.ok) return result;
        return isHighlight(result.data)
          ? { ok: true, data: result.data }
          : badHighlight;
      },
      async remove(id: string): Promise<Result<null>> {
        if (!valid(id)) return invalid;
        const result = await request(
          '/api/v1/learner/highlights/' + segment(id),
          'DELETE',
        );
        return result.ok ? { ok: true, data: null } : result;
      },
    },
  };
}
