import { redirect } from 'next/navigation';

// Keep bookmarked links on the canonical, server-authorized member course list.
export default function MyCoursesPage() {
  redirect('/dashboard/profile#online-courses');
}
