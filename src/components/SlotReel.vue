<script setup lang="ts">
import { vAutoAnimate } from "@formkit/auto-animate/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatDuration, type Movie } from "../composables/useMovieLibrary";
import { canOpenInPlex, openInPlex } from "../lib/openInPlex";

const props = defineProps<{
  movie: Movie;
  reveal: boolean;
  held: boolean;
  spinning: boolean;
}>();
const emit = defineEmits<{ settled: []; "toggle-hold": [] }>();

const seeMoreState = ref<"idle" | "opening" | "failed">("idle");
const seeMoreLabel = computed(
  () => ({ idle: "See more", opening: "Opening…", failed: "Unavailable" })[seeMoreState.value],
);
async function onSeeMore() {
  if (seeMoreState.value === "opening") return;
  seeMoreState.value = "opening";
  try {
    await openInPlex(props.movie);
    seeMoreState.value = "idle";
  } catch {
    seeMoreState.value = "failed";
    setTimeout(() => (seeMoreState.value = "idle"), 2500);
  }
}

const posterVisible = ref(false);
const posterLinkable = computed(
  () => props.reveal && posterVisible.value && canOpenInPlex(props.movie),
);
const fadeIn = ref(false);

let timeoutId: ReturnType<typeof setTimeout> | undefined;

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

// Wait for the browser to actually paint the current (at-rest) frame before
// flipping the opacity class — otherwise the image mounts and fades in on
// the same frame and no transition is visible.
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

onMounted(async () => {
  const loaded = props.movie.thumb
    ? preload(props.movie.thumb)
    : Promise.resolve();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([loaded, timeout]);

  // Artificial spin delay disabled for now — reveal as soon as the image is ready.
  posterVisible.value = true;
  await nextPaint();
  fadeIn.value = true;
  emit("settled");
});
onBeforeUnmount(() => {
  if (timeoutId) clearTimeout(timeoutId);
});
</script>

<template>
  <article>
    <component
      :is="posterLinkable ? 'button' : 'div'"
      :type="posterLinkable ? 'button' : undefined"
      :aria-label="posterLinkable ? `Open ${movie.title} in Plex` : undefined"
      :data-nav="posterLinkable ? 'poster' : undefined"
      class="relative block aspect-2/3 w-full overflow-hidden border-0 bg-imgbg p-0"
      :class="{ 'cursor-pointer': posterLinkable }"
      @click="posterLinkable && onSeeMore()"
    >
      <div v-if="!posterVisible" class="grid h-full w-full place-items-center">
        <span
          class="h-8 w-8 animate-spin rounded-full border-2 border-muted-3 border-t-transparent"
        ></span>
      </div>
      <template v-else>
        <img
          v-if="movie.thumb"
          :src="movie.thumb"
          :alt="movie.title"
          class="h-full w-full object-cover opacity-0 transition-opacity duration-700"
          :class="{ 'opacity-100': fadeIn }"
        />
        <div
          v-else
          class="grid h-full w-full place-items-center font-serif text-[40px] text-muted-3"
        >
          {{ movie.title.slice(0, 1) }}
        </div>
      </template>
      <span
        v-if="seeMoreState !== 'idle'"
        class="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center font-mono text-[11px] tracking-[0.08em] text-button-text uppercase"
      >
        {{ seeMoreLabel }}
      </span>
    </component>
    <div v-auto-animate class="pt-2.5">
      <template v-if="reveal">
        <h3
          class="mb-1.25 line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3]"
        >
          {{ movie.title }}
        </h3>
        <p class="mb-1 font-mono text-[11px] text-muted-4">
          {{ movie.year ?? "—" }} · {{ formatDuration(movie.duration) }}
          <template v-if="movie.rating">
            · <span class="pr-0.5">★</span>{{ movie.rating.toFixed(1) }}
          </template>
        </p>
        <p class="mb-0.75 truncate font-mono text-[11px] text-muted-4">
          {{ movie.genres.join(" / ") || "Uncategorized" }}
        </p>
        <!-- director line hidden for now to keep the whole card on screen
        <small
          class="block line-clamp-2 min-h-[2.6em] font-mono text-[11px] leading-[1.3] text-muted-4"
        >
          {{
            movie.directors.length
              ? "dir. " + movie.directors.join(", ")
              : "Director unknown"
          }}
        </small>
        -->
        <!-- "See more" button replaced by making the poster itself the link
        <button
          v-if="canOpenInPlex(movie)"
          type="button"
          class="mt-2 flex h-8 w-full cursor-pointer items-center justify-center border border-border-2 bg-transparent font-mono text-[11px] tracking-[0.08em] text-muted-5 uppercase aria-disabled:cursor-wait aria-disabled:opacity-50"
          :aria-disabled="seeMoreState === 'opening'"
          @click="onSeeMore"
        >
          {{ seeMoreLabel }}
        </button>
        -->
        <button
          type="button"
          class="mt-2 flex h-8 w-full cursor-pointer items-center justify-center border font-mono text-[11px] tracking-[0.08em] uppercase aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          :class="
            held
              ? 'border-ink bg-ink text-button-text'
              : 'border-border-2 bg-transparent text-muted-5'
          "
          data-nav="hold"
          :aria-disabled="spinning"
          @click="!spinning && emit('toggle-hold')"
        >
          {{ held ? "Held" : "Hold" }}
        </button>
      </template>
    </div>
  </article>
</template>
