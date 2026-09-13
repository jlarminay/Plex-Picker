<script setup lang="ts">
import { formatDuration, type Movie } from "../composables/useMovieLibrary";

withDefaults(defineProps<{ movie: Movie; variant?: "grid" | "pick" }>(), {
  variant: "grid",
});
</script>

<template>
  <article>
    <img
      v-if="movie.thumb"
      :src="movie.thumb"
      :alt="movie.title"
      class="aspect-2/3 w-full bg-imgbg object-cover"
    />
    <div
      v-else
      class="grid aspect-2/3 w-full place-items-center bg-imgbg font-serif text-muted-3"
      :class="variant === 'pick' ? 'text-[40px]' : 'text-[62px]'"
    >
      {{ movie.title.slice(0, 1) }}
    </div>
    <div class="pt-2.5">
      <h3 class="mb-1.25 line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3]">
        {{ movie.title }}
      </h3>
      <p class="mb-1 font-mono text-[11px] text-muted-4">
        {{ movie.year ?? "—" }} · {{ formatDuration(movie.duration) }}
        <template v-if="movie.rating">
          · <span class="pr-0.5">★</span>{{ movie.rating.toFixed(1) }}
        </template>
      </p>
      <template v-if="variant === 'pick'">
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
      <small v-else class="block font-mono text-[11px] text-muted-4">
        {{ movie.genres[0] ?? "No genre" }}
      </small>
    </div>
  </article>
</template>
