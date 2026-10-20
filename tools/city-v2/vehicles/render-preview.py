"""Render one quick visual check directly from the generated OBJ and PNG files."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
ASSET = ROOT / 'modpack/city-vehicles-resourcepack/assets/city_vehicles'
OUT = Path(__file__).parent / 'city-vehicles-preview.png'
S = 2
W, H = 1100 * S, 520 * S
image = Image.new('RGB', (W, H), '#e8e7df')
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((25*S,25*S,535*S,495*S),radius=22*S,fill='#f8f7f1')
draw.rounded_rectangle((565*S,25*S,1075*S,495*S),radius=22*S,fill='#f8f7f1')

def render(kind, color, cx, cy, scale):
    obj = ASSET / f'models/entity/automobile/frame/{kind}/main.obj'
    tex = Image.open(ASSET / f'textures/entity/automobile/frame/{color}.png').convert('RGB')
    vs, uvs, ns, faces = [], [], [], []
    for line in obj.read_text().splitlines():
        fields = line.split()
        if not fields: continue
        if fields[0] == 'v': vs.append(tuple(map(float, fields[1:4])))
        if fields[0] == 'vt': uvs.append(tuple(map(float, fields[1:3])))
        if fields[0] == 'vn': ns.append(tuple(map(float, fields[1:4])))
        if fields[0] == 'f':
            idx = [tuple(int(i)-1 for i in p.split('/')) for p in fields[1:4]]
            n = ns[idx[0][2]]
            if n[0]*4 + n[1]*3 - n[2]*6 <= 0: continue
            xyz = [vs[p[0]] for p in idx]
            uv = uvs[idx[0][1]]
            px, py = round(uv[0]*64), round((1-uv[1])*64)
            rgb = tex.getpixel((px,py))
            light = 1.10 if n[1] > .5 else (.89 if n[0] > .5 else .98)
            rgb = tuple(min(255, round(c*light)) for c in rgb)
            depth = sum(4*x + 3*y - 6*z for x,y,z in xyz)/3
            pts = [(int(cx*S + (x*.832+z*.555)*scale*S), int(cy*S + (x*.30-y*.91-z*.45)*scale*S)) for x,y,z in xyz]
            faces.append((depth, pts, rgb))
    draw.ellipse(((cx-145)*S,(cy+25)*S,(cx+145)*S,(cy+105)*S),fill='#d7d6ce')
    for _, pts, rgb in sorted(faces): draw.polygon(pts, fill=rgb)
    # In game Automobility renders these wheels from the selected stock wheel part.
    axle = 1.625 if kind == 'bus' else 1.0625
    side = .84 if kind == 'bus' else .72
    for z in (-axle, axle):
        x, y = side, .26
        px = int(cx*S + (x*.832+z*.555)*scale*S)
        py = int(cy*S + (x*.30-y*.91-z*.45)*scale*S)
        rr = (21 if kind == 'bus' else 24)*S
        draw.ellipse((px-rr,py-rr,px+rr,py+rr),fill='#292d2f')
        draw.ellipse((px-rr*.43,py-rr*.43,px+rr*.43,py+rr*.43),fill='#898d88')

render('sedan','sedan_blue',278,314,125)
render('bus','bus_cream',820,342,91)
try: font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',30*S)
except OSError: font = ImageFont.load_default()
draw.text((54*S,52*S),'普通城市轿车',fill='#20262a',font=font)
draw.text((594*S,52*S),'城市巴士',fill='#20262a',font=font)
image.resize((W//S,H//S),Image.Resampling.LANCZOS).save(OUT)
print(OUT)
