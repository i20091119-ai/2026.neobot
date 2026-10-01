// 정다각형 미션 — 바퀴 회전 센서가 없으므로 거리·각도를 '시간'으로 제어하고, 그 계산을 수학 활동으로 삼음
//   ① 거리 재기: 시간별 주행 → 잰 거리 입력 → 표·그래프(정비례), 1초당 거리
//   ② 목표 정차: 목표 거리 ÷ 1초당 거리 = 주행 시간(계산이 맞아야 출발)
//   ③ 회전 맞추기: 한 바퀴(360°) 시간 찾기 → 90° 시간 계산
//   ④ 정다각형: 외각(360 ÷ n)을 맞혀야 주행 열림, 오각별(144°) 심화
'use strict';
(function () {
  const NB = window.Neobot;
  const $ = (id) => document.getElementById(id);

  // ---- 현장 조절값 ----
  const SPEEDS = [6, 8, 10, 12];               // 직진 속도(모터 0~15)
  const TURN_SPEEDS = [4, 6, 8];               // 제자리 회전 속도(느릴수록 정확)
  const TIMES = [1, 2, 3, 4];                  // ① 측정 시간(초)
  const TARGETS = [20, 30, 40, 50, 60];        // ② 목표 거리(cm)
  const SIDES = [20, 30, 40];                  // ④ 한 변(cm)
  const PAUSE_MS = 300;                        // 직진·회전 사이 멈춤(미끄러짐 줄이기)
  const SHAPES = [
    { id: '3', n: 3, name: '정삼각형', turn: 120 },
    { id: '4', n: 4, name: '정사각형', turn: 90 },
    { id: '5', n: 5, name: '정오각형', turn: 72 },
    { id: '6', n: 6, name: '정육각형', turn: 60 },
    { id: 'star', n: 5, name: '★ 오각별', turn: 144, star: true },
  ];
  const SAVE_KEY = 'neobot-polygon-v1';

  const st = { step: 1, sp: 8, tsp: 6, t: 2, meas: [], target: 30, solved2: false,
               try360: 3.0, t360: 0, solved3: false, shape: '4', side: 30, unlocked: [], done: [] };

  const round1 = (v) => Math.round(v * 10) / 10;
  const num = (s) => parseFloat(String(s).replace(',', '.').trim());
  // 원점을 지나는 직선(정비례)으로 맞춘 1초당 거리, 화면에 보이는 소수 첫째 자리 값으로 계산을 통일
  function rate() {
    if (!st.meas.length) return 0;
    let td = 0, tt = 0;
    st.meas.forEach(m => { td += m.t * m.d; tt += m.t * m.t; });
    return round1(td / tt);
  }
  const turnSec = (deg) => st.t360 * deg / 360;
  const shape = () => SHAPES.find(s => s.id === st.shape) || SHAPES[1];

  // ---- 저장 ----
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {} }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!o) return;
      const pick = (v, list, d) => list.includes(v) ? v : d;
      st.step = pick(o.step, [1, 2, 3, 4], 1);
      st.sp = pick(o.sp, SPEEDS, st.sp); st.tsp = pick(o.tsp, TURN_SPEEDS, st.tsp);
      st.t = pick(o.t, TIMES, st.t); st.target = pick(o.target, TARGETS, st.target); st.side = pick(o.side, SIDES, st.side);
      st.shape = pick(o.shape, SHAPES.map(s => s.id), st.shape);
      if (Array.isArray(o.meas)) st.meas = o.meas.filter(m => m && TIMES.includes(m.t) && m.d > 0 && m.d < 1000).slice(0, 20);
      st.solved2 = !!o.solved2; st.solved3 = !!o.solved3;
      if (o.try360 > 0 && o.try360 <= 20) st.try360 = round1(o.try360);
      if (o.t360 > 0 && o.t360 <= 20) st.t360 = round1(o.t360);
      const ids = SHAPES.map(s => s.id);
      if (Array.isArray(o.unlocked)) st.unlocked = o.unlocked.filter(x => ids.includes(x));
      if (Array.isArray(o.done)) st.done = o.done.filter(x => ids.includes(x));
    } catch (e) {}
  }

  // ---- 실행 엔진: 단계 목록을 시간대로 실행, 정지 = runId 증가 ----
  let runId = 0, busy = false;
  class Stopped extends Error {}
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function hold(ms, id) {
    const end = performance.now() + ms;
    for (;;) {
      if (id !== runId) throw new Stopped();
      const left = end - performance.now();
      if (left <= 0) return;
      await sleep(Math.min(16, left));
    }
  }
  // steps: [{ l, r, ms, on?() }]
  async function run(steps, busyEl, label) {
    if (busy) return false;
    if (!NB.connected) toast('로봇이 연결되지 않았어요 (화면만 움직여요)');
    const id = ++runId; busy = true; busyEl.textContent = label; render();
    let finished = false;
    try {
      for (const s of steps) { NB.setMotors(s.l, s.r); if (s.on) s.on(s); await hold(s.ms, id); }
      finished = true;
    } catch (e) { if (!(e instanceof Stopped)) throw e; }
    finally {
      NB.setMotors(0, 0);
      if (id === runId) { busy = false; busyEl.textContent = ''; render(); }
    }
    return finished;
  }
  function stopAll() {
    runId++; busy = false; NB.setMotors(0, 0);
    document.querySelectorAll('.busy').forEach(el => el.textContent = '');
    render();
  }
  const fwd = (sec) => ({ l: st.sp, r: st.sp, ms: Math.round(sec * 1000) });
  const left = (sec) => ({ l: -st.tsp, r: st.tsp, ms: Math.round(sec * 1000) });   // 반시계(왼쪽) 제자리 회전
  const pause = () => ({ l: 0, r: 0, ms: PAUSE_MS });

  // ---- 공통 UI ----
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1500); }
  function picks(box, list, cur, label, onPick, doneList) {
    box.innerHTML = '';
    list.forEach(v => {
      const b = document.createElement('button');
      const key = typeof v === 'object' ? v.id : v;
      b.className = 'pick' + (key === cur ? ' sel' : '') + (doneList && doneList.includes(key) ? ' done' : '');
      b.textContent = label(v);
      b.onclick = () => { if (!busy) onPick(key); };
      box.appendChild(b);
    });
  }
  function fb(el, ok, msg) { el.className = 'fb ' + (ok ? 'yes' : 'no'); el.textContent = msg; }
  const wrong = { m2: 0, m3: 0, m4: 0 };

  // ---- ① 거리 재기 ----
  let lastRunT = 0;
  function renderStep1() {
    picks($('spPicks'), SPEEDS, st.sp, v => v, v => {
      if (v === st.sp) return;
      if (st.meas.length && !confirm('속도를 바꾸면 거리가 달라져요. 기록을 지우고 다시 잴까요?')) return;
      st.sp = v; st.meas = []; st.solved2 = false; save(); render();
    });
    picks($('tPicks'), TIMES, st.t, v => v + '초', v => { st.t = v; save(); render(); });
    $('m1Go').disabled = busy;
    $('m1Table').innerHTML = st.meas.map((m, i) =>
      `<tr><td>${m.t}</td><td>${m.d}</td><td>${round1(m.d / m.t)}</td><td><button class="x" data-del="${i}" title="지우기">✕</button></td></tr>`).join('')
      || '<tr><td colspan="4" style="color:var(--mut)">아직 기록이 없어요</td></tr>';
    $('m1Table').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      st.meas.splice(+b.dataset.del, 1); st.solved2 = false; save(); render();
    });
    drawGraph();
    const r = rate();
    $('m1Result').innerHTML = r ? `속도 ${st.sp}에서 1초에 약 <b>${r}</b> cm` : '';
  }
  function drawGraph() {
    const W = 360, H = 260, L = 44, B = 34, T = 12, R = 14;
    const maxT = 4, dMax = Math.max(40, ...st.meas.map(m => m.d), rate() * maxT);
    const step = dMax > 200 ? 50 : dMax > 100 ? 25 : 10;
    const maxD = Math.ceil(dMax / step) * step;
    const x = t => L + (W - L - R) * t / maxT, y = d => H - B - (H - B - T) * d / maxD;
    let s = '';
    for (let d = 0; d <= maxD; d += step) s += `<line x1="${L}" x2="${W - R}" y1="${y(d)}" y2="${y(d)}" stroke="#f0e6d8"/><text x="${L - 6}" y="${y(d) + 4}" text-anchor="end">${d}</text>`;
    for (let t = 0; t <= maxT; t++) s += `<text x="${x(t)}" y="${H - B + 16}" text-anchor="middle">${t}</text>`;
    s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#9b8f86"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#9b8f86"/>`;
    s += `<text x="${W - R}" y="${H - 4}" text-anchor="end">시간(초)</text><text x="${L + 4}" y="${T + 10}">거리(cm)</text>`;
    const r = rate();
    if (r) s += `<line x1="${x(0)}" y1="${y(0)}" x2="${x(maxT)}" y2="${y(r * maxT)}" stroke="#1fb5ad" stroke-width="3" stroke-dasharray="6 5"/>`;
    st.meas.forEach(m => { s += `<circle cx="${x(m.t)}" cy="${y(m.d)}" r="6" fill="#ff7a86"/>`; });
    $('m1Graph').innerHTML = s;
  }
  async function go1() {
    $('m1Ask').classList.add('hidden');
    lastRunT = st.t;
    const ok = await run([fwd(st.t)], $('m1Busy'), `${st.t}초 동안 달리는 중…`);
    if (!ok) return;
    $('m1AskT').textContent = lastRunT + '초';
    $('m1Dist').value = ''; $('m1Fb').textContent = '';
    $('m1Ask').classList.remove('hidden');
    $('m1Dist').focus();
  }
  function save1() {
    const d = round1(num($('m1Dist').value));
    if (!(d > 0 && d < 1000)) { $('m1Fb').textContent = '잰 거리를 숫자로 입력해요 (예: 23.5)'; return; }
    st.meas.push({ t: lastRunT, d }); st.solved2 = false;
    $('m1Ask').classList.add('hidden');
    save(); render();
    toast(`${lastRunT}초 → ${d}cm 기록!`);
  }

  // ---- ② 목표 정차 ----
  function renderStep2() {
    const r = rate();
    $('m2Need').classList.toggle('hidden', !!r);
    $('m2Body').classList.toggle('hidden', !r);
    if (!r) return;
    picks($('dPicks'), TARGETS, st.target, v => v + 'cm', v => {
      st.target = v; st.solved2 = false; $('m2Ans').value = ''; $('m2Fb').textContent = ''; wrong.m2 = 0; save(); render();
    });
    $('m2Rate').textContent = r; $('m2Target').textContent = st.target;
    $('m2Go').disabled = busy || !st.solved2;
  }
  function check2() {
    const v = num($('m2Ans').value), exact = st.target / rate();
    if (!(v > 0)) { fb($('m2Fb'), false, '시간을 숫자로 입력해요 (예: 2.5)'); return; }
    if (Math.abs(v - exact) <= Math.max(0.1, exact * 0.05)) {
      st.solved2 = true; wrong.m2 = 0;
      fb($('m2Fb'), true, `맞아요! ${st.target} ÷ ${rate()} = 약 ${round1(exact)}초`);
    } else {
      st.solved2 = false; wrong.m2++;
      fb($('m2Fb'), false, wrong.m2 >= 2 ? `힌트: 목표 거리 ÷ 1초에 가는 거리 = ${st.target} ÷ ${rate()}` : '다시 계산해 봐요.');
    }
    save(); render();
  }
  function go2() {
    const sec = num($('m2Ans').value);
    if (!(sec > 0 && sec <= 20)) return;
    run([fwd(sec)], $('m2Busy'), `${round1(sec)}초 달리는 중… 멈춘 곳을 자로 재 봐요`);
  }

  // ---- ③ 회전 맞추기 ----
  function renderStep3() {
    picks($('tsPicks'), TURN_SPEEDS, st.tsp, v => v, v => {
      if (v === st.tsp) return;
      if (st.t360 && !confirm('회전 속도를 바꾸면 한 바퀴 시간이 달라져요. 다시 맞출까요?')) return;
      st.tsp = v; st.t360 = 0; st.solved3 = false; save(); render();
    });
    $('m3Try').textContent = st.try360.toFixed(1);
    $('m3Go').disabled = busy; $('m3Set').disabled = busy;
    $('m3Result').innerHTML = st.t360 ? `회전 속도 ${st.tsp}에서 한 바퀴 = <b>${st.t360.toFixed(1)}</b>초` : '';
    $('m3Need').classList.toggle('hidden', !!st.t360);
    $('m3Quiz').classList.toggle('hidden', !st.t360);
    $('m3T360').textContent = st.t360.toFixed(1);
    $('m3Go90').disabled = busy || !st.solved3;
  }
  function check3() {
    const v = num($('m3Ans').value), exact = st.t360 / 4;
    if (!(v > 0)) { fb($('m3Fb'), false, '시간을 숫자로 입력해요'); return; }
    if (Math.abs(v - exact) <= 0.06) {
      st.solved3 = true; wrong.m3 = 0;
      fb($('m3Fb'), true, `맞아요! 90°는 360°의 1/4 → ${st.t360.toFixed(1)} ÷ 4 = ${+exact.toFixed(3)}초`);
    } else {
      st.solved3 = false; wrong.m3++;
      fb($('m3Fb'), false, wrong.m3 >= 2 ? '힌트: 360° ÷ 90° = 4 → 한 바퀴 시간을 4로 나눠요' : '다시 계산해 봐요.');
    }
    save(); render();
  }

  // ---- ④ 정다각형 ----
  function renderStep4() {
    const r = rate(), ready = r && st.t360;
    $('m4Need').classList.toggle('hidden', !!ready);
    $('m4Body').classList.toggle('hidden', !ready);
    $('m4Need').innerHTML = `먼저 ${r ? '' : '<b>① 거리 재기</b> '}${st.t360 ? '' : '<b>③ 회전 맞추기</b> '}를 끝내요.`;
    if (!ready) { drawPolygon(); return; }
    const sh = shape(), open = st.unlocked.includes(sh.id);
    picks($('nPicks'), SHAPES, st.shape, v => v.name, v => {
      st.shape = v; $('m4Ans').value = ''; $('m4Fb').textContent = ''; wrong.m4 = 0; anim = null; save(); render();
    }, st.done);
    picks($('sPicks'), SIDES, st.side, v => v + 'cm', v => { st.side = v; anim = null; save(); render(); });
    $('m4KeyQ').textContent = sh.star
      ? '오각별을 그릴 때 로봇은 꼭짓점에서 몇 도 돌까요? (별을 다 그리면 로봇은 2바퀴, 720° 돌아요)'
      : `${sh.name}을 그릴 때 로봇은 꼭짓점에서 몇 도 돌까요? (다 그리면 로봇은 1바퀴, 360° 돌아요)`;
    $('m4Key').classList.toggle('hidden', open);
    const prog = $('m4Prog');
    prog.classList.toggle('hidden', !open);
    if (open) {
      const fs = round1(st.side / r), ts = turnSec(sh.turn);
      prog.innerHTML = `<b>${sh.n}번 반복하기</b><br>① 앞으로 ${st.side}cm → ${st.side} ÷ ${r} = <b>${fs}초</b><br>` +
        `② 왼쪽으로 ${sh.turn}° → ${st.t360.toFixed(1)} × ${sh.turn}/360 = <b>${ts.toFixed(2)}초</b>`;
    }
    $('m4Go').disabled = busy || !open;
    $('m4Go').textContent = open ? '주행 ▶' : '🔒 주행';
    $('m4Tip').textContent = st.done.length
      ? `완성한 도형: ${SHAPES.filter(s => st.done.includes(s.id)).map(s => s.name).join(', ')}`
      : '로봇이 지나간 길이 그려져요. 실제 로봇 길과 비교해 봐요.';
    drawPolygon();
  }
  function check4() {
    const sh = shape(), v = num($('m4Ans').value);
    if (!Number.isFinite(v)) { fb($('m4Fb'), false, '각도를 숫자로 입력해요'); return; }
    if (Math.abs(v - sh.turn) < 0.5) {
      if (!st.unlocked.includes(sh.id)) st.unlocked.push(sh.id);
      wrong.m4 = 0; toast('🔓 주행이 열렸어요!');
    } else {
      wrong.m4++;
      fb($('m4Fb'), false, wrong.m4 >= 2
        ? (sh.star ? '힌트: 720° ÷ 꼭짓점 5개' : `힌트: 360° ÷ 꼭짓점 ${sh.n}개`)
        : (Math.abs(v - (180 - sh.turn)) < 0.5 ? '그건 도형 안쪽 각이에요. 로봇이 방향을 바꾸는 각은?' : '다시 생각해 봐요.'));
    }
    save(); render();
  }

  // 지나간 길 그리기: 꼭짓점을 미리 계산하고 진행 상태(anim)에 맞춰 그림
  let anim = null;   // { k: 지금 변 번호, kind: 'move'|'turn'|'pause', t0, ms, end }
  function vertices() {
    const sh = shape(), pts = [[0, 0]];
    let h = 0, x = 0, y = 0;
    for (let i = 0; i < sh.n; i++) {
      x += st.side * Math.cos(h); y += st.side * Math.sin(h); pts.push([x, y]);
      h += sh.turn * Math.PI / 180;
    }
    return pts;
  }
  function drawPolygon() {
    const cv = $('pgCanvas'), g = cv.getContext('2d'), W = cv.width;
    g.clearRect(0, 0, W, W);
    const sh = shape(), pts = vertices();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = (W - 140) / Math.max(maxX - minX, maxY - minY, 1);
    const ox = (W - (maxX - minX) * sc) / 2 - minX * sc, oy = (W + (maxY - minY) * sc) / 2 + minY * sc;
    const P = (p) => [ox + p[0] * sc, oy - p[1] * sc];     // 수학 좌표(위가 +) → 화면

    // 계획된 길(옅게)
    g.setLineDash([8, 8]); g.strokeStyle = '#e6dccd'; g.lineWidth = 4;
    g.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
    g.setLineDash([]);

    // 진행 상태
    let k = 0, f = 0, heading = 0, done = false;
    if (anim) {
      const p = anim.p != null ? anim.p : Math.min(1, (performance.now() - anim.t0) / anim.ms);
      k = anim.k; heading = sh.turn * k;
      if (anim.kind === 'move') f = p;
      else { f = 1; if (anim.kind === 'turn') heading += sh.turn * p; else if (anim.after) heading += sh.turn; }
      if (anim.end) { k = sh.n; f = 0; heading = sh.turn * sh.n; done = true; }
    }
    const cur = k < sh.n ? [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f] : pts[sh.n];
    if (anim) {
      g.strokeStyle = '#1fb5ad'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); for (let i = 0; i <= Math.min(k, sh.n); i++) { const [a, b] = P(pts[i]); i ? g.lineTo(a, b) : g.moveTo(a, b); }
      { const [a, b] = P(cur); g.lineTo(a, b); } g.stroke();
    }
    // 출발점
    { const [a, b] = P(pts[0]); g.fillStyle = '#ffb23e'; g.beginPath(); g.arc(a, b, 9, 0, 7); g.fill(); }
    // 로봇(삼각형 화살표)
    const [rx, ry] = P(cur), hr = -heading * Math.PI / 180;
    g.save(); g.translate(rx, ry); g.rotate(hr);
    g.fillStyle = '#ff7a86'; g.beginPath(); g.moveTo(22, 0); g.lineTo(-14, -14); g.lineTo(-14, 14); g.closePath(); g.fill();
    g.restore();
    // 각도 표시
    g.fillStyle = '#3a3230'; g.font = '700 26px Esamanru, sans-serif'; g.textAlign = 'left';
    g.fillText(`${sh.name} · 한 변 ${st.side}cm · 꼭짓점에서 ${st.unlocked.includes(sh.id) ? sh.turn + '°' : '?°'}`, 16, 36);
    if (done) {
      g.fillStyle = '#1b8f6a';
      g.fillText(`돈 각의 합: ${sh.turn}° × ${sh.n} = ${sh.turn * sh.n}°`, 16, W - 20);
    }
  }
  function loop() { if (anim && !anim.end && anim.p == null) drawPolygon(); requestAnimationFrame(loop); }

  async function go4() {
    const sh = shape(), r = rate();
    const fs = st.side / r, ts = turnSec(sh.turn), steps = [];
    const mark = (k, kind, after) => (s) => { anim = { k, kind, after, t0: performance.now(), ms: Math.max(1, s.ms) }; };
    for (let i = 0; i < sh.n; i++) {
      steps.push({ ...fwd(fs), on: mark(i, 'move') });
      steps.push({ ...pause(), on: mark(i, 'pause', false) });
      steps.push({ ...left(ts), on: mark(i, 'turn') });
      steps.push({ ...pause(), on: mark(i, 'pause', true) });
    }
    const ok = await run(steps, $('m4Busy'), `${sh.name} 그리는 중…`);
    if (ok) {
      anim = { end: true };
      if (!st.done.includes(sh.id)) st.done.push(sh.id);
      save(); toast(`${sh.name} 완성! 🎉`); render();
    } else if (anim && !anim.end) { anim.p = Math.min(1, (performance.now() - anim.t0) / anim.ms); anim.end = false; drawPolygon(); }
  }

  // ---- 화면 전환 ----
  function render() {
    document.querySelectorAll('#tabs .tab').forEach(t => t.classList.toggle('sel', +t.dataset.step === st.step));
    [1, 2, 3, 4].forEach(i => $('step' + i).classList.toggle('hidden', i !== st.step));
    $('ok1').textContent = st.meas.length ? '✓' : '';
    $('ok2').textContent = st.solved2 ? '✓' : '';
    $('ok3').textContent = st.t360 && st.solved3 ? '✓' : '';
    $('ok4').textContent = st.done.length ? `${st.done.length}/${SHAPES.length}` : '';
    renderStep1(); renderStep2(); renderStep3(); renderStep4();
  }

  function init() {
    load();
    NB.mountConnectButton($('nbConn'));
    NB.on('sensor', s => { $('sens').innerHTML = `배터리 <b>${s.BAT}</b>`; });
    document.querySelectorAll('#tabs .tab').forEach(t => t.onclick = () => { if (busy) stopAll(); st.step = +t.dataset.step; save(); render(); });
    $('stopBtn').onclick = stopAll;
    $('m1Go').onclick = go1; $('m1Save').onclick = save1;
    $('m2Check').onclick = check2; $('m2Go').onclick = go2;
    $('m2Ans').oninput = () => { if (st.solved2) { st.solved2 = false; $('m2Fb').textContent = ''; render(); } };
    document.querySelectorAll('[data-adj]').forEach(b => b.onclick = () => {
      st.try360 = Math.max(0.5, Math.min(20, round1(st.try360 + parseFloat(b.dataset.adj)))); save(); render();
    });
    $('m3Go').onclick = () => run([left(st.try360)], $('m3Busy'), `${st.try360.toFixed(1)}초 도는 중…`);
    $('m3Set').onclick = () => {
      st.t360 = st.try360; st.solved3 = false; $('m3Ans').value = ''; $('m3Fb').textContent = ''; wrong.m3 = 0;
      save(); render(); toast(`한 바퀴 = ${st.t360.toFixed(1)}초 저장!`);
    };
    $('m3Check').onclick = check3;
    $('m3Go90').onclick = () => run([left(turnSec(90))], $('m3Busy'), '90° 도는 중…');
    $('m4Check').onclick = check4; $('m4Go').onclick = go4;
    // 입력칸에서 Enter = 옆 버튼
    [['m1Dist', save1], ['m2Ans', check2], ['m3Ans', check3], ['m4Ans', check4]].forEach(([id, f]) =>
      $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); f(); } }));
    document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); stopAll(); } });
    render();
    requestAnimationFrame(loop);
  }
  init();

  // 테스트용
  window.__poly = { st, rate, turnSec, stopAll, get busy() { return busy; } };
})();
