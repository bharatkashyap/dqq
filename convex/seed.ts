import { mutation } from "./_generated/server";

const hardcodedQuestions = [
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
];

function textToTipTapDoc(text: string, media: any[] = []) {
  const content: any[] = [
    {
      type: "paragraph",
      content: [{ type: "text", text }],
    },
  ];

  for (const m of media) {
    if (m.type === "image") {
      content.push({
        type: "image",
        attrs: { src: m.src, alt: m.alt, title: m.caption },
      });
    }
  }

  return {
    type: "doc",
    content,
  };
}

export const run = mutation(async (ctx) => {
  for (const q of hardcodedQuestions) {
    const existing = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (query) => query.eq("quizSlug", "daily").eq("date", q.date))
      .first();

    if (!existing) {
      await ctx.db.insert("questions", {
        quizSlug: "daily",
        date: q.date,
        number: q.number,
        title: q.title,
        answer: q.answer,
        answerKeywords: q.answerKeywords,
        category: q.category,
        playersToday: q.playersToday,
        question: q.question,
        paragraphs: q.paragraphs.map((p) => textToTipTapDoc(p)),
        answerSnippet: {
          title: q.answerSnippet.title,
          body: textToTipTapDoc(q.answerSnippet.body, q.answerSnippet.media),
        },
      });
    }
  }
});
