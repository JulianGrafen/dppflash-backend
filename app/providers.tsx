'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { readonly children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delay={300}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
