# 설문 집계기

엑셀에서 머리글 줄까지 복사해 붙여넣으면 문항별 결과 표(문항 / 유효 응답 / 평균 / 빈 응답 / 제외)를 보여 주는 단일 파일 웹 페이지입니다.

- 사용: `index.html`을 브라우저로 열거나 GitHub Pages로 배포합니다(`.nojekyll` 포함).
- 개인정보: 외부 라이브러리·글꼴·분석 도구가 없고, CSP로 모든 네트워크 요청을 막습니다. 붙여넣은 데이터는 브라우저 안에서만 계산하고 저장하지 않습니다.
- 집계 규칙과 구조: [PLAN.md](PLAN.md)

## 시험

Node 18 이상에서 의존성 없이 돌아갑니다.

```bash
npm test
```

- `tests/core.test.mjs`: `index.html`의 계산 로직 블록(`<script id="survey-core">`)만 꺼내 집계 규칙을 검사합니다.
- `tests/static.test.mjs`: 외부 자원·네트워크·저장 API가 없는지, CSP와 `.nojekyll`이 있는지 검사합니다.
