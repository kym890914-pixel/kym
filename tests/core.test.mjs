import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load-core.mjs';

const { parseTSV, classifyCell, formatMean, tally } = loadCore();
// vm 컨텍스트의 배열은 다른 realm이라 deepStrictEqual 비교 전에 평범한 값으로 바꾼다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const row = (s) => plain(tally(s).questions);

test('칸 판정: 1~5는 유효, 앞뒤 공백은 지운다', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3', '4 ', '\t5\t', ' 1 ', ' 2　']) {
    assert.equal(classifyCell(v), 'valid', JSON.stringify(v));
  }
});

test('칸 판정: 비었거나 공백만 있으면 빈 응답', () => {
  for (const v of ['', ' ', '   ', '\t', '　', undefined, null]) {
    assert.equal(classifyCell(v), 'blank', JSON.stringify(v));
  }
});

test('칸 판정: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '3.0', '1.5', '-1', '+3', '03', '１', '예', 'a', '3 4', '"3"', 'NaN']) {
    assert.equal(classifyCell(v), 'excluded', JSON.stringify(v));
  }
});

test('평균: 소수 셋째 자리에서 반올림해 둘째 자리까지', () => {
  assert.equal(formatMean(0, 0), '-');
  assert.equal(formatMean(5, 1), '5.00');
  assert.equal(formatMean(10, 3), '3.33');   // 3.333…
  assert.equal(formatMean(11, 3), '3.67');   // 3.666…
  assert.equal(formatMean(107, 40), '2.68'); // 정확히 2.675 → 올림 (toFixed는 2.67)
  assert.equal(formatMean(1, 8), '0.13');    // 0.125 → 0.13
  assert.equal(formatMean(29, 8), '3.63');   // 3.625 → 3.63
  assert.equal(formatMean(9, 2), '4.50');
  assert.equal(formatMean(1999, 1000), '2.00'); // 1.999 → 2.00
  assert.equal(formatMean(1994, 1000), '1.99'); // 1.994 → 1.99
  assert.equal(formatMean(1995, 1000), '2.00'); // 1.995 → 2.00
});

test('첫 열(응답번호)은 집계하지 않는다', () => {
  const r = tally('번호\t문1\n1\t3\n2\t5\n');
  assert.equal(r.ok, true);
  assert.equal(r.responses, 2);
  assert.deepEqual(row('번호\t문1\n1\t3\n2\t5\n'), [
    { name: '문1', valid: 2, mean: '4.00', blank: 0, excluded: 0 },
  ]);
});

test('문항별로 유효·평균·빈 응답·제외를 센다', () => {
  const text = [
    '응답번호\t만족도\t추천\t재방문',
    '1\t5\t4\t',
    '2\t4\t \t1',
    '3\t 3 \t7\t2',
    '4\t\t모름\t3',
    '5\t2\t5\t 4',
  ].join('\r\n') + '\r\n';
  assert.deepEqual(row(text), [
    { name: '만족도', valid: 4, mean: '3.50', blank: 1, excluded: 0 },
    { name: '추천', valid: 2, mean: '4.50', blank: 1, excluded: 2 },
    { name: '재방문', valid: 4, mean: '2.50', blank: 1, excluded: 0 },
  ]);
});

test('유효 응답이 0이면 평균은 "-"', () => {
  assert.deepEqual(row('번호\t문1\n1\t\n2\tx\n'), [
    { name: '문1', valid: 0, mean: '-', blank: 1, excluded: 1 },
  ]);
});

test('칸 수가 모자란 줄은 모자란 칸을 빈 응답으로 센다', () => {
  const text = '번호\t문1\t문2\t문3\n1\t5\n2\n3\t1\t2\t3\n';
  const r = tally(text);
  assert.equal(r.shortRows, 2);
  assert.deepEqual(row(text), [
    { name: '문1', valid: 2, mean: '3.00', blank: 1, excluded: 0 },
    { name: '문2', valid: 1, mean: '2.00', blank: 2, excluded: 0 },
    { name: '문3', valid: 1, mean: '3.00', blank: 2, excluded: 0 },
  ]);
});

test('칸 수가 많은 줄의 남는 칸은 집계하지 않고 줄 수를 알린다', () => {
  const text = '번호\t문1\n1\t5\t9\t9\n2\t3\n';
  const r = tally(text);
  assert.equal(r.longRows, 1);
  assert.deepEqual(row(text), [
    { name: '문1', valid: 2, mean: '4.00', blank: 0, excluded: 0 },
  ]);
});

test('줄바꿈 \\r\\n, \\n, \\r 모두 읽고 끝의 빈 줄은 응답이 아니다', () => {
  for (const nl of ['\r\n', '\n', '\r']) {
    const r = tally(['번호', '1', '2'].map((x, i) => (i ? `${x}\t${i + 2}` : `${x}\t문1`)).join(nl) + nl + nl);
    assert.equal(r.responses, 2, JSON.stringify(nl));
    assert.equal(r.questions[0].mean, '3.50');
  }
});

test('모든 칸이 빈 줄(탭만 있는 줄)은 빈 응답으로 센다', () => {
  assert.deepEqual(row('번호\t문1\t문2\n\t\t\n1\t2\t3\n'), [
    { name: '문1', valid: 1, mean: '2.00', blank: 1, excluded: 0 },
    { name: '문2', valid: 1, mean: '3.00', blank: 1, excluded: 0 },
  ]);
});

test('엑셀 인용 칸(칸 안 줄바꿈·따옴표)을 한 칸으로 읽는다', () => {
  const rows = plain(parseTSV('번호\t"만족\n정도"\t"그는 ""좋다"""\n1\t4\t5\n'));
  assert.deepEqual(rows, [['번호', '만족\n정도', '그는 "좋다"'], ['1', '4', '5']]);
  assert.deepEqual(row('번호\t"만족\n정도"\n1\t4\n'), [
    { name: '만족\n정도', valid: 1, mean: '4.00', blank: 0, excluded: 0 },
  ]);
});

test('BOM을 지우고, 머리글 이름이 비면 열 번호로 부른다', () => {
  const r = tally('﻿번호\t\t문2\n1\t1\t2\n');
  assert.equal(r.questions[0].name, '(2번째 열)');
  assert.equal(r.questions[1].name, '문2');
});

test('머리글만 있으면 모든 수가 0이고 평균은 "-"', () => {
  const r = tally('번호\t문1\t문2\n');
  assert.equal(r.ok, true);
  assert.equal(r.responses, 0);
  assert.deepEqual(plain(r.questions), [
    { name: '문1', valid: 0, mean: '-', blank: 0, excluded: 0 },
    { name: '문2', valid: 0, mean: '-', blank: 0, excluded: 0 },
  ]);
});

test('빈 입력과 문항 열이 없는 입력은 오류로 알린다', () => {
  for (const t of ['', '\n\n', '\r\n']) assert.equal(tally(t).ok, false, JSON.stringify(t));
  assert.equal(tally('응답번호\n1\n2\n').ok, false);
});

test('여러 문항 큰 표: 직접 센 값과 같다', () => {
  const header = ['번호', ...Array.from({ length: 6 }, (_, i) => `Q${i + 1}`)];
  const values = ['1', '2', '3', '4', '5', '', ' ', 'x', '6', ' 2 '];
  const lines = [header.join('\t')];
  const expect = header.slice(1).map((name) => ({ name, valid: 0, sum: 0, blank: 0, excluded: 0 }));
  for (let r = 0; r < 200; r++) {
    const cells = [String(r + 1)];
    const width = 1 + ((r * 7) % 7); // 1~7칸: 모자란 줄 섞기
    for (let q = 0; q < 6; q++) {
      const e = expect[q];
      if (q + 1 >= width) { e.blank++; continue; }
      const v = values[(r * 31 + q * 17) % values.length];
      cells.push(v);
      const t = v.trim();
      if (t === '') e.blank++;
      else if (['1', '2', '3', '4', '5'].includes(t)) { e.valid++; e.sum += Number(t); }
      else e.excluded++;
    }
    lines.push(cells.join('\t'));
  }
  const got = row(lines.join('\n'));
  assert.deepEqual(got, expect.map((e) => ({
    name: e.name, valid: e.valid, mean: formatMean(e.sum, e.valid), blank: e.blank, excluded: e.excluded,
  })));
  for (const q of got) assert.equal(q.valid + q.blank + q.excluded, 200);
});
