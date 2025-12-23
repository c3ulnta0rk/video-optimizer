import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcon() {
  try {
    const iconPath = path.join(__dirname, '../src-tauri/icons/icon.png');
    const outputPath = path.join(__dirname, '../src-tauri/icons/icon.ico');
    
    // Standard Windows icon sizes
    const sizes = [16, 32, 48, 64, 128, 256];
    
    // Resize the image to each size and collect buffers
    const buffers = await Promise.all(
      sizes.map(async (size) => {
        const buffer = await sharp(iconPath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
          })
          .png()
          .toBuffer();
        return buffer;
      })
    );
    
    // Convert to ICO
    // Note: to-ico might have issues with 256, so let's try without it first
    const ico = await toIco(buffers.slice(0, 5), {
      sizes: sizes.slice(0, 5)
    });
    
    // Write the ICO file
    fs.writeFileSync(outputPath, ico);
    
    console.log('✅ Successfully generated icon.ico from icon.png');
    console.log(`   Created with sizes: ${sizes.slice(0, 5).join('x, ')}x`);
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();

