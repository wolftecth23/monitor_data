import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  storageDir: required("STORAGE_DIR", "./storage"),
  corsOrigin: required("CORS_ORIGIN", "http://localhost:5173"),
  // The address agent installers are told to connect to — must be reachable
  // from employee machines, which "localhost" usually isn't once deployed.
  publicBackendUrl: required("PUBLIC_BACKEND_URL", "http://localhost:4000"),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Monitor Alerts <alerts@example.com>",
  },
};
