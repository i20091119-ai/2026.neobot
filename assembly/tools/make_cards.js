// 조립도 그림 다시 만들기: cards/step01~11.png(1600×1000), thumbs/motor.png(228×200)
// 사용: 저장소 루트에서 정적 서버(예: python3 -m http.server 8765) 켠 뒤
//       node assembly/tools/make_cards.js [http://localhost:8765]
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const ROOT = process.argv[2] || 'http://localhost:8765';
const OUT = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  pg.on('pageerror', e => console.log('오류', e.message));
  const n = (await (await fetch(ROOT + '/assembly/steps.json')).json()).steps.length;
  for (let s = 1; s <= n; s++) {
    await pg.goto(`${ROOT}/assembly/tools/card.html?step=${s}`);
    await pg.waitForFunction(() => window.READY, null, { timeout: 60000 });
    await pg.locator('#card').screenshot({ path: path.join(OUT, 'cards', `step${String(s).padStart(2, '0')}.png`) });
    console.log('card', s);
  }
  for (const key of ['motor']) {
    const t = await b.newPage({ viewport: { width: 228, height: 200 } });
    await t.goto(`${ROOT}/assembly/tools/card.html?thumb=${key}`);
    await t.waitForFunction(() => window.READY, null, { timeout: 60000 });
    await t.locator('#thumb').screenshot({ path: path.join(OUT, 'thumbs', key + '.png') });
    console.log('thumb', key);
  }
  await b.close();
})();
