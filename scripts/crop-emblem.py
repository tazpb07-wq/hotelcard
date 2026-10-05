from PIL import Image

im = Image.open("src/assets/mercado-pago.png").convert("RGBA")
w, h = im.size
px = im.load()

# Find the first fully-transparent horizontal gap below the emblem
# (separates the circle from the "mercado pago" text)
gap_start = None
for y in range(h):
    row_empty = all(px[x, y][3] == 0 for x in range(0, w, 3))
    if not row_empty and gap_start is None:
        gap_start = None
    # track: find first empty row AFTER the emblem's first content row
    has_content = any(px[x, y][3] > 0 for x in range(0, w, 3))
    if has_content and gap_start is None:
        gap_start = y  # emblem starts
        break

emblem_top = gap_start
emblem_bottom = None
for y in range(emblem_top, h):
    has_content = any(px[x, y][3] > 0 for x in range(0, w, 3))
    if not has_content:
        emblem_bottom = y
        break

print("emblem rows:", emblem_top, emblem_bottom)
emblem = im.crop((0, emblem_top, w, emblem_bottom))
eb = emblem.getbbox()
emblem.crop(eb).save("src/assets/mercado-pago-icon.png")
print("saved", eb)
