// 블록코딩 실행 엔진 — 생성된 코드를 async 함수로 실행, 정지 시 즉시 중단
'use strict';
(function () {
  const NB = window.Neobot;
  const G = Blockly.JavaScript;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  class StopSignal extends Error {}
  let runId = 0, running = false, workspace = null, onState = () => {}, onShow = () => {};
  let timerStart = performance.now();
  const keysDown = new Set();
  let __v = {};

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(x) || 0)));
  const outPorts = (p) => (p === 'ALL' ? ['OUT1', 'OUT2'] : [p]);

  function check(id) { if (id !== runId) throw new StopSignal(); }

  function makeApi(id) {
    const wait = async (ms) => {
      const end = performance.now() + ms;
      do {
        check(id);
        await new Promise(r => setTimeout(r, Math.min(20, Math.max(0, end - performance.now()))));
      } while (performance.now() < end);
      check(id);
    };
    const set = (k, val) => { check(id); NB.out[k] = clamp(val, 0, 255); };
    return {
      wait: (secs) => wait(Math.max(0, Number(secs) || 0) * 1000),
      set,
      stopProgram: () => { stop(); throw new StopSignal(); },
      keyDown: (k) => keysDown.has(k),
      timer: () => Math.round((performance.now() - timerStart) / 100) / 10,
      timerReset: () => { timerStart = performance.now(); },
      show: (t) => onShow(String(t)),

      // 센서
      sensor: (p) => NB.sensor[p] | 0,
      convert: (p, omin, omax, min, max) => {
        let value = NB.sensor[p] | 0;
        omin = +omin; omax = +omax; min = +min; max = +max;
        if (omin > omax) [omin, omax] = [omax, omin];
        if (min > max) [min, max] = [max, min];
        if (omax === omin) return Math.round(min);
        value = (value - omin) * ((max - min) / (omax - omin)) + min;
        return Math.round(Math.max(min, Math.min(max, value)));
      },
      compare: (p, sym, value) => {
        const s = NB.sensor[p] | 0, v = Number(value);
        switch (sym) { case '=': return s === v; case '>': return s > v; case '<': return s < v; case '>=': return s >= v; case '<=': return s <= v; }
        return false;
      },
      colorIs: (p, c) => {
        const s = NB.sensor[p] | 0;
        const ranges = [[10, 50], [51, 90], [91, 130], [131, 170], [171, 210]];
        const r = ranges[c];
        return !!r && s >= r[0] && s <= r[1];
      },
      remote: (key) => { if (key >= 5 && key <= 8) key -= 4; return (NB.sensor.IR | 0) === key; },

      // 모터: dir 16=앞으로, 32=뒤로 / 속도 0~15
      motor: (k, dir, speed) => set(k, Number(dir) + clamp(speed, 0, 15)),
      allMotor: async (dir, speed, dur) => {
        const sp = clamp(speed, 0, 15);
        const v = (Number(dir) === 2 ? 0x20 : 0x10) + sp;
        set('DCL', v); set('DCR', v);
        if (Number(dur) > 0) { await wait(Number(dur) * 1000); set('DCL', 0); set('DCR', 0); }
      },
      robot: (move) => {
        const m = { 1: [0x1A, 0x1A], 2: [0x2A, 0x2A], 3: [0x25, 0x15], 4: [0x15, 0x25], 5: [0, 0] }[move] || [0, 0];
        set('DCL', m[0]); set('DCR', m[1]);
      },

      // 출력
      ledFor: async (p, val, dur) => {
        set(p, val);
        if (Number(dur) > 0) { await wait(Number(dur) * 1000); set(p, 0); }
      },
      setOutput: (p, val) => set(p, clamp(val, 0, 255)),

      // 서보 (엔트리 순서·지연 그대로)
      servoInit: async (p) => {
        outPorts(p).forEach(k => set(k, 0xBA));
        await wait(200);
        outPorts(p).forEach(k => set(k, 0x01));
        await wait(100);
      },
      servoDegree: async (deg, p, dir, speed) => {
        const d = clamp(deg, 0, 180);
        outPorts(p).forEach(k => set(k, Number(dir) === 2 ? 0xBD : 0xBC));
        await wait(200);
        outPorts(p).forEach(k => set(k, 0xFA - clamp(speed, 0, 9)));
        await wait(200);
        outPorts(p).forEach(k => set(k, d + 1));
      },
      servoRotate: (p, dir, speed) => {
        const v = (Number(dir) === 2 ? 0xD0 : 0xC0) + (clamp(speed, 0, 9) + 1);
        outPorts(p).forEach(k => set(k, v));
      },
      servoStop: (p) => outPorts(p).forEach(k => set(k, 0xFE)),

      // 소리
      playNote: async (note, octave, len) => {
        set('SND', NB.noteValue(Number(note), Number(octave)));
        await wait(2000 / (Number(len) || 4));
        set('SND', 0);
      },
      playNoteSensor: async (p, omin, omax) => {
        let value = NB.sensor[p] | 0;
        omin = +omin; omax = +omax;
        if (omin > omax) [omin, omax] = [omax, omin];
        value = omax === omin ? 0 : (value - omin) * (72 / (omax - omin));
        value = Math.round(Math.max(0, Math.min(72, value)));
        set('SND', value);
        await wait(500);
        set('SND', 0);
      },
    };
  }

  function codeFor(hat) {
    G.init(workspace);
    const body = G.blockToCode(hat);
    return G.finish(typeof body === 'string' ? body : body[0]);
  }

  function launch(hat, id) {
    const code = codeFor(hat);
    const api = makeApi(id);
    const step = async (blockId) => {
      check(id);
      try { workspace.highlightBlock(blockId); } catch (e) {}
    };
    const tick = async () => { check(id); await new Promise(r => setTimeout(r, 16)); check(id); };
    let fn;
    try { fn = new AsyncFunction('nb', '__step', '__tick', '__v', code); }
    catch (e) { onShow('⚠ 코드 오류: ' + e.message); console.error(code); return Promise.resolve(); }
    return fn(api, step, tick, __v).catch(e => {
      if (!(e instanceof StopSignal)) { console.error(e); onShow('⚠ 실행 오류: ' + e.message); }
    });
  }

  function start() {
    stop(true);
    const id = ++runId;
    running = true;
    __v = {};
    timerStart = performance.now();
    onState(true);
    const hats = workspace.getTopBlocks(true).filter(b => b.type === 'nb_when_run' && b.isEnabled());
    Promise.all(hats.map(h => launch(h, id))).then(() => {
      // 키 이벤트 블록이 없으면 다 끝났을 때 자동 종료
      const keyHats = workspace.getTopBlocks(false).some(b => b.type === 'nb_when_key' && b.isEnabled());
      if (id === runId && !keyHats) stop();
    });
  }

  const keyRunning = new Map(); // 같은 키 블록이 이미 실행 중이면 다시 시작하지 않음
  function onKey(key) {
    if (!running) return;
    const id = runId;
    workspace.getTopBlocks(false).filter(b => b.type === 'nb_when_key' && b.isEnabled() && b.getFieldValue('KEY') === key)
      .forEach(h => {
        if (keyRunning.get(h.id) === id) return;
        keyRunning.set(h.id, id);
        launch(h, id).finally(() => { if (keyRunning.get(h.id) === id) keyRunning.delete(h.id); });
      });
  }

  function stop(silent) {
    runId++;
    running = false;
    NB.resetOutputs();
    try { workspace && workspace.highlightBlock(null); } catch (e) {}
    if (!silent) onState(false);
  }

  function isTyping(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
  document.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keysDown.has(k)) { keysDown.add(k); onKey(k); }
    if (running && (k === ' ' || k.startsWith('Arrow'))) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keysDown.delete(k); });
  window.addEventListener('blur', () => keysDown.clear());

  window.NBRunner = {
    init(ws, opts) {
      G.STATEMENT_PREFIX = 'await __step(%1);\n';
      G.INFINITE_LOOP_TRAP = 'await __tick();\n';
      G.addReservedWords('nb,__step,__tick,__v');
      workspace = ws; onState = opts.onState || onState; onShow = opts.onShow || onShow; },
    start, stop, get running() { return running; },
    codePreview() {
      return workspace.getTopBlocks(true).filter(b => b.type === 'nb_when_run' || b.type === 'nb_when_key')
        .map(h => '// ' + (h.type === 'nb_when_run' ? '시작' : '키 ' + h.getFieldValue('KEY')) + '\n' + codeFor(h)).join('\n');
    },
  };
})();
