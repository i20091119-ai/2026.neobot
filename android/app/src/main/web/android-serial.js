// 안드로이드 태블릿판: 앱(NBAndroid)이 USB 동글과 통신하고, 여기서 Web Serial(navigator.serial) 모양으로 감싸 줌
// → js/neobot.js 등 웹앱 코드는 고치지 않고 그대로 동작. 모든 HTML <head> 맨 앞에 앱이 자동으로 넣음
'use strict';
(function () {
  const A = window.NBAndroid;
  if (!A) return;
  const listeners = { connect: [], disconnect: [] };
  let rxCtl = null, pending = null;

  const b64e = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const b64d = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };

  const port = {
    readable: null, writable: null,
    getInfo: () => ({ usbVendorId: 0x10C4, usbProductId: 0xEA60 }),
    open(opts) {
      return new Promise((resolve, reject) => { pending = { resolve, reject }; A.open((opts && opts.baudRate) || 115200); });
    },
    async close() {
      A.close();
      port.readable = null; port.writable = null;
      try { if (rxCtl) rxCtl.close(); } catch (e) {}
      rxCtl = null;
    },
    async setSignals(s) {
      if (!A.setSignals(!!(s && s.dataTerminalReady), !!(s && s.requestToSend))) throw new Error('setSignals 실패');
    },
    addEventListener() {}, removeEventListener() {},
  };

  // 앱(자바) → 페이지 콜백
  window.__nbAndroid = {
    onOpen(ok, msg) {
      const p = pending; pending = null;
      if (!p) return;
      if (!ok) { const e = new Error(msg || '동글 열기 실패'); e.name = 'NetworkError'; p.reject(e); return; }
      port.readable = new ReadableStream({ start(c) { rxCtl = c; }, cancel() { rxCtl = null; } });
      port.writable = new WritableStream({
        write(chunk) { if (!A.write(b64e(chunk))) { const e = new Error('전송 실패'); e.name = 'NetworkError'; throw e; } },
      });
      p.resolve();
    },
    onData(b) { if (rxCtl) { try { rxCtl.enqueue(b64d(b)); } catch (e) {} } },
    onDetach() {
      // 읽기 반복이 빈 스트림을 계속 다시 읽지 않도록 readable을 먼저 비우고 닫음
      port.readable = null;
      try { if (rxCtl) rxCtl.close(); } catch (e) {}
      rxCtl = null;
      const ev = new Event('disconnect');
      Object.defineProperty(ev, 'target', { value: port });
      listeners.disconnect.forEach(f => { try { f(ev); } catch (e) {} });
    },
  };

  const serial = {
    async requestPort() {
      if (A.hasDevice()) return port;
      const e = new Error('동글을 태블릿에 꽂아 주세요 (USB-C 젠더 필요할 수 있음)'); e.name = 'NotConnectedError'; throw e;
    },
    async getPorts() { return A.hasDevice() ? [port] : []; },
    addEventListener(type, f) { (listeners[type] = listeners[type] || []).push(f); },
    removeEventListener(type, f) { const l = listeners[type]; if (l) { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } },
  };
  Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
})();
