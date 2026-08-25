'use client';

import { useState, useEffect, useCallback } from 'react';
import { searchMangaFiltered, MangaSearchResult } from '@/lib/api';
import Link from 'next/link';

// Common MangaDex genre tag IDs
const POPULAR_GENRES = [
  { name: '🔥 ทั้งหมด (All)', tagId: '' },
  { name: '⚔️ Action', tagId: '391b0423-d847-456f-aff0-8b0cfc03066b' },
  { name: '💖 Romance', tagId: '423e2eae-a7a2-4a8b-ac03-a8351462d71d' },
  { name: '😂 Comedy', tagId: '4d32cc48-9f00-4cca-9b5a-a839f0764984' },
  { name: '🧙 Fantasy', tagId: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc' },
  { name: '🌀 Isekai', tagId: 'ace04997-f6bd-436e-b261-779182193d3d' },
  { name: '☕ Slice of Life', tagId: 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9' },
  { name: '🔍 Mystery', tagId: 'ee968347-2c5e-40f8-974e-0a93ce3e0325' },
  { name: '🚀 Sci-Fi', tagId: '256c8bd9-4904-450f-bf8f-0d0a1176b055' },
  { name: '👻 Horror', tagId: 'cdad7e68-1419-41dd-bdce-27753074a640' },
];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState<'followedCount' | 'latest' | 'rating' | 'relevance'>('followedCount');

  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeSearch = useCallback(
    async (q: string, tag: string, status: string, sort: 'followedCount' | 'latest' | 'rating' | 'relevance') => {
      setLoading(true);
      setError('');
      try {
        const data = await searchMangaFiltered({
          query: q.trim() || undefined,
          tags: tag ? [tag] : undefined,
          status: status || undefined,
          sortBy: sort,
          limit: 24,
          offset: 0,
        });
        setResults(data.results);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load: Popular Manga
  useEffect(() => {
    executeSearch('', '', '', 'followedCount');
  }, [executeSearch]);

  // Handle Search Input Change
  const handleQueryChange = (val: string) => {
    setQuery(val);
  };

  // Submit search
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, selectedTag, selectedStatus, query ? 'relevance' : sortBy);
  };

  // Genre Tag Click
  const handleTagClick = (tagId: string) => {
    setSelectedTag(tagId);
    executeSearch(query, tagId, selectedStatus, sortBy);
  };

  // Status Filter Change
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    executeSearch(query, selectedTag, status, sortBy);
  };

  // Sort Order Change
  const handleSortChange = (sort: 'followedCount' | 'latest' | 'rating' | 'relevance') => {
    setSortBy(sort);
    executeSearch(query, selectedTag, selectedStatus, sort);
  };

  return (
    <div>
      <section className="search-section">
        <div className="search-hero">
          <h1>Manga Manman 📖🇹🇭</h1>
          <p>อ่านมังงะสุดมันส์จาก MangaDex พร้อมแปลไทยอัตโนมัติด้วย AI</p>
        </div>

        <form onSubmit={handleSubmit} className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อมังงะ... (เช่น Solo Leveling, One Piece, Jujutsu Kaisen, Oshi no Ko)"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" style={{ margin: '4px' }}>
            ค้นหา
          </button>
        </form>
      </section>

      {/* Filter & Genre Section */}
      <section className="filter-section">
        {/* Genre Chips */}
        <div className="filter-row">
          <span className="filter-label">หมวดหมู่:</span>
          <div className="filter-chips">
            {POPULAR_GENRES.map((g) => (
              <button
                key={g.tagId}
                type="button"
                className={`chip ${selectedTag === g.tagId ? 'active' : ''}`}
                onClick={() => handleTagClick(g.tagId)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        {/* Status & Sort Controls */}
        <div className="filter-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="filter-label">สถานะ:</span>
            <div className="pill-group">
              <button
                type="button"
                className={`pill-item ${selectedStatus === '' ? 'active' : ''}`}
                onClick={() => handleStatusChange('')}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                className={`pill-item ${selectedStatus === 'ongoing' ? 'active' : ''}`}
                onClick={() => handleStatusChange('ongoing')}
              >
                กำลังเผยแพร่ (Ongoing)
              </button>
              <button
                type="button"
                className={`pill-item ${selectedStatus === 'completed' ? 'active' : ''}`}
                onClick={() => handleStatusChange('completed')}
              >
                จบแล้ว (Completed)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="filter-label" style={{ minWidth: 'auto' }}>
              เรียงตาม:
            </span>
            <select
              value={sortBy}
              onChange={(e) =>
                handleSortChange(e.target.value as 'followedCount' | 'latest' | 'rating' | 'relevance')
              }
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: '0.8rem',
              }}
            >
              <option value="followedCount">🌟 ยอดนิยมสูงสุด (Most Popular)</option>
              <option value="latest">⚡ อัปเดตล่าสุด (Latest Updates)</option>
              <option value="rating">⭐ คะแนนรีวิวสูงสุด (Top Rated)</option>
              <option value="relevance">🎯 ความตรงของผลค้นหา (Relevance)</option>
            </select>
          </div>
        </div>
      </section>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-container" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          <span className="loading-text">กำลังค้นหาและจัดเรียงมังงะ...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>ไม่พบมังงะตามเงื่อนไขที่ระบุ</h3>
          <p>ลองปรับคำค้นหาหรือเลือกหมวดหมู่อื่นดูครับ</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {query ? `ผลการค้นหา "${query}"` : '🔥 มังงะแนะนำ & ยอดนิยม'}
            </h2>
            {total > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                พบทั้งหมด {total} เรื่อง
              </span>
            )}
          </div>

          <div className="manga-grid">
            {results.map((manga) => (
              <Link href={`/manga/${manga.id}`} key={manga.id}>
                <div className="manga-card">
                  {manga.status && <span className="manga-card-status">{manga.status}</span>}
                  <div className="manga-card-image">
                    {manga.coverUrl ? (
                      <img src={manga.coverUrl} alt={manga.title} loading="lazy" />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem',
                          background: 'var(--bg-tertiary)',
                        }}
                      >
                        📖
                      </div>
                    )}
                  </div>
                  <div className="manga-card-info">
                    <div className="manga-card-title">{manga.title}</div>
                    <div className="manga-card-meta">{manga.author || manga.artist || 'MangaDex'}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
