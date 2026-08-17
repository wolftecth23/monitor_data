import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "./env.js";

const SCREENSHOT_JPEG_QUALITY = 70;
const SCREENSHOT_MAX_WIDTH = 1920;

export function screenshotDir(employeeId: string, date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return path.join(env.storageDir, "screenshots", employeeId, day);
}

export async function saveScreenshot(employeeId: string, date: Date, fileName: string, buffer: Buffer): Promise<string> {
  const dir = screenshotDir(employeeId, date);
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, fileName);

  const compressed = await sharp(buffer)
    .resize({ width: SCREENSHOT_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: SCREENSHOT_JPEG_QUALITY })
    .toBuffer();

  await fs.writeFile(fullPath, compressed);
  return fullPath;
}
