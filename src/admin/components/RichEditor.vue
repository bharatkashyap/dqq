<template>
  <div class="rich-editor rounded-md border border-zinc-700 bg-zinc-900 p-2">
    <div
      v-if="editor"
      class="toolbar mb-2 flex items-center gap-2 border-b border-zinc-700 pb-2 text-sm text-zinc-300"
    >
      <button
        @click="editor.chain().focus().toggleBold().run()"
        :class="{ 'text-white bg-zinc-700': editor.isActive('bold') }"
        class="rounded px-2 py-1 hover:bg-zinc-800"
      >
        Bold
      </button>
      <button
        @click="editor.chain().focus().toggleItalic().run()"
        :class="{ 'text-white bg-zinc-700': editor.isActive('italic') }"
        class="rounded px-2 py-1 hover:bg-zinc-800"
      >
        Italic
      </button>
      <div class="h-4 w-px bg-zinc-700 mx-1"></div>
      <button
        @click="editor.chain().focus().setTextAlign('left').run()"
        :class="{
          'text-white bg-zinc-700': editor.isActive({ textAlign: 'left' }),
        }"
        class="rounded px-2 py-1 hover:bg-zinc-800"
      >
        Left
      </button>
      <button
        @click="editor.chain().focus().setTextAlign('center').run()"
        :class="{
          'text-white bg-zinc-700': editor.isActive({ textAlign: 'center' }),
        }"
        class="rounded px-2 py-1 hover:bg-zinc-800"
      >
        Center
      </button>
      <button
        @click="editor.chain().focus().setTextAlign('right').run()"
        :class="{
          'text-white bg-zinc-700': editor.isActive({ textAlign: 'right' }),
        }"
        class="rounded px-2 py-1 hover:bg-zinc-800"
      >
        Right
      </button>
    </div>
    <editor-content
      :editor="editor"
      class="prose prose-invert max-w-none min-h-[100px] outline-none"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { useConvexMutation } from "convex-vue";
import { api } from "../../../convex/_generated/api";

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: any): void;
}>();

const editor = ref<Editor>();

const generateUrl = useConvexMutation(api.files.generateUploadUrl);
import { useConvexClient } from "convex-vue";
const convex = useConvexClient();

const uploadImage = async (file: File): Promise<string> => {
  const postUrl = await generateUrl.mutate({});
  const result = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const { storageId } = await result.json();
  const url = await convex.query(api.files.getUrl, { storageId });
  if (!url) throw new Error("Failed to get URL");
  return url;
};

onMounted(() => {
  editor.value = new Editor({
    content: props.modelValue || {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    extensions: [
      StarterKit,
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    onUpdate: () => {
      emit("update:modelValue", editor.value?.getJSON());
    },
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || []);
        const images = items.filter((item) => item.type.startsWith("image"));
        if (images.length === 0) return false;

        void Promise.all(
          images.map(async (item) => {
            const file = item.getAsFile();
            if (!file) return;

            try {
              const url = await uploadImage(file);
              const node = view.state.schema.nodes.image.create({ src: url });
              const transaction = view.state.tr.replaceSelectionWith(node);
              view.dispatch(transaction);
            } catch (e) {
              console.error("Image upload failed", e);
            }
          }),
        );

        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved || !event.dataTransfer?.files.length) return false;

        const files = Array.from(event.dataTransfer.files).filter((file) =>
          file.type.startsWith("image"),
        );
        if (files.length === 0) return false;

        void Promise.all(
          files.map(async (file) => {
            try {
              const url = await uploadImage(file);
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              if (!coordinates) return;

              const node = view.state.schema.nodes.image.create({ src: url });
              const transaction = view.state.tr.insert(coordinates.pos, node);
              view.dispatch(transaction);
            } catch (e) {
              console.error("Image upload failed", e);
            }
          }),
        );

        return true;
      },
      attributes: {
        class: "prose prose-sm prose-invert focus:outline-none min-h-[100px]",
      },
    },
  });
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});

watch(
  () => props.modelValue,
  (value) => {
    const isSame =
      JSON.stringify(editor.value?.getJSON()) === JSON.stringify(value);
    if (!isSame && editor.value) {
      editor.value.commands.setContent(value, { emitUpdate: false });
    }
  },
  { deep: true },
);
</script>

<style>
.ProseMirror p {
  margin: 0;
}
.ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}
</style>
