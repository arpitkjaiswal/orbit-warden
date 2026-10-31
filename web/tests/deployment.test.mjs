import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const LIVE_URL = 'https://orbit-warden-1.onrender.com/';

test('published website is discoverable in repo documentation and HTML', () => {
  const readme = read('../../README.md');
  const html = read('../index.html');
  assert.ok(readme.includes('https://orbit-warden-1.onrender.com'));
  assert.ok(html.includes(`rel="canonical" href="${LIVE_URL}"`));
  assert.ok(html.includes(`href="${LIVE_URL}"`));
});
test('Render config publishes browser assets rather than Pygame desktop runtime', () => {
  const yaml = read('../../render.yaml');
  assert.match(yaml, /runtime:\s*static/);
  assert.match(yaml, /staticPublishPath:\s*\.\/web/);
});
test('release manifest agrees with the visible game version', () => {
  const manifest=JSON.parse(read('../version.json'));
  assert.ok(read('../index.html').includes(`class="build">v${manifest.version}</span>`));
});
