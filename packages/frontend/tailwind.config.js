/** @type {import('tailwindcss').Config} */

// Semantic color tokens backed by CSS variables (see index.css), so light and
// dark themes share every class. Stage hues encode the pipeline stage and are
// used consistently: timeline, stats, per-turn bars, pipeline list.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        panel: token("panel"),
        raised: token("raised"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        faint: token("faint"),
        stage: {
          eou: token("stage-eou"),
          stt: token("stage-stt"),
          llm: token("stage-llm"),
          tts: token("stage-tts"),
        },
        good: token("good"),
        warn: token("warn"),
        bad: token("bad"),
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["'Geist Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
