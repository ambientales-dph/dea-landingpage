export interface AssociatedFile {
  id: string;
  name: string;
  size: string;
  type: 'document' | 'image' | 'video' | 'audio' | 'other';
  url?: string;
  driveId?: string;
  trelloId?: string;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  occurredAt: string;
  category: Category;
  tags: string[] | null;
  associatedFiles: AssociatedFile[];
  isImportant: boolean;
  history: string[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL:string | null;
}
