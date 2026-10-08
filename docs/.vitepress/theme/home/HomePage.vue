<script setup lang="ts">
// The home page, built from the design system's components (Hero, SectionHeader, process steps
// of ServiceCards with Segments, plain ServiceCards, FinalCTA band, Footer) in their markup and
// classes from ../design-system/components.css.
import { withBase } from "vitepress";

const stages = [
  {
    command: "/bdk:propose",
    title: "Propose",
    text: "Turns an intent or a GitHub issue into an OpenSpec Change: why, what, and the capabilities it touches.",
    link: "/concepts/orchestrators#bdk-propose",
  },
  {
    command: "/bdk:design",
    title: "Design",
    text: "Maps the code, writes the spec deltas with their scenarios and the design, and has a verifier check them.",
    link: "/concepts/orchestrators#bdk-design",
  },
  {
    command: "/bdk:plan",
    title: "Plan",
    text: "Cuts the work into parts one agent each can finish, with the files and the scenarios of every part.",
    link: "/concepts/orchestrators#bdk-plan",
  },
  {
    command: "/bdk:execute",
    title: "Execute",
    text: "Builds the parts test-first, in parallel waves of worktrees, and merges them into the Change's branch.",
    link: "/concepts/orchestrators#bdk-execute-and-the-bdk-execute-waves-lead",
  },
  {
    command: "/bdk:auto-review",
    title: "Review",
    text: "Reviews the diff, runs your checks, and drives the running product through every scenario as its user would.",
    link: "/concepts/orchestrators#bdk-auto-review",
    signal: true,
  },
  {
    command: "/bdk:close",
    title: "Close",
    text: "Checks the product against the specs, merges the deltas into the living specs, and opens the pull request.",
    link: "/concepts/orchestrators#bdk-close",
  },
];

const reasons = [
  {
    title: "The product, not only the code",
    text: "Every review round starts your product and checks each spec scenario through its CLI, API or browser.",
    link: "/concepts/e2e",
  },
  {
    title: "Specs that stay current",
    text: "Each Change ends by merging its spec deltas into openspec/specs/, so the specs say what the product does today.",
    link: "/concepts/openspec-changes",
  },
  {
    title: "Autonomy you choose",
    text: "Stop at every design and every finding, or let /bdk:run go from intent to pull request and record what it decided.",
    link: "/concepts/gates-and-budgets",
  },
  {
    title: "Everything is a file",
    text: "Every stage writes what it did and starts at its first missing file, so a stopped run picks up where it left off.",
    link: "/concepts/run-state",
  },
];

const docs = [
  {
    title: "Guide",
    text: "Install the plugins, set up a project and take one idea to a pull request.",
    cta: "Start here",
    link: "/guide/",
  },
  {
    title: "Concepts",
    text: "Changes, orchestrators and agents, run state, findings, gates and E2E, with diagrams of every flow.",
    cta: "See how it works",
    link: "/concepts/workflow",
  },
  {
    title: "Reference",
    text: "Every skill, agent, bdk command, setting and hook, generated from the plugins themselves.",
    cta: "Look it up",
    link: "/reference/",
  },
  {
    title: "Decisions",
    text: "Why BDK is built the way it is: the architecture decisions with the options that lost.",
    cta: "Read the decisions",
    link: "/adr/0003-v3-architecture-skills-first",
  },
];

const year = new Date().getFullYear();
</script>

<template>
  <div class="bdk-home">
    <section class="bn-hero bn-grid bdk-dark bdk-hero">
      <div class="container bdk-hero-grid">
        <div class="content fade-in">
          <p class="bn-eyebrow"><span class="pre">//</span><span>Claude Code plugins</span></p>
          <h1>From an idea<br />to a pull request<span class="bn-dot">.</span></h1>
          <p class="lead">
            BDK proposes, designs, plans, builds and reviews a change, checks the product the way
            its user would, and keeps your specs current. Every stage writes files you can read;
            every decision can stay yours.
          </p>
          <div class="cta-group">
            <a class="bn-btn bn-btn--primary" :href="withBase('/guide/')"
              >Get started<span class="arr" aria-hidden="true">→</span></a
            >
            <a class="bn-btn bn-btn--secondary" :href="withBase('/concepts/workflow')"
              >How it works</a
            >
          </div>
          <div class="tags">
            <ul class="bn-tag-list">
              <li><span class="bn-tag">OpenSpec Changes</span></li>
              <li><span class="bn-tag">E2E as a user</span></li>
              <li><span class="bn-tag">Living specs</span></li>
              <li><span class="bn-tag">Autopilot</span></li>
            </ul>
          </div>
        </div>
        <div class="bdk-terminal" aria-label="A session with BDK">
          <p class="bdk-terminal-head"><span class="bn-label">claude</span></p>
          <pre><code><span class="bdk-prompt">&gt;</span> /bdk:setup
<span class="bdk-out">.bdk/settings.yaml written</span>

<span class="bdk-prompt">&gt;</span> /bdk:run "orders export as CSV"
<span class="bdk-out">propose → design → plan</span>
<span class="bdk-out">execute → review → close</span>
<span class="bdk-out">pull request opened</span></code></pre>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <header class="bn-section-header">
          <p class="bn-eyebrow"><span class="pre">//</span><span>The workflow</span></p>
          <h2 class="title">
            Six stages<span class="bn-dot">.</span><span class="muted">One command each.</span>
          </h2>
          <p class="subtitle">
            Run them one by one and decide at every step, or let <code>/bdk:run</code> take a queue
            of intents to pull requests.
          </p>
        </header>
        <ol class="bn-cols bn-cols--3 bdk-steps">
          <li v-for="(stage, i) in stages" :key="stage.command" class="bn-step">
            <div class="bn-segments" aria-hidden="true">
              <div :class="{ current: stage.signal }"><span class="bar"></span></div>
            </div>
            <article class="bn-service-card">
              <div class="head">
                <span class="num">{{ String(i + 1).padStart(2, "0") }}</span>
                <code class="bdk-command">{{ stage.command }}</code>
              </div>
              <h3 class="title">{{ stage.title }}</h3>
              <div class="body">
                <p>{{ stage.text }}</p>
              </div>
              <a :href="withBase(stage.link)" class="link">How it runs →</a>
            </article>
          </li>
        </ol>
      </div>
    </section>

    <section class="section section--subtle bn-grid--fade">
      <div class="container">
        <header class="bn-section-header">
          <p class="bn-eyebrow"><span class="pre">//</span><span>Why BDK</span></p>
          <h2 class="title">
            Checks the product<span class="bn-dot">.</span
            ><span class="muted">Not only the code.</span>
          </h2>
        </header>
        <div class="bn-cols bn-cols--4">
          <article
            v-for="(reason, i) in reasons"
            :key="reason.title"
            class="bn-service-card bn-service-card--plain"
          >
            <div class="head">
              <span class="num">{{ String(i + 1).padStart(2, "0") }}</span>
            </div>
            <h3 class="title">{{ reason.title }}</h3>
            <div class="body">
              <p>{{ reason.text }}</p>
            </div>
            <a :href="withBase(reason.link)" class="link">Read more →</a>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <header class="bn-section-header">
          <p class="bn-eyebrow"><span class="pre">//</span><span>Documentation</span></p>
          <h2 class="title">Find your way<span class="bn-dot">.</span></h2>
        </header>
        <div class="bn-cols bn-cols--4">
          <article v-for="(doc, i) in docs" :key="doc.title" class="bn-service-card">
            <div class="head">
              <span class="num">{{ String(i + 1).padStart(2, "0") }}</span>
            </div>
            <h3 class="title">{{ doc.title }}</h3>
            <div class="body">
              <p>{{ doc.text }}</p>
            </div>
            <a :href="withBase(doc.link)" class="link">{{ doc.cta }} →</a>
          </article>
        </div>
      </div>
    </section>

    <section class="bn-final-cta bn-grid">
      <div class="container grid">
        <div>
          <h2>Install in two commands<span class="bn-dot">.</span></h2>
          <p class="intro">
            Add the marketplace, install the plugin, then run <code>/bdk:setup</code> in your
            project. It detects your tests, linters and how to start the product.
          </p>
        </div>
        <div class="card">
          <pre class="bdk-install"><code>/plugin marketplace add broneq/bdk
/plugin install bdk@bdk
/bdk:setup</code></pre>
          <a class="bn-btn bn-btn--primary bn-btn--block" :href="withBase('/guide/install')"
            >Read the install guide<span class="arr" aria-hidden="true">→</span></a
          >
        </div>
      </div>
    </section>

    <footer class="bn-footer bdk-dark bn-grid">
      <div class="container">
        <div class="grid">
          <div>
            <a class="bn-logo" :href="withBase('/')">BDK<span class="dot">.</span></a>
            <p class="tagline">Claude Code plugins that take an idea to a reviewed pull request.</p>
          </div>
          <nav aria-labelledby="bdk-footer-docs">
            <h2 id="bdk-footer-docs" class="head">Documentation</h2>
            <ul>
              <li><a :href="withBase('/guide/')">Guide</a></li>
              <li><a :href="withBase('/concepts/workflow')">Concepts</a></li>
              <li><a :href="withBase('/reference/')">Reference</a></li>
            </ul>
          </nav>
          <nav aria-labelledby="bdk-footer-project">
            <h2 id="bdk-footer-project" class="head">Project</h2>
            <ul>
              <li><a href="https://github.com/broneq/bdk">GitHub</a></li>
              <li><a :href="withBase('/adr/0003-v3-architecture-skills-first')">Decisions</a></li>
              <li><a :href="withBase('/design/2026-10-07-v3-architecture')">Designs</a></li>
            </ul>
          </nav>
        </div>
        <div class="bottom">
          <span>&copy; {{ year }} Przemysław Broniszewski · MIT license</span>
          <a href="https://github.com/broneq/bdk">github.com/broneq/bdk</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* The design system's base.css utilities the home page needs, kept to this page. */
.bdk-home :deep(.section) {
  padding-block: var(--section-y);
}

.bdk-home :deep(.section--subtle) {
  background-color: var(--bg-subtle);
  --grid-fade-to: var(--bg-subtle);
}

.bdk-home :deep(.bn-grid--fade) {
  background-image:
    radial-gradient(130% 110% at 100% 0%, transparent 0%, var(--grid-fade-to, var(--bg-page)) 72%),
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size:
    100% 100%,
    var(--grid-size) var(--grid-size),
    var(--grid-size) var(--grid-size);
}

.bdk-home :deep(.bn-cols) {
  display: grid;
  gap: var(--cols-gap, var(--space-8));
  grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.bdk-home :deep(.bn-cols--3) {
  --cols: 3;
}

.bdk-home :deep(.bn-cols--4) {
  --cols: 4;
}

.bdk-home :deep(.fade-in) {
  animation: bnFadeInUp var(--dur-enter) var(--ease-out) both;
}

.bdk-home :deep(.bn-eyebrow) {
  margin: 0;
}

.bdk-home :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.bdk-home :deep(.bn-section-header .subtitle code) {
  padding: 0.15em 0.4em;
  border-radius: var(--radius-xs);
  background: var(--bg-subtle);
  color: var(--fg-default);
}

@media (max-width: 1024px) {
  .bdk-home :deep(.bn-cols--3),
  .bdk-home :deep(.bn-cols--4) {
    --cols: 2;
  }
}

@media (max-width: 768px) {
  .bdk-home :deep(.bn-cols) {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Hero: text on the left, a session on the right instead of a portrait. */
.bdk-hero {
  min-height: auto;
}

.bdk-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: var(--space-16);
  align-items: center;
}

.bdk-hero h1 {
  font-size: clamp(48px, 5.2vw, 84px);
}

.bdk-terminal {
  border: 1px solid var(--line-default);
  border-radius: var(--radius-sm);
  background: var(--bn-ink-950);
}

.bdk-terminal-head {
  padding: 12px 20px;
  border-bottom: 1px solid var(--line-default);
}

.bdk-terminal pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.7;
  color: var(--fg-default);
}

.bdk-terminal code {
  font-size: inherit;
}

.bdk-prompt {
  color: var(--accent-text);
}

.bdk-out {
  color: var(--fg-muted);
}

@media (max-width: 1024px) {
  .bdk-hero-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Process steps: the command beside the number. */
.bdk-steps .bdk-command {
  color: var(--fg-muted);
}

.bdk-steps .body p {
  color: var(--fg-body);
}

.bn-service-card .body p {
  color: var(--fg-body);
}

/* Install band: the commands on the ink card. */
.bdk-install {
  margin: 0;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
  color: var(--bn-ink-100);
}

.bn-final-cta .intro code {
  padding: 0.15em 0.4em;
  border-radius: var(--radius-xs);
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

@media (max-width: 768px) {
  .bn-final-cta .grid {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-10);
  }

  .bn-footer .grid {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-8);
  }
}
</style>
