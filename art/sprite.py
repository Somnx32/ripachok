from PIL import Image, ImageDraw
import json

PAL = {
    'K': '#16180f',  # outline
    'G': '#5d6e38',  # hood
    'g': '#3d4924',  # hood shadow
    'H': '#86994f',  # hood highlight
    'M': '#2a2e2b',  # mask
    'm': '#4a514c',  # mask mid / gloves
    'L': '#6fe0c8',  # lens glow
    'l': '#2f8a78',  # lens dark
    'W': '#effff9',  # glint
    'F': '#767b72',  # filter
    'f': '#4b4f48',  # filter ridge
    'J': '#56633a',  # jacket
    'j': '#3a4427',  # jacket shadow
    'B': '#6b4a2a',  # straps / belt
    'Y': '#ffd81a',  # rapeseed flower
    'y': '#d4a800',  # flower shade
    'T': '#4f9a3a',  # stem
    't': '#2f6b25',  # leaf dark
    'P': '#2e3127',  # pants
    'S': '#1e2016',  # boots sole/dark
    's': '#3b3a30',  # boots
    'Z': '#cfe8ff',  # z particles / emote
    'R': '#ff5a6e',  # heart
}

LEFT = [
    "................",  # 0
    "................",  # 1
    "..............KK",  # 2
    "............KKGG",  # 3
    "..........KKGGGG",  # 4
    ".........KGGGGGG",  # 5
    "........KGGGGGGG",  # 6
    "........KGGGGGGG",  # 7
    ".......KGGGGKKKK",  # 8
    ".......KGGGKMMMM",  # 9
    ".......KGGKMMMMM",  # 10
    ".......KGGKMLLLM",  # 11
    ".......KGGKMLLLM",  # 12
    ".......KGGKMlllM",  # 13
    ".......KGGKMMMMm",  # 14
    "........KGGKMMFF",  # 15
    "........KGgKMFFF",  # 16
    ".........KgKMFff",  # 17
    "......KKJJJJJKKK",  # 18
    ".....KJJJBJJJJJJ",  # 19
    "....KJJjJBJJJJJj",  # 20
    "....KJJjJBJJJJJj",  # 21
    "....KJJjJBJJJJJj",  # 22
    "....KJJjJBJJJJJj",  # 23
    "....KmmKJBJJJJJj",  # 24
    "....KmmKBBBBBBBy",  # 25
    ".....KKKPPPPPPPP",  # 26
    ".......KPPPPPPK.",  # 27
    ".......KPPPPPPK.",  # 28
    "......KsssssssK.",  # 29
    "......KKKKKKKKK.",  # 30
    "................",  # 31
]

def mirror(left):
    return [list(r + r[::-1]) for r in left]

def put(g, pts, c):
    for (x, y) in pts:
        if 0 <= x < 32 and 0 <= y < 32:
            g[y][x] = c

def base():
    g = mirror(LEFT)
    # hood highlight (light from top-left)
    put(g, [(12,4),(13,4),(10,5),(11,5),(9,6),(10,6),(9,7),(8,9),(8,10),(8,11)], 'H')
    # hood shadow on right
    put(g, [(22,6),(22,7),(23,9),(23,10),(23,11),(23,12),(23,13),(23,14),(22,15),(22,16),(21,16),(21,17)], 'g')
    # lens glints
    put(g, [(12,11),(18,11)], 'W')
    # jacket shading right side
    for y in range(20, 25):
        put(g, [(23,y),(24,y)], 'j')
    # rapeseed sprig in viewer-right hand
    put(g, [(27,y) for y in range(12, 28)], 'T')
    put(g, [(28,18),(29,17),(26,21),(25,20)], 't')
    put(g, [(26,10),(27,9),(28,10),(27,11),(29,12),(25,12),(26,13),(28,13)], 'Y')
    put(g, [(27,10),(26,11),(28,11),(28,12)], 'y')
    # outline the flowers lightly where they meet air (keep it airy: no outline)
    # hand over the stem
    put(g, [(26,24),(27,24),(26,25),(27,25)], 'm')
    put(g, [(28,24),(28,25)], 'K')
    return g

def copy(g):
    return [r[:] for r in g]

def shift_rows(g, top, bottom, dy):
    """move rows [top,bottom) by dy (positive = down), leaving rest"""
    out = copy(g)
    region = [g[y][:] for y in range(top, bottom)]
    for y in range(top, bottom):
        out[y] = ['.'] * 32
    for i, row in enumerate(region):
        ny = top + i + dy
        if 0 <= ny < 32:
            for x, c in enumerate(row):
                if c != '.':
                    out[ny][x] = c
    return out

def blink(g):
    out = copy(g)
    for y in range(32):
        for x in range(32):
            if out[y][x] in 'LW':
                out[y][x] = 'l'
    return out

def legs(g, phase):
    """phase 0: left foot lifted 1px, 1: right foot lifted 1px"""
    out = copy(g)
    xs = range(5, 16) if phase == 0 else range(16, 27)
    for x in xs:
        for y in range(27, 31):
            c = g[y][x]
            if c != '.' or y - 1 >= 27:
                out[y - 1][x] = c
        out[30][x] = '.'
    return out

def flower(out, tx, ty):
    """rapeseed cluster, (tx,ty) = topmost petal"""
    put(out, [(tx+dx, ty+dy) for dx, dy in [(-1,1),(0,0),(1,1),(0,2),(2,3),(-2,3),(-1,4),(1,4)]], 'Y')
    put(out, [(tx+dx, ty+dy) for dx, dy in [(0,1),(-1,2),(1,2),(1,3)]], 'y')

def wave(g, up):
    """arm raised holding the sprig high"""
    out = copy(g)
    for y in range(0, 26):
        for x in range(24, 32):
            out[y][x] = '.'
    for y in range(26, 32):
        for x in range(26, 32):
            if out[y][x] in 'Tt':
                out[y][x] = '.'
    # rebuild torso right edge / shoulder
    for y in range(20, 26):
        out[y][24] = 'K'
    out[25][24] = 'K'
    put(out, [(24,18)], 'K')
    put(out, [(23,19), (24,19)], 'J')
    if up:
        # arm straight-ish up, hand at rows 11-12
        arm = [(25,19),(26,19),(25,18),(26,18),(25,17),(26,17),(25,16),(26,16),(26,15),(27,15),(26,14),(27,14),(26,13),(27,13)]
        put(out, arm, 'J')
        put(out, [(25,19),(25,18)], 'j')
        put(out, [(27,19),(27,18),(27,17),(27,16),(28,15),(28,14),(28,13),
                  (24,17),(24,16),(24,15),(25,15),(25,14),(25,13)], 'K')
        put(out, [(26,11),(27,11),(26,12),(27,12)], 'm')
        put(out, [(25,11),(25,12),(28,11),(28,12)], 'K')
        put(out, [(27,y) for y in range(5, 11)], 'T')
        put(out, [(28,7)], 't')
        flower(out, 27, 1)
    else:
        # arm out to the side, hand at rows 13-14
        arm = [(25,19),(26,19),(25,18),(26,18),(26,17),(27,17),(26,16),(27,16),(27,15),(28,15)]
        put(out, arm, 'J')
        put(out, [(25,19),(25,18)], 'j')
        put(out, [(27,19),(27,18),(28,17),(28,16),(29,15),
                  (24,17),(25,17),(25,16),(26,15)], 'K')
        put(out, [(27,13),(28,13),(27,14),(28,14)], 'm')
        put(out, [(26,13),(26,14),(29,13),(29,14),(27,15) if False else (29,14)], 'K')
        put(out, [(28,y) for y in range(7, 13)], 'T')
        put(out, [(29,9)], 't')
        flower(out, 28, 3)
    return out

def sleep_pose(g):
    out = shift_rows(g, 0, 18, 2)  # head droops
    out = blink(out)
    for y in range(32):
        for x in range(32):
            if out[y][x] == 'l':
                out[y][x] = 'M'
    # closed lens line
    put(out, [(12,14),(13,14),(14,14),(17,14),(18,14),(19,14)], 'l')
    # fix neck gap rows 18-19 get covered by hood bottom; ok
    return out

FRAMES = {}
b = base()
FRAMES['idle0'] = b
FRAMES['idle1'] = shift_rows(b, 0, 26, 1)
FRAMES['blink'] = blink(b)
FRAMES['walk0'] = legs(b, 0)
FRAMES['walk1'] = shift_rows(b, 0, 27, 1)
FRAMES['walk2'] = legs(b, 1)
FRAMES['wave0'] = wave(b, False)
FRAMES['wave1'] = wave(b, True)
FRAMES['sleep0'] = sleep_pose(b)
FRAMES['sleep1'] = shift_rows(sleep_pose(b), 0, 26, 1)

# small emotes (8x8)
EMOTES = {
    'z': ["........",
          ".ZZZZ...",
          "...Z....",
          "..Z.....",
          ".ZZZZ...",
          "........",
          "........",
          "........"],
    'bang': ["...YY...",
             "...YY...",
             "...YY...",
             "...YY...",
             "........",
             "...YY...",
             "........",
             "........"],
    'heart': ["........",
              ".RR.RR..",
              "RRRRRRR.",
              "RRRRRRR.",
              ".RRRRR..",
              "..RRR...",
              "...R....",
              "........"],
}

def to_strings(g):
    return [''.join(r) for r in g]

def render(frames, path, scale=10):
    names = list(frames)
    W = len(names) * (32 * scale + 10)
    img = Image.new('RGB', (W, 32 * scale + 30), '#e9e6dc')
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        ox = i * (32 * scale + 10)
        for y, row in enumerate(frames[n]):
            for x, c in enumerate(row):
                if c != '.':
                    d.rectangle([ox + x*scale, y*scale, ox + x*scale + scale - 1, y*scale + scale - 1], fill=PAL[c])
        d.text((ox + 4, 32*scale + 8), n, fill='#000')
    img.save(path)

if __name__ == '__main__':
    render(FRAMES, 'frames_preview.png', 8)
    out = {'palette': PAL, 'frames': {k: to_strings(v) for k, v in FRAMES.items()}, 'emotes': EMOTES}
    json.dump(out, open('sprite.json', 'w'), indent=0)
    # sprite sheet at 1x
    sheet = Image.new('RGBA', (32 * len(FRAMES), 32), (0,0,0,0))
    for i, (k, f) in enumerate(FRAMES.items()):
        for y, row in enumerate(f):
            for x, c in enumerate(row):
                if c != '.':
                    sheet.putpixel((i*32 + x, y), tuple(int(PAL[c][j:j+2], 16) for j in (1,3,5)) + (255,))
    sheet.save('ripachok_spritesheet_32px.png')
    sheet.resize((sheet.width*4, sheet.height*4), Image.NEAREST).save('ripachok_spritesheet_4x.png')
    print('ok', list(FRAMES))
