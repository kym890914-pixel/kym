// index.html이 외부 자원·네트워크·저장소를 쓰지 않는지, 화면과 계산 로직이 나뉘어 있는지 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { indexPath } from './load-core.mjs';

const html = readFileSync(indexPath, 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

test('외부 주소를 참조하지 않는다', () => {
  assert.doesNotMatch(html, /\b(src|href|action)\s*=\s*["']?\s*(https?:)?\/\//i);
  assert.doesNotMatch(html, /url\(\s*["']?\s*(https?:)?\/\//i);
  assert.doesNotMatch(html, /@import/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<(iframe|object|embed|img|form)\b/i);
});

test('외부 스크립트 파일을 불러오지 않는다', () => {
  for (const [, attrs] of scripts) assert.doesNotMatch(attrs, /\bsrc\s*=/i);
});

test('네트워크·저장 API를 쓰지 않는다', () => {
  const code = scripts.map((m) => m[2]).join('\n');
  for (const api of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'localStorage',
    'sessionStorage', 'indexedDB', 'document.cookie', 'caches', 'serviceWorker', 'postMessage', 'window.open', 'innerHTML', 'eval']) {
    assert.ok(!code.includes(api), `${api} 사용 금지`);
  }
});

test('CSP가 기본으로 모든 요청을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, 'CSP meta 없음');
  assert.match(m[1], /default-src 'none'/);
  assert.match(m[1], /form-action 'none'/);
  assert.doesNotMatch(m[1], /connect-src|https?:/);
});

test('입력란은 맞춤법 검사·자동완성을 끈다', () => {
  const m = html.match(/<textarea\b[^>]*>/);
  assert.ok(m);
  assert.match(m[0], /spellcheck="false"/);
  assert.match(m[0], /autocomplete="off"/);
});

test('계산 로직 블록은 DOM을 쓰지 않는다', () => {
  const core = scripts.find((m) => /id="survey-core"/.test(m[1]));
  const ui = scripts.find((m) => /id="survey-ui"/.test(m[1]));
  assert.ok(core && ui, 'survey-core / survey-ui 블록이 모두 있어야 함');
  assert.doesNotMatch(core[2], /\b(document|window|navigator)\b/);
});

test('결과 표 머리글 순서', () => {
  const heads = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ['문항', '유효 응답', '평균', '빈 응답', '제외']);
});

test('저장소 맨 위에 빈 .nojekyll 파일이 있다', () => {
  const p = fileURLToPath(new URL('../.nojekyll', import.meta.url));
  assert.equal(statSync(p).size, 0);
});
