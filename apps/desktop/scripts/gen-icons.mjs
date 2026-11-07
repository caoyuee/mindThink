/**
 * 生成 Tauri 跨平台图标
 *
 * 用 png-to-ico 把 PNG 转成真正的 ICO（Windows RC.EXE 要求 ICO 3.00 格式）
 * 同时复制/调整成 icns 命名（macOS 实际打包时 .icns 需要专用工具，此处占位）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'src-tauri', 'icons');

const sources = [
  { file: '32x32.png', size: 32 },
  { file: '128x128.png', size: 128 },
  { file: '128x128@2x.png', size: 256 },
  { file: '256x256.png', size: 256 },
];

async function main() {
  // 1. 生成真正的 ICO（Windows）
  const pngs = sources.map((s) => readFileSync(resolve(iconsDir, s.file)));
  const ico = await pngToIco(pngs);
  writeFileSync(resolve(iconsDir, 'icon.ico'), ico);
  console.log(`✓ icon.ico (${ico.length} bytes)`);

  // 2. icns 占位：直接复制 256x256 PNG（实际发布需要 png2icns 工具）
  const png256 = readFileSync(resolve(iconsDir, '256x256.png'));
  writeFileSync(resolve(iconsDir, 'icon.icns'), png256);
  console.log('✓ icon.icns (PNG 临时,发布前用 png2icns 转换)');

  // 3. icon.png 顶层图标（Linux 部分桌面环境要求）
  writeFileSync(resolve(iconsDir, 'icon.png'), png256);
  console.log('✓ icon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});