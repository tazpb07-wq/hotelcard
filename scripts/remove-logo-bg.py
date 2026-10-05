from PIL import Image
from collections import deque

SRC = "src/assets/mercado-pago.png"
im = Image.open(SRC).convert("RGBA")
w, h = im.size
px = im.load()

THRESH = 235

def is_white(p):
    return p[0] >= THRESH and p[1] >= THRESH and p[2] >= THRESH and p[3] > 0

# Flood-fill transparent only the white connected to the image border,
# keeping the white inside the emblem (hands) intact.
seen = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if is_white(px[x, y]):
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if is_white(px[x, y]):
            q.append((x, y))

while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    p = px[x, y]
    px[x, y] = (p[0], p[1], p[2], 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_white(px[nx, ny]):
            q.append((nx, ny))

# Trim to content bbox with a small margin
bbox = im.getbbox()
im.crop(bbox).save(SRC)
print("saved transparent logo", bbox)

# Also export the emblem alone (top circle) — dark text reads badly on blue
im2 = Image.open(SRC).convert("RGBA")
w2, h2 = im2.size
# emblem occupies roughly the top 58% of the logo
emblem = im2.crop((0, 0, w2, int(h2 * 0.58)))
eb = emblem.getbbox()
emblem.crop(eb).save("src/assets/mercado-pago-icon.png")
print("saved emblem", eb)
