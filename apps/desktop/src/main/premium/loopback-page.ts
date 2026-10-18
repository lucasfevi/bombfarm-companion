export const LOOPBACK_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signed in — Bomb Farm Companion</title>
<style>
:root {
  color-scheme: dark;
  --bg: oklch(18% 0.015 48);
  --surface: oklch(24% 0.016 48);
  --line: oklch(35% 0.02 48);
  --text: oklch(93% 0.012 48);
  --muted: oklch(70% 0.02 48);
  --accent: oklch(72% 0.14 55);
  --accent-ink: oklch(20% 0.03 55);
  --green: oklch(72% 0.14 150);
}
* { box-sizing: border-box; }
html, body { min-height: 100%; margin: 0; }
body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
main {
  width: 100%;
  max-width: 520px;
  padding: 32px;
  background: var(--surface);
  border: 1px solid color-mix(in oklch, var(--line), var(--green) 30%);
  border-radius: 8px;
  box-shadow: inset 3px 0 0 var(--green);
  overflow-wrap: anywhere;
}
.steps { display: flex; align-items: center; margin: 0 0 28px; }
.step { display: flex; align-items: center; gap: 8px; }
.dot {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 12px ui-monospace, Consolas, monospace;
  border: 1px solid var(--green);
  background: color-mix(in oklch, var(--surface), var(--green) 18%);
  color: var(--green);
}
.dot.current { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.bar { flex: 1 1 24px; min-width: 16px; height: 1px; margin: 0 8px; background: var(--green); }
.caption { font-size: 12px; color: var(--muted); }
.check { display: block; margin: 0 0 16px; }
h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; line-height: 1.25; }
p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--line); margin: 24px 0; }
</style>
</head>
<body>
<main>
<div class="steps">
<span class="dot">1</span>
<span class="bar"></span>
<span class="dot">2</span>
<span class="bar"></span>
<span class="step"><span class="dot current">3</span><span class="caption">Back to the app · De volta ao app</span></span>
</div>
<svg class="check" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
<circle cx="20" cy="20" r="18.5" stroke="oklch(72% 0.14 150)" stroke-width="2"/>
<path d="M12 20.5l6 6 11-12.5" stroke="oklch(72% 0.14 150)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
<section lang="en">
<h1>You are signed in</h1>
<p>Return to the desktop app. You can close this tab.</p>
</section>
<hr>
<section lang="pt-BR">
<h1>Você está conectado</h1>
<p>Volte para o app de desktop. Você pode fechar esta aba.</p>
</section>
</main>
</body>
</html>
`;
