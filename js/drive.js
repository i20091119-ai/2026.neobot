// 수학 에너지 주행 — 문제를 풀어 에너지 충전, 에너지가 있는 동안만 주행, 코인으로 속도업
// 알티노 '수학 연료 꼬리잡기'(2026newaltinopro1/webapp/js/tag.js)의 에너지·코인 규칙을 네오봇용으로 옮김
'use strict';
(function () {
  const NB = window.Neobot;
  const PB = window.AltinoProblems;
  const $ = (id) => document.getElementById(id);

  // ---- 에너지 경제 (현장 조절용 상수) ----
  const TICK_MS = 100;
  const SECONDS_PER_SOLVE = 30;                // 문제 1개로 달릴 수 있는 시간(초)
  const GAIN_PER_SOLVE = 500;                  // 정답 1개 충전량
  const DRAIN_PER_SEC = GAIN_PER_SOLVE / SECONDS_PER_SOLVE;
  const ENERGY_MAX = 3000;                     // 최대 = 문제 6개치
  const START_ENERGY = 500;

  // ---- 속도 (네오봇 모터 속도 0~15) ----
  const SPEED_TIERS = [6, 8, 10, 12, 15];
  const UPGRADE_COST = [2, 3, 4, 5];           // 0→1, 1→2, 2→3, 3→4

  let energy = START_ENERGY, coins = 0, speedTier = 0, maxTier = 0;
  let grade = null;
  const SAVE_KEY = 'neobot-drive-v1';

  // ---- 입력 ----
  const keys = { up: false, down: false, left: false, right: false };
  let running = false;

  function inputBlocked() {
    return !running || !$('probModal').classList.contains('hidden');
  }

  function intent() {
    if (inputBlocked()) return { fwd: 0, turn: 0 };
    const fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    return { fwd, turn };
  }

  function motorsFor(fwd, turn, sp) {
    if (fwd === 0 && turn === 0) return [0, 0];
    if (fwd === 0) {                           // 제자리 회전
      const t = Math.max(4, Math.round(sp * 0.6));
      return [turn * t, -turn * t];
    }
    const base = fwd * sp;
    if (turn === 0) return [base, base];
    const inner = Math.round(base * 0.35);     // 곡선 주행
    return turn > 0 ? [base, inner] : [inner, base];
  }

  // ---- 로봇 소리 (부저) ----
  let melodyTimer = null;
  function robotMelody(notes, ms) {
    clearTimeout(melodyTimer);
    let i = 0;
    const step = () => {
      if (i >= notes.length) { NB.out.SND = 0; return; }
      NB.out.SND = notes[i++];
      melodyTimer = setTimeout(step, ms);
    };
    step();
  }
  const SND = { charge: [NB.noteValue(1, 3), NB.noteValue(5, 3), NB.noteValue(8, 3)],
                upgrade: [NB.noteValue(8, 3), NB.noteValue(1, 4), NB.noteValue(5, 4), NB.noteValue(8, 4)],
                empty: [NB.noteValue(5, 2), NB.noteValue(1, 2)] };

  const SFX = {};
  ['charge', 'upgrade'].forEach(n => { try { SFX[n] = new Audio('sounds/' + n + '.wav'); } catch (e) {} });
  function sfx(n) { const a = SFX[n]; if (a) { try { a.currentTime = 0; a.play(); } catch (e) {} } }

  // ---- 메인 루프 ----
  let wasEmpty = false, saveTick = 0;
  setInterval(() => {
    const { fwd, turn } = intent();
    const want = fwd !== 0 || turn !== 0;
    const canMove = want && energy > 0;
    if (canMove) energy = Math.max(0, energy - DRAIN_PER_SEC * TICK_MS / 1000);
    const [l, r] = canMove ? motorsFor(fwd, turn, SPEED_TIERS[speedTier]) : [0, 0];
    NB.setMotors(l, r);
    const empty = energy <= 0;
    if (empty && !wasEmpty && running) { robotMelody(SND.empty, 180); }
    wasEmpty = empty;
    if (canMove && ++saveTick >= 20) { saveTick = 0; save(); }
    if (running) renderHud(want);
  }, TICK_MS);

  // ---- 화면 ----
  function renderHud(moving) {
    const pct = Math.round(energy / ENERGY_MAX * 100);
    $('energyBar').style.width = pct + '%';
    $('energyBar').classList.toggle('low', energy < GAIN_PER_SOLVE * 0.5);
    $('energyVal').textContent = Math.round(energy) + ' / ' + ENERGY_MAX;
    $('coinVal').textContent = coins;
    $('emptyMsg').textContent = energy <= 0 ? '에너지가 없어요! 충전소에서 문제를 풀어요' : '';
    const mood = energy <= 0 ? 'tired' : (moving ? 'happy' : '');
    const src = 'assets/mascot' + (mood ? '-' + mood : '') + '.png';
    if (!$('mascot').src.endsWith(src)) $('mascot').src = src;
    $('speedVal').textContent = speedTier + 1;
    $('spDown').disabled = speedTier <= 0;
    $('spUp').disabled = speedTier >= maxTier;
    const dots = $('dots');
    if (dots.children.length !== SPEED_TIERS.length) dots.innerHTML = SPEED_TIERS.map(() => '<i></i>').join('');
    [...dots.children].forEach((d, i) => { d.classList.toggle('on', i <= maxTier); d.classList.toggle('cur', i === speedTier); });
    const btn = $('upgradeBtn');
    if (maxTier >= SPEED_TIERS.length - 1) { $('upgradeText').textContent = '최고 속도!'; btn.disabled = true; }
    else {
      const cost = UPGRADE_COST[maxTier];
      $('upgradeText').textContent = `속도업 (코인 ${cost})`;
      btn.disabled = coins < cost;
    }
    $('gradeChip').textContent = '학년 ' + (PB.GRADE_LABELS[grade] || '—');
  }

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1300); }

  // ---- 문제 ----
  let curAnswer = null, lastIdx = -1;
  function genProblem() {
    const pool = PB.GRADE_POOLS[grade] || PB.GRADE_POOLS.e3;
    let i;
    do { i = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && i === lastIdx);
    lastIdx = i;
    curAnswer = pool[i].a;
    $('probText').textContent = pool[i].q;
    $('probInput').value = ''; $('probFb').textContent = '';
    $('probModal').classList.remove('hidden');
    setTimeout(() => $('probInput').focus(), 30);
  }
  function checkProblem() {
    const raw = $('probInput').value.trim();
    const v = parseInt(raw, 10);
    if (raw === '' || isNaN(v)) { $('probFb').textContent = '숫자를 입력하세요.'; return; }
    if (v === curAnswer) {
      energy = Math.min(ENERGY_MAX, energy + GAIN_PER_SOLVE);
      coins += 1;
      sfx('charge'); robotMelody(SND.charge, 120);
      save();
      toast(`+${GAIN_PER_SOLVE} 에너지 ⚡  +1 코인 🪙`);
      genProblem();                            // 연속 풀이
    } else {
      $('probFb').textContent = '다시! 계산을 확인해요.';
      $('probInput').select();
    }
  }

  function buyUpgrade() {
    if (maxTier >= SPEED_TIERS.length - 1) return;
    const cost = UPGRADE_COST[maxTier];
    if (coins < cost) { toast(`코인이 ${cost - coins}개 더 필요해요`); return; }
    coins -= cost; maxTier++; speedTier = maxTier;
    sfx('upgrade'); robotMelody(SND.upgrade, 110);
    toast(`속도 ${speedTier + 1}단계! 🚀`);
    save();
  }

  // ---- 저장 ----
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ e: Math.round(energy), c: coins, s: speedTier, mx: maxTier, g: grade })); } catch (e) {}
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!o || !PB.GRADE_POOLS[o.g]) return null;
      const n = (v, d, lo, hi) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d;
      return { e: n(o.e, START_ENERGY, 0, ENERGY_MAX), c: n(o.c, 0, 0, 9999), mx: n(o.mx, 0, 0, SPEED_TIERS.length - 1),
               s: n(o.s, 0, 0, SPEED_TIERS.length - 1), g: o.g };
    } catch (e) { return null; }
  }

  // ---- 시작 화면 ----
  function buildGrades() {
    const box = $('grades');
    PB.GRADE_ORDER.forEach(g => {
      const b = document.createElement('button');
      b.className = 'gradebtn'; b.textContent = PB.GRADE_LABELS[g]; b.dataset.g = g;
      b.onclick = () => { grade = g; [...box.children].forEach(x => x.classList.toggle('sel', x === b)); $('startBtn').disabled = false; };
      box.appendChild(b);
    });
    const saved = load();
    if (saved) {
      $('resumeBtn').classList.remove('hidden');
      $('resumeInfo').textContent = `(${PB.GRADE_LABELS[saved.g]} · 에너지 ${saved.e} · 코인 ${saved.c})`;
      $('resumeBtn').onclick = () => {
        energy = saved.e; coins = saved.c; maxTier = saved.mx; speedTier = Math.min(saved.s, saved.mx); grade = saved.g;
        startGame();
      };
    }
  }
  function startGame() {
    $('startScreen').classList.add('hidden');
    $('gameScreen').classList.remove('hidden');
    running = true; save(); renderHud(false);
    if (!NB.connected) toast('오른쪽 위 [로봇 연결]을 눌러요');
  }

  // ---- 이벤트 ----
  function bindPad() {
    $('pad').querySelectorAll('button[data-dir]').forEach(el => {
      const dir = el.dataset.dir;
      const down = (e) => { e.preventDefault(); el.classList.add('pressed');
        if (dir === 'stop') { for (const k in keys) keys[k] = false; } else keys[dir] = true; };
      const up = (e) => { e.preventDefault(); el.classList.remove('pressed'); if (dir !== 'stop') keys[dir] = false; };
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); down(e); });
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', (e) => {
    if (!$('probModal').classList.contains('hidden')) {
      if (e.key === 'Enter') checkProblem();
      if (e.key === 'Escape') $('probModal').classList.add('hidden');
      return;
    }
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.key === ' ') { for (const x in keys) keys[x] = false; e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => { for (const x in keys) keys[x] = false; });

  function bindKeypad() {
    const kp = $('keypad');
    ['1','2','3','4','5','6','7','8','9','←','0','확인'].forEach(t => {
      const b = document.createElement('button'); b.textContent = t;
      if (t === '확인') b.className = 'ok';
      b.onclick = () => {
        const inp = $('probInput');
        if (t === '확인') checkProblem();
        else if (t === '←') inp.value = inp.value.slice(0, -1);
        else inp.value += t;
        inp.focus();
      };
      kp.appendChild(b);
    });
  }

  function init() {
    NB.mountConnectButton($('nbConn'));
    NB.on('sensor', s => { $('sens').innerHTML = `배터리 <b>${s.BAT}</b>`; });
    buildGrades(); bindPad(); bindKeypad();
    $('startBtn').onclick = () => { energy = START_ENERGY; coins = 0; speedTier = 0; maxTier = 0; startGame(); };
    $('chargeBtn').onclick = genProblem;
    $('probClose').onclick = () => $('probModal').classList.add('hidden');
    $('upgradeBtn').onclick = buyUpgrade;
    $('spDown').onclick = () => { speedTier = Math.max(0, speedTier - 1); save(); };
    $('spUp').onclick = () => { speedTier = Math.min(maxTier, speedTier + 1); save(); };
    $('newGameBtn').onclick = () => {
      if (!confirm('에너지·코인·속도를 처음으로 되돌릴까요?')) return;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      location.reload();
    };
  }
  init();

  // 테스트용
  window.__drive = { get energy() { return energy; }, set energy(v) { energy = v; }, get coins() { return coins; }, set coins(v) { coins = v; },
    keys, motorsFor, get answer() { return curAnswer; } };
})();
