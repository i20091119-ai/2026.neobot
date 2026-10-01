// '오늘 배운 것' 각도 문제 풀 — 이어달리기 대기 중 풀이, 미션 심화 복습용
// 구조는 problems.js와 같게 { q, a, lv } 배열, 자동 생성 + 검산. 모든 답은 정수.
//   lv: 'base' = 초5·초6·중1 공통, 'm1' = 중1만 추가
'use strict';
(function () {
  const NAME = { 3: '정삼각형', 4: '정사각형', 5: '정오각형', 6: '정육각형', 8: '정팔각형', 9: '정구각형', 10: '정십각형', 12: '정십이각형' };
  const NS = [3, 4, 5, 6, 8, 9, 10, 12];
  const out = [];
  const add = (q, a, lv = 'base') => out.push({ q, a, lv });

  NS.forEach(n => add(`${NAME[n]}에서 로봇이 한 번에 도는 각은? (°)`, 360 / n));
  NS.forEach(n => add(`${NAME[n]}을 한 바퀴 돌면 도는 각의 합은? (°)`, 360));
  [120, 90, 72, 60, 45, 40, 36, 30].forEach(d => add(`한 번에 ${d}°씩 돌아 제자리로 왔어요. 정몇각형?`, 360 / d));
  NS.forEach(n => add(`${NAME[n]} 주행 코드, 몇 번 반복?`, n));
  [[12, [3, 4, 6, 12]], [10, [5, 10]], [8, [4, 8]]].forEach(([T, ns]) =>
    ns.forEach(n => add(`한 바퀴 ${T}초 로봇, ${NAME[n]}에서 한 번 도는 시간은? (초)`, T / n)));
  NS.forEach(n => add(`${NAME[n]}의 한 내각은? (°)`, 180 - 360 / n));
  NS.forEach(n => add(`${NAME[n]}의 한 내각과 로봇이 도는 각을 더하면? (°)`, 180));
  [5, 6, 8, 10].forEach(n => add(`${NAME[n]} 내각의 합은? (°)`, 180 * (n - 2), 'm1'));
  add('144°씩 5번 돌면 도는 각의 합은? (°)', 720, 'm1');

  // 검산: 정수·양수, 같은 문제 중복 없음
  const seen = new Set();
  out.forEach(p => {
    if (!Number.isInteger(p.a) || p.a <= 0) throw new Error('각도 문제 답이 정수가 아님: ' + p.q);
    if (seen.has(p.q)) throw new Error('각도 문제 중복: ' + p.q);
    seen.add(p.q);
  });

  // 학년별 풀: 중1이면 m1 문제 추가
  function pool(grade) { return out.filter(p => p.lv === 'base' || (grade === 'm1' && p.lv === 'm1')); }
  // 같은 문제가 연속으로 나오지 않게 뽑기
  function picker(grade) {
    let last = -1;
    return function next() {
      const P = pool(grade);
      let i;
      do { i = Math.floor(Math.random() * P.length); } while (P.length > 1 && i === last);
      last = i;
      return P[i];
    };
  }
  window.AngleProblems = { ALL: out, pool, picker, NAME };
})();
