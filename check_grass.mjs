import fs from 'fs';
import { PNG } from 'pngjs';
const data = fs.readFileSync('docs/screenshots/traffic-block.png');
const png = PNG.sync.read(data);
let grassCount = 0;
for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i+1], b = png.data[i+2];
    if (g > r + 10 && g > b + 10 && g < 150) {
        grassCount++;
    }
}
console.log('Green pixels:', grassCount, 'out of', png.width * png.height);
