

export enum Difficulty {
  Easy = 'Easy',
  Moderate = 'Moderate',
  Hard = 'Hard',
}

export enum Semester {
  First = '1',
  Second = '2',
  Third = '3',
}

export enum QuestionSource {
  Manual = 'Manual',
  Upload = 'Upload',
  Scan = 'Scan',
  Generated = 'Generated',
}

export interface UsedIn {
  year: number;
  semester: Semester;
  paperId: string;
}

export interface Question {
  id: string;
  user_id?: string;
  class: number;
  chapter: string;
  text: string;
  answer?: string;
  marks: number;
  difficulty: Difficulty;
  usedIn: UsedIn[];
  source: QuestionSource;
  year: number;
  semester: Semester;
  tags: string[];
  imageDataURL?: string;
}

export interface Paper {
  id: string;
  user_id?: string;
  title: string;
  year: number;
  class: number;
  semester: Semester;
  source: QuestionSource;
  fileType?: string;
  text?: string;
  dataURL?: string;
  questions: Question[];
  createdAt: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone_number: string;
  age: number;
  gender: string;
  address?: string;
  date_of_birth?: string;
  avatar_url?: string;
}

export type Language = 'en' | 'bn' | 'hi';

export type Tab = 'bank' | 'generator' | 'archive' | 'settings';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}