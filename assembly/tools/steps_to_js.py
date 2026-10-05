# steps.json → js/assembly-steps.js (미션 화면이 file://에서도 단계 문구를 읽도록)
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
d = json.loads((root / 'assembly/steps.json').read_text(encoding='utf-8'))
(root / 'js/assembly-steps.js').write_text(
    "// 조립도 단계 데이터 — assembly/steps.json 사본(폴더판 file://에서도 읽히게 일반 스크립트로)\n"
    "// steps.json을 고치면 이 파일도 다시 만들 것: python3 assembly/tools/steps_to_js.py\n"
    "window.ASM_STEPS = " + json.dumps(d, ensure_ascii=False, indent=1) + ";\n", encoding='utf-8')
print('ok')
