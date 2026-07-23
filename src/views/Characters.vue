<script setup>
import { useRouter } from 'vue-router'
import DualTitle from '../components/DualTitle.vue'
import FocusList from '../components/FocusList.vue'
import { characters } from '../content'

const router = useRouter()
</script>

<template>
  <div class="characters-view">
    <header class="head" v-reveal>
      <DualTitle en="CHARACTERS" zh="人物" />
    </header>
    <FocusList :items="characters" @open="(c) => router.push(`/characters/${c.id}`)" />
  </div>
</template>

<style scoped>
.characters-view {
  min-height: 100vh;
  padding: 3rem clamp(1.2rem, 4vw, 3rem) 2rem;
}

.head { margin-bottom: 1rem; }

@media (max-width: 860px) {
  .characters-view { padding-top: 4.5rem; }
}
</style>
