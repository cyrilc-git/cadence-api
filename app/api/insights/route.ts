import { NextResponse } from 'next/server';
import { computeRadarInsights } from '@/lib/radar-insights';

export const runtime = 'nodejs';
export const maxDuration = 30;

// V8.9 §3+§4 — insights factuel pour Dashboard et Radar.
export async function GET() {
  try {
    const insights = await computeRadarInsights();
    return NextResponse.json({ insights, generated_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, insights: [] }, { status: 500 });
  }
}
