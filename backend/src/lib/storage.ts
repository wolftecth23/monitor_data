import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

export function screenshotDir(employeeId: string, date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return path.join(env.storageDir, "screenshots", employeeId, day);
}

export async function saveScreenshot(employeeId: string, date: Date, fileName: string, buffer: Buffer): Promise<string> {
  const dir = screenshotDir(employeeId, date);
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}
