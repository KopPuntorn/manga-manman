'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getMangaDetail,
  getChapters,
  addToLibrary,
  removeFromLibrary,
  updateLibraryCategory,
  checkLibrary,
  getHistory,
  MangaDetail,
  Chapter,
  ReadingHistory,
} from '@/lib/api';

export default function MangaDetailPage() {
  const params = useParams();
  const mangaId = params.id as string;

  const [manga, setManga] = useState<MangaDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [inLibrary, setInLibrary] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState('reading');
  const [history, setHistory] = useState<ReadingHistory[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [chapterSearch, setChapterSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mangaId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [detail, chaptersData, libraryCheck, historyData] = await Promise.all([
          getMangaDetail(mangaId),
          getChapters(mangaId, 500, 0, sortOrder),
          checkLibrary(mangaId).catch(() => ({ inLibrary: false, category: 'reading' })),
          getHistory(mangaId).catch(() => []),
        ]);
        setManga(detail);
        setChapters(chaptersData.chapters);
        setTotalChapters(chaptersData.total);
        setInLibrary(libraryCheck.inLibrary);
        if (libraryCheck.category) setLibraryCategory(libraryCheck.category);
        setHistory(historyData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load manga');
      } finally {
        setLoading(false);
        setLoadingChapters(false);
      }
    };

    fetchData();
  }, [mangaId, sortOrder]);

  const handleToggleLibrary = async () => {
    if (!manga) return;
    try {
      if (inLibrary) {
        await removeFromLibrary(mangaId);
        setInLibrary(false);
      } else {
        await addToLibrary(mangaId, manga.title, manga.coverUrl, libraryCategory);
        setInLibrary(true);
      }
    } catch (err) {
      console.error('Library toggle failed:', err);
    }
  };

  const handleCategoryChange = async (newCategory: string) => {
    setLibraryCategory(newCategory);
    if (inLibrary) {
      try {
        await updateLibraryCategory(mangaId, newCategory);
      } catch (err) {
        console.error('Update category failed:', err);
      }
    }
  };

  // Find latest read chapter for Continue Reading
  const lastReadInfo = useMemo(() => {
    if (!history || history.length === 0 || chapters.length === 0) return null;
    const latest = history[0]; // Assuming history contains most recent
    const chapter = chapters.find((c) => c.id === latest.chapterId);
    return {
      chapterId: latest.chapterId,
      chapterNumber: chapter?.chapter || '?',
      pageIndex: latest.pageIndex,
    };
  }, [history, chapters]);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    if (!chapterSearch.trim()) return chapters;
    const q = chapterSearch.toLowerCase().trim();
    return chapters.filter(
      (c) =>
        c.chapter.toLowerCase().includes(q) ||
        (c.title && c.title.toLowerCase().includes(q))
    );
  }, [chapters, chapterSearch]);

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <span className="loading-text">กำลังโหลดข้อมูลมังงะ...</span>
      </div>
    );
  }

  if (error || !manga) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '0 20px' }}>
        <div className="error-message">{error || 'Manga not found'}</div>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link href="/" className="btn btn-primary">
            ← กลับไปหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/" className="back-button">
        ← กลับไปค้นหา
      </Link>

      <div className="manga-detail">
        <div className="manga-detail-cover">
          {manga.coverUrl ? (
            <img src={manga.coverUrl.replace('.256.jpg', '.512.jpg')} alt={manga.title} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '4rem',
                background: 'var(--bg-tertiary)',
              }}
            >
              📖
            </div>
          )}
        </div>

        <div className="manga-detail-info">
          <h1>{manga.title}</h1>

          <div className="manga-detail-meta">
            {manga.author && <span>✍️ {manga.author}</span>}
            {manga.artist && manga.artist !== manga.author && <span>🎨 {manga.artist}</span>}
            {manga.status && <span>📊 {manga.status}</span>}
            {manga.year && <span>📅 {manga.year}</span>}
            {manga.originalLanguage && <span>🌐 {manga.originalLanguage.toUpperCase()}</span>}
          </div>

          {manga.tags && manga.tags.length > 0 && (
            <div className="manga-detail-tags">
              {manga.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {manga.description && <div className="manga-detail-description">{manga.description}</div>}

          <div className="manga-detail-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <button
              className={`btn ${inLibrary ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleToggleLibrary}
            >
              {inLibrary ? '❌ ลบออกจากไลบรารี' : '📚 เพิ่มในไลบรารี'}
            </button>

            {inLibrary && (
              <select
                value={libraryCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                }}
              >
                <option value="reading">📖 กำลังอ่าน (Reading)</option>
                <option value="plan_to_read">📌 วางแผนจะอ่าน (Plan to Read)</option>
                <option value="completed">✅ อ่านจบแล้ว (Completed)</option>
                <option value="dropped">⏸️ พักไว้ก่อน (Dropped)</option>
              </select>
            )}

            {chapters.length > 0 && (
              <Link href={`/manga/${mangaId}/${chapters[0].id}`} className="btn btn-secondary">
                ▶️ เริ่มอ่านตอนแรก
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Continue Reading Prompt */}
      {lastReadInfo && (
        <div className="continue-card">
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: '2px' }}>
              📍 อ่านค้างไว้ที่ ตอนที่ {lastReadInfo.chapterNumber} (หน้าที่ {lastReadInfo.pageIndex + 1})
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              กดปุ่มด้านขวาเพื่ออ่านต่อจากจุดเดิมได้ทันที
            </div>
          </div>
          <Link
            href={`/manga/${mangaId}/${lastReadInfo.chapterId}`}
            className="btn btn-primary btn-sm"
            style={{ whiteSpace: 'nowrap' }}
          >
            📖 อ่านต่อทันที →
          </Link>
        </div>
      )}

      {/* Chapter List Section */}
      <div className="chapter-list">
        <div className="chapter-list-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2>📑 รายการตอน</h2>
            <span className="chapter-list-count">{totalChapters} ตอน</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search chapter input */}
            <input
              type="text"
              placeholder="ค้นหาตอน..."
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                width: '140px',
              }}
            />

            {/* Sort order toggle */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              title="สลับการเรียงลำดับตอน"
            >
              {sortOrder === 'asc' ? '⬆️ น้อยไปมาก' : '⬇️ มากไปน้อย'}
            </button>
          </div>
        </div>

        {loadingChapters ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">กำลังโหลดรายการตอน...</span>
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>ไม่พบตอนที่ค้นหา</h3>
            <p>กรุณาลองค้นหาด้วยคำอื่น หรือมังงะเรื่องนี้ยังไม่มีตอนที่พร้อมอ่าน</p>
          </div>
        ) : (
          filteredChapters.map((chapter) => (
            <Link href={`/manga/${mangaId}/${chapter.id}`} key={chapter.id}>
              <div className="chapter-item">
                <div className="chapter-item-left">
                  <span className="chapter-number">Ch. {chapter.chapter || '?'}</span>
                  <span className="chapter-title">{chapter.title || ''}</span>
                </div>
                <div className="chapter-item-right">
                  <span className="chapter-lang">{chapter.language}</span>
                  {chapter.scanlationGroup && <span>{chapter.scanlationGroup}</span>}
                  <span>{chapter.pages}p</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
