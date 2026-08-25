'use client';

import { useState, useCallback } from 'react';
import { searchManga, MangaSearchResult } from '@/lib/api';
import Link from 'next/link';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const debounceRef = useCallback(() => {
    let timer: NodeJS.Timeout;
    return (fn: () => void, delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }, [])();

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await searchManga(value.trim());
        setResults(data.results);
        setTotal(data.total);
        setSearched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div>
      <section className="search-section">
        <div className="search-hero">
          <h1>Manga Manman</h1>
          <p>ค้นหามังงะจาก MangaDex · แปลไทยอัตโนมัติ</p>
        </div>

        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ค้นหามังงะ... (เช่น One Piece, Naruto, Attack on Titan)"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
      </section>

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <span className="loading-text">กำลังค้นหา...</span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>ไม่พบผลลัพธ์</h3>
          <p>ลองค้นหาด้วยชื่อภาษาอังกฤษหรือญี่ปุ่น</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          {total > 0 && (
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.85rem' }}>
              พบ {total} ผลลัพธ์
            </p>
          )}
          <div className="manga-grid">
            {results.map((manga) => (
              <Link href={`/manga/${manga.id}`} key={manga.id}>
                <div className="manga-card">
                  {manga.status && (
                    <span className="manga-card-status">{manga.status}</span>
                  )}
                  <div className="manga-card-image">
                    {manga.coverUrl ? (
                      <img
                        src={manga.coverUrl}
                        alt={manga.title}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        background: 'var(--bg-tertiary)',
                      }}>
                        📖
                      </div>
                    )}
                  </div>
                  <div className="manga-card-info">
                    <div className="manga-card-title">{manga.title}</div>
                    <div className="manga-card-meta">{manga.author || manga.artist || ''}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {!loading && !searched && (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <h3>ค้นหามังงะที่อยากอ่าน</h3>
          <p>พิมพ์ชื่อมังงะในช่องค้นหาด้านบน</p>
        </div>
      )}
    </div>
  );
}
