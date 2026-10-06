# Dashboard v2 (User-Testing Mock) — Page Overrides

Overrides `MASTER.md` for `/dashboard/v2` only.

- **Layout**: max-width `max-w-lg` (520–640px feel) on mobile-first; desktop wizard may use `max-w-5xl` with sidebar.
- **Tone**: B2B compliance, trustworthy, low TTV — one primary action per screen.
- **Auth**: Corporate email only; clear inline validation, no freemail providers.
- **Status**: Use badges for AI-erkannt, Prüfen, Fehlt, Bestätigt (Lucide icons, no emoji).
- **Progress**: Always show concrete counts (e.g. „3 Angaben fehlen“, „2 müssen geprüft werden“), not only percent.
- **Upload**: Large dropzone, document queue with processing states.
- **Components**: shadcn/ui (base-nova), `cursor-pointer` on all interactive cards.
