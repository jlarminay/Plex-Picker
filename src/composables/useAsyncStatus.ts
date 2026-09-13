import { ref } from 'vue'

const loading = ref(false)
const error = ref('')

export function useAsyncStatus() {
  return { loading, error }
}
