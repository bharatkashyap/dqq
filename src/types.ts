export type Question = {
  _id: string;
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
};

export type StoredResult = {
  initials: string;
  elapsedSeconds: number;
  wrongAttempts: number;
  answerQuality: number;
  visibleWordsByCard: number[];
  completedAt: string;
};

export type GameState = "intro" | "playing" | "result";
