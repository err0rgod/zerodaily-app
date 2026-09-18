import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("assets", exist_ok=True)

# 1. Main App Icon (1024x1024, dark background with neon emerald "0D" logo)
def make_app_icon(path, size=(1024, 1024), bg_color=(9, 13, 22), text="0D"):
    img = Image.new("RGBA", size, bg_color)
    draw = ImageDraw.Draw(img)
    
    # Outer glowing border ring
    margin = int(size[0] * 0.08)
    draw.rounded_rectangle(
        [margin, margin, size[0] - margin, size[1] - margin],
        radius=int(size[0] * 0.2),
        outline=(16, 185, 129, 200),
        width=int(size[0] * 0.02)
    )
    
    # Draw central "0D" mark
    cx, cy = size[0] // 2, size[1] // 2
    draw.ellipse([cx - 160, cy - 160, cx + 160, cy + 160], outline=(16, 185, 129, 255), width=28)
    draw.line([cx - 100, cy + 100, cx + 100, cy - 100], fill=(16, 185, 129, 255), width=24)
    
    img.save(path, "PNG")
    print(f"Generated {path}")

# 2. Splash Icon
def make_splash_icon(path):
    make_app_icon(path, size=(1024, 1024))

# 3. Notification Icon (White silhouette on transparent background for Android)
def make_notification_icon(path, size=(96, 96)):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, size[1] // 2
    draw.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], outline=(255, 255, 255, 255), width=6)
    draw.line([cx - 16, cy + 16, cx + 16, cy - 16], fill=(255, 255, 255, 255), width=6)
    img.save(path, "PNG")
    print(f"Generated {path}")

# 4. Favicon
def make_favicon(path, size=(48, 48)):
    make_app_icon(path, size=size)

make_app_icon("assets/icon.png")
make_app_icon("assets/adaptive-icon.png")
make_splash_icon("assets/splash-icon.png")
make_notification_icon("assets/notification-icon.png")
make_favicon("assets/favicon.png")
print("All assets generated successfully.")
