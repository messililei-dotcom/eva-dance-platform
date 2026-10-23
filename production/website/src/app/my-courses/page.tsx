import { redirect } from 'next/navigation';

/** The former phone-number lookup page is retired in favour of Online Academy. */
export default function MyCoursesPage() {
  redirect('/dashboard/profile#online-courses');
}
