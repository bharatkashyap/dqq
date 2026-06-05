<script setup lang="ts">
import { CalendarDays, Clipboard, Lock, Play, Share2, Timer } from "lucide-vue-next"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

import Button from "@/components/ui/Button.vue"

type DailyQuestion = {
  date: string
  title: string
  number: number
  answer: string
  answerKeywords: string[]
  category: string
  playersToday: number
  paragraphs: string[]
  question: string
  answerSnippet: {
    title: string
    body: string
    media: MediaAsset[]
  }
}

type MediaAsset = {
  type: "image" | "video" | "audio" | "youtube"
  src: string
  alt?: string
  caption?: string
}

type StoredResult = {
  initials: string
  elapsedSeconds: number
  wrongAttempts: number
  answerQuality: number
  visibleWordsByCard: number[]
  completedAt: string
}

type GameState = "intro" | "playing" | "result"

const dailyQuestions: DailyQuestion[] = [
  {
    date: "2026-06-01",
    title: "Archive",
    number: 18,
    answer: "athens",
    answerKeywords: ["athens"],
    category: "Places",
    playersToday: 182,
    paragraphs: [
      "The modern version of this global sporting event began with delegations from fourteen nations and fewer than three hundred athletes.",
      "Its host city had also been central to the ancient version of the same competition, giving the revival a symbolic homecoming.",
    ],
    question: "Which city hosted the first modern Olympic Games?",
    answerSnippet: {
      title: "Athens",
      body: "The first modern Olympic Games were held in Athens in 1896.",
      media: [],
    },
  },
  {
    date: "2026-06-02",
    title: "Archive",
    number: 19,
    answer: "python",
    answerKeywords: ["python"],
    category: "Technology",
    playersToday: 211,
    paragraphs: [
      "This programming language was designed to emphasize readability, with indentation becoming part of the way developers express structure.",
      "Its creator, Guido van Rossum, named it after a comedy troupe rather than the animal many people first imagine.",
    ],
    question: "Which programming language is this?",
    answerSnippet: {
      title: "Python",
      body: "Python was created by Guido van Rossum and first released in 1991.",
      media: [],
    },
  },
  {
    date: "2026-06-03",
    title: "Archive",
    number: 20,
    answer: "venus",
    answerKeywords: ["venus"],
    category: "Space",
    playersToday: 236,
    paragraphs: [
      "This planet is similar to Earth in size, but its atmosphere traps heat so aggressively that its surface is hotter than Mercury's.",
      "It also rotates in the opposite direction from most planets, making the Sun appear to rise in the west.",
    ],
    question: "Which planet is this?",
    answerSnippet: {
      title: "Venus",
      body: "Venus rotates clockwise, unlike most planets in the solar system.",
      media: [],
    },
  },
  {
    date: "2026-06-04",
    title: "Daily",
    number: 21,
    answer: "rice straw",
    answerKeywords: ["rice", "straw"],
    category: "Art and Culture",
    playersToday: 490,
    paragraphs: [
      "For the last decade, students from the Musashino Art University in Tokyo have headed north to Niigata each fall to create wonderful sculptures with wara, Japanese for __ __.",
      "The Niigata region principally practises agriculture and thus, wara is easy to source. In recent years, the Wara Art Festival, with its large public installations, has caught the attention of multiple tourists.",
      "Although a skeletal wooden frame is placed inside, the exterior of the sculpture appears golden due to patches of __ __, braided together and used both inside, and on the exterior of, the framework.",
    ],
    question: "What are the sculptures made of?",
    answerSnippet: {
      title: "Rice Straw",
      body: "Wara means rice straw. The Wara Art Festival uses braided rice straw over wooden frames to build large animal sculptures.",
      media: [
        {
          type: "image",
          src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
          alt: "Golden rice field",
          caption: "Rice straw gives the sculptures their golden texture.",
        },
        {
          type: "image",
          src: "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1200&q=80",
          alt: "Rice plants in a field",
          caption: "Wara comes from rice cultivation.",
        },
      ],
    },
  },
  {
    date: "2026-06-05",
    title: "Tomorrow",
    number: 22,
    answer: "locked",
    answerKeywords: ["locked"],
    category: "Locked",
    playersToday: 0,
    paragraphs: ["Tomorrow's daily question is staged but not available yet."],
    question: "Unlocks tomorrow.",
    answerSnippet: {
      title: "Locked",
      body: "Come back tomorrow.",
      media: [],
    },
  },
]

const todayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date())

const todayIndex = Math.max(
  0,
  dailyQuestions.findIndex((entry) => entry.date === todayKey),
)

const selectedIndex = ref(todayIndex === -1 ? dailyQuestions.length - 2 : todayIndex)
const gameState = ref<GameState>("intro")
const initials = ref("")
const guess = ref("")
const copied = ref(false)
const showArchive = ref(false)
const currentCardIndex = ref(0)
const visibleWordsByCard = ref<number[]>([])
const elapsedSeconds = ref(0)
const wrongAttempts = ref(0)
const answerQuality = ref(1)
const resultTone = ref<"idle" | "right" | "wrong">("idle")
const secondsUntilReset = ref(0)
const animatedScore = ref(0)

let revealTimer: number | undefined
let gameTimer: number | undefined
let resetTimer: number | undefined
let toneTimer: number | undefined
let scoreFrame: number | undefined

const selectedQuestion = computed(() => dailyQuestions[selectedIndex.value])
const isLocked = computed(() => selectedQuestion.value.date > todayKey)
const playableQuestions = computed(() => dailyQuestions.filter((entry) => entry.date <= todayKey))
const nextQuestion = computed(() => dailyQuestions.find((entry) => entry.date > todayKey))
const playerInitials = computed(() => initials.value.trim().slice(0, 3).toUpperCase() || "Guest")
const cardWords = computed(() => selectedQuestion.value.paragraphs.map((paragraph) => paragraph.split(" ")))
const visibleCardCount = computed(() => Math.min(currentCardIndex.value + 1, selectedQuestion.value.paragraphs.length))
const totalWordsSeen = computed(() => visibleWordsByCard.value.reduce((total, count) => total + count, 0))
const totalAvailableWords = computed(() => cardWords.value.reduce((total, words) => total + words.length, 0))
const cardComplete = computed(() => {
  const words = cardWords.value[currentCardIndex.value] ?? []
  return (visibleWordsByCard.value[currentCardIndex.value] ?? 0) >= words.length
})

const formattedDate = computed(() => formatDate(selectedQuestion.value.date))
const timeRemaining = computed(() => formatDuration(secondsUntilReset.value))
const hasStoredResult = computed(() => Boolean(readStoredResult(selectedQuestion.value.date)))
const playersToday = computed(() => selectedQuestion.value.playersToday)
const rankToday = computed(() => {
  const scoreRatio = Math.max(0, Math.min(1, score.value / 50))
  const rank = Math.round(playersToday.value * Math.pow(1 - scoreRatio, 1.55)) + 1

  return Math.max(1, Math.min(playersToday.value || 1, rank))
})
const rankLine = computed(() => `${rankToday.value} of ${playersToday.value} players today`)

const score = computed(() => {
  if (gameState.value !== "result" || isLocked.value) {
    return 0
  }

  const timePenalty = elapsedSeconds.value * 0.11
  const cardPenalty = Math.max(0, visibleCardCount.value - 1) * 2.6
  const wordPenalty = totalWordsSeen.value * 0.08
  const missPenalty = wrongAttempts.value * 1.75
  const answerPenalty = (1 - answerQuality.value) * 3

  return Number(Math.max(2.5, 50 - timePenalty - cardPenalty - wordPenalty - missPenalty - answerPenalty).toFixed(2))
})

const scoreLine = computed(() => {
  const phrases = [
    { min: 45, text: "Clean strike. Barely any trail exposed." },
    { min: 36, text: "Sharp read. You caught the pattern early." },
    { min: 24, text: "Steady solve. The clues did their work." },
    { min: 12, text: "Late solve, but you got there." },
    { min: 0, text: "The story gave you a long look." },
  ]

  return phrases.find((phrase) => score.value >= phrase.min)?.text ?? phrases.at(-1)?.text
})

const animatedScoreText = computed(() => formatScore(animatedScore.value))

const shareText = computed(() => {
  return `Quizgen Daily #${selectedQuestion.value.number}
${playerInitials.value} ${score.value}/50
${elapsedSeconds.value}s · ${visibleCardCount.value} cards · ${totalWordsSeen.value}/${totalAvailableWords.value} words
Answer: ${selectedQuestion.value.answerSnippet.title}`
})

function storageKey(date: string) {
  return `quizgen-daily-result:${date}`
}

function readStoredResult(date: string): StoredResult | null {
  try {
    const raw = window.localStorage.getItem(storageKey(date))
    return raw ? (JSON.parse(raw) as StoredResult) : null
  } catch {
    return null
  }
}

function writeStoredResult() {
  const result: StoredResult = {
    initials: playerInitials.value,
    elapsedSeconds: elapsedSeconds.value,
    wrongAttempts: wrongAttempts.value,
    answerQuality: answerQuality.value,
    visibleWordsByCard: [...visibleWordsByCard.value],
    completedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(storageKey(selectedQuestion.value.date), JSON.stringify(result))
}

function saveInitials() {
  const value = initials.value.trim().slice(0, 3).toUpperCase()
  if (value) {
    window.localStorage.setItem("quizgen-initials", value)
    return
  }

  window.localStorage.removeItem("quizgen-initials")
}

function hydrateStoredResult(date = selectedQuestion.value.date) {
  const stored = readStoredResult(date)
  if (!stored) {
    return false
  }

  initials.value = stored.initials
  elapsedSeconds.value = stored.elapsedSeconds
  wrongAttempts.value = stored.wrongAttempts
  answerQuality.value = stored.answerQuality ?? 1
  visibleWordsByCard.value = stored.visibleWordsByCard
  currentCardIndex.value = Math.max(
    0,
    Math.min(
      stored.visibleWordsByCard.filter((count) => count > 0).length - 1,
      dailyQuestions[selectedIndex.value].paragraphs.length - 1,
    ),
  )
  gameState.value = "result"
  animateScore(score.value)
  return true
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+05:30`))
}

function updateResetCountdown() {
  const now = new Date()
  const reset = new Date(now)
  reset.setHours(24, 0, 0, 0)
  secondsUntilReset.value = Math.max(0, Math.floor((reset.getTime() - now.getTime()) / 1000))
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
}

function formatScore(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function animateScore(target: number) {
  if (scoreFrame) {
    window.cancelAnimationFrame(scoreFrame)
  }

  const start = animatedScore.value
  const startedAt = performance.now()
  const duration = 950

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedScore.value = start + (target - start) * eased

    if (progress < 1) {
      scoreFrame = window.requestAnimationFrame(tick)
      return
    }

    animatedScore.value = target
  }

  scoreFrame = window.requestAnimationFrame(tick)
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
}

function getAnswerQuality(value: string) {
  const normalizedGuess = normalize(value)
  const normalizedAnswer = normalize(selectedQuestion.value.answer)
  const keywords = selectedQuestion.value.answerKeywords.map(normalize).filter(Boolean)

  if (normalizedGuess === normalizedAnswer) {
    return 1
  }

  const matchedKeywords = keywords.filter((keyword) => {
    const keywordPattern = new RegExp(`(^| )${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`)
    return keywordPattern.test(normalizedGuess)
  })

  if (!matchedKeywords.length) {
    return 0
  }

  return matchedKeywords.length / keywords.length
}

function triggerHaptics(pattern: number | number[]) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern)
  }
}

function clearTimers() {
  window.clearInterval(revealTimer)
  window.clearInterval(gameTimer)
  window.clearTimeout(toneTimer)
}

function startReveal() {
  window.clearInterval(revealTimer)
  revealTimer = window.setInterval(() => {
    const index = currentCardIndex.value
    const shown = visibleWordsByCard.value[index] ?? 0
    const words = cardWords.value[index] ?? []

    if (shown >= words.length) {
      window.clearInterval(revealTimer)
      return
    }

    visibleWordsByCard.value[index] = shown + 1
  }, 170)
}

function startGame() {
  if (isLocked.value || hydrateStoredResult()) {
    return
  }

  saveInitials()
  clearTimers()
  gameState.value = "playing"
  guess.value = ""
  copied.value = false
  showArchive.value = false
  currentCardIndex.value = 0
  visibleWordsByCard.value = selectedQuestion.value.paragraphs.map(() => 0)
  elapsedSeconds.value = 0
  wrongAttempts.value = 0
  answerQuality.value = 1
  resultTone.value = "idle"

  gameTimer = window.setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
  startReveal()
}

function revealNextCard() {
  if (currentCardIndex.value >= selectedQuestion.value.paragraphs.length - 1) {
    return
  }

  currentCardIndex.value += 1
  triggerHaptics(12)
  startReveal()
}

function submitGuess() {
  if (!guess.value.trim() || gameState.value !== "playing") {
    return
  }

  const quality = getAnswerQuality(guess.value)

  if (quality > 0) {
    answerQuality.value = quality
    gameState.value = "result"
    resultTone.value = "right"
    clearTimers()
    writeStoredResult()
    saveInitials()
    animateScore(score.value)
    triggerHaptics([18, 36, 18, 60, 42])
  } else {
    wrongAttempts.value += 1
    resultTone.value = "wrong"
    triggerHaptics(24)
    window.clearTimeout(toneTimer)
    toneTimer = window.setTimeout(() => {
      resultTone.value = "idle"
    }, 500)
  }
}

function chooseQuestion(index: number) {
  clearTimers()
  selectedIndex.value = index
  guess.value = ""
  copied.value = false
  showArchive.value = false
  currentCardIndex.value = 0
  visibleWordsByCard.value = dailyQuestions[index].paragraphs.map(() => 0)
  elapsedSeconds.value = 0
  wrongAttempts.value = 0
  answerQuality.value = 1
  resultTone.value = "idle"
  animatedScore.value = 0

  if (dailyQuestions[index].date > todayKey) {
    gameState.value = "result"
    return
  }

  gameState.value = hydrateStoredResult(dailyQuestions[index].date) ? "result" : "intro"
}

async function shareScore() {
  const text = `${shareText.value}\n${window.location.href}`

  if (navigator.share) {
    await navigator.share({ text, title: "Quizgen Daily", url: window.location.href })
    return
  }

  await navigator.clipboard.writeText(text)
  copied.value = true
}

async function copyScore() {
  await navigator.clipboard.writeText(shareText.value)
  copied.value = true
}

onMounted(() => {
  initials.value = window.localStorage.getItem("quizgen-initials") ?? ""
  updateResetCountdown()
  resetTimer = window.setInterval(updateResetCountdown, 1000)
  hydrateStoredResult()
})

onBeforeUnmount(() => {
  clearTimers()
  if (scoreFrame) {
    window.cancelAnimationFrame(scoreFrame)
  }
  window.clearInterval(resetTimer)
})

watch(score, (value) => {
  if (gameState.value === "result") {
    animateScore(value)
  }
})

watch(initials, () => {
  saveInitials()
})
</script>

<template>
  <main class="min-h-screen bg-[#f5f3ee] px-4 py-5 text-black sm:px-8 sm:py-7">
    <header class="mx-auto flex w-full max-w-4xl items-center justify-between">
      <button class="brand-mark text-left" @click="chooseQuestion(todayIndex)">
        quizgen
        <span></span>
      </button>
      <span class="text-xs font-semibold text-neutral-500">/daily</span>
    </header>

    <section class="mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-4xl place-items-center py-5">
      <div class="daily-shell relative w-full max-w-[650px] overflow-hidden rounded-[22px] bg-black text-white shadow-[0_26px_70px_rgba(0,0,0,0.22)]">
        <div class="flutter-lines" aria-hidden="true"></div>

        <div v-if="gameState === 'intro'" class="relative grid min-h-[590px] content-between gap-8 p-7 sm:min-h-[620px] sm:p-10">
          <div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-zinc-400">
              <span>{{ formattedDate }}</span>
              <span class="inline-flex items-center gap-1.5">
                <Timer class="size-4 text-[#d6a64f]" />
                Time left: {{ timeRemaining }}
              </span>
            </div>

            <h1 class="title-face mt-12 text-[4.25rem] font-normal leading-none text-white sm:text-[5.5rem]">
              daily
            </h1>

            <div class="mt-8 max-w-[490px] space-y-5 text-[1.25rem] font-semibold leading-snug text-zinc-300 sm:text-[1.45rem]">
              <p>{{ selectedQuestion.paragraphs.length }} paragraph cards reveal word by word.</p>
              <p>Answer when it clicks. Faster solves and fewer revealed words score higher.</p>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-[145px_1fr]">
            <label class="sr-only" for="initials">Initials</label>
            <input
              id="initials"
              v-model="initials"
              maxlength="3"
              class="h-14 rounded-full border-2 border-white bg-transparent px-5 text-center text-base font-black uppercase text-white outline-none placeholder:text-zinc-600 focus:border-[#d6a64f] sm:h-16"
              placeholder="Initials"
            />
            <Button class="attention-pulse h-14 rounded-full bg-white text-base text-black shadow-none hover:bg-[#f1e4d2] sm:h-16" @click="startGame">
              <Play class="size-5 fill-current" />
              {{ hasStoredResult ? "View scorecard" : "Play the daily" }}
            </Button>
          </div>
        </div>

        <div v-else-if="gameState === 'playing'" class="relative grid min-h-[650px] content-between gap-5 p-5 sm:p-7">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-bold text-zinc-400">{{ visibleCardCount }} / {{ selectedQuestion.paragraphs.length }}</p>
              <p class="mt-1 text-base font-semibold text-[#d6a64f]">Daily #{{ selectedQuestion.number }}</p>
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
              :key="paragraph"
              class="reveal-card"
              :class="{
                active: cardIndex === currentCardIndex,
                seen: cardIndex < currentCardIndex,
                locked: cardIndex > currentCardIndex,
              }"
            >
              <p class="reveal-text">
                <span
                  v-for="(word, wordIndex) in cardWords[cardIndex]"
                  :key="`${cardIndex}-${word}-${wordIndex}`"
                  class="word-slot"
                  :class="{ visible: wordIndex < (visibleWordsByCard[cardIndex] ?? 0) }"
                >
                  {{ word }}
                </span>
              </p>
            </article>
          </section>

          <div class="grid gap-3">
            <p class="text-[1.15rem] font-semibold leading-tight text-[#d6a64f]">{{ selectedQuestion.question }}</p>
            <form class="grid gap-2 sm:grid-cols-[1fr_auto]" @submit.prevent="submitGuess">
              <label class="sr-only" for="answer">Answer</label>
              <input
                id="answer"
                v-model="guess"
                class="h-12 rounded-full border border-zinc-700 bg-transparent px-5 text-base font-bold text-white outline-none placeholder:text-zinc-600 focus:border-[#d6a64f]"
                autocomplete="off"
                placeholder="Type answer"
              />
              <Button type="submit" class="h-12 rounded-full bg-white px-6 text-black hover:bg-[#f1e4d2]">
                Submit
              </Button>
            </form>

            <div class="h-11">
              <Button
                v-show="currentCardIndex < selectedQuestion.paragraphs.length - 1"
                variant="outline"
                class="h-11 w-full rounded-full border-zinc-600"
                :disabled="!cardComplete"
                @click="revealNextCard"
              >
                Reveal next card
              </Button>
            </div>
          </div>
        </div>

        <div v-else class="relative grid min-h-[620px] content-between gap-5 p-6 sm:p-8">
          <div v-if="isLocked" class="grid min-h-[420px] place-items-center text-center">
            <div>
              <Lock class="mx-auto mb-4 size-10 text-[#d6a64f]" />
              <p class="title-face text-6xl">locked</p>
              <p class="mx-auto mt-4 max-w-md text-lg font-semibold leading-snug text-zinc-400">
                Question #{{ selectedQuestion.number }} opens on {{ formattedDate }}.
              </p>
            </div>
          </div>

          <template v-else>
            <div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-black">
                <span>{{ formattedDate }}</span>
                <span class="text-emerald-400">{{ rankLine }}!</span>
              </div>
              <p class="mt-3 text-6xl font-black leading-none sm:text-7xl">
                {{ animatedScoreText }}<span class="text-zinc-600">/50</span>
              </p>
              <p class="mt-3 max-w-xl text-xl font-semibold leading-tight text-zinc-400">{{ scoreLine }}</p>
            </div>

            <section class="answer-card">
              <div class="answer-copy">
                <p class="text-sm font-black uppercase tracking-[0.16em] text-zinc-500">Answer</p>
                <h2>{{ selectedQuestion.answerSnippet.title }}</h2>
              </div>

              <div v-if="selectedQuestion.answerSnippet.media.length" class="answer-media">
                <figure v-for="asset in selectedQuestion.answerSnippet.media" :key="asset.src">
                  <img v-if="asset.type === 'image'" :src="asset.src" :alt="asset.alt ?? asset.caption ?? selectedQuestion.answerSnippet.title" />
                  <video v-else-if="asset.type === 'video'" :src="asset.src" controls playsinline></video>
                  <audio v-else-if="asset.type === 'audio'" :src="asset.src" controls></audio>
                  <iframe
                    v-else
                    :src="asset.src"
                    :title="asset.caption ?? selectedQuestion.answerSnippet.title"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                  ></iframe>
                  <figcaption v-if="asset.caption">{{ asset.caption }}</figcaption>
                </figure>
              </div>
            </section>

            <div class="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" class="h-12 rounded-full border-white text-base" @click="copyScore">
                <Clipboard class="size-4" />
                {{ copied ? "Copied" : "Copy" }}
              </Button>
              <Button class="h-12 rounded-full bg-white text-base text-black hover:bg-[#f1e4d2]" @click="shareScore">
                <Share2 class="size-4" />
                Share
              </Button>
              <Button variant="outline" class="h-12 rounded-full border-white text-base" @click="showArchive = !showArchive">
                <CalendarDays class="size-4" />
                Archive
              </Button>
            </div>
          </template>

          <div v-if="showArchive || isLocked" class="grid gap-3 border-t border-zinc-800 pt-4">
            <div class="flex items-center justify-between">
              <p class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Browse</p>
              <CalendarDays class="size-4 text-zinc-500" />
            </div>
            <div class="grid gap-2">
              <button
                v-for="(question, index) in playableQuestions"
                :key="question.date"
                class="flex items-center justify-between rounded-lg bg-zinc-950 px-4 py-3 text-left transition hover:bg-zinc-900"
                :class="{ 'text-[#d6a64f]': selectedIndex === index }"
                @click="chooseQuestion(index)"
              >
                <span>
                  <span class="block text-sm font-black">#{{ question.number }} {{ formatDate(question.date) }}</span>
                  <span class="text-xs font-semibold text-zinc-500">{{ question.category }}</span>
                </span>
              </button>

              <button
                v-if="nextQuestion"
                class="flex items-center justify-between rounded-lg bg-zinc-950 px-4 py-3 text-left text-zinc-500"
                @click="chooseQuestion(dailyQuestions.indexOf(nextQuestion))"
              >
                <span>
                  <span class="block text-sm font-black">#{{ nextQuestion.number }} {{ formatDate(nextQuestion.date) }}</span>
                  <span class="text-xs font-semibold">Next question locked</span>
                </span>
                <Lock class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
