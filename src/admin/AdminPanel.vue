<template>
  <div class="flex min-h-screen bg-zinc-950 text-white">
    <aside class="flex w-72 flex-col border-r border-white/10 bg-zinc-950/95">
      <div class="border-b border-white/10 p-5">
        <p
          class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70"
        >
          Quiz Admin
        </p>
        <h2 class="mt-2 text-2xl font-black tracking-tight">Dashboard</h2>
        <p class="mt-1 text-sm text-zinc-400">
          Manage daily questions and answer reveals.
        </p>
      </div>

      <div class="border-b border-white/10 p-5">
        <label
          class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
        >
          Select Quiz
        </label>
        <select
          v-model="selectedQuizSlug"
          class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
        >
          <option value="daily">Daily Quiz</option>
        </select>
      </div>

      <div class="flex-1 overflow-y-auto p-3">
        <div
          class="mb-3 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
        >
          <span>Questions</span>
          <button
            class="text-amber-200 transition hover:text-amber-100"
            @click="startNewQuestion"
          >
            + New
          </button>
        </div>

        <div v-if="loadingQuestions" class="px-2 py-4 text-sm text-zinc-500">
          Loading...
        </div>

        <ul v-else class="space-y-1">
          <li v-for="q in archiveQuestions" :key="q._id">
            <button
              class="w-full rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-white/5"
              :class="
                selectedQuestionId === q._id
                  ? 'bg-amber-300/10 text-amber-200'
                  : 'text-zinc-300'
              "
              @click="selectQuestion(q)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium">#{{ q.number }}</span>
                <span class="text-xs text-zinc-500">{{ q.date }}</span>
              </div>
              <div class="mt-1 truncate text-xs text-zinc-500">
                {{ q.title }} · {{ q.category }}
              </div>
            </button>
          </li>
        </ul>
      </div>

      <div class="border-t border-white/10 p-5">
        <div class="truncate text-xs text-zinc-400">
          {{ viewer?.email || "Signed in" }}
        </div>
        <button
          class="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
          @click="handleSignOut"
        >
          Sign out
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto">
      <div
        v-if="!form.date"
        class="flex min-h-screen items-center justify-center px-6 text-zinc-500"
      >
        Select a question or create a new one.
      </div>

      <div v-else class="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
        <div
          class="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p
              class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70"
            >
              Editor
            </p>
            <h1 class="mt-2 text-3xl font-black tracking-tight">
              {{ isEditing ? "Edit Question" : "New Question" }}
            </h1>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section class="space-y-6">
            <div class="rounded-3xl border border-white/10 bg-zinc-950/80 p-5">
              <div class="grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                    >Date</label
                  >
                  <input
                    v-model="form.date"
                    type="date"
                    :disabled="isEditing"
                    class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label
                    class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                    >Number</label
                  >
                  <input
                    v-model.number="form.number"
                    type="number"
                    class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                  />
                </div>
                <div>
                  <label
                    class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                    >Category</label
                  >
                  <input
                    v-model="form.category"
                    type="text"
                    class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                  />
                </div>
              </div>

              <div class="mt-4">
                <label
                  class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                  >Title Flag</label
                >
                <select
                  v-model="form.title"
                  class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                >
                  <option>Daily</option>
                  <option>Archive</option>
                  <option>Tomorrow</option>
                  <option>Locked</option>
                </select>
              </div>
            </div>

            <div class="rounded-3xl border border-white/10 bg-zinc-950/80 p-5">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                  >
                    Question Prompt
                  </p>
                  <h3 class="mt-1 text-lg font-semibold">Cards and prompt</h3>
                </div>
                <button
                  class="text-sm font-semibold text-amber-200 transition hover:text-amber-100"
                  @click="addParagraph"
                >
                  + Add Card
                </button>
              </div>

              <div class="space-y-4">
                <div
                  v-for="(p, index) in form.paragraphs"
                  :key="index"
                  class="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div class="mb-3 flex items-center justify-between">
                    <span
                      class="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                    >
                      Card {{ Number(index) + 1 }}
                    </span>
                    <button
                      class="text-sm text-zinc-500 transition hover:text-red-300"
                      @click="form.paragraphs.splice(Number(index), 1)"
                    >
                      Remove
                    </button>
                  </div>
                  <RichEditor v-model="form.paragraphs[index]" />
                </div>
              </div>

              <div class="mt-5">
                <label
                  class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                  >Question Prompt</label
                >
                <input
                  v-model="form.question"
                  type="text"
                  class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                />
              </div>
            </div>
          </section>

          <aside class="space-y-6">
            <div class="rounded-3xl border border-white/10 bg-zinc-950/80 p-5">
              <h3 class="text-lg font-semibold">Answer Details</h3>
              <div class="mt-4 space-y-4">
                <div>
                  <label
                    class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                    >Exact Answer</label
                  >
                  <input
                    v-model="form.answer"
                    type="text"
                    class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                  />
                </div>
                <div>
                  <label
                    class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                    >Keywords</label
                  >
                  <input
                    v-model="keywordsString"
                    type="text"
                    class="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                  />
                </div>
                <div>
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <label
                      class="block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                      >Answer Slides</label
                    >
                    <button
                      class="text-sm font-semibold text-amber-200 transition hover:text-amber-100"
                      @click="addAnswerSlide"
                    >
                      + Add Slide
                    </button>
                  </div>

                  <div class="space-y-4">
                    <div
                      v-for="(slide, index) in form.answerSlides"
                      :key="index"
                      class="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div class="mb-3 flex items-center justify-between gap-3">
                        <span
                          class="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                        >
                          Slide {{ Number(index) + 1 }}
                        </span>
                        <div class="flex items-center gap-3 text-sm">
                          <button
                            class="text-zinc-500 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                            :disabled="Number(index) === 0"
                            @click="moveAnswerSlide(Number(index), -1)"
                          >
                            Up
                          </button>
                          <button
                            class="text-zinc-500 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                            :disabled="
                              Number(index) === form.answerSlides.length - 1
                            "
                            @click="moveAnswerSlide(Number(index), 1)"
                          >
                            Down
                          </button>
                          <button
                            class="text-zinc-500 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                            :disabled="form.answerSlides.length <= 1"
                            @click="removeAnswerSlide(Number(index))"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div class="grid gap-3">
                        <div>
                          <label
                            class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                            >Title</label
                          >
                          <input
                            v-model="slide.title"
                            type="text"
                            class="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                          />
                        </div>
                        <div>
                          <label
                            class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                            >Subtitle</label
                          >
                          <input
                            v-model="slide.subtitle"
                            type="text"
                            class="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/25"
                          />
                        </div>
                        <div>
                          <label
                            class="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500"
                            >Body</label
                          >
                          <RichEditor v-model="slide.body" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <button
            class="inline-flex h-12 items-center justify-center rounded-2xl bg-amber-300 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving"
            @click="saveQuestion"
          >
            {{ saving ? "Saving..." : "Save question" }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useConvexMutation, useConvexQuery } from "convex-vue";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import RichEditor from "./components/RichEditor.vue";
import { useAdminAuth } from "@/lib/admin-auth";
import type { AnswerSlide, Question } from "../types";

const router = useRouter();
const auth = useAdminAuth();
const selectedQuizSlug = ref("daily");
const selectedQuestionId = ref<Id<"questions"> | null>(null);

const { data: viewerData } = useConvexQuery(api.admin.viewer, {});
const viewer = viewerData;

const { data: archiveData, isPending: loadingQuestions } = useConvexQuery(
  api.admin.getArchive,
  () => ({
    quizSlug: selectedQuizSlug.value,
  }),
);

const archiveQuestions = computed(() => archiveData.value ?? []);
const createQuestionMutation = useConvexMutation(api.questions.createQuestion);
const updateQuestionMutation = useConvexMutation(api.questions.updateQuestion);

const formatDateInput = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const addDaysToDateInput = (dateString: string, days: number) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const suggestedNewQuestionFields = () => {
  const questions = archiveQuestions.value;
  const latestQuestion = questions.reduce<Question | null>(
    (latest, question) => {
      if (!latest || question.date > latest.date) return question;
      return latest;
    },
    null,
  );
  const highestNumber = questions.reduce(
    (highest, question) => Math.max(highest, question.number || 0),
    0,
  );

  return {
    date: latestQuestion
      ? addDaysToDateInput(latestQuestion.date, 1)
      : formatDateInput(new Date()),
    number: highestNumber + 1,
  };
};

const emptyRichTextDoc = () => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

const emptyAnswerSlide = (
  overrides: Partial<AnswerSlide> = {},
): AnswerSlide => ({
  title: "",
  body: emptyRichTextDoc(),
  ...overrides,
});

const answerSnippetFromSlides = (slides: AnswerSlide[]) => {
  const firstSlide = slides[0] ?? emptyAnswerSlide({ title: "Answer" });

  return {
    title: firstSlide.title,
    body: firstSlide.body,
  };
};

const normalizeAnswerSlides = (
  slides: Partial<AnswerSlide>[] | undefined,
  fallbackSnippet?: Question["answerSnippet"],
) => {
  const source =
    Array.isArray(slides) && slides.length > 0
      ? slides
      : [
          {
            title: fallbackSnippet?.title ?? "",
            body: fallbackSnippet?.body ?? emptyRichTextDoc(),
          },
        ];

  return source.map((slide, index) => {
    const title = slide.title?.trim() || (index === 0 ? "Answer" : "More");
    const slideData = slide as AnswerSlide;
    const subtitle = slideData.subtitle?.trim();
    const normalized: AnswerSlide = {
      title,
      body: slide.body ?? emptyRichTextDoc(),
    };

    if (subtitle) {
      normalized.subtitle = subtitle;
    }
    if (slideData.audioUrl) {
      normalized.audioUrl = slideData.audioUrl;
    }

    return normalized;
  });
};

const emptyForm = (overrides: Partial<Question> = {}): Partial<Question> => ({
  date: "",
  number: 0,
  title: "Daily",
  category: "",
  question: "",
  paragraphs: [emptyRichTextDoc()],
  answer: "",
  answerKeywords: [],
  answerSnippet: {
    title: "",
    body: emptyRichTextDoc(),
  },
  answerSlides: [emptyAnswerSlide()],
  ...overrides,
});

const form = ref<any>(emptyForm());
const { data: fullAnswer } = useConvexQuery(api.admin.getAnswer, () => ({
  quizSlug: selectedQuizSlug.value,
  date: form.value.date || "0000-00-00",
}));

const saving = ref(false);
const isEditing = computed(() => !!selectedQuestionId.value);
const keywordsString = computed({
  get: () => form.value.answerKeywords?.join(", ") || "",
  set: (val: string) => {
    form.value.answerKeywords = val
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  },
});

watch(fullAnswer, (answerObj) => {
  if (answerObj && selectedQuestionId.value) {
    form.value.answer = answerObj.answer;
    form.value.answerKeywords = answerObj.answerKeywords;
    form.value.answerSnippet = answerObj.answerSnippet;
    form.value.answerSlides = normalizeAnswerSlides(
      answerObj.answerSlides,
      answerObj.answerSnippet,
    );
  }
});

watch(
  () => auth.isAuthenticated.value,
  (authenticated) => {
    if (!authenticated) {
      router.replace("/admin/login");
    }
  },
  { immediate: true },
);

function selectQuestion(q: Question) {
  selectedQuestionId.value = q._id;
  form.value = {
    ...q,
    answer: "",
    answerKeywords: [],
    answerSnippet: {
      title: "",
      body: emptyRichTextDoc(),
    },
    answerSlides: normalizeAnswerSlides(q.answerSlides, q.answerSnippet),
  };
}

function startNewQuestion() {
  selectedQuestionId.value = null;
  form.value = emptyForm(suggestedNewQuestionFields());
}

function addParagraph() {
  form.value.paragraphs.push(emptyRichTextDoc());
}

function addAnswerSlide() {
  form.value.answerSlides.push(emptyAnswerSlide());
}

function removeAnswerSlide(index: number) {
  if (form.value.answerSlides.length <= 1) return;
  form.value.answerSlides.splice(index, 1);
}

function moveAnswerSlide(index: number, direction: -1 | 1) {
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= form.value.answerSlides.length) {
    return;
  }

  const [slide] = form.value.answerSlides.splice(index, 1);
  form.value.answerSlides.splice(targetIndex, 0, slide);
}

async function saveQuestion() {
  saving.value = true;
  try {
    const answerSlides = normalizeAnswerSlides(
      form.value.answerSlides,
      form.value.answerSnippet,
    );
    const answerSnippet = answerSnippetFromSlides(answerSlides);

    if (isEditing.value) {
      const id = selectedQuestionId.value;
      if (!id) return;

      await updateQuestionMutation.mutate({
        id,
        title: form.value.title,
        answer: form.value.answer,
        answerKeywords: form.value.answerKeywords,
        category: form.value.category,
        question: form.value.question,
        paragraphs: form.value.paragraphs,
        answerSnippet,
        answerSlides,
      });
    } else {
      await createQuestionMutation.mutate({
        quizSlug: selectedQuizSlug.value,
        date: form.value.date,
        number: form.value.number,
        title: form.value.title,
        answer: form.value.answer,
        answerKeywords: form.value.answerKeywords,
        category: form.value.category,
        question: form.value.question,
        paragraphs: form.value.paragraphs,
        answerSnippet,
        answerSlides,
      });
      startNewQuestion();
    }
  } finally {
    saving.value = false;
  }
}

async function handleSignOut() {
  await auth.signOut();
  router.replace("/admin/login");
}
</script>
