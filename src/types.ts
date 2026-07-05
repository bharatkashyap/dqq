import type { Id } from "../convex/_generated/dataModel";

export type AnswerSlide = {
  title: string;
  subtitle?: string;
  body: any;
  audioUrl?: string;
};

export type Question = {
  _id: Id<"questions">;
  quizSlug: string;
  date: string;
  title: string;
  number: number;
  answer?: string;
  answerKeywords?: string[];
  category: string;
  playersToday: number;
  question: string;
  paragraphs: any[];
  answerSnippet?: {
    title: string;
    body: any;
  };
  answerSlides?: AnswerSlide[];
};

export type StoredResult = {
  initials: string;
  elapsedSeconds: number;
  wrongAttempts: number;
  answerQuality: number;
  visibleWordsByCard: number[];
  completedAt: string;
  skipped?: boolean;
};

export type QuestionProgress = {
  currentCardIndex: number;
  elapsedSeconds: number;
  skipAnimation: boolean;
  visibleWordsByCard: number[];
};

export type GameState = "intro" | "playing" | "result";