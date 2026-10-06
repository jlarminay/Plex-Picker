<script setup lang="ts">
import { vAutoAnimate } from "@formkit/auto-animate/vue";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMovieLibrary } from "../composables/useMovieLibrary";
import { useRandomPicker } from "../composables/useRandomPicker";
import SlotReel from "./SlotReel.vue";

const { genres, countries, collections, byDecade } = useMovieLibrary();
const {
  advancedOpen,
  pickerGenres,
  pickerDecades,
  pickerYears,
  pickerCountries,
  pickerCollection,
  pickerDuration,
  pickerHideWatched,
  pickedMovies,
  heldFlags,
  pickIds,
  noPickerMatches,
  matchCount,
  togglePickerGenre,
  togglePickerDecade,
  togglePickerYear,
  togglePickerCountry,
  findMoviesToWatch,
  toggleHold,
  rerollPicker,
  retryPicker,
} = useRandomPicker();

const thisYear = new Date().getFullYear();
const recentYears = [
  { label: "Last year", year: thisYear - 1 },
  { label: "This year", year: thisYear },
];

const settledCount = ref(0);
const allSettled = ref(true);
const revealInfo = ref(false);
const findButtonRef = ref<HTMLElement | null>(null);
const rerollButtonRef = ref<HTMLElement | null>(null);

// Held reels keep their existing movie (same v-for :key, so they never
// remount/re-spin) and so never re-fire "settled" — only wait on the ones
// that are actually spinning this round.
function spinningCount(list: typeof pickedMovies.value) {
  return list.filter((_, index) => !heldFlags.value[index]).length;
}

watch(pickedMovies, async (movies, previous) => {
  settledCount.value = 0;
  const spinning = spinningCount(movies);
  allSettled.value = spinning === 0;
  revealInfo.value = spinning === 0;
  if (!movies.length && previous?.length) {
    await nextTick();
    findButtonRef.value?.focus();
  } else if (movies.length && !previous?.length) {
    await nextTick();
    rerollButtonRef.value?.focus();
  }
});
onMounted(() => findButtonRef.value?.focus());
// Leaving the page starts fresh — otherwise old picks would re-spin on return.
onBeforeUnmount(retryPicker);
// The results are a grid: one column per movie, poster on top and Hold below.
// Arrow keys move within that grid instead of the global linear order, and
// stop at its edges rather than spilling out onto unrelated controls.
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
function onGridKeydown(event: KeyboardEvent) {
  if (!ARROWS.includes(event.key)) return;
  const active = document.activeElement as HTMLElement | null;
  const row = active?.dataset.nav;
  const grid = event.currentTarget as HTMLElement;
  if (!active || (row !== "poster" && row !== "hold")) return;
  event.preventDefault();
  event.stopPropagation();

  const column = active.closest("article");
  const columns = Array.from(grid.children) as HTMLElement[];
  const index = column ? columns.indexOf(column as HTMLElement) : -1;
  const inColumn = (col: HTMLElement | undefined, kind: string) =>
    col?.querySelector<HTMLElement>(`[data-nav="${kind}"]`) ?? null;

  let target: HTMLElement | null = null;
  if (event.key === "ArrowLeft") target = inColumn(columns[index - 1], row);
  else if (event.key === "ArrowRight")
    target = inColumn(columns[index + 1], row);
  else if (event.key === "ArrowDown")
    target = row === "poster" ? inColumn(columns[index], "hold") : null;
  else if (row === "hold") target = inColumn(columns[index], "poster");
  else target = rerollButtonRef.value;

  if (!target) return;
  active.blur();
  target.focus();
}

function onReelSettled() {
  settledCount.value++;
  if (settledCount.value >= spinningCount(pickedMovies.value)) {
    allSettled.value = true;
    revealInfo.value = true;
  }
}
</script>

<template>
  <section v-auto-animate class="bg-cream px-10.5 py-6 max-md:p-6.5">
    <div class="relative mb-3">
      <div
        class="grid grid-cols-[1fr_auto] gap-6 max-md:grid-cols-1 max-md:gap-4"
      >
        <div
          class="flex items-baseline gap-3 -mb-2 max-tablet:flex-col max-tablet:items-center max-tablet:gap-1 max-tablet:text-center"
        >
          <!-- hidden once the slots are showing, to give them the room -->
          <h2 v-if="!pickedMovies.length" class="portrait:mb-0 max-tablet:text-[33px] max-tablet:tracking-[-0.06em]">Not sure what to watch?</h2>
          <!-- Centered across the full width on every device. In landscape it
               overlays the row beside the buttons instead of adding a line, so
               the slots keep their height on the TV. -->
          <p
            v-if="pickedMovies.length"
            class="m-0 w-full text-center font-mono text-[13px] text-muted-4 landscape:pointer-events-none landscape:absolute landscape:inset-x-0 landscape:top-0 landscape:flex landscape:h-14 landscape:items-center landscape:justify-center"
          >
            ({{ matchCount }} movie{{ matchCount === 1 ? "" : "s" }} found)
          </p>
        </div>
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
          <div v-else key="actions-results" class="flex items-center gap-2.5">
            <button
              class="flex h-14 w-auto items-center overflow-hidden border border-ink bg-transparent px-6 py-4 text-left text-ink cursor-pointer aria-disabled:cursor-wait aria-disabled:opacity-50"
              :aria-disabled="!allSettled"
              @click="allSettled && retryPicker()"
            >
              Reset
            </button>
            <button
              ref="rerollButtonRef"
              class="flex h-14 w-auto items-center overflow-hidden border-0 bg-ink px-6 py-4 text-left text-button-text cursor-pointer aria-disabled:cursor-wait aria-disabled:opacity-50"
              :aria-disabled="!allSettled"
              @click="allSettled && rerollPicker()"
            >
              {{ allSettled ? "Re-roll" : "Spinning…" }}
            </button>
          </div>
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
        <div v-if="collections.length" class="grid gap-2.5">
          <p class="m-0 font-mono text-[11px] text-muted-3">Collection</p>
          <select v-model="pickerCollection" class="max-w-60">
            <option value="">Any collection</option>
            <option
              v-for="collection in collections"
              :key="collection.ratingKey"
              :value="collection.title"
            >
              {{ collection.title }}
            </option>
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
            <button
              v-for="recent in recentYears"
              :key="recent.year"
              type="button"
              class="cursor-pointer rounded-full border border-border-2 px-3.5 py-1.75 font-mono text-xs text-muted-5"
              :class="
                pickerYears.includes(recent.year)
                  ? 'border-ink bg-ink text-button-text'
                  : 'bg-transparent'
              "
              @click="togglePickerYear(recent.year)"
            >
              {{ recent.label }}
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

    <template v-else key="results">
      <div
        class="grid grid-cols-2 gap-5 sm:grid-cols-5 portrait:grid-cols-3"
        @keydown="onGridKeydown"
      >
        <SlotReel
          v-for="(movie, index) in pickedMovies"
          :key="pickIds[index]"
          :movie="movie"
          :reveal="heldFlags[index] || revealInfo"
          :held="heldFlags[index]"
          :spinning="!allSettled"
          @settled="onReelSettled"
          @toggle-hold="toggleHold(index)"
        />
      </div>
    </template>
  </section>
</template>
