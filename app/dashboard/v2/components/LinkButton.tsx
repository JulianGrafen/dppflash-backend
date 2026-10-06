import Link from 'next/link';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';

type LinkButtonProps = VariantProps<typeof buttonVariants> & {
  readonly href: string;
  readonly className?: string;
  readonly children: React.ReactNode;
  readonly onClick?: () => void;
  readonly target?: string;
  readonly rel?: string;
};

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  onClick,
  target,
  rel,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
