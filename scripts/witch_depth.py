"""Build a depth map for the witch painting (src/assets/img/witch.webp) -> src/assets/img/witch_depth.png.

The painting is flat; this gives it volume for the 2.5D rig (src/scene/witch.ts):
  * the silhouette is "inflated" (deeper toward the middle, thin at the edges),
  * the face is an ellipsoid with a nose ridge, sitting in front of the hood,
  * the hands (skin pixels below the neck) come forward of the chest.
White = closest to the viewer. Run: python scripts/witch_depth.py [--preview out.png]
"""
import sys
import cv2
import numpy as np

SRC = 'src/assets/img/witch.webp'
OUT = 'src/assets/img/witch_depth.png'

im = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)  # BGRA, 1020x1300
h, w = im.shape[:2]
alpha = im[:, :, 3].astype(np.float32) / 255.0
mask = (alpha > 0.5).astype(np.uint8)

# 1. inflate the silhouette: sqrt of the distance to the edge
dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
inflate = np.sqrt(dist / dist.max())

yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

# 2. face ellipsoid + nose ridge
fx, fy, rx, ry = 512.0, 355.0, 122.0, 168.0
r2 = ((xx - fx) / rx) ** 2 + ((yy - fy) / ry) ** 2
face = np.sqrt(np.clip(1.0 - r2, 0.0, 1.0))
nose = np.exp(-(((xx - 512.0) / 13.0) ** 2 + ((yy - 392.0) / 38.0) ** 2))

# 3. hands: warm, light pixels below the neck
hsv = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2HSV).astype(np.float32)
hue, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
skin = ((hue < 25) | (hue > 165)) & (sat > 35) & (sat < 170) & (val > 120)
skin &= (yy > 585) & (yy < 1060) & (xx > 280) & (xx < 760) & (mask > 0)
skin = skin.astype(np.uint8) * 255
skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
# the bare chest between the hands is skin too, but it sits behind them
chest = ((xx - 512.0) / 72.0) ** 2 + ((yy - 640.0) / 74.0) ** 2 < 1.0
skin[chest] = 0
# keep the big blobs only (the two hands and wrists), with ring holes filled
contours, _ = cv2.findContours(skin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
keep = np.zeros_like(skin)
for c in contours:
    if cv2.contourArea(c) > 4000:
        cv2.drawContours(keep, [c], -1, 255, thickness=cv2.FILLED)
hands = cv2.GaussianBlur(keep.astype(np.float32) / 255.0, (0, 0), 14)
hands = hands / max(hands.max(), 1e-6)
# fingertips reach further forward than the wrists, which sink into the sleeves
hands *= np.clip(1.15 - (yy - 600.0) / 600.0, 0.4, 1.0)

depth = 0.42 * inflate + 0.34 * face + 0.07 * nose + 0.42 * hands
depth = cv2.GaussianBlur(depth, (0, 0), 5)
depth *= mask
depth = depth / depth.max()

small = cv2.resize(depth, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
cv2.imwrite(OUT, np.clip(small * 255.0, 0, 255).astype(np.uint8))
print('wrote', OUT, small.shape, 'hands px', int((keep > 0).sum()))

if '--preview' in sys.argv:
    out = sys.argv[sys.argv.index('--preview') + 1]
    vis = cv2.applyColorMap(np.clip(depth * 255, 0, 255).astype(np.uint8), cv2.COLORMAP_MAGMA)
    side = np.hstack([cv2.resize(im[:, :, :3], (w // 2, h // 2)), cv2.resize(vis, (w // 2, h // 2))])
    cv2.imwrite(out, side)
