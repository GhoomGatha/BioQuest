
import { Tab } from './types';

export const LOCAL_STORAGE_KEY = 'bioquest_v1_0';
export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 26 }, (_, i) => 2020 + i);
export const CLASSES = [7, 8, 9, 10];
export const MARKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
export const SEMESTERS = ['1', '2', '3'];

export const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'bank', name: 'Question Bank', icon: '🧠' },
  { id: 'generator', name: 'Generator', icon: '🧾' },
  { id: 'archive', name: 'Archive', icon: '📚' },
  { id: 'settings', name: 'Settings', icon: '⚙️' },
];