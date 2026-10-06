import Image from 'next/image';
import Link from 'next/link';
import { cn } from 'cn';

const LOGO_SRC = '/assets/logo-dpp-flash.png';

type V2BrandLogoProps = {
  readonly href?: string;
  readonly className?: string;
  readonly priority?: boolean;
  /** Navy chip behind PNG so white wordmark stays readable on light UI. */
  readonly onDarkBackground?: boolean;
};

export function V2BrandLogo({
  href = '/dashboard/v2',
  className,
  priority,
  onDarkBackground = false,
}: V2BrandLogoProps) {
  const image = (
    <Image
      src={LOGO_SRC}
      alt="DPP-Flash"
      width={120}
      height={36}
      className={cn(
        'h-8 w-auto max-w-[140px] object-contain object-left',
        onDarkBackground && 'h-9 max-w-[160px]',
        className,
      )}
      priority={priority}
    />
  );

  const wrapped = onDarkBackground ? (
    <span
      className={cn(
        'inline-flex items-center rounded-lg bg-[#0c1929] px-3 py-2 shadow-sm ring-1 ring-white/10',
        className,
      )}
    >
      {image}
    </span>
  ) : (
    image
  );

  if (!href) {
    return wrapped;
  }

  if (onDarkBackground) {
    return (
      <Link
        href={href}
        className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
      >
        {wrapped}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40',
        className,
      )}
    >
      {image}
    </Link>
  );
}
