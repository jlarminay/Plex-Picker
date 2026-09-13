<script setup lang="ts">
import { vAutoAnimate } from "@formkit/auto-animate/vue";
import { nextTick, ref, watch } from "vue";
import { useMovieLibrary } from "../composables/useMovieLibrary";
import { useRandomPicker } from "../composables/useRandomPicker";
import SlotReel from "./SlotReel.vue";

const { genres, countries, byDecade } = useMovieLibrary();
const {
  advancedOpen,
  pickerGenres,
  pickerDecades,
  pickerCountries,
  pickerDuration,
  pickerHideWatched,
  pickedMovies,
  noPickerMatches,
  togglePickerGenre,
  togglePickerDecade,
  togglePickerCountry,
  findMoviesToWatch,
  retryPicker,
} = useRandomPicker();

const settledCount = ref(0);
const allSettled = ref(true);
const revealInfo = ref(false);
const resultsRef = ref<HTMLElement | null>(null);
const findButtonRef = ref<HTMLElement | null>(null);
watch(pickedMovies, async (movies, previous) => {
  settledCount.value = 0;
  allSettled.value = movies.length === 0;
  revealInfo.value = false;
  if (movies.length && !previous?.length) {
    await nextTick();
    // Focus (not just scroll) the grid itself: the Retry button stays
    // disabled — and so unfocusable — for the whole spin, and D-pad nav
    // only centers whatever currently holds focus.
    resultsRef.value?.focus();
    resultsRef.value?.scrollIntoView({ block: "center", behavior: "smooth" });
  } else if (!movies.length && previous?.length) {
    await nextTick();
    findButtonRef.value?.focus();
  }
});
function onReelSettled() {
  settledCount.value++;
  if (settledCount.value >= pickedMovies.value.length) {
    allSettled.value = true;
    revealInfo.value = true;
  }
}
</script>

<template>
  <section v-auto-animate class="mb-11.5 bg-cream p-10.5 max-md:p-6.5">
    <div class="mb-5.5">
      <p class="mb-4.5 font-mono text-[11px] tracking-[0.12em] text-muted-1">
        TONIGHT'S SUGGESTION
      </p>
      <div
        class="grid grid-cols-[1fr_auto] gap-6 max-md:grid-cols-1 max-md:gap-4"
      >
        <h2>Not sure what to watch?</h2>
        <div v-auto-animate class="grid justify-items-center gap-2.5">
          <template v-if="!pickedMovies.length" key="actions-setup">
            <button
              ref="findButtonRef"
              class="flex h-14 w-auto items-center overflow-hidden border-0 bg-ink px-6 py-4 text-left text-button-text cursor-pointer"
              @click="findMoviesToWatch"
            >
              Find something to watch
            </button>
            <button
              type="button"
              class="cursor-pointer border-0 bg-transparent p-0 text-clay underline"
              @click="advancedOpen = !advancedOpen"
            >
              {{ advancedOpen ? "Hide" : "Show" }} advanced options
            </button>
          </template>
          <button
            v-else
            key="actions-retry"
            class="flex h-14 w-auto items-center overflow-hidden border-0 bg-ink px-6 py-4 text-left text-button-text cursor-pointer disabled:cursor-wait disabled:opacity-50"
            :disabled="!allSettled"
            @click="retryPicker"
          >
            {{ allSettled ? "Retry" : "Spinning…" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="!pickedMovies.length"
      key="setup"
      v-auto-animate
      class="grid justify-items-start gap-4"
    >
      <p v-if="noPickerMatches" class="font-mono text-xs text-error">
        No movies match those filters.
      </p>

      <div v-if="advancedOpen" class="mt-1.5 grid w-full max-w-180 gap-5.5">
        <label class="flex items-center gap-2.5 font-mono text-xs text-muted-5">
          <input type="checkbox" v-model="pickerHideWatched" class="w-auto" />
          Hide already watched
        </label>
        <div class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Duration</p>
          <select v-model="pickerDuration" class="max-w-60">
            <option value="any">Any length</option>
            <option value="under120">Under 2 hours</option>
            <option value="under90">Under 90 minutes</option>
          </select>
        </div>
        <div class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Decades</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="[decade] in byDecade"
              :key="decade"
              type="button"
              class="cursor-pointer rounded-full border border-border-2 px-3.5 py-1.75 font-mono text-xs text-muted-5"
              :class="
                pickerDecades.includes(decade)
                  ? 'border-ink bg-ink text-button-text'
                  : 'bg-transparent'
              "
              @click="togglePickerDecade(decade)"
            >
              {{ decade }}s
            </button>
          </div>
        </div>
        <div class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Genres</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="genre in genres"
              :key="genre"
              type="button"
              class="cursor-pointer rounded-full border border-border-2 px-3.5 py-1.75 font-mono text-xs text-muted-5"
              :class="
                pickerGenres.includes(genre)
                  ? 'border-ink bg-ink text-button-text'
                  : 'bg-transparent'
              "
              @click="togglePickerGenre(genre)"
            >
              {{ genre }}
            </button>
          </div>
        </div>
        <div class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Countries</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="country in countries"
              :key="country"
              type="button"
              class="cursor-pointer rounded-full border border-border-2 px-3.5 py-1.75 font-mono text-xs text-muted-5"
              :class="
                pickerCountries.includes(country)
                  ? 'border-ink bg-ink text-button-text'
                  : 'bg-transparent'
              "
              @click="togglePickerCountry(country)"
            >
              {{ country }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      key="results"
      ref="resultsRef"
      tabindex="0"
      class="grid grid-cols-2 gap-5 sm:grid-cols-5"
    >
      <SlotReel
        v-for="movie in pickedMovies"
        :key="movie.title + movie.year"
        :movie="movie"
        :reveal="revealInfo"
        @settled="onReelSettled"
      />
    </div>
  </section>
</template>
