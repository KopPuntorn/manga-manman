'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getMangaDetail,
  getChapters,
  addToLibrary,
  removeFromLibrary,
  checkLibrary,
  MangaDetail,
  Chapter,
} from '@/lib/api';

export default function MangaDetailPage() {
  const params = useParams();
  const mangaId = params.id as string;

  const [manga, setManga] = useState<MangaDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [inLibrary, setInLibrary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mangaId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [detail, chaptersData, libraryCheck] = await Promise.all([
          getMangaDetail(mangaId),
          getChapters(mangaId, 200),
          checkLibrary(mangaId).catch(() => ({ inLibrary: false })),
        ]);
        setManga(detail);
        setChapters(chaptersData.chapters);
        setTotalChapters(chaptersData.total);
        setInLibrary(libraryCheck.inLibrary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load manga');
      } finally {
        setLoading(false);
        setLoadingChapters(false);
      }
    };

    fetchData();
  }, [mangaId]);

  const toggleLibrary = async () => {
    if (!manga) return;
    try {
      if (inLibrary) {
        await removeFromLibrary(mangaId);
        setInLibrary(false);
      } else {
        await addToLibrary(mangaId, manga.title, manga.coverUrl);
        setInLibrary(true);
      }
    } catch (err) {
      console.error('Library toggle failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="loading-text">กำลังโหลดข้อมูลมังงะ...</span>
      </div>
    );
  }

  if (error || !manga) {
    return <div className="error-message">{error || 'Manga not found'}</div>;
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
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '4rem',
              background: 'var(--bg-tertiary)',
            }}>
              📖
            </div>
          )}
        </div>

        <div className="manga-detail-info">
          <h1>{manga.title}</h1>

          <div className="manga-detail-meta">
            {manga.author && <span>✍️ {manga.author}</span>}
            {manga.artist && manga.artist !== manga.author && (
              <span>🎨 {manga.artist}</span>
            )}
            {manga.status && <span>📊 {manga.status}</span>}
            {manga.year && <span>📅 {manga.year}</span>}
            {manga.originalLanguage && (
              <span>🌐 {manga.originalLanguage.toUpperCase()}</span>
            )}
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

          {manga.description && (
            <div className="manga-detail-description">
              {manga.description}
            </div>
          )}

          <div className="manga-detail-actions">
            <button
              className={`btn ${inLibrary ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleLibrary}
            >
              {inLibrary ? '❌ ลบออกจากไลบรารี' : '📚 เพิ่มในไลบรารี'}
            </button>
          </div>
        </div>
      </div>

      <div className="chapter-list">
        <div className="chapter-list-header">
          <h2>📑 รายการตอน</h2>
          <span className="chapter-list-count">
            {totalChapters} ตอน
          </span>
        </div>

        {loadingChapters ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">กำลังโหลดรายการตอน...</span>
          </div>
        ) : chapters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>ยังไม่มีตอน</h3>
            <p>มังงะเรื่องนี้ยังไม่มีตอนที่อ่านได้</p>
          </div>
        ) : (
          chapters.map((chapter) => (
            <Link
              href={`/manga/${mangaId}/${chapter.id}`}
              key={chapter.id}
            >
              <div className="chapter-item">
                <div className="chapter-item-left">
                  <span className="chapter-number">
                    Ch. {chapter.chapter || '?'}
                  </span>
                  <span className="chapter-title">
                    {chapter.title || ''}
                  </span>
                </div>
                <div className="chapter-item-right">
                  <span className="chapter-lang">{chapter.language}</span>
                  {chapter.scanlationGroup && (
                    <span>{chapter.scanlationGroup}</span>
                  )}
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
