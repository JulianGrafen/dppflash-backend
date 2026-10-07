import { redirect } from 'next/navigation';

export default function LieferantenPage() {
  redirect('/dashboard/v2/produktpaesse?tab=lieferanten');
}
