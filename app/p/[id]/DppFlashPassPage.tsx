import { getProductById } from '@/app/lib/mock-data';
import { resolveSamplePassForProduct } from '@/app/domain/dpp/resolveSamplePassForProduct';
import { BatteryPassView } from '@/components/dpp/battery-pass-view';
import { notFound } from 'next/navigation';

type DppFlashPassPageProps = {
  readonly passId: string;
};

export async function DppFlashPassPage({ passId }: DppFlashPassPageProps) {
  const product = await getProductById(passId);
  const pass = resolveSamplePassForProduct(passId, product);
  if (!pass) {
    notFound();
  }
  return <BatteryPassView pass={pass} />;
}
