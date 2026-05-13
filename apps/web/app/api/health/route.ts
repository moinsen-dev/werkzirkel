import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Health-Check für Uptime-Monitoring und Docker-Probes.
 * Erweitern um DB-Connectivity, sobald Drizzle initialisiert ist.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? 'dev',
  });
}
