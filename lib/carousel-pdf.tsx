// V18.7 — Rendu PDF d'un CarouselPlan via @react-pdf/renderer.
//
// Direction artistique : Linear x Pitch x Granola x Stripe Docs.
// Minimal, calme, beaucoup de respiration, hiérarchie typographique
// forte, peu de texte par slide. Pas de templates Canva. Pas de
// gradients flashy. Une seule famille d'accent par slide.
//
// Format : 1080x1080 (carré LinkedIn natif). 1 slide = 1 page PDF.

import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';
import type { CarouselPlan, Slide } from './carousel';

// Charter pour les titres / hooks. Fallback Inter. Police pure
// (Helvetica par défaut React-PDF, propre, lisible).
// On évite les fonts externes pour ne pas avoir de fetch côté serverless.
// Inter sera utilisée via fallback Helvetica.

const ACCENT_COLORS: Record<string, { bg: string; fg: string; line: string }> = {
  brand:   { bg: '#FAFAF9', fg: '#0F172A', line: '#2563EB' },
  emerald: { bg: '#FAFAF9', fg: '#0F172A', line: '#047857' },
  amber:   { bg: '#FAFAF9', fg: '#0F172A', line: '#B45309' },
  ink:     { bg: '#F8FAFC', fg: '#0F172A', line: '#0F172A' },
};

const PAGE_SIZE = { width: 1080, height: 1080 };

const styles = StyleSheet.create({
  page: {
    padding: 80,
    backgroundColor: '#FAFAF9',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  // Slide content area (centered, with breathing room)
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  metric: {
    fontSize: 96,
    fontWeight: 'bold',
    letterSpacing: -2,
    color: '#0F172A',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    lineHeight: 1.2,
    color: '#0F172A',
    marginBottom: 20,
  },
  body: {
    fontSize: 22,
    lineHeight: 1.5,
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontSize: 32,
    lineHeight: 1.4,
    color: '#0F172A',
    fontWeight: 'medium',
    letterSpacing: -0.4,
  },
  // Footer area : signature + numéro de slide
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  brand: {
    fontSize: 12,
    color: '#64748B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  slideNum: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 'normal',
  },
  // Accent line (filet vertical signature Cadence)
  accentLine: {
    width: 3,
    height: 64,
    marginBottom: 24,
    backgroundColor: '#2563EB',
  },
  // Cover specific
  coverContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  coverEyebrow: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 56,
    fontWeight: 'bold',
    letterSpacing: -1.2,
    lineHeight: 1.15,
    color: '#0F172A',
  },
});

function eyebrowForKind(kind: Slide['kind']): string {
  return {
    hook:        'Ouverture',
    reveal:      'En réalité',
    proof:       'En chiffres',
    step:        'Étape',
    conclusion:  'À retenir',
    cta:         'Pour aller plus loin',
  }[kind];
}

function SlidePage({ slide, total, brand = 'CADENCE · HEELIO' }: { slide: Slide; total: number; brand?: string }) {
  const accent = ACCENT_COLORS[slide.accent || 'ink'] || ACCENT_COLORS.ink;
  return (
    <Page size={PAGE_SIZE} style={[styles.page, { backgroundColor: accent.bg }] as any}>
      <View>
        <View style={[styles.accentLine, { backgroundColor: accent.line }] as any} />
        <Text style={styles.eyebrow}>{eyebrowForKind(slide.kind)}</Text>
      </View>
      <View style={styles.content}>
        {slide.metric && <Text style={[styles.metric, { color: accent.line }] as any}>{slide.metric}</Text>}
        {slide.title && slide.title !== slide.body && <Text style={styles.title}>{slide.title}</Text>}
        <Text style={slide.kind === 'hook' ? styles.bodyLarge : styles.body}>
          {slide.body}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.brand}>{brand}</Text>
        <Text style={styles.slideNum}>{slide.index} / {total}</Text>
      </View>
    </Page>
  );
}

function CoverPage({ plan, brand = 'CADENCE · HEELIO' }: { plan: CarouselPlan; brand?: string }) {
  const accent = ACCENT_COLORS.brand;
  return (
    <Page size={PAGE_SIZE} style={[styles.page, { backgroundColor: accent.bg }] as any}>
      <View>
        <View style={[styles.accentLine, { backgroundColor: accent.line }] as any} />
      </View>
      <View style={styles.coverContent}>
        <Text style={styles.coverEyebrow}>{formatLabelLocal(plan.format)} · {plan.totalSlides} slides</Text>
        <Text style={styles.coverTitle}>{plan.hookLine}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.brand}>{brand}</Text>
        <Text style={styles.slideNum}>0 / {plan.totalSlides}</Text>
      </View>
    </Page>
  );
}

function formatLabelLocal(f: CarouselPlan['format']): string {
  return {
    pedagogical: 'Pédagogique',
    framework: 'Framework',
    breakdown: 'Décortiquage',
    'case-study': 'Cas client',
    timeline: 'Timeline',
    comparison: 'Comparaison',
  }[f];
}

export function CarouselDocument({ plan, brand }: { plan: CarouselPlan; brand?: string }) {
  return (
    <Document
      title={plan.hookLine.slice(0, 80)}
      author="Cadence"
      creator="Cadence (cadence-api)"
      subject={`Carrousel LinkedIn · ${formatLabelLocal(plan.format)}`}
    >
      <CoverPage plan={plan} brand={brand} />
      {plan.slides.map(s => (
        <SlidePage key={s.index} slide={s} total={plan.totalSlides} brand={brand} />
      ))}
    </Document>
  );
}
