/** Semantic surfaces for Dashboard v2 (light + dark via CSS variables). */
export const v2GridShell =
  'rounded-xl border border-border bg-muted/30 text-foreground dark:bg-muted/20';

export const v2Panel =
  'border-border bg-card text-card-foreground';

export const v2PanelMuted =
  'border-border/80 bg-muted/40 text-foreground';

/** Sticky editor column: bounded to viewport with internal scroll. */
export const editorStickyAside =
  'hidden lg:flex lg:min-h-0 lg:flex-col lg:sticky lg:top-4 lg:self-start lg:h-[calc(100dvh-2rem)] lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden';
