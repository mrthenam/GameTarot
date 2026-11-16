"""Relief maps for the entrance door painting (src/assets/img/door.webp), for the 2.5D door in stage.ts.

Writes to src/assets/img/:
  door_normal.webp  tangent-space normal map: gold filigree and frames raised, ebony recessed
  door_orm.webp     packed material map: R = 1 (no AO), G = roughness, B = metalness (gold shines)
  door_runes.webp   glow mask of the purple runes (white = rune), pulsed in the game
Run: python scripts/door_maps.py
"""
import cv2
import numpy as np

SRC = 'src/assets/img/door.webp'
im = cv2.imread(SRC, cv2.IMREAD_COLOR)
h, w = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
hue, sat, val = hsv[:, :, 0], hsv[:, :, 1] / 255.0, hsv[:, :, 2] / 255.0
luma = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0

# gold inlay: warm hue, saturated, bright
gold = ((hue > 12) & (hue < 38) & (sat > 0.3) & (val > 0.35)).astype(np.float32)
gold = cv2.GaussianBlur(gold, (0, 0), 1.0)
# runes: violet, saturated, bright
runes = ((hue > 118) & (hue < 165) & (sat > 0.28) & (val > 0.45)).astype(np.float32)
runes = cv2.GaussianBlur(runes, (0, 0), 1.6)

# height: inlay sits proud of the wood; broad light areas (frames, bosses) a little higher
height = 0.62 * cv2.GaussianBlur(gold, (0, 0), 1.3) + 0.38 * cv2.GaussianBlur(luma, (0, 0), 5.0)
height -= 0.25 * runes  # runes are carved in

# normals from the height gradient (OpenGL convention: +Y up, image rows grow downward)
strength = 6.0
gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3)
gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3)
nx, ny, nz = -gx * strength, gy * strength, np.ones_like(height)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.dstack([nz / ln, ny / ln, nx / ln])  # BGR order for OpenCV: B=z, G=y, R=x
cv2.imwrite('src/assets/img/door_normal.webp', np.clip((normal * 0.5 + 0.5) * 255, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 92])

# material: gold is metallic and smoother, wood is rough and dielectric
rough = 0.82 - 0.42 * gold
metal = 0.75 * gold
orm = np.dstack([metal, rough, np.ones_like(rough)])  # BGR: B=metal, G=rough, R=ao
cv2.imwrite('src/assets/img/door_orm.webp', np.clip(orm * 255, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 90])

cv2.imwrite('src/assets/img/door_runes.webp', np.clip(np.dstack([runes] * 3) * 255, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 90])
print('door maps', (w, h), 'gold %.1f%%' % (gold.mean() * 100), 'runes %.1f%%' % (runes.mean() * 100))
