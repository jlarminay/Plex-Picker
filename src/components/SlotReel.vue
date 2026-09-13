<script setup lang="ts">
import { vAutoAnimate } from "@formkit/auto-animate/vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  formatDuration,
  useMovieLibrary,
  type Movie,
} from "../composables/useMovieLibrary";

const props = defineProps<{ movie: Movie; reveal: boolean }>();
const emit = defineEmits<{ settled: [] }>();

const { movies } = useMovieLibrary();

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const DISTRACTOR_COUNT = 8;
const totalTicks = 16 + Math.floor(Math.random() * 12); // 16-27 frames before landing — more to cycle through over the longer spin
const basePool = shuffle(
  movies.value.filter((candidate) => candidate !== props.movie),
).slice(0, DISTRACTOR_COUNT);

const reelItems: Movie[] = [];
if (basePool.length) {
  while (reelItems.length < totalTicks) reelItems.push(...shuffle(basePool));
  reelItems.length = totalTicks;
}
reelItems.push(props.movie);

const ready = ref(false);
const displayIndex = ref(0);
const spinDuration = ref(0);
const viewportRef = ref<HTMLElement | null>(null);
const itemHeight = ref(0);

let timeoutId: ReturnType<typeof setTimeout> | undefined;

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

async function waitForImages() {
  const urls = reelItems
    .map((item) => item.thumb)
    .filter((url): url is string => Boolean(url));
  if (!urls.length) return;
  const loaded = Promise.all(urls.map(preload));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([loaded, timeout]);
}

// Wait for the browser to actually paint the current (at-rest) frame before
// changing styles again — otherwise two style writes in the same tick get
// coalesced into one frame and the CSS transition never visibly plays.
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function spin() {
  const lastIndex = reelItems.length - 1;
  if (lastIndex <= 0) {
    emit("settled");
    return;
  }
  // One continuous slide across the whole reel — a fast-start, evenly-decelerating
  // curve reads as a single smooth spin rather than a series of little hops.
  // Widely randomized per reel so the five columns clearly stop at different times.
  spinDuration.value = 5000 + Math.random() * 5000;
  displayIndex.value = lastIndex;
  timeoutId = setTimeout(() => {
    emit("settled");
  }, spinDuration.value);
}

onMounted(async () => {
  itemHeight.value = viewportRef.value?.getBoundingClientRect().height ?? 0;
  await waitForImages();
  ready.value = true;
  await nextPaint();
  spin();
});
onBeforeUnmount(() => {
  if (timeoutId) clearTimeout(timeoutId);
});
</script>

<template>
  <article>
    <div ref="viewportRef" class="aspect-2/3 w-full overflow-hidden bg-imgbg">
      <div v-if="!ready" class="grid h-full w-full place-items-center">
        <span
          class="h-6 w-6 animate-spin rounded-full border-2 border-muted-3 border-t-transparent"
        ></span>
      </div>
      <div
        v-else
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
          class="aspect-2/3 w-full shrink-0"
        >
          <img
            v-if="item.thumb"
            :src="item.thumb"
            :alt="item.title"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="grid h-full w-full place-items-center font-serif text-[40px] text-muted-3"
          >
            {{ item.title.slice(0, 1) }}
          </div>
        </div>
      </div>
    </div>
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
        <p class="mb-0.75 font-mono text-[11px] text-muted-4">
          {{ movie.genres.join(" / ") || "Uncategorized" }}
        </p>
        <small class="block font-mono text-[11px] text-muted-4">
          {{
            movie.directors.length
              ? "dir. " + movie.directors.join(", ")
              : "Director unknown"
          }}
        </small>
      </template>
    </div>
  </article>
</template>
