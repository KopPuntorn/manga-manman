function getApiUrl(): string {
  let url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

const API_URL = getApiUrl();
const mangaDetailRequests = new Map<string, Promise<MangaDetail>>();
const chapterListRequests = new Map<string, Promise<{ chapters: Chapter[]; total: number }>>();
const chapterPageRequests = new Map<string, Promise<ChapterPages>>();
const chapterTranslationRequests = new Map<string, Promise<Translation[]>>();
const translationRequests = new Map<string, Promise<Translation>>();

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
  original: string; // Source Text
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
  shelf?: LibraryShelf;
  category: LibraryShelf; // Backward compatibility alias for Library Shelf
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
  totalBookmarked: number; // Backward compatibility alias for totalLibraryEntries
  shelvesCount?: Record<string, number>;
  categoriesCount: Record<string, number>; // Backward compatibility alias for shelvesCount
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
  const existing = mangaDetailRequests.get(mangaId);
  if (existing) return existing;

  const request = fetchAPI<MangaDetail>(`/api/manga/${mangaId}`);
  mangaDetailRequests.set(mangaId, request);
  request.catch(() => mangaDetailRequests.delete(mangaId));
  return request;
}

export async function getChapters(
  mangaId: string,
  limit = 100,
  offset = 0,
  order: 'asc' | 'desc' = 'asc',
  languages?: string[]
) {
  const cacheKey = JSON.stringify({ mangaId, limit, offset, order, languages });
  const existing = chapterListRequests.get(cacheKey);
  if (existing) return existing;

  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());
  params.set('order', order);
  if (languages && languages.length > 0) {
    params.set('languages', languages.join(','));
  }

  const request = fetchAPI<{ chapters: Chapter[]; total: number }>(
    `/api/manga/${mangaId}/chapters?${params.toString()}`
  );
  chapterListRequests.set(cacheKey, request);
  request.catch(() => chapterListRequests.delete(cacheKey));
  return request;
}

export async function getChapterPages(chapterId: string) {
  const existing = chapterPageRequests.get(chapterId);
  if (existing) return existing;

  const request = fetchAPI<ChapterPages>(`/api/chapter/${chapterId}/pages`);
  chapterPageRequests.set(chapterId, request);
  request.catch(() => chapterPageRequests.delete(chapterId));
  return request;
}

export async function translatePage(chapterId: string, pageIndex: number, imageUrl: string) {
  const cacheKey = `${chapterId}:${pageIndex}`;
  const existing = translationRequests.get(cacheKey);
  if (existing) return existing;

  const request = fetchAPI<Translation>('/api/translate', {
    method: 'POST',
    body: JSON.stringify({ chapterId, pageIndex, imageUrl }),
  });
  translationRequests.set(cacheKey, request);
  request.then(
    () => translationRequests.delete(cacheKey),
    () => translationRequests.delete(cacheKey)
  );
  return request;
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
  const existing = chapterTranslationRequests.get(chapterId);
  if (existing) return existing;

  const request = fetchAPI<Translation[]>(`/api/translate/${chapterId}`);
  chapterTranslationRequests.set(chapterId, request);
  request.catch(() => chapterTranslationRequests.delete(chapterId));
  return request;
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

// Backward compatibility alias.
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

// Backward compatibility alias.
export const getHistory = getReadingProgress;

export async function getAllReadingProgress(limit = 50) {
  return fetchAPI<GlobalReadingProgressEntry[]>(`/api/progress?limit=${limit}`);
}

// Backward compatibility alias.
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

// Backward compatibility alias.
export const updateHistory = updateReadingProgress;
