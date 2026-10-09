"""Reproducible ClearPath mark drawn from simple vector geometry, no external artwork."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parent.parent / 'assets' / 'brand'
destination.mkdir(parents=True, exist_ok=True)
mark = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(mark)
draw.rounded_rectangle((342, 236, 458, 788), 58, fill='white')
draw.rounded_rectangle((566, 406, 682, 788), 58, fill='white')
mark = mark.rotate(-25, resample=Image.Resampling.BICUBIC)
icon = Image.new('RGB', (1024, 1024), '#173C57')
icon.paste(mark, mask=mark.getchannel('A'))
icon.save(destination / 'icon.png')
adaptive = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
scaled = mark.resize((640, 640), Image.Resampling.LANCZOS)
adaptive.alpha_composite(scaled, (192, 192))
adaptive.save(destination / 'adaptive.png')
adaptive.save(destination / 'monochrome.png')
mark.resize((256, 256), Image.Resampling.LANCZOS).save(destination / 'splash.png')
