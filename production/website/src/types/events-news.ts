export type EventNewsStatKey = 'groups' | 'players' | 'scores' | 'judges';

export interface EventNews {
  id: string;
  slug: string;
  title: string;
  date: string;
  dateRange: string;
  location: string;
  categoryLabel?: string;
  reportType?: 'event' | 'course';
  registrationPublic?: boolean;
  registrationStatus?: 'open' | 'closed';
  backLabel?: string;
  backHref?: string;
  coverImage?: string | null;
  summary: string;
  content: string;
  sourceUrl?: string;
  gallery?: string[];
  statLabels?: Partial<Record<EventNewsStatKey, string>>;
  facts?: {
    label: string;
    value: string;
  }[];
  relatedCourse?: {
    title: string;
    href: string;
    label?: string;
  };
  stats: {
    groups: number;
    players: number;
    scores: number;
    judges: number;
  };
  champions: {
    groupName: string;
    winner: string;
    score?: number;
  }[];
}
