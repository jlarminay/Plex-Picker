<script setup lang="ts">
import { vAutoAnimate } from "@formkit/auto-animate/vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { formatDuration, type Movie } from "../composables/useMovieLibrary";

const props = defineProps<{ movie: Movie; reveal: boolean }>();
const emit = defineEmits<{ settled: [] }>();

const posterVisible = ref(false);
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

  // Spin for a random 5-10s so the five columns clearly stop at different times.
  const spinDuration = 5000 + Math.random() * 5000;
  timeoutId = setTimeout(async () => {
    posterVisible.value = true;
    await nextPaint();
    fadeIn.value = true;
    emit("settled");
  }, spinDuration);
});
onBeforeUnmount(() => {
  if (timeoutId) clearTimeout(timeoutId);
});
</script>

<template>
  <article>
    <div class="aspect-2/3 w-full overflow-hidden bg-imgbg">
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
