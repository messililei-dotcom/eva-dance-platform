import { permanentRedirect } from 'next/navigation';

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next || '';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '';
  const landingPage = next.startsWith('/events') ? '/events' : '/';
  const query = new URLSearchParams({ login: '1' });
  if (next) query.set('next', next);
  permanentRedirect(`${landingPage}?${query.toString()}`);
}
