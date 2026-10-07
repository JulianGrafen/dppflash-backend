import { redirect } from 'next/navigation';

export default function ProduktePage() {
  redirect('/dashboard/v2/produktpaesse?tab=produkte');
}
