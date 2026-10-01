# 네오봇 수학SW체험 (2026.neobot)

구형 네오봇에듀 컨트롤러를 **엔트리 없이** 웹페이지에서 조종하는 프로그램.
블루투스 동글(CP210x, 윈도우 COM 포트)에 크롬·엣지 **Web Serial**로 직접 연결. 설치 없음.

## 구성
| 페이지 | 내용 |
|---|---|
| `index.html` | 처음 화면 — 두 활동 선택, 로봇 연결 |
| `drive.html` | **수학 에너지 주행** — 문제 풀어 에너지 충전, 주행 중 에너지 감소, 코인으로 속도업 |
| `blocks.html` | **네오봇 블록코딩** — 엔트리 네오봇 블록(센서·모터·LED·서보·소리) + 흐름·판단·계산·변수 |
| `polygon.html` | **정다각형 미션** — 시간으로 거리·각도 제어: ① 거리 재기(정비례 그래프) ② 목표 정차 ③ 회전 맞추기 ④ 외각 열쇠 → 정다각형·오각별 주행 |

## 사용 방법
1. 동글을 PC에 꽂기 → 로봇 전원 켜기(① Coding 모드, Pairing 파란 불)
2. 엔트리 하드웨어 연결 프로그램 종료(포트 동시 사용 불가)
3. 크롬/엣지로 페이지 열기 → **로봇 연결** → `CP210x` 포트 선택
4. 한 번 허용한 포트는 다른 페이지로 이동해도 자동 재연결

## 통신 규격 (엔트리 entry-hw `neobot.js` 기준)
- 115200 baud, PC가 32ms마다 송신
- PC→로봇 11바이트: `CD AB OUT1 OUT2 OUT3 DCL DCR SND FND OPT 체크섬`
- 로봇→PC 8바이트: `AB CD IN1 IN2 IN3 IR BAT 체크섬`
- 모터: 앞으로 `0x10+속도`, 뒤로 `0x20+속도` (속도 0~15)
- 소리: `음(1~12) + 12×옥타브값(0~5)`, 0=끔
- 서보 각도: `0xBC/0xBD`(방향) → `0xFA-속도` → `각도+1` (각 200ms 간격)

## 현장 조절값
`js/drive.js` 상단 상수
- `SECONDS_PER_SOLVE` 문제 1개당 주행 시간(기본 30초)
- `ENERGY_MAX` 최대 에너지(기본 문제 6개치)
- `SPEED_TIERS` 속도 단계(기본 6·8·10·12·15)
- `UPGRADE_COST` 속도업 코인

`js/polygon.js` 상단 상수
- `SPEEDS` 직진 속도 선택지(기본 6·8·10·12), `TURN_SPEEDS` 회전 속도(4·6·8)
- `TIMES` 측정 시간, `TARGETS` 목표 거리, `SIDES` 한 변 길이
- `PAUSE_MS` 직진·회전 사이 멈춤(기본 0.3초)

## 출처
- 문제 은행 `js/problems.js`, 이미지·폰트·효과음: 2026newaltinopro1 저장소에서 재사용
- 블록 편집기: Google Blockly 11 (Apache-2.0, `vendor/blockly`)
- 프로토콜: entrylabs/entry-hw, entrylabs/entryjs
