<script setup lang="ts">
import {
  CalendarDays,
  Check,
  ChevronRight,
  Lock,
  Play,
  Share2,
  Timer,
  X,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import Button from "@/components/ui/Button.vue";
import TipTapRenderer from "@/components/TipTapRenderer.vue";
import type { Question, StoredResult, GameState } from "@/types";
import { countWordsInNode } from "@/lib/tiptap";
import { useConvexClient, useConvexMutation } from "convex-vue";
import { api } from "../convex/_generated/api";

type LockedQuestion = Omit<Question, "_id"> & { _id: string };
type ArchiveQuestionItem = {
  question: Question | LockedQuestion;
  index: number;
  locked: boolean;
};

const selectedQuizSlug = ref("daily");
const route = useRoute();
const router = useRouter();
const convex = useConvexClient();

const todayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const archiveQuestionsData = ref<Question[]>([]);
const archiveLoaded = ref(false);
const isArchiveLoading = ref(false);
const isQuestionLoading = ref(false);
const questionError = ref("");
const currentQuestion = ref<Question | LockedQuestion | null>(null);
const dailyQuestions = computed<Question[]>(() => archiveQuestionsData.value);
const routeDate = computed(() =>
  typeof route.params.date === "string" ? route.params.date : "",
);
const isHome = computed(() => route.name === "home");

const gameState = ref<GameState>("intro");
const initials = ref("");
const guess = ref("");
const copied = ref(false);
const showArchive = ref(false);
const currentCardIndex = ref(0);
const visibleWordsByCard = ref<number[]>([]);
const elapsedSeconds = ref(0);
const wrongAttempts = ref(0);
const answerQuality = ref(1);
const resultTone = ref<"idle" | "right" | "wrong">("idle");
const secondsUntilReset = ref(0);
const animatedScore = ref(0);

const fullAnswerData = ref<any>(null);
const resultStats = ref<{ playersToday: number; rank: number } | null>(null);

const recordCompletion = useConvexMutation(api.questions.recordCompletion);

let revealTimer: number | undefined;
let gameTimer: number | undefined;
let resetTimer: number | undefined;
let toneTimer: number | undefined;
let scoreFrame: number | undefined;
let shareFeedbackTimer: number | undefined;

const selectedQuestion = computed(() => currentQuestion.value);
const selectedQuestionUrl = computed(() => {
  if (!selectedQuestion.value) return "";

  const path = router.resolve({
    name: "daily-question",
    params: { date: selectedQuestion.value.date },
  }).href;

  return new URL(path, window.location.origin).toString();
});
const selectedQuestionPath = computed(() =>
  selectedQuestion.value
    ? router.resolve({
        name: "daily-question",
        params: { date: selectedQuestion.value.date },
      }).href
    : "",
);
const isLocked = computed(
  () => !selectedQuestion.value || selectedQuestion.value.date > todayKey,
);
const playableQuestions = computed(() =>
  dailyQuestions.value.filter((entry) => entry.date <= todayKey),
);
const playerInitials = computed(
  () => initials.value.trim().slice(0, 3).toUpperCase() || "Guest",
);
const archiveQuestions = computed<ArchiveQuestionItem[]>(() => {
  const questions: ArchiveQuestionItem[] = [...playableQuestions.value]
    .reverse()
    .map((question) => ({
      question,
      index: dailyQuestions.value.findIndex(
        (entry) => entry.date === question.date,
      ),
      locked: false,
    }));

  const tomorrow = new Date(`${todayKey}T00:00:00+05:30`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);

  const lockedTomorrow: LockedQuestion = {
    _id: "locked-tomorrow",
    quizSlug: selectedQuizSlug.value,
    date: tomorrowDate,
    title: "Locked",
    number: (playableQuestions.value.at(0)?.number ?? 0) + 1,
    category: "Daily",
    playersToday: 0,
    question: "Unlocks tomorrow.",
    paragraphs: [],
  };

  questions.push({
    question: lockedTomorrow,
    index: -1,
    locked: true,
  });

  return questions;
});

const cardWordsCounts = computed(() => {
  if (!selectedQuestion.value) return [];
  return selectedQuestion.value.paragraphs.map((p) => countWordsInNode(p));
});

const visibleCardCount = computed(() => {
  if (!selectedQuestion.value) return 0;
  return Math.min(
    currentCardIndex.value + 1,
    selectedQuestion.value.paragraphs.length,
  );
});
const canRevealNextCard = computed(() => {
  const question = selectedQuestion.value;
  return Boolean(
    question && currentCardIndex.value < question.paragraphs.length - 1,
  );
});

const totalWordsSeen = computed(() =>
  visibleWordsByCard.value.reduce((total, count) => total + count, 0),
);
const totalAvailableWords = computed(() =>
  cardWordsCounts.value.reduce((total, count) => total + count, 0),
);

const cardComplete = computed(() => {
  const count = cardWordsCounts.value[currentCardIndex.value] ?? 0;
  return (visibleWordsByCard.value[currentCardIndex.value] ?? 0) >= count;
});

const formattedDate = computed(() => {
  if (!selectedQuestion.value) return "";
  return formatDate(selectedQuestion.value.date);
});
const timeRemaining = computed(() => formatDuration(secondsUntilReset.value));
const hasStoredResult = computed(() => {
  if (!selectedQuestion.value) return false;
  return Boolean(readStoredResult(selectedQuestion.value.date));
});
const playersToday = computed(
  () =>
    resultStats.value?.playersToday ??
    selectedQuestion.value?.playersToday ??
    0,
);
const rankToday = computed(() => {
  if (resultStats.value) {
    return resultStats.value.rank;
  }

  const scoreRatio = Math.max(0, Math.min(1, score.value / 50));
  const fallbackRank =
    Math.round(playersToday.value * Math.pow(1 - scoreRatio, 1.55)) + 1;

  return Math.max(1, Math.min(playersToday.value || 1, fallbackRank));
});
const rankLine = computed(
  () =>
    `#${rankToday.value} of ${Math.max(playersToday.value, 1)} ${pluralize(
      Math.max(playersToday.value, 1),
      "attempt",
    )}`,
);

const score = computed(() => {
  if (gameState.value !== "result" || isLocked.value) {
    return 0;
  }

  const paragraphPenalty = Math.max(0, visibleCardCount.value - 1) * 8.5;
  const wordPenalty = totalWordsSeen.value * 0.05;
  const timePenalty = elapsedSeconds.value * 0.025;
  const missPenalty = wrongAttempts.value * 1.75;
  const answerPenalty = (1 - answerQuality.value) * 3;

  return Number(
    Math.max(
      2.5,
      50 -
        paragraphPenalty -
        wordPenalty -
        timePenalty -
        missPenalty -
        answerPenalty,
    ).toFixed(2),
  );
});

const scoreLine = computed(() => {
  const phrases = [
    { min: 45, text: "Clean strike. Barely any trail exposed." },
    { min: 36, text: "Sharp read. You caught the pattern early." },
    { min: 24, text: "Steady solve. The clues did their work." },
    { min: 12, text: "Late solve, but you got there." },
    { min: 0, text: "You spent quite a while with that one." },
  ];

  return (
    phrases.find((phrase) => score.value >= phrase.min)?.text ??
    phrases.at(-1)?.text
  );
});

const animatedScoreText = computed(() => formatScore(animatedScore.value));

const shareText = computed(() => {
  if (!selectedQuestion.value) return "";
  return `Quizgen Daily #${selectedQuestion.value.number}
${playerInitials.value} ${score.value}/50
${elapsedSeconds.value}s · ${visibleCardCount.value} cards · ${totalWordsSeen.value}/${totalAvailableWords.value} words`;
});
const sharePayloadText = computed(() => {
  if (!shareText.value || !selectedQuestionUrl.value) return shareText.value;
  return `${shareText.value}\n${selectedQuestionUrl.value}`;
});

function storageKey(date: string) {
  return `quizgen-daily-result:${date}`;
}

function readStoredResult(date: string): StoredResult | null {
  try {
    const raw = window.localStorage.getItem(storageKey(date));
    return raw ? (JSON.parse(raw) as StoredResult) : null;
  } catch {
    return null;
  }
}

function createLockedQuestion(date: string): LockedQuestion {
  const latestNumber = playableQuestions.value.at(0)?.number ?? 0;

  return {
    _id: `locked-${date}`,
    quizSlug: selectedQuizSlug.value,
    date,
    title: "Locked",
    number: latestNumber + 1,
    category: "Daily",
    playersToday: 0,
    question: "Unlocks tomorrow.",
    paragraphs: [],
  };
}

function isPersistedQuestion(
  question: Question | LockedQuestion | null,
): question is Question {
  return Boolean(question && !question._id.startsWith("locked-"));
}

function setCurrentQuestion(question: Question | LockedQuestion | null) {
  clearTimers();
  currentQuestion.value = question;
  guess.value = "";
  copied.value = false;
  showArchive.value = false;
  currentCardIndex.value = 0;
  visibleWordsByCard.value = question?.paragraphs.map(() => 0) || [];
  elapsedSeconds.value = 0;
  wrongAttempts.value = 0;
  answerQuality.value = 1;
  resultTone.value = "idle";
  animatedScore.value = 0;
  fullAnswerData.value = null;
  resultStats.value = null;

  if (!question) {
    gameState.value = "intro";
    return;
  }

  if (question.date > todayKey) {
    gameState.value = "result";
    return;
  }

  gameState.value = hydrateStoredResult(question) ? "result" : "intro";
}

function applyQuestionSelection(index: number) {
  const question = dailyQuestions.value[index];
  if (!question) {
    return;
  }

  setCurrentQuestion(question);
}

async function loadArchive() {
  if (archiveLoaded.value || isArchiveLoading.value) {
    return;
  }

  isArchiveLoading.value = true;
  try {
    archiveQuestionsData.value = await convex.query(api.questions.getArchive, {
      quizSlug: selectedQuizSlug.value,
    });
    archiveLoaded.value = true;
  } finally {
    isArchiveLoading.value = false;
  }
}

async function loadQuestionByDate(date: string) {
  const question = await convex.query(api.questions.getQuestion, {
    quizSlug: selectedQuizSlug.value,
    date,
  });

  if (question) {
    setCurrentQuestion(question);
    return question;
  }

  if (date > todayKey) {
    setCurrentQuestion(createLockedQuestion(date));
    return selectedQuestion.value;
  }

  setCurrentQuestion(null);
  return null;
}

async function openLatestQuestion() {
  if (isQuestionLoading.value) {
    return;
  }

  isQuestionLoading.value = true;
  questionError.value = "";

  try {
    const latestQuestion = await convex.query(api.questions.getLatestQuestion, {
      quizSlug: selectedQuizSlug.value,
    });

    if (!latestQuestion) {
      questionError.value = "No daily question is available yet.";
      return;
    }

    setCurrentQuestion(latestQuestion);

    await router.push({
      name: "daily-question",
      params: { date: latestQuestion.date },
    });
  } catch (error) {
    console.error("Failed to load latest question", error);
    questionError.value = "Could not load today’s question.";
  } finally {
    isQuestionLoading.value = false;
  }
}

function writeStoredResult(question = selectedQuestion.value) {
  if (!question) return;
  const result: StoredResult = {
    initials: playerInitials.value,
    elapsedSeconds: elapsedSeconds.value,
    wrongAttempts: wrongAttempts.value,
    answerQuality: answerQuality.value,
    visibleWordsByCard: [...visibleWordsByCard.value],
    completedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    storageKey(question.date),
    JSON.stringify(result),
  );
}

function saveInitials() {
  const value = initials.value.trim().slice(0, 3).toUpperCase();
  if (value) {
    window.localStorage.setItem("quizgen-initials", value);
    return;
  }

  window.localStorage.removeItem("quizgen-initials");
}

function hydrateStoredResult(question = selectedQuestion.value) {
  if (!question) return false;
  const stored = readStoredResult(question.date);
  if (!stored) {
    return false;
  }

  initials.value = stored.initials;
  elapsedSeconds.value = stored.elapsedSeconds;
  wrongAttempts.value = stored.wrongAttempts;
  answerQuality.value = stored.answerQuality ?? 1;
  visibleWordsByCard.value = stored.visibleWordsByCard;
  currentCardIndex.value = Math.max(
    0,
    Math.min(
      stored.visibleWordsByCard.filter((count) => count > 0).length - 1,
      question.paragraphs.length - 1,
    ),
  );
  gameState.value = "result";
  fetchAnswerData(question.date);
  fetchResultStats();
  animateScore(score.value);
  return true;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+05:30`));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function updateResetCountdown() {
  const now = new Date();
  const reset = new Date(now);
  reset.setHours(24, 0, 0, 0);
  secondsUntilReset.value = Math.max(
    0,
    Math.floor((reset.getTime() - now.getTime()) / 1000),
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatScore(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [text];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function buildShareImageFile() {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#08080a");
  bg.addColorStop(0.55, "#111114");
  bg.addColorStop(1, "#09090b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const accent = ctx.createRadialGradient(820, 180, 60, 820, 180, 540);
  accent.addColorStop(0, "rgba(214,166,79,0.34)");
  accent.addColorStop(1, "rgba(214,166,79,0)");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, height);

  const accent2 = ctx.createRadialGradient(180, 1120, 40, 180, 1120, 520);
  accent2.addColorStop(0, "rgba(110,134,190,0.22)");
  accent2.addColorStop(1, "rgba(110,134,190,0)");
  ctx.fillStyle = accent2;
  ctx.fillRect(0, 0, width, height);

  const cardX = 72;
  const cardY = 92;
  const cardW = width - 144;
  const cardH = height - 184;

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#171719";
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = '700 28px "Avenir Next", sans-serif';
  ctx.letterSpacing = "0.18em";
  ctx.fillText("QUIZGEN DAILY", cardX + 44, cardY + 54);

  ctx.fillStyle = "#f6f0e4";
  ctx.font = '700 56px "Avenir Next", sans-serif';
  ctx.fillText(
    `Daily #${selectedQuestion.value?.number ?? ""}`,
    cardX + 44,
    cardY + 122,
  );

  ctx.fillStyle = "#e7b64d";
  ctx.font = '800 108px "Iowan Old Style", Georgia, serif';
  ctx.fillText(formatScore(score.value), cardX + 44, cardY + 238);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = '700 34px "Avenir Next", sans-serif';
  const dateLine = `${formattedDate.value} · ${elapsedSeconds.value}s · ${visibleCardCount.value} cards`;
  const dateLines = wrapText(ctx, dateLine, cardW - 88);
  let cursorY = cardY + 286;
  for (const line of dateLines.slice(0, 2)) {
    ctx.fillText(line, cardX + 44, cursorY);
    cursorY += 40;
  }

  const promptY = cardY + 388;
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 42px "Avenir Next", sans-serif';
  const promptLines = wrapText(
    ctx,
    selectedQuestion.value?.question ?? "",
    cardW - 88,
  );
  let lineY = promptY;
  for (const line of promptLines.slice(0, 3)) {
    ctx.fillText(line, cardX + 44, lineY);
    lineY += 50;
  }

  const statsY = promptY + 238;
  const statsH = 330;
  ctx.fillStyle = "#1f1f22";
  roundRect(ctx, cardX + 24, statsY, cardW - 48, statsH, 34);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.font = '800 26px "Avenir Next", sans-serif';
  ctx.fillText("RESULT", cardX + 52, statsY + 52);

  const stats = [
    ["TIME", `${elapsedSeconds.value}s`],
    ["CARDS", String(visibleCardCount.value)],
    ["WORDS", `${totalWordsSeen.value}/${totalAvailableWords.value}`],
  ];

  const statW = (cardW - 128) / stats.length;
  stats.forEach(([label, value], index) => {
    const x = cardX + 52 + statW * index;
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = '800 22px "Avenir Next", sans-serif';
    ctx.fillText(label, x, statsY + 126);
    ctx.fillStyle = "#f6f0e4";
    ctx.font = '800 48px "Avenir Next", sans-serif';
    ctx.fillText(value, x, statsY + 188);
  });

  ctx.fillStyle = "#e7b64d";
  ctx.font = '700 34px "Avenir Next", sans-serif';
  const challengeLines = wrapText(
    ctx,
    "Think you can solve it earlier?",
    cardW - 104,
  );
  let challengeY = statsY + 274;
  for (const line of challengeLines.slice(0, 2)) {
    ctx.fillText(line, cardX + 52, challengeY);
    challengeY += 42;
  }

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = '700 24px "Avenir Next", sans-serif';
  ctx.fillText(
    `${playerInitials.value} · ${totalWordsSeen.value}/${totalAvailableWords.value} words`,
    cardX + 52,
    cardY + cardH - 48,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) {
    return null;
  }

  return new File(
    [blob],
    `quizgen-daily-${selectedQuestion.value?.number ?? "share"}.png`,
    {
      type: "image/png",
    },
  );
}

function animateScore(target: number) {
  if (scoreFrame) {
    window.cancelAnimationFrame(scoreFrame);
  }

  const start = animatedScore.value;
  const startedAt = performance.now();
  const duration = 950;

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    animatedScore.value = start + (target - start) * eased;

    if (progress < 1) {
      scoreFrame = window.requestAnimationFrame(tick);
      return;
    }

    animatedScore.value = target;
  };

  scoreFrame = window.requestAnimationFrame(tick);
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

async function fetchAnswerData(date: string) {
  fullAnswerData.value = await convex.query(api.questions.getAnswer, {
    quizSlug: selectedQuizSlug.value,
    date,
  });
}

async function fetchResultStats() {
  const question = selectedQuestion.value;
  if (!isPersistedQuestion(question)) return;

  resultStats.value = await convex.query(api.questions.getResultStats, {
    questionId: question._id,
    score: score.value,
  });
}

async function getAnswerQuality(value: string) {
  if (!fullAnswerData.value) {
    if (!selectedQuestion.value) {
      return 0;
    }
    await fetchAnswerData(selectedQuestion.value.date);
  }
  if (!fullAnswerData.value) return 0;

  const normalizedGuess = normalize(value);
  const normalizedAnswer = normalize(fullAnswerData.value.answer);
  const keywords = fullAnswerData.value.answerKeywords
    .map(normalize)
    .filter(Boolean);

  if (normalizedGuess === normalizedAnswer) {
    return 1;
  }

  const matchedKeywords = keywords.filter((keyword: string) => {
    const keywordPattern = new RegExp(
      `(^| )${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`,
    );
    return keywordPattern.test(normalizedGuess);
  });

  if (!matchedKeywords.length) {
    return 0;
  }

  return matchedKeywords.length / keywords.length;
}

function triggerHaptics(pattern: number | number[]) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function clearTimers() {
  window.clearInterval(revealTimer);
  window.clearInterval(gameTimer);
  window.clearTimeout(toneTimer);
  window.clearTimeout(shareFeedbackTimer);
}

function showShareFeedback() {
  copied.value = true;
  window.clearTimeout(shareFeedbackTimer);
  shareFeedbackTimer = window.setTimeout(() => {
    copied.value = false;
  }, 1800);
}

function startReveal() {
  window.clearInterval(revealTimer);
  revealTimer = window.setInterval(() => {
    const index = currentCardIndex.value;
    const shown = visibleWordsByCard.value[index] ?? 0;
    const count = cardWordsCounts.value[index] ?? 0;

    if (shown >= count) {
      window.clearInterval(revealTimer);
      return;
    }

    visibleWordsByCard.value[index] = shown + 1;
  }, 170);
}

function startGame() {
  if (isLocked.value || hydrateStoredResult()) {
    return;
  }

  saveInitials();
  clearTimers();
  gameState.value = "playing";
  guess.value = "";
  copied.value = false;
  showArchive.value = false;
  currentCardIndex.value = 0;
  visibleWordsByCard.value = selectedQuestion.value?.paragraphs?.map(
    () => 0,
  ) ?? [0];
  elapsedSeconds.value = 0;
  wrongAttempts.value = 0;
  answerQuality.value = 1;
  resultTone.value = "idle";

  gameTimer = window.setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
  startReveal();
}

function revealNextCard() {
  if (!selectedQuestion.value) return;
  if (currentCardIndex.value >= selectedQuestion.value.paragraphs.length - 1) {
    return;
  }

  currentCardIndex.value += 1;
  triggerHaptics(12);
  startReveal();
}

function canRevealCard(cardIndex: number) {
  return (
    cardComplete.value &&
    canRevealNextCard.value &&
    cardIndex === currentCardIndex.value + 1
  );
}

function revealCard(cardIndex: number) {
  if (!canRevealCard(cardIndex)) {
    return;
  }

  revealNextCard();
}

function selectArchiveQuestion(item: (typeof archiveQuestions.value)[number]) {
  if (item.locked) return;
  chooseQuestion(item.index);
}

async function submitGuess() {
  const question = selectedQuestion.value;
  if (
    !guess.value.trim() ||
    gameState.value !== "playing" ||
    !isPersistedQuestion(question)
  ) {
    return;
  }

  const quality = await getAnswerQuality(guess.value);

  if (quality > 0) {
    answerQuality.value = quality;
    gameState.value = "result";
    resultTone.value = "right";
    clearTimers();
    writeStoredResult();
    saveInitials();
    animateScore(score.value);
    triggerHaptics([18, 36, 18, 60, 42]);

    // Check if this was the first time completion and increment playersToday
    const alreadyCompletedStr = localStorage.getItem(
      `quizgen-completed:${question.date}`,
    );
    if (!alreadyCompletedStr) {
      localStorage.setItem(`quizgen-completed:${question.date}`, "true");
      try {
        await recordCompletion.mutate({
          id: question._id,
          score: score.value,
          elapsedSeconds: elapsedSeconds.value,
          visibleCardCount: visibleCardCount.value,
          paragraphsRevealed: Math.max(0, visibleCardCount.value - 1),
          totalWordsSeen: totalWordsSeen.value,
          totalAvailableWords: totalAvailableWords.value,
          answerQuality: answerQuality.value,
          wrongAttempts: wrongAttempts.value,
        });
      } catch (e) {
        console.error("Failed to record completion", e);
      }
    }

    try {
      await fetchResultStats();
    } catch (e) {
      console.error("Failed to load result stats", e);
    }
  } else {
    wrongAttempts.value += 1;
    resultTone.value = "wrong";
    triggerHaptics(24);
    window.clearTimeout(toneTimer);
    toneTimer = window.setTimeout(() => {
      resultTone.value = "idle";
    }, 500);
  }
}

function chooseQuestion(index: number) {
  const question = dailyQuestions.value[index];
  if (!question) {
    return;
  }

  applyQuestionSelection(index);

  if (routeDate.value === question.date) {
    return;
  }

  void router.push({
    name: "daily-question",
    params: { date: question.date },
  });
}

function goHome() {
  if (isHome.value) {
    return;
  }

  void router.push({ name: "home" });
}

async function shareScore() {
  const text = sharePayloadText.value;
  const file = await buildShareImageFile();

  if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "Quizgen Daily",
      text,
      url: selectedQuestionUrl.value,
      files: [file],
    });
    showShareFeedback();
    return;
  }

  if (navigator.share) {
    await navigator.share({
      text,
      title: "Quizgen Daily",
      url: selectedQuestionUrl.value,
    });
    showShareFeedback();
    return;
  }

  await navigator.clipboard.writeText(text);
  showShareFeedback();
}

watch(showArchive, async (open) => {
  if (open) {
    await loadArchive();
  }
});

watch(currentQuestion, async (question) => {
  startGame();
});

watch(
  routeDate,
  async (date) => {
    questionError.value = "";

    if (!date) {
      setCurrentQuestion(null);
      return;
    }

    if (selectedQuestion.value?.date === date) {
      return;
    }

    isQuestionLoading.value = true;
    try {
      await loadQuestionByDate(date);
    } catch (error) {
      console.error("Failed to load question", error);
      questionError.value = "Could not load that question.";
    } finally {
      isQuestionLoading.value = false;
    }
  },
  { immediate: true },
);

onMounted(() => {
  initials.value = window.localStorage.getItem("quizgen-initials") ?? "";
  updateResetCountdown();
  resetTimer = window.setInterval(updateResetCountdown, 1000);
});

onBeforeUnmount(() => {
  clearTimers();
  if (scoreFrame) {
    window.cancelAnimationFrame(scoreFrame);
  }
  window.clearInterval(resetTimer);
});

watch(score, (value) => {
  if (gameState.value === "result") {
    animateScore(value);
  }
});

watch(initials, () => {
  saveInitials();
});
</script>

<template>
  <main class="min-h-screen bg-[#f5f3ee] px-4 py-5 text-black sm:px-8 sm:py-7">
    <header class="mx-auto flex w-full max-w-4xl items-center justify-between">
      <button class="brand-mark text-left" @click="goHome">
        quizgen
        <span></span>
      </button>
      <span class="text-xs font-semibold text-neutral-500">/daily</span>
    </header>

    <section
      v-if="isHome"
      class="mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-4xl place-items-center py-5"
    >
      <div
        class="daily-shell relative w-full max-w-[650px] overflow-hidden rounded-[22px] bg-black text-white shadow-[0_26px_70px_rgba(0,0,0,0.22)]"
      >
        <div class="flutter-lines" aria-hidden="true"></div>

        <div
          v-if="isQuestionLoading"
          class="relative grid min-h-[590px] place-items-center p-7 sm:min-h-[620px] sm:p-10"
        >
          <div
            class="shimmer-card w-full max-w-[490px] space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
          >
            <div class="h-4 w-24 rounded-full bg-white/12"></div>
            <div class="h-16 w-4/5 rounded-2xl bg-white/12"></div>
            <div class="grid gap-3">
              <div class="h-5 w-full rounded-full bg-white/10"></div>
              <div class="h-5 w-11/12 rounded-full bg-white/10"></div>
              <div class="h-5 w-5/6 rounded-full bg-white/10"></div>
            </div>
            <div class="mt-8 h-14 w-full rounded-full bg-white/12"></div>
          </div>
        </div>

        <div
          v-else
          class="relative grid min-h-[590px] content-between gap-8 p-7 sm:min-h-[620px] sm:p-10"
        >
          <div>
            <div
              class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-zinc-400"
            >
              <span>{{ formatDate(todayKey) }}</span>
              <span class="inline-flex items-center gap-1.5">
                <Timer class="size-4 text-[#d6a64f]" />
                Time left: {{ timeRemaining }}
              </span>
            </div>

            <h1
              class="title-face mt-12 text-[4.25rem] font-normal leading-none text-white sm:text-[5.5rem]"
            >
              daily
            </h1>

            <div
              class="mt-8 max-w-[490px] space-y-5 text-[1.25rem] font-semibold geist-pixel leading-snug text-zinc-300 sm:text-[1.45rem]"
            >
              <p>Read the question one paragraph at a time.</p>
              <p>Answer when it hits.</p>
              <p>Faster solves and fewer revealed words score higher.</p>
            </div>
          </div>

          <div class="grid gap-3">
            <Button
              class="attention-pulse h-14 rounded-full bg-white text-base text-black shadow-none hover:bg-[#f1e4d2] sm:h-16 cursor-pointer"
              @click="openLatestQuestion"
            >
              <Play class="size-5 fill-current" />
              Play the latest
            </Button>
            <p v-if="questionError" class="text-sm font-medium text-red-300">
              {{ questionError }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section
      v-else-if="isQuestionLoading && !selectedQuestion"
      class="mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-4xl place-items-center py-5"
    >
      <div
        class="daily-shell relative w-full max-w-[650px] overflow-hidden rounded-[22px] bg-black text-white shadow-[0_26px_70px_rgba(0,0,0,0.22)]"
      >
        <div class="flutter-lines" aria-hidden="true"></div>
        <div class="relative grid min-h-[620px] place-items-center p-7 sm:p-10">
          <div
            class="shimmer-card w-full max-w-[490px] space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
          >
            <div class="h-4 w-24 rounded-full bg-white/12"></div>
            <div class="h-16 w-4/5 rounded-2xl bg-white/12"></div>
            <div class="grid gap-3">
              <div class="h-5 w-full rounded-full bg-white/10"></div>
              <div class="h-5 w-11/12 rounded-full bg-white/10"></div>
              <div class="h-5 w-5/6 rounded-full bg-white/10"></div>
            </div>
            <div class="mt-8 h-14 w-full rounded-full bg-white/12"></div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-else-if="selectedQuestion"
      class="mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-4xl place-items-center py-5"
    >
      <div
        class="daily-shell relative w-full max-w-[650px] overflow-hidden rounded-[22px] bg-black text-white shadow-[0_26px_70px_rgba(0,0,0,0.22)]"
      >
        <div class="flutter-lines" aria-hidden="true"></div>

        <div
          v-if="gameState === 'playing'"
          class="relative grid min-h-[590px] content-between gap-8 p-7 sm:min-h-[620px] sm:p-10"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="geist-pixel">
              <p class="text-sm font-bold text-zinc-400">
                {{ visibleCardCount }} /
                {{ selectedQuestion.paragraphs.length }}
              </p>
              <p class="mt-1 text-base font-semibold text-[#d6a64f]">
                Daily #{{ selectedQuestion.number }}
              </p>
            </div>
            <div class="flex items-center gap-2 text-3xl font-black text-white">
              <Timer class="size-5 text-[#d6a64f]" />
              {{ elapsedSeconds }}s
            </div>
          </div>

          <section
            class="reveal-stack"
            :class="{
              'is-right': resultTone === 'right',
              'is-wrong': resultTone === 'wrong',
            }"
          >
            <article
              v-for="(paragraph, cardIndex) in selectedQuestion.paragraphs"
              :key="cardIndex"
              class="reveal-card"
              :class="{
                active: cardIndex === currentCardIndex,
                seen: cardIndex < currentCardIndex,
                locked: cardIndex > currentCardIndex,
                'next-reveal': canRevealCard(cardIndex),
              }"
              :role="canRevealCard(cardIndex) ? 'button' : undefined"
              :tabindex="canRevealCard(cardIndex) ? 0 : undefined"
              :aria-label="
                canRevealCard(cardIndex) ? 'Reveal next card' : undefined
              "
              @click="revealCard(cardIndex)"
              @keydown.enter.prevent="revealCard(cardIndex)"
              @keydown.space.prevent="revealCard(cardIndex)"
            >
              <span
                v-if="canRevealCard(cardIndex)"
                class="reveal-cue"
                aria-hidden="true"
              >
                <ChevronRight class="size-4" />
              </span>
              <TipTapRenderer
                :content="paragraph"
                :visibleWordsCount="visibleWordsByCard[cardIndex] || 0"
              />
            </article>
          </section>

          <div class="grid gap-3">
            <p
              class="text-[1.42rem] font-semibold leading-tight text-[#d6a64f] sm:text-[1.7rem]"
            >
              {{ selectedQuestion.question }}
            </p>
            <form
              class="grid gap-2 sm:grid-cols-[1fr_auto]"
              @submit.prevent="submitGuess"
            >
              <label class="sr-only" for="answer">Answer</label>
              <input
                id="answer"
                v-model="guess"
                class="h-12 rounded-full border border-zinc-700 bg-transparent px-5 text-base font-bold text-white outline-none placeholder:text-zinc-600 focus:border-[#d6a64f]"
                autocomplete="off"
                placeholder="Type answer"
              />
              <Button
                type="submit"
                class="h-12 rounded-full bg-white px-6 text-black hover:bg-[#f1e4d2]"
              >
                Submit
              </Button>
            </form>

            <div class="h-11">
              <Button
                v-show="canRevealNextCard"
                variant="outline"
                class="hidden h-11 w-full rounded-full border-zinc-600 sm:inline-flex"
                :disabled="!cardComplete"
                @click="revealNextCard"
              >
                Reveal next card
              </Button>
            </div>
          </div>
        </div>

        <div
          v-else
          class="relative grid min-h-[620px] content-between gap-5 p-6 sm:p-8"
        >
          <div
            v-if="isLocked"
            class="grid min-h-[420px] place-items-center text-center"
          >
            <div>
              <Lock class="mx-auto mb-4 size-10 text-[#d6a64f]" />
              <p class="title-face text-6xl">locked</p>
              <p
                class="mx-auto mt-4 max-w-md text-lg font-semibold leading-snug text-zinc-400"
              >
                Question #{{ selectedQuestion.number }} opens on
                {{ formattedDate }}.
              </p>
            </div>
          </div>

          <template v-else>
            <div>
              <div
                class="flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-black"
              >
                <span>{{ formattedDate }}</span>
                <span class="text-emerald-400">{{ rankLine }}!</span>
              </div>
              <p class="mt-3 text-6xl font-black leading-none sm:text-7xl">
                {{ animatedScoreText }}<span class="text-zinc-600">/50</span>
              </p>
              <p
                class="mt-3 max-w-xl text-xl font-semibold leading-tight text-zinc-400 geist-pixel"
              >
                {{ scoreLine }}
              </p>
            </div>

            <section class="answer-card" v-if="fullAnswerData?.answerSnippet">
              <div class="answer-copy">
                <h2 class="text-center">
                  {{ fullAnswerData.answerSnippet.title }}
                </h2>
              </div>

              <div class="answer-media">
                <TipTapRenderer
                  class="answer-snippet-body"
                  :content="fullAnswerData.answerSnippet.body"
                  :visibleWordsCount="9999"
                />
              </div>
            </section>

            <div
              class="flex justify-center gap-3 pt-0.5 max-sm:pointer-events-none max-sm:sticky max-sm:bottom-4 max-sm:z-20"
              aria-label="Result actions"
            >
              <Button
                size="icon"
                class="pointer-events-auto size-[3.75rem] rounded-full border border-transparent bg-[#f6f0e4] text-[#09090b] shadow-[0_14px_32px_rgb(0_0_0_/_0.34),inset_0_1px_0_rgb(255_255_255_/_0.08)] backdrop-blur-md hover:bg-white sm:size-[3.45rem]"
                :aria-label="copied ? 'Shared result' : 'Share result'"
                :title="copied ? 'Shared result' : 'Share result'"
                @click="shareScore"
              >
                <Check v-if="copied" class="size-5" />
                <Share2 v-else class="size-5" />
                <span class="sr-only">
                  {{ copied ? "Shared result" : "Share result" }}
                </span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                :class="`pointer-events-auto size-[3.75rem] rounded-full border-white/30 bg-zinc-950/70 text-zinc-100 shadow-[0_14px_32px_rgb(0_0_0_/_0.34),inset_0_1px_0_rgb(255_255_255_/_0.08)] backdrop-blur-md hover:border-[#d6a64f]/70 hover:bg-zinc-900/90 sm:size-[3.45rem] ${showArchive ? 'border-[#d6a64f]/70 bg-zinc-900/90 text-white' : ''}`"
                :aria-pressed="showArchive"
                aria-label="Open archive"
                title="Archive"
                @click="showArchive = !showArchive"
              >
                <CalendarDays class="size-5" />
                <span class="sr-only">Archive</span>
              </Button>
            </div>
          </template>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showArchive"
          class="fixed inset-0 z-50 overflow-y-auto bg-[#09090b] text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Daily archive"
        >
          <div
            class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgb(214_166_79_/_0.10),transparent_36%),radial-gradient(ellipse_at_18%_82%,rgb(110_134_190_/_0.10),transparent_30%)]"
            aria-hidden="true"
          ></div>
          <Button
            variant="outline"
            size="icon"
            class="fixed right-4 top-4 z-20 size-11 rounded-full border-zinc-700 bg-zinc-950/90 hover:border-[#d6a64f]/70 hover:bg-zinc-900 sm:right-6 sm:top-6"
            aria-label="Close archive"
            title="Close"
            @click="showArchive = false"
          >
            <X class="size-5" />
          </Button>

          <Transition
            appear
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-4 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="translate-y-3 opacity-0"
          >
            <section
              v-if="showArchive"
              class="relative mx-auto min-h-full w-full max-w-[680px] transform-gpu px-4 pb-8 pt-20 will-change-transform sm:px-6 sm:pt-24"
            >
              <div v-if="isArchiveLoading || !archiveLoaded" class="grid gap-3">
                <div
                  v-for="n in 6"
                  :key="n"
                  class="h-24 animate-pulse rounded-2xl bg-zinc-900"
                ></div>
              </div>
              <div v-else class="grid gap-3">
                <button
                  v-for="item in archiveQuestions"
                  :key="item.question.date"
                  class="grid min-h-24 grid-cols-[1fr_auto] items-center gap-4 rounded-2xl bg-[#1b1b1f] px-5 py-4 text-left transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  :class="{
                    'bg-zinc-800 ring-1 ring-[#d6a64f]/60':
                      selectedQuestion?.date === item.question.date,
                  }"
                  :disabled="item.locked"
                  @click="selectArchiveQuestion(item)"
                >
                  <div class="min-w-0">
                    <p class="geist-pixel text-sm leading-none text-[#d6a64f]">
                      {{
                        item.locked
                          ? "Tomorrow"
                          : `Daily #${item.question.number}`
                      }}
                    </p>
                    <p
                      class="mt-2 truncate text-2xl font-black leading-none text-white"
                    >
                      {{
                        item.locked ? "Locked" : formatDate(item.question.date)
                      }}
                    </p>
                    <p
                      class="mt-2 truncate text-base font-semibold text-zinc-400"
                    >
                      {{ item.question.category }}
                    </p>
                  </div>

                  <Lock v-if="item.locked" class="size-5 text-zinc-500" />
                  <ChevronRight v-else class="size-5 text-[#d6a64f]" />
                </button>
              </div>
            </section>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
