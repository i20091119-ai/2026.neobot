// 네오봇 블록 정의 + 자바스크립트 생성기
// 블록 구성·값 규칙은 엔트리 '네오봇' 하드웨어 블록(entryjs block_neobot.js)을 따름
'use strict';
(function () {
  const G = Blockly.JavaScript;            // javascriptGenerator
  const O = javascript.Order;

  const C = { start: '#3bb34a', flow: '#3a9bdc', judge: '#5c8bd6', calc: '#f2a33a', text: '#d667a8',
              sensor: '#0fa3a0', motor: '#1fb5ad', output: '#2fbf9f', servo: '#26a5b8', sound: '#16a38a' };

  const PORTS_IN = [['IN1', 'IN1'], ['IN2', 'IN2'], ['IN3', 'IN3']];
  const PORTS_ALL = [['IN1', 'IN1'], ['IN2', 'IN2'], ['IN3', 'IN3'], ['리모컨', 'IR'], ['배터리', 'BAT']];
  const PORTS_OUT = [['OUT1', 'OUT1'], ['OUT2', 'OUT2'], ['OUT3', 'OUT3']];
  const PORTS_SERVO = [['OUT1', 'OUT1'], ['OUT2', 'OUT2'], ['OUT1&2', 'ALL']];
  const DIR_LR = [['앞으로', '16'], ['뒤로', '32']];
  const DURATION = [['계속', '0'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n + '초', String(n)])];
  const CMP = [['＝', '='], ['＞', '>'], ['＜', '<'], ['≥', '>='], ['≤', '<=']];
  const NOTES = [['무음', '0'], ['도', '1'], ['도#', '2'], ['레', '3'], ['레#', '4'], ['미', '5'], ['파', '6'],
                 ['파#', '7'], ['솔', '8'], ['솔#', '9'], ['라', '10'], ['라#', '11'], ['시', '12']];
  const PERCENT = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p, i) => [p + '%속도', String(i)]);       // 서보 회전하기: 10%→0 … 100%→9
  const PERCENT_DEG = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p, i) => [p + '%속도', String(9 - i)]); // 각도 바꾸기: 10%→9 … 100%→0 (0xFA−값, 작을수록 빠름)
  const KEYS = [['스페이스', ' '], ['↑', 'ArrowUp'], ['↓', 'ArrowDown'], ['←', 'ArrowLeft'], ['→', 'ArrowRight'],
                ...'abcdefghijklmnopqrstuvwxyz'.split('').map(k => [k, k]), ...'0123456789'.split('').map(k => [k, k]), ['엔터', 'Enter']];

  const dd = (name, options) => ({ type: 'field_dropdown', name, options });
  const num = (name) => ({ type: 'input_value', name, check: 'Number' });
  const stmt = (o) => Object.assign({ previousStatement: null, nextStatement: null, inputsInline: true }, o);
  const val = (o, check) => Object.assign({ output: check || 'Number', inputsInline: true }, o);

  Blockly.defineBlocksWithJsonArray([
    // ---- 시작 ----
    { type: 'nb_when_run', message0: '▶ 시작하기 버튼을 클릭했을 때', nextStatement: null, colour: C.start, hat: 'cap' },
    { type: 'nb_when_key', message0: '%1 키를 눌렀을 때', args0: [dd('KEY', KEYS)], nextStatement: null, colour: C.start },

    // ---- 흐름 ----
    stmt({ type: 'nb_wait_secs', message0: '%1 초 기다리기', args0: [num('SECS')], colour: C.flow }),
    stmt({ type: 'nb_repeat_n', message0: '%1 번 반복하기 %2 %3', args0: [num('TIMES'), { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.flow }),
    stmt({ type: 'nb_repeat_forever', message0: '계속 반복하기 %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.flow }),
    stmt({ type: 'nb_repeat_until', message0: '%1 이(가) 될 때까지 반복하기 %2 %3', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.flow }),
    stmt({ type: 'nb_wait_until', message0: '%1 이(가) 될 때까지 기다리기', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], colour: C.flow }),
    stmt({ type: 'nb_if', message0: '만일 %1 이라면 %2 %3', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.flow }),
    stmt({ type: 'nb_if_else', message0: '만일 %1 이라면 %2 %3', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
           message1: '아니면 %1', args1: [{ type: 'input_statement', name: 'ELSE' }], colour: C.flow }),
    { type: 'nb_break', message0: '반복 중단하기', previousStatement: null, colour: C.flow },
    { type: 'nb_stop_all', message0: '모든 코드 멈추기', previousStatement: null, colour: C.flow },

    // ---- 판단 ----
    val({ type: 'nb_key_pressed', message0: '%1 키가 눌러져 있는가?', args0: [dd('KEY', KEYS)], colour: C.judge }, 'Boolean'),

    // ---- 계산 ----
    val({ type: 'nb_timer', message0: '초시계 값', colour: C.calc }),
    stmt({ type: 'nb_timer_reset', message0: '초시계 초기화하기', colour: C.calc }),

    // ---- 글/표시 ----
    stmt({ type: 'nb_show', message0: '%1 을(를) 화면에 표시하기', args0: [{ type: 'input_value', name: 'TEXT' }], colour: C.text }),
    val({ type: 'nb_join', message0: '%1 과(와) %2 를 합치기', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: C.text }, 'String'),

    // ---- 네오봇: 센서 ----
    val({ type: 'nb_sensor_value', message0: '%1 값', args0: [dd('PORT', PORTS_ALL)], colour: C.sensor }),
    val({ type: 'nb_sensor_external', message0: '%1 에 연결한 %2 값', args0: [dd('PORT', PORTS_IN), dd('KIND', [['적외선센서', '1'], ['빛센서', '2'], ['소리센서', '3']])], colour: C.sensor }),
    val({ type: 'nb_sensor_convert', message0: '%1 센서값 %2 ~ %3 를 %4 ~ %5 (으)로 바꾼 값', args0: [dd('PORT', PORTS_IN), num('OMIN'), num('OMAX'), num('MIN'), num('MAX')], colour: C.sensor }),
    val({ type: 'nb_sensor_compare', message0: '%1 의 센서값이 %2 %3', args0: [dd('PORT', PORTS_IN), dd('SYMBOL', CMP), num('VALUE')], colour: C.sensor }, 'Boolean'),
    val({ type: 'nb_color_detect', message0: '%1 에 연결한 컬러센서가 %2 을 감지함', args0: [dd('PORT', PORTS_ALL), dd('COLOR', [['흰색', '0'], ['빨간색', '1'], ['노란색', '2'], ['초록색(연두색)', '3'], ['파란색', '4']])], colour: C.sensor }, 'Boolean'),
    val({ type: 'nb_remote_button', message0: '리모컨의 %1 버튼을 누름', args0: [dd('KEY', [['A', '1'], ['B', '2'], ['C', '3'], ['D', '4'], ['1', '5'], ['2', '6'], ['3', '7'], ['4', '8'], ['▲', '11'], ['▼', '12'], ['◀', '14'], ['▶', '13']])], colour: C.sensor }, 'Boolean'),

    // ---- 네오봇: 모터 ----
    stmt({ type: 'nb_left_motor', message0: '왼쪽 모터를 %1 %2 의 속도로 회전', args0: [dd('DIR', DIR_LR), num('SPEED')], colour: C.motor }),
    stmt({ type: 'nb_stop_left', message0: '왼쪽 모터를 정지', colour: C.motor }),
    stmt({ type: 'nb_right_motor', message0: '오른쪽 모터를 %1 %2 의 속도로 회전', args0: [dd('DIR', DIR_LR), num('SPEED')], colour: C.motor }),
    stmt({ type: 'nb_stop_right', message0: '오른쪽 모터를 정지', colour: C.motor }),
    stmt({ type: 'nb_both_motor', message0: '왼쪽 모터를 %1 %2 & 오른쪽 모터를 %3 %4 의 속도로 회전', args0: [dd('DIRL', DIR_LR), num('SPEEDL'), dd('DIRR', DIR_LR), num('SPEEDR')], colour: C.motor }),
    stmt({ type: 'nb_all_motor', message0: '양쪽 모터를 %1 %2 의 속도로 %3 회전', args0: [dd('DIR', [['앞으로', '1'], ['뒤로', '2']]), num('SPEED'), dd('DUR', DURATION)], colour: C.motor }),
    stmt({ type: 'nb_stop_all_motor', message0: '양쪽 모터를 정지', colour: C.motor }),
    stmt({ type: 'nb_robot', message0: '로봇 %1', args0: [dd('MOVE', [['전진', '1'], ['후진', '2'], ['좌회전', '3'], ['우회전', '4'], ['정지', '5']])], colour: C.motor }),

    // ---- 네오봇: 출력(LED) ----
    stmt({ type: 'nb_led_type1', message0: '%1 에 연결한 LED를 %2 밝기로 %3 켜기', args0: [dd('PORT', PORTS_OUT),
          dd('VALUE', [100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(p => [p + '%', String(Math.round(p * 2.55))])), dd('DUR', DURATION)], colour: C.output }),
    stmt({ type: 'nb_led_on', message0: '%1 에 연결한 LED 켜기', args0: [dd('PORT', PORTS_OUT)], colour: C.output }),
    stmt({ type: 'nb_led_off', message0: '%1 에 연결한 LED 끄기', args0: [dd('PORT', PORTS_OUT)], colour: C.output }),
    stmt({ type: 'nb_set_output', message0: '%1 에 %2 값만큼 출력', args0: [dd('PORT', PORTS_OUT), num('VALUE')], colour: C.output }),

    // ---- 네오봇: 서보 ----
    stmt({ type: 'nb_servo_init', message0: '%1 Servo모터 리셋', args0: [dd('PORT', PORTS_SERVO)], colour: C.servo }),
    stmt({ type: 'nb_servo_degree', message0: 'Servo모터 각도 바꾸기 : %1 도 %2 %3 %4', args0: [num('DEGREE'), dd('PORT', PORTS_SERVO), dd('DIR', [['정방향', '1'], ['역방향', '2']]), dd('SPEED', PERCENT_DEG)], colour: C.servo }),
    stmt({ type: 'nb_servo_rotate', message0: 'Servo모터 회전하기 : %1 %2 %3', args0: [dd('PORT', PORTS_SERVO), dd('DIR', [['정방향', '1'], ['역방향', '2']]), dd('SPEED', PERCENT)], colour: C.servo }),
    stmt({ type: 'nb_servo_stop', message0: '%1 Servo모터 멈추기', args0: [dd('PORT', PORTS_SERVO)], colour: C.servo }),

    // ---- 네오봇: 소리 ----
    stmt({ type: 'nb_play_note', message0: '멜로디 %1 을(를) %2 옥타브로 %3 길이만큼 소리내기', args0: [dd('NOTE', NOTES),
          dd('OCTAVE', [['1', '0'], ['2', '1'], ['3', '2'], ['4', '3'], ['5', '4'], ['6', '5']]),
          dd('LEN', [['2분 음표', '2'], ['4분 음표', '4'], ['8분 음표', '8'], ['16분 음표', '16']])], colour: C.sound }),
    stmt({ type: 'nb_play_note_sensor', message0: '컨트롤러에서 %1 센서의 %2 ~ %3 값으로 멜로디 연주하기', args0: [dd('PORT', PORTS_ALL), num('MIN'), num('MAX')], colour: C.sound }),
    stmt({ type: 'nb_sound_off', message0: '소리 끄기', colour: C.sound }),
  ]);

  // 기본값 설정 (OCTAVE 기본 3옥타브, LEN 기본 4분 음표)
  const setDefault = (type, field, v) => {
    const orig = Blockly.Blocks[type].init;
    Blockly.Blocks[type].init = function () { orig.call(this); this.setFieldValue(v, field); };
  };
  setDefault('nb_play_note', 'NOTE', '1');
  setDefault('nb_play_note', 'OCTAVE', '2');
  setDefault('nb_play_note', 'LEN', '4');
  setDefault('nb_servo_degree', 'SPEED', '0');
  setDefault('nb_servo_rotate', 'SPEED', '9');
  setDefault('nb_sensor_compare', 'SYMBOL', '>');

  // ---- 생성기 ----
  const F = G.forBlock;
  const v = (b, name, d) => G.valueToCode(b, name, O.NONE) || d;
  const s = (b, name) => G.statementToCode(b, name);
  const q = (b, f) => JSON.stringify(b.getFieldValue(f));

  F.nb_when_run = () => '';
  F.nb_when_key = () => '';
  F.nb_wait_secs = (b) => `await nb.wait(${v(b, 'SECS', 1)});\n`;
  F.nb_repeat_n = (b) => {
    const i = G.nameDB_.getDistinctName('i', Blockly.Names.NameType.VARIABLE);
    return `for (let ${i} = 0, n_${i} = Math.round(Number(${v(b, 'TIMES', 10)}) || 0); ${i} < n_${i}; ${i}++) {\n${s(b, 'DO')}  await __tick();\n}\n`;
  };
  F.nb_repeat_forever = (b) => `while (true) {\n${s(b, 'DO')}  await __tick();\n}\n`;
  F.nb_repeat_until = (b) => `while (!(${v(b, 'COND', 'false')})) {\n${s(b, 'DO')}  await __tick();\n}\n`;
  F.nb_wait_until = (b) => `while (!(${v(b, 'COND', 'false')})) { await __tick(); }\n`;
  F.nb_if = (b) => `if (${v(b, 'COND', 'false')}) {\n${s(b, 'DO')}}\n`;
  F.nb_if_else = (b) => `if (${v(b, 'COND', 'false')}) {\n${s(b, 'DO')}} else {\n${s(b, 'ELSE')}}\n`;
  F.nb_break = () => 'break;\n';
  F.nb_stop_all = () => 'nb.stopProgram();\n';
  F.nb_key_pressed = (b) => [`nb.keyDown(${q(b, 'KEY')})`, O.FUNCTION_CALL];
  F.nb_timer = () => ['nb.timer()', O.FUNCTION_CALL];
  F.nb_timer_reset = () => 'nb.timerReset();\n';
  F.nb_show = (b) => `nb.show(${v(b, 'TEXT', "''")});\n`;
  F.nb_join = (b) => [`(String(${v(b, 'A', "''")}) + String(${v(b, 'B', "''")}))`, O.ATOMIC];

  F.nb_sensor_value = (b) => [`nb.sensor(${q(b, 'PORT')})`, O.FUNCTION_CALL];
  F.nb_sensor_external = (b) => [`nb.sensor(${q(b, 'PORT')})`, O.FUNCTION_CALL];
  F.nb_sensor_convert = (b) => [`nb.convert(${q(b, 'PORT')}, ${v(b, 'OMIN', 0)}, ${v(b, 'OMAX', 255)}, ${v(b, 'MIN', 0)}, ${v(b, 'MAX', 100)})`, O.FUNCTION_CALL];
  F.nb_sensor_compare = (b) => [`nb.compare(${q(b, 'PORT')}, ${q(b, 'SYMBOL')}, ${v(b, 'VALUE', 10)})`, O.FUNCTION_CALL];
  F.nb_color_detect = (b) => [`nb.colorIs(${q(b, 'PORT')}, ${b.getFieldValue('COLOR')})`, O.FUNCTION_CALL];
  F.nb_remote_button = (b) => [`nb.remote(${b.getFieldValue('KEY')})`, O.FUNCTION_CALL];

  F.nb_left_motor = (b) => `nb.motor('DCL', ${b.getFieldValue('DIR')}, ${v(b, 'SPEED', 5)});\n`;
  F.nb_stop_left = () => `nb.set('DCL', 0);\n`;
  F.nb_right_motor = (b) => `nb.motor('DCR', ${b.getFieldValue('DIR')}, ${v(b, 'SPEED', 5)});\n`;
  F.nb_stop_right = () => `nb.set('DCR', 0);\n`;
  F.nb_both_motor = (b) => `nb.motor('DCL', ${b.getFieldValue('DIRL')}, ${v(b, 'SPEEDL', 5)}); nb.motor('DCR', ${b.getFieldValue('DIRR')}, ${v(b, 'SPEEDR', 5)});\n`;
  F.nb_all_motor = (b) => `await nb.allMotor(${b.getFieldValue('DIR')}, ${v(b, 'SPEED', 5)}, ${b.getFieldValue('DUR')});\n`;
  F.nb_stop_all_motor = () => `nb.set('DCL', 0); nb.set('DCR', 0);\n`;
  F.nb_robot = (b) => `nb.robot(${b.getFieldValue('MOVE')});\n`;

  F.nb_led_type1 = (b) => `await nb.ledFor(${q(b, 'PORT')}, ${b.getFieldValue('VALUE')}, ${b.getFieldValue('DUR')});\n`;
  F.nb_led_on = (b) => `nb.set(${q(b, 'PORT')}, 255);\n`;
  F.nb_led_off = (b) => `nb.set(${q(b, 'PORT')}, 0);\n`;
  F.nb_set_output = (b) => `nb.setOutput(${q(b, 'PORT')}, ${v(b, 'VALUE', 255)});\n`;

  F.nb_servo_init = (b) => `await nb.servoInit(${q(b, 'PORT')});\n`;
  F.nb_servo_degree = (b) => `await nb.servoDegree(${v(b, 'DEGREE', 90)}, ${q(b, 'PORT')}, ${b.getFieldValue('DIR')}, ${b.getFieldValue('SPEED')});\n`;
  F.nb_servo_rotate = (b) => `nb.servoRotate(${q(b, 'PORT')}, ${b.getFieldValue('DIR')}, ${b.getFieldValue('SPEED')});\n`;
  F.nb_servo_stop = (b) => `nb.servoStop(${q(b, 'PORT')});\n`;

  F.nb_play_note = (b) => `await nb.playNote(${b.getFieldValue('NOTE')}, ${b.getFieldValue('OCTAVE')}, ${b.getFieldValue('LEN')});\n`;
  F.nb_play_note_sensor = (b) => `await nb.playNoteSensor(${q(b, 'PORT')}, ${v(b, 'MIN', 0)}, ${v(b, 'MAX', 255)});\n`;
  F.nb_sound_off = () => `nb.set('SND', 0);\n`;

  // 변수: 모든 스크립트가 공유하도록 __v 객체 사용
  const varName = (b) => JSON.stringify(b.getField('VAR').getText());
  F.variables_get = (b) => [`__v[${varName(b)}]`, O.MEMBER];
  F.variables_set = (b) => `__v[${varName(b)}] = ${v(b, 'VALUE', 0)};\n`;
  F.math_change = (b) => `__v[${varName(b)}] = (Number(__v[${varName(b)}]) || 0) + Number(${v(b, 'DELTA', 1)});\n`;

  // ---- 툴박스 ----
  const sh = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const blk = (type, inputs) => (inputs ? { kind: 'block', type, inputs } : { kind: 'block', type });
  const sep = { kind: 'sep', gap: 24 };
  const label = (text) => ({ kind: 'label', text });

  window.NB_TOOLBOX = {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: '시작', colour: C.start, contents: [blk('nb_when_run'), blk('nb_when_key')] },
      { kind: 'category', name: '흐름', colour: C.flow, contents: [
        blk('nb_wait_secs', { SECS: sh(2) }), blk('nb_repeat_n', { TIMES: sh(10) }), blk('nb_repeat_forever'),
        blk('nb_repeat_until'), blk('nb_wait_until'), blk('nb_if'), blk('nb_if_else'), blk('nb_break'), blk('nb_stop_all')] },
      { kind: 'category', name: '판단', colour: C.judge, contents: [
        blk('nb_key_pressed'), blk('logic_compare', { A: sh(10), B: sh(10) }), blk('logic_operation'), blk('logic_negate'), blk('logic_boolean')] },
      { kind: 'category', name: '계산', colour: C.calc, contents: [
        blk('math_number'), blk('math_arithmetic', { A: sh(10), B: sh(10) }), blk('math_random_int', { FROM: sh(0), TO: sh(10) }),
        blk('math_modulo', { DIVIDEND: sh(10), DIVISOR: sh(3) }), blk('math_round', { NUM: sh(3.1) }), blk('nb_timer'), blk('nb_timer_reset')] },
      { kind: 'category', name: '글·표시', colour: C.text, contents: [
        blk('nb_show', { TEXT: { shadow: { type: 'text', fields: { TEXT: '안녕!' } } } }), blk('text'),
        blk('nb_join', { A: { shadow: { type: 'text', fields: { TEXT: '값: ' } } }, B: { shadow: { type: 'text', fields: { TEXT: '' } } } })] },
      { kind: 'category', name: '자료(변수)', colour: '#e06666', custom: 'VARIABLE' },
      { kind: 'sep' },
      { kind: 'category', name: '네오봇 센서', colour: C.sensor, contents: [
        blk('nb_sensor_value'), blk('nb_sensor_external'),
        blk('nb_sensor_convert', { OMIN: sh(0), OMAX: sh(255), MIN: sh(0), MAX: sh(100) }),
        blk('nb_sensor_compare', { VALUE: sh(10) }), blk('nb_color_detect'), blk('nb_remote_button')] },
      { kind: 'category', name: '네오봇 모터', colour: C.motor, contents: [
        blk('nb_left_motor', { SPEED: sh(5) }), blk('nb_stop_left'), blk('nb_right_motor', { SPEED: sh(5) }), blk('nb_stop_right'),
        blk('nb_both_motor', { SPEEDL: sh(5), SPEEDR: sh(5) }), blk('nb_all_motor', { SPEED: sh(5) }), blk('nb_stop_all_motor'), blk('nb_robot')] },
      { kind: 'category', name: '네오봇 LED·출력', colour: C.output, contents: [
        blk('nb_led_type1'), blk('nb_led_on'), blk('nb_led_off'), blk('nb_set_output', { VALUE: sh(255) })] },
      { kind: 'category', name: '네오봇 서보', colour: C.servo, contents: [
        blk('nb_servo_init'), blk('nb_servo_degree', { DEGREE: sh(90) }), blk('nb_servo_rotate'), blk('nb_servo_stop')] },
      { kind: 'category', name: '네오봇 소리', colour: C.sound, contents: [
        blk('nb_play_note'), blk('nb_play_note_sensor', { MIN: sh(0), MAX: sh(255) }), blk('nb_sound_off')] },
    ],
  };
})();
