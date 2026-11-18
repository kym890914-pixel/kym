// index.html에서 계산 로직 블록(<script id="survey-core">)만 꺼내 DOM 없이 실행한다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));

export function loadCore() {
  const html = readFileSync(indexPath, 'utf8');
  const m = html.match(/<script id="survey-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="survey-core"> 블록이 없습니다.');
  const context = vm.createContext({});
  vm.runInContext(m[1], context, { filename: 'index.html#survey-core' });
  return context.SurveyCore;
}
