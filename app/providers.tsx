'use client';

import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { readonly children: React.ReactNode }) {
  return <TooltipProvider delay={300}>{children}</TooltipProvider>;
}
