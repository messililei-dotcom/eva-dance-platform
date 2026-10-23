import { permanentRedirect } from 'next/navigation';

export default function TrainingCalendarPage() {
  permanentRedirect('/offline/schedule');
}
