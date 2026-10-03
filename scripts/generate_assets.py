import os
import shutil
import re
from PIL import Image
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

# 1. Locate source SVG
SOURCE_SVG = r"D:\zerodaily\z.svg"
if not os.path.exists(SOURCE_SVG):
    SOURCE_SVG = os.path.join(ASSETS_DIR, "z.svg")

if not os.path.exists(SOURCE_SVG):
    raise FileNotFoundError(f"Source SVG not found at {SOURCE_SVG}")

# Copy source SVG to assets for safekeeping
target_svg = os.path.join(ASSETS_DIR, "z.svg")
if os.path.abspath(SOURCE_SVG) != os.path.abspath(target_svg):
    shutil.copyfile(SOURCE_SVG, target_svg)
    print(f"Copied source SVG to {target_svg}")

with open(SOURCE_SVG, "r", encoding="utf-8") as f:
    raw_svg = f.read()

# Extract defs
defs_match = re.search(r"<defs>.*?</defs>", raw_svg, re.DOTALL)
defs_str = defs_match.group(0) if defs_match else ""

# Extract the artwork group
group_match = re.search(r'(<g transform="matrix\(1, 0, 0, 1, 236, 0.*?)</svg>', raw_svg, re.DOTALL)
if not group_match:
    raise ValueError("Could not extract artwork group from SVG")
group_str = group_match.group(1).replace('#010101', '#000000')

def build_svg(scale=1.0, bg_color="#000000"):
    """
    Centers the artwork group in a 1500x1500 viewBox and applies the desired scale.
    Artwork bounding box is x=[277.5, 1196.53] (center 737.015), y=[250.92, 1248.39] (center 749.655).
    """
    transform = f"translate(750, 750) scale({scale}) translate(-737.015, -749.655)"
    bg_element = f'<rect width="1500" height="1500" fill="{bg_color}" />' if bg_color else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1500 1500" width="100%" height="100%">
{defs_str}
{bg_element}
<g transform="{transform}">
{group_str}
</g>
</svg>"""

# Find Chrome executable
chrome_paths = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
chrome_bin = next((p for p in chrome_paths if os.path.exists(p)), None)

with sync_playwright() as p:
    launch_kwargs = {"headless": True}
    if chrome_bin:
        launch_kwargs["executable_path"] = chrome_bin
    browser = p.chromium.launch(**launch_kwargs)
    page = browser.new_page(viewport={"width": 1024, "height": 1024})

    # 1. Main App Icon (1024x1024, scale 1.0, solid black #000000 background)
    # Designed for iOS squircle and default app icon.
    icon_svg = build_svg(scale=1.0, bg_color="#000000")
    page.set_content(f'<!DOCTYPE html><html><body style="margin:0;padding:0;background:#000000;">{icon_svg}</body></html>')
    icon_path = os.path.join(ASSETS_DIR, "icon.png")
    page.screenshot(path=icon_path)
    print(f"Generated {icon_path} (1024x1024, scale 1.0)")

    # 2. Android Adaptive Icon (1024x1024, scale 0.70, solid black #000000 background)
    # Scaled to fit within the Android 66% circular safe zone with zero clipping on any launcher.
    adaptive_svg = build_svg(scale=0.70, bg_color="#000000")
    page.set_content(f'<!DOCTYPE html><html><body style="margin:0;padding:0;background:#000000;">{adaptive_svg}</body></html>')
    adaptive_path = os.path.join(ASSETS_DIR, "adaptive-icon.png")
    page.screenshot(path=adaptive_path)
    print(f"Generated {adaptive_path} (1024x1024, scale 0.70)")

    # 3. Splash Icon (1024x1024, scale 0.70, solid black #000000 background)
    # Displayed on splash screen centered with contain resizeMode.
    splash_path = os.path.join(ASSETS_DIR, "splash-icon.png")
    shutil.copyfile(adaptive_path, splash_path)
    print(f"Generated {splash_path} (1024x1024)")

    browser.close()

# 4. Web Favicon (48x48 PNG)
# Downsample the 1024x1024 icon using high-quality Lanczos resampling.
im_icon = Image.open(icon_path)
favicon_path = os.path.join(ASSETS_DIR, "favicon.png")
im_favicon = im_icon.resize((48, 48), Image.Resampling.LANCZOS)
im_favicon.save(favicon_path, "PNG")
print(f"Generated {favicon_path} (48x48)")

# 5. Notification Icon (96x96 PNG, monochrome white silhouette on transparent background)
# Android requires notification icons to be pure white silhouette with transparent background.
im_adaptive = Image.open(adaptive_path).convert("L")
mask_96 = im_adaptive.resize((96, 96), Image.Resampling.LANCZOS)
notif_icon = Image.new("RGBA", (96, 96), (255, 255, 255, 0))
notif_icon.putalpha(mask_96)
notif_path = os.path.join(ASSETS_DIR, "notification-icon.png")
notif_icon.save(notif_path, "PNG")
print(f"Generated {notif_path} (96x96, white monochrome silhouette)")

print("All app icon assets generated successfully from D:/zerodaily/z.svg.")
