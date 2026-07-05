import { v } from "convex/values";

export const emptyRichTextDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const answerSnippetValidator = v.object({
  title: v.string(),
  body: v.any(),
});

export const answerSlideValidator = v.object({
  title: v.string(),
  subtitle: v.optional(v.string()),
  body: v.any(),
  audioUrl: v.optional(v.string()),
});

export const answerSlidesValidator = v.array(answerSlideValidator);

export type AnswerSnippet = {
  title: string;
  body: unknown;
};

export type AnswerSlide = {
  title: string;
  subtitle?: string;
  body: unknown;
  audioUrl?: string;
};

function normalizeSlide(slide: Partial<AnswerSlide>, fallbackTitle: string) {
  const title = slide.title?.trim() || fallbackTitle;
  const subtitle = slide.subtitle?.trim();
  const normalized: AnswerSlide = {
    title,
    body: slide.body ?? emptyRichTextDoc,
  };

  if (subtitle) {
    normalized.subtitle = subtitle;
  }
  if (slide.audioUrl) {
    normalized.audioUrl = slide.audioUrl;
  }

  return normalized;
}

export function answerSlidesFromRecord(record: {
  answerSnippet: AnswerSnippet;
  answerSlides?: AnswerSlide[] | null;
}) {
  const slides =
    Array.isArray(record.answerSlides) && record.answerSlides.length > 0
      ? record.answerSlides
      : [
          {
            title: record.answerSnippet.title,
            body: record.answerSnippet.body,
          },
        ];

  return slides.map((slide, index) =>
    normalizeSlide(slide, index === 0 ? record.answerSnippet.title : "Answer"),
  );
}

export function answerSnippetFromSlides(
  slides: AnswerSlide[],
  fallback?: AnswerSnippet,
) {
  const firstSlide = slides[0];

  if (firstSlide) {
    return {
      title: firstSlide.title,
      body: firstSlide.body,
    };
  }

  return fallback ?? { title: "Answer", body: emptyRichTextDoc };
}