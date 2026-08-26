'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getMangaDetail,
  getChapters,
  addToLibrary,
  removeFromLibrary,
  updateLibraryShelf,
  checkLibrary,
  getReadingProgress,
  MangaDetail,
  Chapter,
  LibraryShelf,
  ReadingProgress,
} from '@/lib/api';

type LangFilter = 'all' | 'en' | 'ja' | 'th';

export default function MangaDetailPage() {
  const params = useParams();
  const mangaId = params.id as string;

  const [manga, setManga] = useState<MangaDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [inLibrary, setInLibrary] = useState(false);
  const [libraryShelf, setLibraryShelf] = useState<LibraryShelf>('reading');
  const [progressList, setProgressList] = useState<ReadingProgress[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedLang, setSelectedLang] = useState<LangFilter>('all');
  const [chapterSearch, setChapterSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mangaId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const langParam = selectedLang === 'all' ? ['en', 'ja', 'th'] : [selectedLang];
        const [detail, chaptersData, libraryCheck, progressData] = await Promise.all([
          getMangaDetail(mangaId),
          getChapters(mangaId, 500, 0, sortOrder, langParam),
          checkLibrary(mangaId).catch(() => ({ inLibrary: false, shelf: 'reading' as LibraryShelf, category: 'reading' as LibraryShelf })),
          getReadingProgress(mangaId).catch(() => []),
        ]);
        setManga(detail);
        setChapters(chaptersData?.chapters || []);
        setTotalChapters(chaptersData?.total || 0);
        setInLibrary(libraryCheck.inLibrary);
        const resolvedShelf = libraryCheck.shelf || libraryCheck.category;
        if (resolvedShelf) setLibraryShelf(resolvedShelf);
        setProgressList(progressData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load manga');
      } finally {
        setLoading(false);
        setLoadingChapters(false);
      }
    };

    fetchData();
  }, [mangaId, sortOrder, selectedLang]);

  const handleToggleLibrary = async () => {
    if (!manga) return;
    try {
      if (inLibrary) {
        await removeFromLibrary(mangaId);
        setInLibrary(false);
      } else {
        await addToLibrary(mangaId, manga.title, manga.coverUrl, libraryShelf);
        setInLibrary(true);
      }
    } catch (err) {
      console.error('Library toggle failed:', err);
    }
  };

  const handleShelfChange = async (newShelf: LibraryShelf) => {
    setLibraryShelf(newShelf);
    if (inLibrary) {
      try {
        await updateLibraryShelf(mangaId, newShelf);
      } catch (err) {
        console.error('Update shelf failed:', err);
      }
    }
  };

  // Find latest read chapter for Continue Reading
  const lastReadInfo = useMemo(() => {
    if (!progressList || progressList.length === 0 || !chapters || chapters.length === 0) return null;
    const latest = progressList[0];
    const chapter = chapters.find((c) => c.id === latest.chapterId);
    return {
      chapterId: latest.chapterId,
      chapterNumber: chapter?.chapter || '?',
      pageIndex: latest.pageIndex,
    };
  }, [progressList, chapters]);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    const list = chapters || [];
    if (!chapterSearch.trim()) return list;
    const q = chapterSearch.toLowerCase().trim();
    return list.filter(
      (c) =>
        (c.chapter && c.chapter.toLowerCase().includes(q)) ||
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
            <img src={manga.coverUrl.replace('.256.jpg', '.512.jpg')} alt={manga.title} referrerPolicy="no-referrer" />
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

          <div className="manga-detail-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {manga.author && (
              <Link href={`/?q=${encodeURIComponent(manga.author)}`} title="ค้นหาผลงานของผู้แต่งนี้ (Author)">
                <span className="tag" style={{ cursor: 'pointer' }}>✍️ ผู้แต่ง: {manga.author}</span>
              </Link>
            )}
            {manga.artist && manga.artist !== manga.author && (
              <Link href={`/?q=${encodeURIComponent(manga.artist)}`} title="ค้นหาผลงานของผู้วาดนี้ (Artist)">
                <span className="tag" style={{ cursor: 'pointer' }}>🎨 ผู้วาด: {manga.artist}</span>
              </Link>
            )}
            {manga.status && <span>📊 สถานะมังงะ: {manga.status}</span>}
            {manga.year && <span>📅 ปีที่เผยแพร่: {manga.year}</span>}
            {manga.originalLanguage && <span>🌐 ภาษาต้นฉบับ: {manga.originalLanguage.toUpperCase()}</span>}
          </div>

          {manga.tags && manga.tags.length > 0 && (
            <div className="manga-detail-tags" style={{ marginTop: '12px' }}>
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
              {inLibrary ? '❌ ลบออกจากไลบรารี' : '📚 เพิ่มเข้าชั้นหนังสือ'}
            </button>

            {inLibrary && (
              <select
                value={libraryShelf}
                onChange={(e) => handleShelfChange(e.target.value as LibraryShelf)}
                title="ชั้นหนังสือ (Library Shelf)"
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

            {chapters && chapters.length > 0 && (
              <Link href={`/manga/${mangaId}/${chapters[0].id}`} className="btn btn-secondary">
                ▶️ เริ่มอ่านตอนแรก
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Continue Reading Prompt (Reading Progress) */}
      {lastReadInfo && (
        <div className="continue-card">
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)', marginBottom: '2px' }}>
              📍 ความคืบหน้าการอ่าน: ตอนที่ {lastReadInfo.chapterNumber} (หน้าที่ {lastReadInfo.pageIndex + 1})
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              กดปุ่มด้านขวาเพื่ออ่านต่อจากตำแหน่งล่าสุดทันที
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
        <div className="chapter-list-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2>📑 รายการตอน</h2>
            <span className="chapter-list-count">{totalChapters} ตอน</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Language filter pills */}
            <div className="pill-group">
              <button
                className={`pill-item ${selectedLang === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedLang('all')}
                title="ทุกภาษา"
              >
                🌐 ทั้งหมด
              </button>
              <button
                className={`pill-item ${selectedLang === 'en' ? 'active' : ''}`}
                onClick={() => setSelectedLang('en')}
                title="เฉพาะภาษาอังกฤษ"
              >
                🇬🇧 EN
              </button>
              <button
                className={`pill-item ${selectedLang === 'ja' ? 'active' : ''}`}
                onClick={() => setSelectedLang('ja')}
                title="เฉพาะภาษาญี่ปุ่น"
              >
                🇯🇵 JA
              </button>
              <button
                className={`pill-item ${selectedLang === 'th' ? 'active' : ''}`}
                onClick={() => setSelectedLang('th')}
                title="เฉพาะภาษาไทย"
              >
                🇹🇭 TH
              </button>
            </div>

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
                width: '130px',
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
            <p>กรุณาลองเปลี่ยนตัวกรองภาษา หรือค้นหาด้วยคำอื่น</p>
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
                  <span className={`chapter-lang lang-badge ${chapter.language}`}>{chapter.language}</span>
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
