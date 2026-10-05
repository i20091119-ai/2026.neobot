// 네오봇 통신 모듈 — Web Serial(크롬·엣지)로 블루투스 동글(CP210x, COM 포트)에 직접 연결
// 프로토콜 출처: entrylabs/entry-hw app/modules/neobot.js, entryjs block_neobot.js
//   PC→로봇 11바이트: CD AB | OUT1 OUT2 OUT3 DCL DCR SND FND OPT | 체크섬(2~9 합 & 0xFF)
//   로봇→PC  8바이트: AB CD | IN1 IN2 IN3 IR BAT | 체크섬(2~6 합 & 0xFF)
//   115200 baud, PC가 약 32ms마다 현재 상태를 계속 보냄
'use strict';
(function () {
  const BAUD = 115200;
  const PERIOD_MS = 32;
  const CP210X_VID = 0x10C4;

  const out = { OUT1: 0, OUT2: 0, OUT3: 0, DCL: 0, DCR: 0, SND: 0, FND: 0, OPT: 0 };
  const sensor = { IN1: 0, IN2: 0, IN3: 0, IR: 0, BAT: 0 };
  let port = null, reader = null, writer = null, timer = null;
  let writeFails = 0, lastError = '', lastReason = '';
  let writing = false, connected = false, lastRx = 0, rxCount = 0, rxBytes = 0, txCount = 0, lastWriteStart = 0;
  // DTR/RTS 신호: .NET(PowerShell 조종기, 동작 확인됨)은 기본 꺼짐, 크롬은 기본 켜짐 → 꺼짐을 기본으로
  function signalPref() {
    try { const o = JSON.parse(localStorage.getItem('nb-signals') || 'null'); if (o) return o; } catch (e) {}
    return { dataTerminalReady: false, requestToSend: false };
  }
  const rxBuf = [];
  const listeners = { status: [], sensor: [] };

  function emit(type, v) { listeners[type].forEach(f => { try { f(v); } catch (e) { console.error(e); } }); }
  function on(type, f) { listeners[type].push(f); }

  // 모터 보정(조립에 따라 바퀴 방향이 다를 수 있음): 미션 ① 바퀴 시험에서 정하고 모든 화면에 적용
  //   flipL/flipR = 그 바퀴 앞·뒤 뒤집기(0x1n ↔ 0x2n), swap = 왼쪽·오른쪽 출력 바꾸기
  //   trim = 똑바로 가기 보정(+면 오른쪽 바퀴를, −면 왼쪽 바퀴를 늦춤, ±3까지)
  //     속도 5 기준 값 → 다른 속도에서는 비례(속도 10이면 2배만큼 늦춤)
  //     모터 속도는 0~15 정수뿐이라 소수 보정은 32ms 패킷마다 s와 s−1을 섞어 평균을 맞춤
  const TRIM_MAX = 3;
  function normCal(c) {
    c = c || {};
    const t = Math.max(-TRIM_MAX, Math.min(TRIM_MAX, Math.round((+c.trim || 0) * 10) / 10));
    return { flipL: !!c.flipL, flipR: !!c.flipR, swap: !!c.swap, trim: t };
  }
  function motorCal() {
    try { return normCal(JSON.parse(localStorage.getItem('nb-motor') || 'null')); } catch (e) { return normCal(); }
  }
  let cal = motorCal();
  function setMotorCal(c) { cal = normCal(c); try { localStorage.setItem('nb-motor', JSON.stringify(cal)); } catch (e) {} }
  const trimAcc = { L: 0, R: 0 };
  function trimByte(b, cut, side) {
    const s = b & 15, hi = b & 0xF0;
    if (!cut || !s || (hi !== 0x10 && hi !== 0x20)) return b;
    const target = Math.max(0, s - cut * s / 5), lo = Math.floor(target);
    trimAcc[side] += target - lo;
    let v = lo;
    if (trimAcc[side] >= 1) { trimAcc[side] -= 1; v = lo + 1; }
    return v ? hi + v : 0;
  }
  const flipByte = (b) => (b >= 0x11 && b <= 0x1F) ? b + 0x10 : (b >= 0x21 && b <= 0x2F) ? b - 0x10 : b;
  function buildPacket() {
    const v = [out.OUT1, out.OUT2, out.OUT3, out.DCL, out.DCR, out.SND, out.FND, out.OPT].map(x => (x | 0) & 255);
    let l = v[3], r = v[4];
    if (cal.trim > 0) r = trimByte(r, cal.trim, 'R');
    else if (cal.trim < 0) l = trimByte(l, -cal.trim, 'L');
    if (cal.swap) [l, r] = [r, l];
    if (cal.flipL) l = flipByte(l);
    if (cal.flipR) r = flipByte(r);
    v[3] = l; v[4] = r;
    if (v[6] > 0) v[7] |= 8; // FND 사용 시 OPT bit3
    const sum = v.reduce((a, b) => a + b, 0) & 255;
    return new Uint8Array([0xCD, 0xAB, ...v, sum]);
  }

  function parseRx(bytes) {
    rxBytes += bytes.length;
    for (const b of bytes) rxBuf.push(b);
    let got = false;
    // 가장 최근의 온전한 프레임을 찾는다
    for (let i = rxBuf.length - 8; i >= 0; i--) {
      if (rxBuf[i] === 0xAB && rxBuf[i + 1] === 0xCD) {
        const d = rxBuf.slice(i + 2, i + 7);
        const sum = d.reduce((a, b) => a + b, 0) & 255;
        if (sum === rxBuf[i + 7]) {
          sensor.IN1 = d[0]; sensor.IN2 = d[1]; sensor.IN3 = d[2]; sensor.IR = d[3]; sensor.BAT = d[4];
          rxBuf.splice(0, i + 8);
          got = true;
          break;
        }
      }
    }
    if (rxBuf.length > 64) rxBuf.splice(0, rxBuf.length - 16);
    if (got) { lastRx = Date.now(); rxCount++; emit('sensor', { ...sensor }); }
  }

  async function readLoop() {
    while (port && port.readable && connected) {
      reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parseRx(value);
        }
      } catch (e) {
        // 블루투스 동글은 수신 중 프레이밍/버퍼 오류가 종종 생김 — 일시 오류면 새 스트림으로 계속 읽음
        console.warn('read', e && e.name, e);
        lastError = (e && e.name) || 'read';
        await new Promise(r => setTimeout(r, 50));
      } finally {
        try { reader.releaseLock(); } catch (e) {}
        reader = null;
      }
    }
    if (connected) await disconnect('연결 끊김');
  }

  async function tick() {
    if (!writer) return;
    if (writing) {
      // 전송이 1초 넘게 끝나지 않으면 막힌 것으로 보고 상태에 표시
      if (Date.now() - lastWriteStart > 1000) emit('status', status());
      return;
    }
    writing = true; lastWriteStart = Date.now();
    try { await writer.write(buildPacket()); txCount++; writeFails = 0; }
    catch (e) {
      console.warn('write', e);
      lastError = (e && e.name) || 'write';
      if (++writeFails > 30) disconnect('전송 오류');
      return;
    }
    finally { writing = false; }
  }

  async function openPort(p) {
    await p.open({ baudRate: BAUD, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 1024 });
    port = p;
    try { await port.setSignals(signalPref()); } catch (e) { console.warn('setSignals', e); }
    writer = port.writable.getWriter();
    connected = true; rxCount = 0; rxBytes = 0; txCount = 0; lastRx = 0; writing = false;
    timer = setInterval(tick, PERIOD_MS);
    readLoop();
    emit('status', status());
  }

  async function connect() {
    if (!('serial' in navigator)) throw new Error('이 브라우저는 Web Serial을 지원하지 않습니다. 크롬 또는 엣지를 사용하세요.');
    if (connected) return;
    const p = await navigator.serial.requestPort({ filters: [{ usbVendorId: CP210X_VID }] })
      .catch(async (e) => {
        if (e && e.name === 'NotFoundError') throw new Error('포트를 선택하지 않았습니다.');
        throw e;
      });
    await openPort(p);
  }

  // 이전에 허용한 포트가 있으면 묻지 않고 다시 연결(페이지 이동 후 자동 재연결)
  async function autoConnect() {
    if (!('serial' in navigator) || connected) return false;
    const ports = await navigator.serial.getPorts();
    const p = ports.find(x => (x.getInfo().usbVendorId === CP210X_VID)) || ports[0];
    if (!p) return false;
    try { await openPort(p); return true; } catch (e) { console.warn('autoConnect', e); return false; }
  }

  async function disconnect(reason) {
    if (!port) return;
    const wasConnected = connected;
    resetOutputs();
    try { if (writer) await writer.write(buildPacket()); } catch (e) {}
    connected = false;
    clearInterval(timer); timer = null;
    try { if (reader) await reader.cancel(); } catch (e) {}
    try { if (writer) { writer.releaseLock(); } } catch (e) {}
    writer = null;
    try { await port.close(); } catch (e) {}
    port = null;
    lastReason = reason || '';
    if (wasConnected) emit('status', { ...status(), reason: lastReason });
  }

  function resetOutputs() { for (const k in out) out[k] = 0; }
  function stopAll() { out.DCL = 0; out.DCR = 0; out.SND = 0; }

  function status() {
    return { connected, receiving: connected && Date.now() - lastRx < 1000, rxCount, rxBytes, txCount,
             writeStuck: writing && Date.now() - lastWriteStart > 1000, signals: signalPref(), lastError, lastReason };
  }

  // ---- 편의 함수 (값 규칙) ----
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  // 속도 -15~15 (음수=뒤로)
  function motorByte(speed) {
    const s = clamp(speed, -15, 15);
    if (s === 0) return 0;
    return s > 0 ? 0x10 + s : 0x20 + (-s);
  }
  function setMotors(left, right) { out.DCL = motorByte(left); out.DCR = motorByte(right); }
  // 음 이름 1~12(도~시), 옥타브값 0~5 → SND
  function noteValue(note, octave) { return note > 0 ? Math.min(65, note + 12 * octave) : 0; }

  // 화면 이탈·닫기 시 정지
  window.addEventListener('pagehide', () => { stopAll(); disconnect(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
  if ('serial' in navigator) {
    navigator.serial.addEventListener('disconnect', (e) => { if (e.target === port) disconnect('동글 분리'); });
  }

  // ---- 공통 연결 칩 UI ----
  // <button id="nbConn"> 하나만 있으면 상태 표시 + 클릭 연결/해제
  function mountConnectButton(btn, opts = {}) {
    const render = () => {
      const s = status();
      btn.classList.toggle('ok', s.connected && s.receiving);
      btn.classList.toggle('warn', s.connected && !s.receiving);
      btn.textContent = !s.connected ? (s.lastReason && s.lastReason !== '사용자 해제' ? '🔴 다시 연결 (' + s.lastReason + ')' : '🔌 로봇 연결')
                                     : (s.receiving ? '🟢 연결됨' : '🟡 응답 대기');
      btn.title = s.connected ? `송신 ${s.txCount} · 수신 ${s.rxBytes}바이트 — 클릭하면 연결 해제` : '네오봇 동글(CP210x) 포트를 선택하세요';
    };
    btn.addEventListener('click', async () => {
      try {
        if (connected) await disconnect('사용자 해제');
        else await connect();
      } catch (e) { (opts.onError || alert)(e.message || String(e)); }
      render();
    });
    on('status', render);
    let lastR = 0;
    on('sensor', () => { const t = Date.now(); if (t - lastR > 300) { lastR = t; render(); } });
    setInterval(render, 500);
    render();
    autoConnect().then(render);
  }

  async function setSignals(sig) {
    try { localStorage.setItem('nb-signals', JSON.stringify(sig)); } catch (e) {}
    if (port) await port.setSignals(sig);
  }

  window.Neobot = {
    setSignals, get port() { return port; }, get motorCal() { return { ...cal }; }, setMotorCal,
    out, sensor, on, connect, autoConnect, disconnect, status, stopAll, resetOutputs,
    setMotors, motorByte, noteValue, buildPacket, parseRx, mountConnectButton,
    get connected() { return connected; },
  };
})();
