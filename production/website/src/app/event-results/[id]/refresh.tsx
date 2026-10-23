'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RefreshResults() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => router.refresh(), 30000); return () => clearInterval(timer); }, [router]);
  return null;
}
