import { permanentRedirect } from 'next/navigation';

// Registration and login use the same verified SMS flow, including country codes.
export default function RegisterPage() {
  permanentRedirect('/?login=1&next=%2Fdashboard');
}
