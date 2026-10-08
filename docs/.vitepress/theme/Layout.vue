<script setup lang="ts">
// The default layout with the design system's page header: a `// Section` eyebrow above every
// document's title, and numbered chapters in the Guide and Concepts.
import { useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { computed } from "vue";
import { sectionOf } from "./sections.ts";

const route = useRoute();
const section = computed(() => sectionOf(route.path));
</script>

<template>
  <div :class="{ 'bdk-numbered': section?.numbered }">
    <DefaultTheme.Layout>
      <template #doc-before>
        <p v-if="section" class="bn-eyebrow bdk-eyebrow">
          <span class="pre">//</span><span>{{ section.label }}</span>
        </p>
      </template>
    </DefaultTheme.Layout>
  </div>
</template>
