# 네오봇 커스텀 부품(LDraw .dat) 생성
# 단위 LDU (1스터드 = 20 LDU = 8mm). LDraw 관례: 원점 = 윗면 중심, y는 아래(+)
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'ldraw', 'lib', 'parts')
os.makedirs(OUT, exist_ok=True)

GRAY, DARK, WHITE, TGREEN, PCB, BLACK, YELLOW = 151, 72, 15, 34, 2, 0, 14

def quad(c, pts):
    return '4 %d ' % c + ' '.join('%g %g %g' % p for p in pts)

def box(c, x0, x1, y0, y1, z0, z1, faces='xXyYzZ'):
    L = []
    if 'x' in faces: L.append(quad(c, [(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)]))
    if 'X' in faces: L.append(quad(c, [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)]))
    if 'y' in faces: L.append(quad(c, [(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)]))
    if 'Y' in faces: L.append(quad(c, [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]))
    if 'z' in faces: L.append(quad(c, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)]))
    if 'Z' in faces: L.append(quad(c, [(x0, y0, z1), (x0, y1, z1), (x1, y1, z1), (x1, y0, z1)]))
    P = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    for i in range(8):
        for j in range(i + 1, 8):
            a, b = P[i], P[j]
            if sum(1 for k in range(3) if a[k] != b[k]) == 1:
                L.append('2 24 %g %g %g %g %g %g' % (a + b))
    return L

def disc_x(c, x, y, z, r):      # 원판, 법선 X
    return '1 %d %g %g %g 0 %g 0 0 0 %g %g 0 0 4-4disc.dat' % (c, x, y, z, r, r, r)

def ring_x(c, x, y, z, r):      # 구멍 테두리
    return '1 %d %g %g %g 0 %g 0 0 0 %g %g 0 0 4-4edge.dat' % (c, x, y, z, r, r, r)

def stud(x, y, z):
    return '1 16 %g %g %g 1 0 0 0 1 0 0 0 1 stud.dat' % (x, y, z)

def write(name, title, lines):
    head = ['0 ' + title, '0 Name: ' + name, '0 Author: neobot-class', '0 !LDRAW_ORG Unofficial_Part', '0 BFC NOCERTIFY']
    open(os.path.join(OUT, name), 'w').write('\n'.join(head + lines) + '\n')

HOLE_ROWS = (16, 36, 56)          # 옆면 구멍 높이(위에서), 8mm 간격 가정

# ---------- 녹색 컨트롤러 ----------
# 10x10 스터드(80x80mm), 높이 3브릭(72 LDU ≈ 29mm, 스터드 포함 약 3cm)
# 윗면: 좌우 2x10 스터드 띠 + 가운데 초록 덮개 / ±X 옆면: 구멍 7x3
# +Z 끝면(뒤): L·IN3·OUT3·R 단자 + 건전지 서랍 / -Z 끝면(앞): IN1·IN2·OUT1·OUT2 단자
H = 72
c = []
c += box(GRAY, -100, 100, 12, H, -100, 100, 'xXYzZ')
c += box(GRAY, -100, -60, 0, 12, -100, 100)
c += box(GRAY, 60, 100, 0, 12, -100, 100)
c += box(PCB, -60, 60, 9, 10, -96, 96, 'y')
c += box(TGREEN, -60, 60, 2, 12, -100, 100, 'yzZ')
for x in (-90, -70, 70, 90):
    for z in range(-90, 91, 20):
        c.append(stud(x, 0, z))
for sx in (-100.3, 100.3):
    for z in range(-60, 61, 20):
        for y in HOLE_ROWS:
            c.append(disc_x(BLACK, sx, y, z, 6))
            c.append(ring_x(24, sx, y, z, 6))
for zf, d in ((100, 1), (-100, -1)):
    for x in (-45, -15, 15, 45):
        c += box(WHITE, x - 9, x + 9, 4, 14, min(zf, zf + 2 * d), max(zf, zf + 2 * d))
c += box(DARK, -22, 22, 40, 70, 100, 101.5)          # 건전지 서랍(PULL)
c += box(BLACK, -70, -32, 36, 70, 100.2, 100.5, 'Z')
c += box(BLACK, 32, 70, 36, 70, 100.2, 100.5, 'Z')
write('nb_controller.dat', 'Neobot Controller (approx)', c)

# ---------- 모터 블록 ----------
# 윗면 4x6 스터드(32x48mm), 높이 3브릭. 원점 윗면 중심, 선은 -Z 끝 윗부분
# ±X 옆면: 구멍(길이 방향 4칸 x 높이 3칸, 선 쪽 첫 칸은 1개) + 출력축(노란 십자) 1개
m = []
m += box(BLACK, -40, 40, 0, H, -60, 60)
for x in (-30, -10, 10, 30):
    for z in (-50, -30, -10, 10, 30, 50):
        m.append(stud(x, 0, z))
AXLE_Z, AXLE_Y = 20, 36
for sx in (-40.3, 40.3):
    for z in (-20, 0, 20, 40):
        rows = (56,) if z == -20 else HOLE_ROWS
        for y in rows:
            if (z, y) == (AXLE_Z, AXLE_Y):
                m.append(disc_x(YELLOW, sx, y, z, 7))
            else:
                m.append(disc_x(DARK, sx, y, z, 6))
m += box(WHITE, -6, 6, 0, 10, -62, -60)               # 선 나오는 부분
write('nb_motor.dat', 'Neobot Motor Block (approx)', m)

# ---------- 큰 휠 + 큰 타이어 (타이어 표기 56x9: 지름 56mm, 폭 9mm) ----------
import math
R_TIRE, R_HUB, W = 70, 56, 22.5
w = []
w.append('1 0 0 0 0 %g 0 0 0 %g 0 0 0 %g 4-4cyli.dat' % (R_TIRE, W, R_TIRE))
w.append('1 0 0 0 0 %g 0 0 0 1 0 0 0 %g 4-4disc.dat' % (R_TIRE, R_TIRE))
w.append('1 24 0 0 0 %g 0 0 0 1 0 0 0 %g 4-4edge.dat' % (R_TIRE, R_TIRE))
w.append('1 24 0 %g 0 %g 0 0 0 1 0 0 0 %g 4-4edge.dat' % (W, R_TIRE, R_TIRE))
w.append('1 0 0 %g 0 %g 0 0 0 1 0 0 0 %g 4-4disc.dat' % (W, R_TIRE, R_TIRE))
w.append('1 151 0 -0.4 0 %g 0 0 0 1 0 0 0 %g 4-4disc.dat' % (R_HUB, R_HUB))
w.append('1 151 0 %g 0 %g 0 0 0 1 0 0 0 %g 4-4disc.dat' % (W + 0.4, R_HUB, R_HUB))
for i in range(-3, 4):
    for j in range(-3, 4):
        x, z = i * 20 - 10 * (1 if i > 0 else -1 if i < 0 else 0) * 0, j * 20
        d = math.hypot(i * 16, j * 16)
        if 18 < d < 50:
            w.append('1 151 %g -0.4 %g 1 0 0 0 1 0 0 0 1 stud.dat' % (i * 16, j * 16))
w.append('1 0 0 -0.8 0 5 0 0 0 1 0 0 0 5 4-4disc.dat')
write('nb_wheel_big.dat', 'Neobot Big Wheel 56x9 (approx)', w)
print('parts ok')

# ---------- 모터 선 (세계 좌표로 바로 그림) ----------
import numpy as np
def tube(c, p1, p2, r=3.2):
    p1, p2 = np.array(p1, float), np.array(p2, float); d = p2 - p1
    a = np.array([1.0, 0, 0]) if abs(d[0]) < 0.9 * np.linalg.norm(d) else np.array([0, 0, 1.0])
    u = np.cross(d, a); u = u / np.linalg.norm(u) * r
    v = np.cross(d / np.linalg.norm(d), u)
    M = np.column_stack([u, d, v])   # 로컬 x→u, y→d, z→v
    m = M.flatten()
    return '1 %d %g %g %g ' % ((c,) + tuple(p1)) + ' '.join('%g' % x for x in m) + ' 4-4cyli.dat'
for side, sx, px in (('L', 60, 45), ('R', -60, -45)):
    pts = [(sx, 78, 100), (sx, 78, 124), (sx * 0.92, 9, 124), (px, 9, 124), (px, 9, 106)]
    L = [tube(15, pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    L += box(15, px - 7, px + 7, 4, 14, 101, 108)
    write('nb_cable_%s.dat' % side, 'Neobot motor cable %s' % side, L)
print('cables ok')

# ---------- LED 블록 (2x4 바닥, 노란 몸통 1브릭 + 투명 윗덮개, 선은 짧은 끝) ----------
# 원점 = 바닥면 중심, y 위쪽이 음수. 길이 방향 z(80 LDU), 폭 x(40 LDU)
TRANS_CLEAR = 47
led = []
led += box(YELLOW, -20, 20, 0, -24, -40, 40, 'xXYzZ')
led += box(TRANS_CLEAR, -19, 19, -24, -30, -39, 39)
led += box(PCB, -14, 14, -24.5, -25, -34, 34, 'y')
led += box(WHITE, -7, 7, -25, -28, -32, -18)                 # LED 칩(선 반대쪽 끝)
led.append('1 14 0 -28.2 -25 5 0 0 0 1 0 0 0 5 4-4disc.dat')
for z in (14, 30):                                           # 옆면 구멍 2개(선 쪽)
    for sx in (-20.3, 20.3):
        led.append(disc_x(BLACK, sx, -12, z, 6)); led.append(ring_x(24, sx, -12, z, 6))
led += box(WHITE, -5, 5, -8, -16, 40, 46)                    # 선 나오는 부분
write('nb_led.dat', 'Neobot LED block (approx)', led)
# LED 선: 컨트롤러 윗면 오른쪽 띠 뒤쪽(x=-80,z=60) → 뒤 끝면 OUT3 단자(-15,9,101)
pts = [(-80, -12, 106), (-80, -12, 116), (-15, -12, 116), (-15, 9, 116), (-15, 9, 106)]
L = [tube(15, pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
L += box(15, -22, -8, 4, 14, 101, 108)
write('nb_cable_LED.dat', 'Neobot LED cable to OUT3', L)
print('led ok')
