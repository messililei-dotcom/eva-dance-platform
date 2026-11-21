export type ImportIdentityConflict = {
  key: string;
  phone: string;
  name: string;
  rows: number[];
  candidates: Array<{ id: number; name: string }>;
  canMerge: boolean;
  unavailable: boolean;
};

export type ImportIdentityDecision = {
  key: string;
  action: 'skip' | 'same' | 'merge';
  targetId?: number;
};
