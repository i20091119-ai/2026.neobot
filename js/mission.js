// 정다각형 미션 — 수업 하방을 활동지 대신 앱으로: 앱 단계 → 바닥 활동 → 다음 앱 단계 반복
//   시작(모둠·학년) → ① 조립 → ② 한 바퀴 시간 → ③ 정사각형 → ④ 정삼각형·정육각형 → ⑤ 놀이(drive.html)
//   심화(④ 완료 후): 미션 카드(정오·팔·구·십·십이각형), 오각별, 각도 복습 문제
// 거리·각도는 시간으로 제어(바퀴 회전 센서 없음). 회전 시간 = 한 바퀴 시간 × 도는 각 ÷ 360
'use strict';
(function () {
  const NB = window.Neobot;
  const AP = window.AngleProblems;
  const $ = (id) => document.getElementById(id);

  // ---- 현장 조절값 ----
  const FWD_SPEED = 5;                         // 직진 DCL = DCR = 0x10 + 5
  const TURN_SPEED = 5;                        // 오른쪽 제자리 회전 DCL = 0x10 + 5, DCR = 0x20 + 5
  const PAUSE_MS = 500;                        // 동작 사이 정지
  const T_DEFAULT = 6.0, T_MIN = 1, T_MAX = 20, T_SUGGEST = 0.3;
  const TIME_TOL = 0.05;                       // 시간 답 허용 오차(초)
  const L_CHOICES = [0.5, 1.0, 1.5, 2.0];      // 변 길이(직진 시간, 초)
  // 부품 목록 — 사진 받은 뒤 확정
  const PARTS = ['컨트롤러', '모터 2개', '바퀴 2개', '보조 바퀴', '건전지 AA 4개'];
  // 조립 순서 사진 — assets/assembly/ 에 넣으면 표시(없으면 자리 표시)
  const PHOTOS = [1, 2, 3, 4, 5].map(i => ({ src: `assets/assembly/${i}.jpg`, cap: `조립 ${i}단계` }));
  const GRADES = { e5: '초5', e6: '초6', m1: '중1' };
  const SHAPES = {
    sq: { n: 4, turn: 90, name: '정사각형', div: true },
    tri: { n: 3, turn: 120, name: '정삼각형' },
    hex: { n: 6, turn: 60, name: '정육각형' },
    p5: { n: 5, turn: 72, name: '정오각형' },
    p8: { n: 8, turn: 45, name: '정팔각형' },
    p9: { n: 9, turn: 40, name: '정구각형' },
    p10: { n: 10, turn: 36, name: '정십각형' },
    p12: { n: 12, turn: 30, name: '정십이각형' },
    star: { n: 5, turn: 144, name: '오각별', laps: 2 },
  };
  const CARDS = ['p5', 'p8', 'p9', 'p10', 'p12'];
  const STAGES = [[1, '① 조립'], [2, '② 한 바퀴'], [3, '③ 정사각형'], [4, '④ 삼각·육각'], [5, '⑤ 놀이']];
  const SAVE_KEY = 'neobot-mission-v1';
  const RELAY_KEY = 'neobot-relay-v1';         // drive.js 이어달리기 기록(기록 화면에서 읽기만)

  const fresh = () => ({
    team: null, grade: null, view: 'start', T: null, Ttry: T_DEFAULT, spun: false, s2msg: '',
    done: {}, s1: { checks: [], photo: 0, seen: false, wheel: '' }, shapes: {},
    s4: { sub: 'exp', pred: '', expRan: false, result: '', sumSeen: false }, m1: {}, adv: { card: null, review: 0 },
  });
  let st = fresh();

  const round2 = (v) => Math.round(v * 100) / 100;
  const fmtT = (v) => (+v).toFixed(1);
  const num = (s) => parseFloat(String(s).replace(',', '.').trim());
  const clampT = (v) => Math.max(T_MIN, Math.min(T_MAX, Math.round(v * 10) / 10));
  const newQ = () => ({ ok: false, w: 0, help: false, rev: false, val: '' });
  function sh(id) {
    if (!st.shapes[id]) st.shapes[id] = { q: { angle: newQ(), div: newQ(), time: newQ() }, rep: '', tt: '', L: 1.0, ran: false, star: 0, Tused: st.T };
    return st.shapes[id];
  }
  function m1q(k) { if (!st.m1[k]) st.m1[k] = newQ(); return st.m1[k]; }
  const turnTime = (id) => st.T * (SHAPES[id].laps || 1) / SHAPES[id].n;

  // ---- 저장 ----
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {} }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!o || typeof o !== 'object') return;
      const f = fresh();
      st = Object.assign(f, o);
      ['done', 's1', 's4', 'm1', 'adv', 'shapes'].forEach(k => { if (!st[k] || typeof st[k] !== 'object') st[k] = f[k]; });
      st.s1 = Object.assign(f.s1, st.s1); st.s4 = Object.assign(f.s4, st.s4); st.adv = Object.assign(f.adv, st.adv);
      if (!Array.isArray(st.s1.checks)) st.s1.checks = [];
      st.T = st.T > 0 ? clampT(st.T) : null;
      st.Ttry = st.Ttry > 0 ? clampT(st.Ttry) : T_DEFAULT;
      if (!(st.team >= 1 && st.team <= 25) || !GRADES[st.grade]) { st.team = null; st.view = 'start'; }
      if (!['start', 's1', 's2', 's3', 's4', 's5', 'adv'].includes(st.view)) st.view = 'start';
      if (st.adv.card && !SHAPES[st.adv.card]) st.adv.card = null;
    } catch (e) { st = fresh(); }
  }

  // ---- 실행 엔진: performance.now() 기준 대기, 정지 = runId 증가 ----
  let runId = 0, busy = false;
  class Stopped extends Error {}
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function hold(ms, id) {
    const end = performance.now() + ms;
    for (;;) {
      if (id !== runId) throw new Stopped();
      const left = end - performance.now();
      if (left <= 0) return;
      await sleep(Math.min(10, left));
    }
  }
  async function run(steps) {
    if (busy) return false;
    if (!NB.connected) toast('로봇 연결 안 됨 — 오른쪽 위 [로봇 연결]');
    const id = ++runId; busy = true; $('stopBig').classList.remove('hidden'); render();
    let ok = false;
    try {
      for (const s of steps) { NB.setMotors(s.l, s.r); if (s.on) s.on(s); await hold(s.ms, id); }
      ok = true;
    } catch (e) { if (!(e instanceof Stopped)) throw e; }
    finally {
      NB.setMotors(0, 0);
      if (id === runId) { busy = false; $('stopBig').classList.add('hidden'); render(); }
    }
    return ok;
  }
  function stopRun() {
    if (!busy) return;
    runId++; busy = false; NB.setMotors(0, 0);
    $('stopBig').classList.add('hidden');
    if (anim && !anim.end && anim.p == null) anim.p = Math.min(1, (performance.now() - anim.t0) / anim.ms);
    render();
  }
  const ms = (sec) => Math.round(sec * 1000);
  const fwd = (sec) => ({ l: FWD_SPEED, r: FWD_SPEED, ms: ms(sec) });
  const right = (sec) => ({ l: TURN_SPEED, r: -TURN_SPEED, ms: ms(sec) });
  const pause = () => ({ l: 0, r: 0, ms: PAUSE_MS });
  // n번 반복 { 직진 L초 → 정지 → 회전 t초 → 정지 }, 그림과 함께
  function polySteps(n, L, t) {
    const mark = (k, kind, after) => (s) => { anim = { k, kind, after, t0: performance.now(), ms: Math.max(1, s.ms) }; };
    const steps = [];
    for (let i = 0; i < n; i++) {
      steps.push({ ...fwd(L), on: mark(i, 'move') }, { ...pause(), on: mark(i, 'pause', false) },
                 { ...right(t), on: mark(i, 'turn') }, { ...pause(), on: mark(i, 'pause', true) });
    }
    return steps;
  }

  // ---- 그림: 지나간 길(오른쪽 회전) ----
  let anim = null, cvKey = '';
  let cvCfg = null;                            // { n, turn, name }
  function setCanvas(cfg) {
    const key = cfg ? cfg.n + '/' + cfg.turn : '';
    if (key !== cvKey && !busy) { anim = null; cvKey = key; }
    cvCfg = cfg;
  }
  function drawCanvas() {
    const cv = $('cv');
    if (!cv || !cvCfg) return;
    const g = cv.getContext('2d'), W = cv.width, { n, turn } = cvCfg;
    g.clearRect(0, 0, W, W);
    const pts = [[0, 0]];
    let h = 90, x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += Math.cos(h * Math.PI / 180); y += Math.sin(h * Math.PI / 180); pts.push([x, y]); h -= turn; }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = (W - 150) / Math.max(maxX - minX, maxY - minY, 1);
    const ox = (W - (maxX - minX) * sc) / 2 - minX * sc, oy = (W + (maxY - minY) * sc) / 2 + minY * sc;
    const P = (p) => [ox + p[0] * sc, oy - p[1] * sc];
    g.setLineDash([8, 8]); g.strokeStyle = '#e6dccd'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
    g.setLineDash([]);
    let k = 0, f = 0, head = 90;
    if (anim) {
      if (anim.end) { k = n; head = 90 - turn * n; }
      else {
        const p = anim.p != null ? anim.p : Math.min(1, (performance.now() - anim.t0) / anim.ms);
        k = anim.k; head = 90 - turn * k;
        if (anim.kind === 'move') f = p;
        else { f = 1; if (anim.kind === 'turn') head -= turn * p; else if (anim.after) head -= turn; }
      }
    }
    const cur = k < n ? [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f] : pts[n];
    if (anim) {
      g.strokeStyle = '#1fb5ad'; g.lineWidth = 8;
      g.beginPath(); for (let i = 0; i <= Math.min(k, n); i++) { const [a, b] = P(pts[i]); i ? g.lineTo(a, b) : g.moveTo(a, b); }
      { const [a, b] = P(cur); g.lineTo(a, b); } g.stroke();
    }
    { const [a, b] = P(pts[0]); g.fillStyle = '#ffb23e'; g.beginPath(); g.arc(a, b, 10, 0, 7); g.fill(); }
    const [rx, ry] = P(cur);
    g.save(); g.translate(rx, ry); g.rotate(-head * Math.PI / 180);
    g.fillStyle = '#ff7a86'; g.beginPath(); g.moveTo(24, 0); g.lineTo(-15, -15); g.lineTo(-15, 15); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#3a3230'; g.font = '700 28px Esamanru, sans-serif'; g.fillText(cvCfg.name, 18, 40);
  }
  function loop() { if (anim && !anim.end && anim.p == null) drawCanvas(); requestAnimationFrame(loop); }
  const canvasPanel = () => `<div class="panel"><canvas id="cv" width="600" height="600"></canvas>
    <p class="guide" style="margin:10px 0 0">● 출발점 · 로봇이 지나간 길</p></div>`;

  // ---- 문제(공통): 오답 2회 → 도움 보기, 3회 → 정답 표시 후 진행 ----
  function qSpec(key) {
    const [a, b] = key.split('.');
    if (a === 'm1') {
      const M = { in3: [60, '정삼각형 한 내각 = 180° − 도는 각 120° = 60°'], in6: [120, '정육각형 한 내각 = 180° − 도는 각 60° = 120°'],
                  sum: [180, '한 내각 + 도는 각 = 곧은 선 = 180°'] };
      return { Q: m1q(b), ans: M[b][0], tol: 0, help: M[b][1], show: M[b][0] };
    }
    const c = SHAPES[a], s = sh(a), laps = c.laps || 1;
    if (b === 'angle') return { Q: s.q.angle, ans: c.turn, tol: 0, show: c.turn + '°',
      help: laps > 1 ? `별은 두 바퀴(720°) 돌아요 → 720° ÷ 꼭짓점 ${c.n}개 = ${c.turn}°` : `한 바퀴 360° ÷ 꼭짓점 ${c.n}개 = ${c.turn}°` };
    if (b === 'div') return { Q: s.q.div, ans: c.n, tol: 0, show: c.n, help: `꼭짓점 ${c.n}개에서 나눠서 돌아요 → ÷ ${c.n}` };
    const ex = turnTime(a);
    return { Q: s.q.time, ans: ex, tol: TIME_TOL, show: round2(ex) + '초',
      help: laps > 1 ? `두 바퀴 시간 ÷ ${c.n} = ${fmtT(st.T)} × 2 ÷ ${c.n} = ${round2(ex)}초` : `한 바퀴 시간 ÷ ${c.n} = ${fmtT(st.T)} ÷ ${c.n} = ${round2(ex)}초` };
  }
  function qHTML(key, text, unit) {
    const { Q, help, show } = qSpec(key);
    return `<div class="q ${Q.ok ? 'ok' : ''}"><div class="qt">${text}</div>
      <div class="row"><input class="num" id="in-${key}" inputmode="decimal" autocomplete="off" value="${Q.ok ? Q.val : ''}" ${Q.ok ? 'disabled' : ''} data-enter="check" data-key="${key}"> ${unit}
      ${Q.ok ? '' : `<button class="btn" data-act="check" data-key="${key}">확인</button>`}
      ${!Q.ok && Q.w >= 2 && !Q.help ? `<button class="btn ghost" data-act="help" data-key="${key}">도움 보기</button>` : ''}</div>
      <div class="fb ${Q.ok ? 'yes' : 'no'}">${Q.ok ? (Q.rev ? '정답: ' + show : '정답!') : (Q.w ? '다시! (' + Q.w + '번)' : '')}</div>
      ${Q.help || Q.rev ? `<div class="help">${help}</div>` : ''}</div>`;
  }
  function check(key) {
    const { Q, ans, tol } = qSpec(key);
    if (Q.ok) return;
    const v = num($('in-' + key).value);
    if (!Number.isFinite(v)) { toast('숫자를 입력해요'); return; }
    if (Math.abs(v - ans) <= tol + 1e-9) { Q.ok = true; Q.val = String(v); }
    else if (++Q.w >= 3) { Q.ok = true; Q.rev = true; Q.val = String(round2(ans)); }
    commit();
  }

  // ---- 도형 미션(공통): 도는 각 → (÷ 몇) → 도는 시간 → 빈칸 코드 → 주행 → 별점 ----
  function syncT(id) {
    const s = sh(id);
    if (s.Tused === st.T) return;
    s.Tused = st.T;
    if (s.q.time.ok || s.tt !== '') { s.q.time = newQ(); s.tt = ''; s.ran = false; }
  }
  function codeState(id) {
    const c = SHAPES[id], s = sh(id);
    const repOk = String(s.rep).trim() !== '' && num(s.rep) === c.n;
    const tt = num(s.tt), ttOk = Number.isFinite(tt) && Math.abs(tt - turnTime(id)) <= TIME_TOL + 1e-9;
    let hint = '';
    if (String(s.rep).trim() !== '' && !repOk) hint = '변이 몇 개?';
    else if (String(s.tt).trim() !== '' && !ttOk) hint = '도는 시간 = 위에서 구한 값';
    return { ready: repOk && ttOk, hint };
  }
  function shapeHTML(id) {
    const c = SHAPES[id], s = sh(id);
    syncT(id);
    let h = `<h2>${c.name}</h2><p class="guide">로봇은 꼭짓점에서 <b>오른쪽</b>으로 돌아요.</p>`;
    h += qHTML(id + '.angle', `${c.name} 꼭짓점에서 로봇이 도는 각은?`, '°');
    if (!s.q.angle.ok) return h;
    if (c.div) { h += qHTML(id + '.div', '한 번 도는 시간 = 한 바퀴 시간 ÷ (  )', ''); if (!s.q.div.ok) return h; }
    h += qHTML(id + '.time', `한 번 도는 시간은? <span style="color:var(--mut);font-weight:500">(한 바퀴 ${fmtT(st.T)}초)</span>`, '초');
    if (!s.q.time.ok) return h;
    const cs = codeState(id);
    h += `<div class="code">
      <div class="blk start">▶ 시작</div>
      <div class="blk rep"><input class="num sm" id="rep-${id}" value="${s.rep}" inputmode="numeric" autocomplete="off" data-code="rep" data-id="${id}"> 번 반복</div>
      <div class="inner">
        <div class="blk fw">앞으로 <select data-code="L" data-id="${id}">${L_CHOICES.map(v => `<option value="${v}" ${v === s.L ? 'selected' : ''}>${v.toFixed(1)}</option>`).join('')}</select> 초</div>
        <div class="blk tr">오른쪽 돌기 <input class="num sm" id="tt-${id}" value="${s.tt}" inputmode="decimal" autocomplete="off" data-code="tt" data-id="${id}"> 초</div>
      </div></div>
      <div class="fb no" id="hint-${id}">${cs.hint}</div>
      <div class="row"><button class="btn mint big" id="drive-${id}" data-act="drive" data-id="${id}" ${cs.ready && !busy ? '' : 'disabled'}>주행 ▶</button></div>`;
    if (!s.ran) return h;
    h += `<div class="q"><div class="qt">출발점에서 얼마나 떨어졌나요?</div><div class="stars">
      ${[[3, '★★★ 한 뼘 안'], [2, '★★ 두 뼘 안'], [1, '★ 그 밖']].map(([v, t]) => `<button class="pick ${s.star === v ? 'sel' : ''}" data-act="star" data-id="${id}" data-v="${v}">${t}</button>`).join('')}</div></div>`;
    if (s.star) h += `<div class="note">도는 각 합 ${c.turn}° × ${c.n} = ${c.turn * c.n}° → ${c.laps ? '두 바퀴' : '한 바퀴'} → 출발점</div>`;
    if (s.star === 1) h += `<div class="row"><button class="btn sun" data-act="goto" data-v="s2">한 바퀴 시간 다시 맞추기</button></div>`;
    return h;
  }
  async function drive(id) {
    const c = SHAPES[id], s = sh(id);
    if (!codeState(id).ready) return;
    setCanvas({ n: c.n, turn: c.turn, name: c.name });
    const ok = await run(polySteps(c.n, s.L, num(s.tt)));
    if (ok) { anim = { end: true }; s.ran = true; commit(); }
  }

  // ---- 화면 ----
  const nextBtn = (k) => `<div class="next"><button class="btn mint big" data-act="goto" data-v="s${k + 1}" ${st.done['s' + k] ? '' : 'disabled'}>다음 ▶</button></div>`;
  const unlocked = (k) => k === 1 || !!st.done['s' + (k - 1)];

  function viewStart() {
    return `<div class="panel" style="max-width:780px;margin:0 auto">
      <h2>모둠 번호</h2><p class="guide">로봇 번호 스티커 = 모둠 번호</p>
      <div class="teams">${Array.from({ length: 25 }, (_, i) => i + 1).map(n => `<button class="pick ${st.team === n ? 'sel' : ''}" data-act="team" data-v="${n}">${n}</button>`).join('')}</div>
      <h2>학년</h2>
      <div class="row">${Object.entries(GRADES).map(([k, v]) => `<button class="pick ${st.grade === k ? 'sel' : ''}" data-act="grade" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="next"><button class="btn mint big" data-act="begin" ${st.team && st.grade ? '' : 'disabled'}>시작 ▶</button></div></div>`;
  }
  function viewS1() {
    const s = st.s1, all = PARTS.every((_, i) => s.checks.includes(i));
    let h = `<div class="panel" style="max-width:900px;margin:0 auto"><h2>① 조립</h2>
      <p class="guide">부품을 찾아 모두 체크</p>
      <div class="checks">${PARTS.map((p, i) => `<label class="${s.checks.includes(i) ? 'on' : ''}" data-act="part" data-v="${i}"><input type="checkbox" tabindex="-1" ${s.checks.includes(i) ? 'checked' : ''} style="pointer-events:none"> ${p}</label>`).join('')}</div>`;
    if (all) {
      const p = PHOTOS[s.photo];
      h += `<h2 style="margin-top:18px">조립 순서 <span style="color:var(--mut);font-size:1rem">${s.photo + 1} / ${PHOTOS.length}</span></h2>
        <div class="photo"><img src="${p.src}" alt="${p.cap}" onerror="this.replaceWith(document.createTextNode('사진 준비 중 · ${p.cap}'))"></div>
        <div class="row" style="justify-content:space-between"><button class="btn ghost" data-act="photo" data-v="-1" ${s.photo ? '' : 'disabled'}>◀ 이전</button>
          <b>${p.cap}</b><button class="btn ghost" data-act="photo" data-v="1" ${s.photo < PHOTOS.length - 1 ? '' : 'disabled'}>다음 ▶</button></div>`;
    }
    if (all && s.seen) {
      h += `<div class="q"><div class="qt">바퀴 시험 — 1초 앞으로</div>
        <div class="row"><button class="btn mint big" data-act="wheel" ${busy ? 'disabled' : ''}>바퀴 시험 ▶</button></div>
        ${s.wheel ? `<div class="qt">앞으로 갔나요?</div><div class="row">
          <button class="pick ${s.wheel === 'yes' ? 'sel' : ''}" data-act="wheelAns" data-v="yes">예</button>
          <button class="pick ${s.wheel === 'no' ? 'sel' : ''}" data-act="wheelAns" data-v="no">아니요</button></div>` : ''}
        ${s.wheel === 'no' ? '<div class="help">모터 선 좌우 바꾸기 · 선생님 부르기</div>' : ''}</div>`;
    }
    return h + nextBtn(1) + '</div>';
  }
  function viewS2() {
    return `<div class="panel" style="max-width:820px;margin:0 auto"><h2>② 한 바퀴 시간</h2>
      <p class="guide">출발 표시에 로봇 앞을 맞추고 [제자리 한 바퀴]</p>
      <div class="row" style="justify-content:center">
        <button class="btn ghost" data-act="adj" data-v="-0.5">−0.5</button><button class="btn ghost" data-act="adj" data-v="-0.1">−0.1</button>
        <span class="tval">${fmtT(st.Ttry)}</span>초
        <button class="btn ghost" data-act="adj" data-v="0.1">+0.1</button><button class="btn ghost" data-act="adj" data-v="0.5">+0.5</button></div>
      <div class="row" style="justify-content:center"><button class="btn mint big" data-act="spin" ${busy ? 'disabled' : ''}>제자리 한 바퀴 ↻</button></div>
      ${st.spun ? `<div class="q" style="text-align:center"><div class="qt">어땠나요?</div><div class="row" style="justify-content:center">
        <button class="pick" data-act="judge" data-v="less">덜 돎</button><button class="pick" data-act="judge" data-v="ok">딱 맞음</button>
        <button class="pick" data-act="judge" data-v="more">더 돎</button></div></div>` : ''}
      <div class="fb yes" style="text-align:center">${st.s2msg}</div>
      ${st.T ? `<div class="note" style="text-align:center;font-size:1.3rem">우리 로봇 한 바퀴 = ${fmtT(st.T)}초</div>` : ''}
      ${nextBtn(2)}</div>`;
  }
  function viewS3() {
    setCanvas({ n: 4, turn: 90, name: '정사각형' });
    return `<div class="grid2"><div class="panel">${shapeHTML('sq')}${nextBtn(3)}</div>${canvasPanel()}</div>`;
  }
  function viewS4() {
    const s = st.s4, subs = [['exp', '실험'], ['tri', '정삼각형'], ['hex', '정육각형'], ['sum', '정리']];
    const open = { exp: true, tri: !!s.result, hex: sh('tri').star > 0, sum: sh('hex').star > 0 };
    if (!open[s.sub]) s.sub = 'exp';
    let h = `<div class="subtabs">${subs.map(([k, t]) => `<button class="pick ${s.sub === k ? 'sel' : ''} ${open[k] ? '' : 'lock'}" data-act="sub" data-v="${k}">${open[k] ? '' : '🔒 '}${t}</button>`).join('')}</div>`;
    if (s.sub === 'exp') {
      setCanvas({ n: 3, turn: 60, name: '60°씩 3번' });
      h += `<h2>실험</h2><div class="q"><div class="qt">정삼각형 한 각 = 60°. 60°씩 3번 돌면?</div><div class="row">
        ${[['tri', '정삼각형'], ['other', '다른 모양']].map(([k, t]) => `<button class="pick ${s.pred === k ? 'sel' : ''}" data-act="pred" data-v="${k}">${t}</button>`).join('')}</div></div>`;
      if (s.pred) h += `<div class="row"><button class="btn mint big" data-act="exp" ${busy ? 'disabled' : ''}>60°씩 3번 주행 ▶</button></div>`;
      if (s.expRan) h += `<div class="q"><div class="qt">결과는?</div><div class="row">
        ${[['closed', '닫힘'], ['open', '안 닫힘']].map(([k, t]) => `<button class="pick ${s.result === k ? 'sel' : ''}" data-act="result" data-v="${k}">${t}</button>`).join('')}</div></div>`;
      if (s.result) h += `<div class="note">로봇이 도는 각 = 바깥쪽 각(외각)<br>60°씩 3번 = 180° → 반 바퀴 → 안 닫힘</div>
        <div class="row"><button class="btn mint" data-act="sub" data-v="tri">정삼각형 ▶</button></div>`;
    } else if (s.sub === 'tri' || s.sub === 'hex') {
      const c = SHAPES[s.sub];
      setCanvas({ n: c.n, turn: c.turn, name: c.name });
      h += shapeHTML(s.sub);
      if (sh(s.sub).star) h += `<div class="row"><button class="btn mint" data-act="sub" data-v="${s.sub === 'tri' ? 'hex' : 'sum'}">${s.sub === 'tri' ? '정육각형' : '정리'} ▶</button></div>`;
    } else {
      setCanvas({ n: 6, turn: 60, name: '정육각형' });
      if (!s.sumSeen) { s.sumSeen = true; updateDone(); save(); }
      h += `<h2>정리</h2><div class="note" style="font-size:1.2rem;line-height:1.8">한 번에 도는 각 = 360° ÷ 꼭짓점 수<br>한 번 도는 시간 = 한 바퀴 시간 ÷ 꼭짓점 수</div>`;
      if (st.grade === 'm1') {
        h += qHTML('m1.in3', '정삼각형 한 내각은?', '°');
        if (m1q('in3').ok) h += qHTML('m1.in6', '정육각형 한 내각은?', '°');
        if (m1q('in6').ok) h += qHTML('m1.sum', '한 내각 + 도는 각 = ?', '°');
      }
    }
    return `<div class="grid2"><div class="panel">${h}${nextBtn(4)}</div>${canvasPanel()}</div>`;
  }
  function viewS5() {
    const g = st.grade || 'e5';
    return `<div class="cards" style="max-width:900px;margin:0 auto">
      <button class="card" style="border-color:#ffd0d5" onclick="location.href='drive.html?mode=tag&grade=${g}'"><div style="font-size:3rem">🏃</div><h3>술래잡기</h3><p>잡히면 문제 풀고 부활</p></button>
      <button class="card" style="border-color:#b9ecdc" onclick="location.href='drive.html?mode=relay&grade=${g}'"><div style="font-size:3rem">🏁</div><h3>이어달리기</h3><p>기다리며 각도 문제 → 출발 속도</p></button>
      ${st.done.s4 ? `<button class="card" style="border-color:#e2d4ff" data-act="goto" data-v="adv"><div style="font-size:3rem">⭐</div><h3>심화</h3><p>먼저 끝난 모둠</p></button>` : ''}</div>`;
  }
  let reviewP = null, reviewNext = null, reviewW = 0;
  function viewAdv() {
    if (!st.done.s4) return `<div class="panel" style="max-width:600px;margin:0 auto"><h2>🔒 심화</h2><p class="guide">④ 삼각·육각을 마치면 열려요.</p></div>`;
    const a = st.adv;
    if (!reviewNext) { reviewNext = AP.picker(st.grade); reviewP = reviewNext(); reviewW = 0; }
    const doneList = [...CARDS, 'star'].filter(id => st.shapes[id] && st.shapes[id].star);
    let h = `<h2>심화</h2><div class="row">
      <button class="btn sun big" data-act="draw" ${busy ? 'disabled' : ''}>미션 카드 뽑기 🎴</button>
      <button class="btn big" style="background:var(--grape)" data-act="card" data-v="star" ${busy ? 'disabled' : ''}>오각별 ★</button>
      <a class="btn ghost" href="blocks.html" style="text-decoration:none">블록코딩으로 만들기</a></div>
      ${doneList.length ? `<p class="guide">완성: ${doneList.map(id => SHAPES[id].name + ' ' + '★'.repeat(st.shapes[id].star)).join(' · ')}</p>` : ''}`;
    if (a.card) { const c = SHAPES[a.card]; setCanvas({ n: c.n, turn: c.turn, name: c.name }); h += shapeHTML(a.card); }
    else setCanvas(null);
    const rv = `<div class="panel" style="margin-top:18px"><h2>복습 문제 <span style="color:var(--mut);font-size:1rem">맞힌 수 ${a.review}</span></h2>
      <div class="q"><div class="qt">${reviewP.q}</div><div class="row"><input class="num" id="in-review" inputmode="numeric" autocomplete="off" data-enter="review">
      <button class="btn" data-act="review">확인</button></div><div class="fb no">${reviewW >= 3 ? '' : reviewW ? '다시!' : ''}</div></div></div>`;
    return a.card ? `<div class="grid2"><div><div class="panel">${h}</div>${rv}</div>${canvasPanel()}</div>`
                  : `<div style="max-width:820px;margin:0 auto"><div class="panel">${h}</div>${rv}</div>`;
  }

  function updateDone() {
    const d = st.done;
    if (st.s1.wheel === 'yes') d.s1 = true;
    if (sh('sq').star > 0) d.s3 = true;
    if (st.s4.sumSeen && (st.grade !== 'm1' || ['in3', 'in6', 'sum'].every(k => m1q(k).ok))) d.s4 = true;
  }
  function commit() { updateDone(); save(); render(); }

  function renderBar() {
    const v = st.view;
    $('bar').innerHTML = STAGES.map(([k, t]) => {
      const lock = !unlocked(k);
      return `<button class="st ${v === 's' + k ? 'cur' : ''} ${lock ? 'lock' : ''}" data-stage="${k}">${lock ? '🔒 ' : ''}${t}${st.done['s' + k] ? ' <span class="ck">✓</span>' : ''}</button>`;
    }).join('');
    $('advBtn').textContent = st.done.s4 ? '심화 ★' : '🔒 심화';
    $('advBtn').classList.toggle('sel', v === 'adv');
  }
  function render() {
    const started = st.view !== 'start';
    $('barWrap').classList.toggle('hidden', !started);
    $('teamChip').classList.toggle('hidden', !st.team);
    $('teamChip').textContent = st.team ? `${st.team}모둠 · ${GRADES[st.grade] || ''}` : '';
    $('tBadge').classList.toggle('hidden', !st.T || !started);
    $('tBadge').textContent = st.T ? `우리 로봇 한 바퀴 = ${fmtT(st.T)}초` : '';
    const V = { start: viewStart, s1: viewS1, s2: viewS2, s3: viewS3, s4: viewS4, s5: viewS5, adv: viewAdv };
    cvCfg = null;
    $('view').innerHTML = V[st.view]();
    if (started) renderBar();                  // 화면을 그리며 완료 상태가 바뀔 수 있어 표시줄은 나중에
    drawCanvas();
  }

  function goto(v) {
    if (busy) stopRun();
    const k = +String(v).replace('s', '');
    if (v === 'adv' ? !st.done.s4 : (k && !unlocked(k))) return;
    st.view = v; save(); render(); window.scrollTo(0, 0);
  }
  // 해설사 건너뛰기: 현재 단계 완료 처리(학생 안내 문구 없음)
  function skipStage() {
    const v = st.view;
    if (v === 's2' && !st.T) st.T = st.Ttry;
    if (/^s[1-4]$/.test(v)) { st.done[v] = true; save(); render(); }
  }

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1500); }

  function recordHTML() {
    let relay = null;
    try { relay = JSON.parse(localStorage.getItem(RELAY_KEY) || 'null'); } catch (e) {}
    const stars = (id) => st.shapes[id] && st.shapes[id].star ? '★'.repeat(st.shapes[id].star) : '–';
    const rows = [['모둠', st.team ? st.team + '모둠' : '–'], ['학년', GRADES[st.grade] || '–'], ['한 바퀴 시간', st.T ? fmtT(st.T) + '초' : '–'],
      ['완료 단계', STAGES.filter(([k]) => st.done['s' + k]).map(([, t]) => t).join(' ') || '–'],
      ['정사각형', stars('sq')], ['정삼각형', stars('tri')], ['정육각형', stars('hex')],
      ...[...CARDS, 'star'].filter(id => st.shapes[id] && st.shapes[id].star).map(id => [SHAPES[id].name, stars(id)]),
      ['복습 문제 정답', st.adv.review], ['이어달리기 정답 수', relay && relay.total != null ? relay.total : '–']];
    return `<table class="rec">${rows.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table>`;
  }

  // ---- 동작 ----
  const ACT = {
    team: (d) => { st.team = +d.v; save(); render(); },
    grade: (d) => { st.grade = d.v; reviewNext = null; save(); render(); },
    begin: () => { const k = [1, 2, 3, 4].find(i => !st.done['s' + i]) || 5; st.view = 's' + k; save(); render(); },
    goto: (d) => goto(d.v),
    part: (d) => { const i = +d.v, c = st.s1.checks; c.includes(i) ? c.splice(c.indexOf(i), 1) : c.push(i); save(); render(); },
    photo: (d) => { st.s1.photo = Math.max(0, Math.min(PHOTOS.length - 1, st.s1.photo + +d.v)); if (st.s1.photo === PHOTOS.length - 1) st.s1.seen = true; save(); render(); },
    wheel: async () => { if (await run([fwd(1)])) { if (!st.s1.wheel) st.s1.wheel = 'asked'; commit(); } },
    wheelAns: (d) => { st.s1.wheel = d.v; commit(); },
    adj: (d) => { st.Ttry = clampT(st.Ttry + parseFloat(d.v)); st.s2msg = ''; save(); render(); },
    spin: async () => { st.s2msg = ''; if (await run([right(st.Ttry)])) { st.spun = true; commit(); } },
    judge: (d) => {
      if (d.v === 'ok') { st.T = st.Ttry; st.done.s2 = true; st.s2msg = '저장!'; }
      else { st.Ttry = clampT(st.Ttry + (d.v === 'less' ? T_SUGGEST : -T_SUGGEST)); st.s2msg = `${fmtT(st.Ttry)}초로 바꿨어요 → 다시 [제자리 한 바퀴]`; }
      st.spun = false; commit();
    },
    check: (d) => check(d.key),
    help: (d) => { qSpec(d.key).Q.help = true; save(); render(); },
    drive: (d) => drive(d.id),
    star: (d) => { sh(d.id).star = +d.v; commit(); },
    sub: (d, el) => { if (el.classList.contains('lock')) return; if (busy) stopRun(); st.s4.sub = d.v; save(); render(); },
    pred: (d) => { st.s4.pred = d.v; save(); render(); },
    exp: async () => {
      setCanvas({ n: 3, turn: 60, name: '60°씩 3번' });
      if (await run(polySteps(3, 1.0, st.T / 6))) { anim = { end: true }; st.s4.expRan = true; commit(); }
    },
    result: (d) => { st.s4.result = d.v; commit(); },
    draw: () => {
      const left = CARDS.filter(id => !(st.shapes[id] && st.shapes[id].star) && id !== st.adv.card);
      const pool = left.length ? left : CARDS.filter(id => id !== st.adv.card);
      st.adv.card = pool[Math.floor(Math.random() * pool.length)]; anim = null; save(); render();
    },
    card: (d) => { st.adv.card = d.v; anim = null; save(); render(); },
    review: () => {
      const v = num($('in-review').value);
      if (!Number.isFinite(v)) { toast('숫자를 입력해요'); return; }
      if (v === reviewP.a) { st.adv.review++; toast('정답! ⭐'); reviewP = reviewNext(); reviewW = 0; save(); }
      else if (++reviewW >= 3) { toast(`정답은 ${reviewP.a}`); reviewP = reviewNext(); reviewW = 0; }
      render(); const el = $('in-review'); if (el) el.focus();
    },
  };

  function init() {
    load();
    NB.mountConnectButton($('nbConn'));
    const view = $('view');
    view.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      e.preventDefault();
      ACT[b.dataset.act](b.dataset, b);
    });
    // 빈칸 코드 입력: 다시 그리지 않고 상태만 갱신(입력 중 포커스 유지)
    const onCode = (e) => {
      const el = e.target, k = el.dataset.code;
      if (!k) return;
      const s = sh(el.dataset.id);
      if (k === 'L') s.L = parseFloat(el.value); else s[k] = el.value;
      save();
      const cs = codeState(el.dataset.id);
      $('hint-' + el.dataset.id).textContent = cs.hint;
      $('drive-' + el.dataset.id).disabled = !cs.ready || busy;
    };
    view.addEventListener('input', onCode);
    view.addEventListener('change', onCode);
    view.addEventListener('keydown', (e) => {
      const el = e.target;
      if (e.key !== 'Enter' || !el.dataset || !el.dataset.enter) return;
      e.preventDefault();
      if (el.dataset.enter === 'check') check(el.dataset.key); else ACT.review();
    });

    // 단계 표시줄: 클릭 = 이동, 2초 길게 누르기 = 해설사 건너뛰기
    const bar = $('bar');
    let lpTimer = null, suppress = false;
    bar.addEventListener('pointerdown', () => { suppress = false; clearTimeout(lpTimer); lpTimer = setTimeout(() => { suppress = true; skipStage(); }, 2000); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => bar.addEventListener(t, () => clearTimeout(lpTimer)));
    bar.addEventListener('contextmenu', e => e.preventDefault());
    bar.addEventListener('click', (e) => {
      if (suppress) { suppress = false; return; }
      const b = e.target.closest('[data-stage]');
      if (b) goto('s' + b.dataset.stage);
    });
    $('advBtn').onclick = () => goto('adv');
    const openRec = () => { $('recBody').innerHTML = recordHTML(); $('recModal').classList.remove('hidden'); };
    $('recBtn').onclick = openRec; $('teamChip').onclick = openRec;
    $('recClose').onclick = () => $('recModal').classList.add('hidden');
    $('recReset').onclick = () => {
      if (!confirm('이 노트북의 모둠 기록을 모두 지우고 처음부터 시작할까요?')) return;
      stopRun();
      try { [SAVE_KEY, RELAY_KEY, 'neobot-drive-v1'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
      st = fresh(); reviewNext = null; anim = null;
      $('recModal').classList.add('hidden'); render();
    };
    $('stopBig').onclick = stopRun;
    document.addEventListener('keydown', (e) => { if (busy && (e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); stopRun(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopRun(); });
    render();
    requestAnimationFrame(loop);
  }
  init();

  // 테스트용
  window.__mission = { get st() { return st; }, turnTime, stopRun, skipStage, get busy() { return busy; }, get review() { return reviewP; } };
})();
