// 네오봇 조립도 3D 뷰어 — three.js LDrawLoader 기반, 단계별 표시
// 사용: const v = await createAssemblyViewer(div, { base: 'assembly/' }); v.setStep(0);
// 의존: importmap 으로 'three' → vendor/three/three.module.min.js 지정
import * as THREE from 'three';
import { LDrawLoader } from './vendor/three/LDrawLoader.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

export async function createAssemblyViewer(container, opts = {}) {
  const base = opts.base || './';
  const data = opts.steps || await (await fetch(base + 'steps.json')).json();

  const W = () => container.clientWidth, H = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W(), H());
  renderer.setClearColor(0xffffff);
  container.style.position = container.style.position || 'relative';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(200, 400, 300); scene.add(dl);
  const cam = new THREE.PerspectiveCamera(28, W() / H(), 1, 10000);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;

  // 라벨(L/R 등) 오버레이
  const labelLayer = document.createElement('div');
  labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  container.appendChild(labelLayer);

  const loader = new LDrawLoader();
  loader.setPartsLibraryPath(base + 'ldraw/lib/');
  await loader.preloadMaterials(base + 'ldraw/lib/colors/ldcfgalt.ldr');
  const model = await loader.loadAsync(base + data.model);
  model.rotation.x = Math.PI;               // LDraw(y 아래) → three(y 위)
  scene.add(model);

  // 단계별 원래 재질·위치 보관
  const items = model.children.filter(c => c.userData.buildingStep !== undefined);
  for (const c of items) {
    c.userData.basePos = c.position.clone();
    c.traverse(o => {
      if (o.isMesh || o.isLineSegments) {
        const list = Array.isArray(o.material) ? o.material : [o.material];
        o.userData.solid = list.map(m => { const n = m.clone(); n.side = THREE.DoubleSide; return n; });
        o.userData.faded = list.map(m => {
          const n = m.clone(); n.side = THREE.DoubleSide;
          if (!m.transparent) { n.transparent = true; n.opacity = o.isMesh ? 0.42 : 0.15; n.depthWrite = false; }
          return n;
        });
      }
    });
  }

  let cur = 0, labels = [];
  // 결합 안내 점선(모델 좌표계에 붙여 같이 회전)
  const guideGroup = new THREE.Group(); model.add(guideGroup);
  const DASH = 6, GAP = 4;
  const dashGeo = new THREE.CylinderGeometry(1.6, 1.6, 1, 8);
  const dotGeo = new THREE.SphereGeometry(4.5, 16, 12);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xe0262b, depthTest: false, transparent: true, opacity: 0.9 });
  function setMat(o, faded) {
    const arr = faded ? o.userData.faded : o.userData.solid;
    if (arr) o.material = Array.isArray(o.material) ? arr : arr[0];
  }

  function setStep(i) {
    cur = Math.max(0, Math.min(data.steps.length - 1, i));
    const st = data.steps[cur];
    const exv = st.explode || [0, 0, 0];
    // 분해 벡터: mirrorX면 부품이 놓인 쪽(x 부호)으로 벌림 / only가 있으면 파일 이름이 맞는 부품만 띄움
    const exFor = (x) => new THREE.Vector3(st.mirrorX && x < 0 ? -exv[0] : exv[0], exv[1], exv[2]);
    const only = st.explodeOnly || null;
    for (const c of items) {
      const s = c.userData.buildingStep;
      c.visible = s <= cur;
      c.position.copy(c.userData.basePos);
      const fn = (c.userData.fileName || '').toLowerCase();
      if (s === cur && (!only || only.some(k => fn.includes(k)))) {
        // basePos는 회전 전(LDraw) 좌표계의 자식 위치 → 같은 좌표계로 더함
        c.position.add(exFor(c.userData.basePos.x));
      }
      c.traverse(o => setMat(o, st.fade && s < cur));
    }
    // 결합 안내 점선: guides = 부품이 들어갈 구멍(LDraw 좌표). 구멍 → 떠 있는 부품까지 점선 + 구멍에 빨간 점
    guideGroup.clear();
    for (const g of st.guides || []) {
      const a = new THREE.Vector3(...g), b = a.clone().add(exFor(g[0]));
      const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      for (let t = 0; t < len; t += DASH + GAP) {          // 굵은 점선(원기둥 토막)
        const l = Math.min(DASH, len - t);
        const m = new THREE.Mesh(dashGeo, dotMat);
        m.scale.set(1, l, 1); m.quaternion.copy(q);
        m.position.copy(a).addScaledVector(dir, t + l / 2); m.renderOrder = 999;
        guideGroup.add(m);
      }
      const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.copy(a); dot.renderOrder = 1000;
      guideGroup.add(dot);
    }
    model.updateMatrixWorld(true);
    // 보이는 부품 기준으로 카메라 맞춤
    const box = new THREE.Box3();
    for (const c of items) if (c.visible) box.expandByObject(c);
    guideGroup.updateMatrixWorld(true); box.expandByObject(guideGroup);
    const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
    const v = st.view || { az: 35, el: 25, zoom: 1 };
    const R = size * 1.75 / (v.zoom || 1), a = v.az * Math.PI / 180, e = v.el * Math.PI / 180;
    cam.position.set(ctr.x + R * Math.cos(e) * Math.sin(a), ctr.y + R * Math.sin(e), ctr.z + R * Math.cos(e) * Math.cos(a));
    controls.target.copy(ctr); cam.lookAt(ctr); controls.update();
    // 라벨
    labelLayer.innerHTML = ''; labels = [];
    for (const lb of st.labels || []) {
      const el = document.createElement('div');
      el.textContent = lb.text;
      el.style.cssText = 'position:absolute;transform:translate(-50%,-150%);background:#e0262b;color:#fff;font-weight:700;' +
        'border-radius:999px;min-width:34px;padding:0 10px;box-sizing:border-box;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px';
      labelLayer.appendChild(el);
      labels.push({ el, p: new THREE.Vector3(...lb.at) });
    }
    if (opts.onStep) opts.onStep(cur, st, data.steps.length);
    return st;
  }

  function placeLabels() {
    for (const { el, p } of labels) {
      const v = p.clone().applyMatrix4(model.matrixWorld).project(cam);
      el.style.left = ((v.x + 1) / 2 * W()) + 'px';
      el.style.top = ((1 - v.y) / 2 * H()) + 'px';
    }
  }

  let raf = 0, paused = false;              // paused: 화면에 안 보일 때 그리기 멈춤(저사양 노트북 부담 줄이기)
  (function loop() {
    if (!paused) { controls.update(); renderer.render(scene, cam); placeLabels(); }
    raf = requestAnimationFrame(loop);
  })();
  const ro = new ResizeObserver(() => { cam.aspect = W() / H(); cam.updateProjectionMatrix(); renderer.setSize(W(), H()); });
  ro.observe(container);

  setStep(0);
  return {
    data, setStep, get step() { return cur; },
    next: () => setStep(cur + 1), prev: () => setStep(cur - 1),
    pause() { paused = true; }, resume() { paused = false; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); container.innerHTML = ''; },
  };
}
