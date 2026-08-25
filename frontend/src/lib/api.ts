const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json: APIResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'API request failed');
  }

  return json.data as T;
}

// --- Types ---

export interface MangaSearchResult {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  author: string;
  artist: string;
  status: string;
  year?: number;
  tags: string[];
}

export interface MangaDetail {
  id: string;
  title: string;
  altTitles?: string[];
  description: string;
  coverUrl: string;
  author: string;
  artist: string;
  status: string;
  year?: number;
  tags: string[];
  contentRating: string;
  originalLanguage: string;
}

export interface Chapter {
  id: string;
  chapter: string;
  title: string;
  volume?: string;
  pages: number;
  language: string;
  scanlationGroup?: string;
  publishedAt: string;
}

export interface ChapterPages {
  chapterId: string;
  pages: string[];
  pagesSaver: string[];
}

export interface TextBlock {
  original: string;
  thai: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TranslationResult {
  texts: TextBlock[];
}

export interface Translation {
  id: number;
  chapterId: string;
  pageIndex: number;
  result: TranslationResult;
  provider: string;
  createdAt: string;
}

export interface LibraryEntry {
  id: number;
  mangaId: string;
  title: string;
  coverUrl: string;
  addedAt: string;
}

export interface ReadingHistory {
  id: number;
  mangaId: string;
  chapterId: string;
  pageIndex: number;
  updatedAt: string;
}

// --- API Functions ---

export async function searchManga(query: string, limit = 20, offset = 0) {
  return fetchAPI<{ results: MangaSearchResult[]; total: number; limit: number; offset: number }>(
    `/api/manga/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
  );
}

export async function getMangaDetail(mangaId: string) {
  return fetchAPI<MangaDetail>(`/api/manga/${mangaId}`);
}

export async function getChapters(mangaId: string, limit = 100, offset = 0) {
  return fetchAPI<{ chapters: Chapter[]; total: number }>(
    `/api/manga/${mangaId}/chapters?limit=${limit}&offset=${offset}`
  );
}

export async function getChapterPages(chapterId: string) {
  return fetchAPI<ChapterPages>(`/api/chapter/${chapterId}/pages`);
}

export async function translatePage(chapterId: string, pageIndex: number, imageUrl: string) {
  return fetchAPI<Translation>('/api/translate', {
    method: 'POST',
    body: JSON.stringify({ chapterId, pageIndex, imageUrl }),
  });
}

export async function getChapterTranslations(chapterId: string) {
  return fetchAPI<Translation[]>(`/api/translate/${chapterId}`);
}

export async function getLibrary() {
  return fetchAPI<LibraryEntry[]>('/api/library');
}

export async function addToLibrary(mangaId: string, title: string, coverUrl: string) {
  return fetchAPI<LibraryEntry>('/api/library', {
    method: 'POST',
    body: JSON.stringify({ mangaId, title, coverUrl }),
  });
}

export async function removeFromLibrary(mangaId: string) {
  return fetchAPI<void>(`/api/library/${mangaId}`, { method: 'DELETE' });
}

export async function checkLibrary(mangaId: string) {
  return fetchAPI<{ inLibrary: boolean }>(`/api/library/${mangaId}/check`);
}

export async function getHistory(mangaId: string) {
  return fetchAPI<ReadingHistory[]>(`/api/history/${mangaId}`);
}

export async function updateHistory(mangaId: string, chapterId: string, pageIndex: number) {
  return fetchAPI<void>('/api/history', {
    method: 'PUT',
    body: JSON.stringify({ mangaId, chapterId, pageIndex }),
  });
}
