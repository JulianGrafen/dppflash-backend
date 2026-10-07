import { redirect } from 'next/navigation';

export default function ReadinessPage() {
  redirect('/dashboard/v2/produktpaesse?tab=readiness');
}
