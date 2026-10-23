'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { getStudentSession } from '@/lib/student-auth';
import { OPEN_STUDENT_LOGIN_EVENT } from '@/lib/ui-events';

type StudentProtectedLinkProps = ComponentProps<typeof Link> & {
  requireAuth?: boolean;
  documentNavigation?: boolean;
};

export default function StudentProtectedLink({ href, onClick, requireAuth = true, documentNavigation = false, ...props }: StudentProtectedLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!requireAuth || getStudentSession()) {
      if (documentNavigation) {
        event.preventDefault();
        window.location.assign(typeof href === 'string' ? href : href.pathname || '/events');
      }
      return;
    }

    event.preventDefault();
    const next = typeof href === 'string' ? href : href.pathname || '/events';
    window.dispatchEvent(new CustomEvent(OPEN_STUDENT_LOGIN_EVENT, { detail: { next } }));
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
