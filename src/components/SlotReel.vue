<script setup lang="ts">
import { vAutoAnimate } from "@formkit/auto-animate/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatDuration, useMovieLibrary, type Movie } from "../composables/useMovieLibrary";
import { isTv } from "../lib/device";
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

const { movies } = useMovieLibrary();

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The slot effect: a vertical strip of other posters that slides and lands on
// the real pick. Skipped on TV, where the reveal is immediate. Disabled
// everywhere for now — it was too laggy on the tablet.
const SLOT_EFFECT = false;
const DISTRACTOR_COUNT = 8;
const totalTicks = 16 + Math.floor(Math.random() * 12);
const reelItems: Movie[] = [];
if (SLOT_EFFECT && !isTv) {
  const basePool = shuffle(
    movies.value.filter((candidate) => candidate.thumb && candidate !== props.movie),
  ).slice(0, DISTRACTOR_COUNT);
  if (basePool.length) {
    while (reelItems.length < totalTicks) reelItems.push(...shuffle(basePool));
    reelItems.length = totalTicks;
    reelItems.push(props.movie);
  }
}
const hasReel = reelItems.length > 1;
const viewportRef = ref<HTMLElement | null>(null);
const itemHeight = ref(0);
const displayIndex = ref(0);
const spinDuration = ref(0);

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
  itemHeight.value = viewportRef.value?.getBoundingClientRect().height ?? 0;
  const urls = (hasReel ? reelItems : [props.movie])
    .map((item) => item.thumb)
    .filter((url): url is string => Boolean(url));
  const loaded = Promise.all(urls.map(preload));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([loaded, timeout]);

  posterVisible.value = true;
  await nextPaint();
  if (hasReel) {
    // One continuous slide across the whole strip, randomized per reel so
    // the columns stop at different times.
    spinDuration.value = 5000 + Math.random() * 5000;
    displayIndex.value = reelItems.length - 1;
    timeoutId = setTimeout(() => emit("settled"), spinDuration.value);
  } else {
    fadeIn.value = true;
    emit("settled");
  }
});
onBeforeUnmount(() => {
  if (timeoutId) clearTimeout(timeoutId);
});
</script>

<template>
  <article class="@container">
    <component
      :is="posterLinkable ? 'button' : 'div'"
      :type="posterLinkable ? 'button' : undefined"
      :aria-label="posterLinkable ? `Open ${movie.title} in Plex` : undefined"
      :data-nav="posterLinkable ? 'poster' : undefined"
      ref="viewportRef"
      class="relative block aspect-2/3 w-full portrait:aspect-auto portrait:h-[calc(150cqw-15px)] overflow-hidden border-0 bg-imgbg p-0"
      :class="{ 'cursor-pointer': posterLinkable }"
      @click="posterLinkable && onSeeMore()"
    >
      <div v-if="!posterVisible" class="grid h-full w-full place-items-center">
        <span
          class="h-8 w-8 animate-spin rounded-full border-2 border-muted-3 border-t-transparent"
        ></span>
      </div>
      <template v-else>
        <div
          v-if="hasReel"
          class="flex flex-col"
          :style="{
            transform: `translateY(-${displayIndex * itemHeight}px)`,
            transitionProperty: 'transform',
            transitionDuration: spinDuration + 'ms',
            transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
          }"
        >
          <div
            v-for="(item, index) in reelItems"
            :key="index"
            class="w-full shrink-0"
            :style="{ height: itemHeight + 'px' }"
          >
            <img
              :src="item.thumb!"
              :alt="item.title"
              class="h-full w-full object-cover"
            />
          </div>
        </div>
        <img
          v-else-if="movie.thumb"
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
        <div>
        <h3
          class="mb-1.25 line-clamp-2 min-h-[2.6em] portrait:line-clamp-1 portrait:min-h-0 text-[15px] leading-[1.3]"
        >
          {{ movie.title }}
        </h3>
        <p class="mb-1 font-mono text-[11px] text-muted-4">
          {{ movie.year ?? "—" }} · {{ formatDuration(movie.duration) }}
          <!-- hidden on phones, where it wraps the line -->
          <span v-if="movie.rating" class="max-tablet:hidden">
            · <span class="pr-0.5">★</span>{{ movie.rating.toFixed(1) }}
          </span>
        </p>
        <p class="mb-0.75 truncate font-mono text-[11px] text-muted-4">
          {{ movie.genres.join(" / ") || "Uncategorized" }}
        </p>
        </div>
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
