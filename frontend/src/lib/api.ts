function getApiUrl(): string {
  let url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

const API_URL = getApiUrl();

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

export interface MangaTag {
  id: string;
  name: string;
  group: string;
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

export type LibraryShelf = 'reading' | 'plan_to_read' | 'completed' | 'dropped';

export interface LibraryEntry {
  id: number;
  mangaId: string;
  title: string;
  coverUrl: string;
  category: LibraryShelf;
  shelf?: LibraryShelf;
  addedAt: string;
}

export interface ReadingProgress {
  id: number;
  mangaId: string;
  chapterId: string;
  pageIndex: number;
  updatedAt: string;
}

export type ReadingHistory = ReadingProgress;

export interface GlobalReadingProgressEntry {
  id: number;
  mangaId: string;
  chapterId: string;
  pageIndex: number;
  updatedAt: string;
  title?: string;
  coverUrl?: string;
}

export type GlobalHistoryEntry = GlobalReadingProgressEntry;

export interface ReadingStats {
  totalChaptersRead: number;
  totalLibraryEntries?: number;
  totalBookmarked: number;
  shelvesCount?: Record<string, number>;
  categoriesCount: Record<string, number>;
}

export interface SearchFilterParams {
  query?: string;
  tags?: string[];
  status?: string;
  sortBy?: 'relevance' | 'latest' | 'rating' | 'followedCount' | 'title';
  contentRating?: string[];
  limit?: number;
  offset?: number;
}

// --- API Functions ---

export async function searchManga(query: string, limit = 20, offset = 0) {
  return searchMangaFiltered({ query, limit, offset });
}

export async function searchMangaFiltered(filters: SearchFilterParams) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.offset) params.set('offset', filters.offset.toString());
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.status) params.set('status', filters.status);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.contentRating && filters.contentRating.length > 0) {
    params.set('contentRating', filters.contentRating.join(','));
  }

  return fetchAPI<{ results: MangaSearchResult[]; total: number; limit: number; offset: number }>(
    `/api/manga/search?${params.toString()}`
  );
}

export async function getTags() {
  return fetchAPI<MangaTag[]>('/api/tags');
}

export async function getMangaDetail(mangaId: string) {
  return fetchAPI<MangaDetail>(`/api/manga/${mangaId}`);
}

export async function getChapters(
  mangaId: string,
  limit = 100,
  offset = 0,
  order: 'asc' | 'desc' = 'asc',
  languages?: string[]
) {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());
  params.set('order', order);
  if (languages && languages.length > 0) {
    params.set('languages', languages.join(','));
  }

  return fetchAPI<{ chapters: Chapter[]; total: number }>(
    `/api/manga/${mangaId}/chapters?${params.toString()}`
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

export async function updateTranslation(chapterId: string, pageIndex: number, texts: TextBlock[]) {
  return fetchAPI<{ chapterId: string; pageIndex: number; result: TranslationResult }>(
    `/api/translate/${chapterId}/${pageIndex}`,
    {
      method: 'PUT',
      body: JSON.stringify({ texts }),
    }
  );
}

export async function getChapterTranslations(chapterId: string) {
  return fetchAPI<Translation[]>(`/api/translate/${chapterId}`);
}

export async function getLibrary(shelf?: string) {
  const query = shelf && shelf !== 'all' ? `?shelf=${shelf}` : '';
  return fetchAPI<LibraryEntry[]>(`/api/library${query}`);
}

export async function addToLibrary(mangaId: string, title: string, coverUrl: string, shelf: LibraryShelf = 'reading') {
  return fetchAPI<LibraryEntry>('/api/library', {
    method: 'POST',
    body: JSON.stringify({ mangaId, title, coverUrl, shelf, category: shelf }),
  });
}

export async function updateLibraryShelf(mangaId: string, shelf: string) {
  return fetchAPI<{ mangaId: string; shelf: string; category: string }>(`/api/library/${mangaId}/shelf`, {
    method: 'PATCH',
    body: JSON.stringify({ shelf, category: shelf }),
  });
}

export const updateLibraryCategory = updateLibraryShelf;

export async function removeFromLibrary(mangaId: string) {
  return fetchAPI<void>(`/api/library/${mangaId}`, { method: 'DELETE' });
}

export async function checkLibrary(mangaId: string) {
  return fetchAPI<{ inLibrary: boolean; shelf?: LibraryShelf; category?: LibraryShelf }>(`/api/library/${mangaId}/check`);
}

export async function getReadingProgress(mangaId: string) {
  return fetchAPI<ReadingProgress[]>(`/api/progress/${mangaId}`);
}

export const getHistory = getReadingProgress;

export async function getAllReadingProgress(limit = 50) {
  return fetchAPI<GlobalReadingProgressEntry[]>(`/api/progress?limit=${limit}`);
}

export const getAllHistory = getAllReadingProgress;

export async function getReadingStats() {
  return fetchAPI<ReadingStats>('/api/stats');
}

export async function updateReadingProgress(mangaId: string, chapterId: string, pageIndex: number) {
  return fetchAPI<void>('/api/progress', {
    method: 'PUT',
    body: JSON.stringify({ mangaId, chapterId, pageIndex }),
  });
}

export const updateHistory = updateReadingProgress;



