<template>
  <div class="tiptap-renderer">
    <template v-for="(node, nodeIdx) in content.content" :key="nodeIdx">
      <p
        v-if="node.type === 'paragraph'"
        :style="{ textAlign: node.attrs?.textAlign || 'left' }"
        class="reveal-text google-sans"
      >
        <template v-for="(child, childIdx) in node.content" :key="childIdx">
          <template v-if="child.type === 'text'">
            <span
              v-for="(word, wordIdx) in splitText(child.text)"
              :key="wordIdx"
              :class="{
                'word-slot': word.trim().length > 0,
                visible: isWordVisible(
                  getGlobalWordIndex(nodeIdx, childIdx, wordIdx),
                ),
                [getMarksClasses(child.marks)]: true,
              }"
            >
              {{ word }}
            </span>
          </template>
        </template>
      </p>
      <img
        v-else-if="node.type === 'image'"
        :src="node.attrs?.src"
        :alt="node.attrs?.alt"
        class="mt-4 rounded-lg w-full h-auto"
        :class="{
          'opacity-0': !isMediaVisible(nodeIdx),
          'opacity-100 transition-opacity duration-500':
            isMediaVisible(nodeIdx),
        }"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  content: any;
  visibleWordsCount: number;
}>();

// Map global word index across all text nodes
const wordIndices = computed(() => {
  const map = new Map<string, number>();
  let globalIdx = 0;

  if (props.content?.content) {
    props.content.content.forEach((node: any, nodeIdx: number) => {
      if (node.type === "paragraph" && node.content) {
        node.content.forEach((child: any, childIdx: number) => {
          if (child.type === "text") {
            const parts = splitText(child.text);
            parts.forEach((word: string, wordIdx: number) => {
              if (word.trim().length > 0) {
                map.set(`${nodeIdx}-${childIdx}-${wordIdx}`, globalIdx);
                globalIdx++;
              }
            });
          }
        });
      }
    });
  }
  return map;
});

const maxWordIndexByNode = computed(() => {
  const map = new Map<number, number>();

  if (props.content?.content) {
    props.content.content.forEach((node: any, nodeIdx: number) => {
      let maxIdx = -1;
      if (node.type === "paragraph" && node.content) {
        node.content.forEach((child: any, childIdx: number) => {
          if (child.type === "text") {
            const parts = splitText(child.text);
            parts.forEach((word: string, wordIdx: number) => {
              if (word.trim().length > 0) {
                const globalIdx =
                  wordIndices.value.get(`${nodeIdx}-${childIdx}-${wordIdx}`) ??
                  -1;
                if (globalIdx > maxIdx) maxIdx = globalIdx;
              }
            });
          }
        });
      }
      map.set(nodeIdx, maxIdx);
    });
  }
  return map;
});

function getGlobalWordIndex(
  nodeIdx: number,
  childIdx: number,
  wordIdx: number,
) {
  return wordIndices.value.get(`${nodeIdx}-${childIdx}-${wordIdx}`) ?? -1;
}

function isWordVisible(globalWordIndex: number) {
  return globalWordIndex >= 0 && globalWordIndex < props.visibleWordsCount;
}

function isMediaVisible(nodeIdx: number) {
  // Find the last word index BEFORE this media node
  let lastWordIdxBeforeMedia = -1;
  for (let i = 0; i < nodeIdx; i++) {
    const maxIdx = maxWordIndexByNode.value.get(i) ?? -1;
    if (maxIdx > lastWordIdxBeforeMedia) {
      lastWordIdxBeforeMedia = maxIdx;
    }
  }

  // Media is visible if all words before it are visible
  // OR if there are no words before it, it's visible immediately.
  return (
    lastWordIdxBeforeMedia === -1 ||
    props.visibleWordsCount > lastWordIdxBeforeMedia
  );
}

function splitText(text = "") {
  return text.split(/(\s+)/);
}

function getMarksClasses(marks: any[]) {
  if (!marks) return "";
  let classes = "";
  marks.forEach((mark) => {
    if (mark.type === "bold") classes += " font-bold";
    if (mark.type === "italic") classes += " italic";
  });
  return classes;
}
</script>
