'use client';

import { useState, useEffect, useCallback } from 'react';
import { searchMangaFiltered, MangaSearchResult, getTags, MangaTag } from '@/lib/api';
import Link from 'next/link';

// Curated full genre catalog with Thai labels & emojis
const ALL_GENRES: { name: string; tagId: string; emoji: string }[] = [
  { name: 'ทั้งหมด (All)', tagId: '', emoji: '🔥' },
  { name: '18+ ผู้ใหญ่ (Mature/18+)', tagId: 'erotica_mature', emoji: '🔞' },
  { name: 'เอตจิ (Ecchi)', tagId: '9ab53f92-3eed-4e9b-903a-1e04e7525d19', emoji: '🔥' },
  { name: 'เร่าร้อน (Smut)', tagId: 'faa39aa8-524d-4451-abda-9528669f30ce', emoji: '💋' },
  { name: 'ฮาเร็ม (Harem)', tagId: 'cafaa103-9c3a-44e5-a580-91045785512e', emoji: '👥' },
  { name: 'แอ็กชัน (Action)', tagId: '391b0423-d847-456f-aff0-8b0cfc03066b', emoji: '⚔️' },
  { name: 'โรแมนติก (Romance)', tagId: '423e2eae-a7a2-4a8b-ac03-a8351462d71d', emoji: '💖' },
  { name: 'แฟนตาซี (Fantasy)', tagId: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc', emoji: '🧙' },
  { name: 'ต่างโลก (Isekai)', tagId: 'ace04997-f6bd-436e-b261-779182193d3d', emoji: '🌀' },
  { name: 'คอมเมดี้ (Comedy)', tagId: '4d32cc48-9f00-4cca-9b5a-a839f0764984', emoji: '😂' },
  { name: 'ชีวิตประจำวัน (Slice of Life)', tagId: 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9', emoji: '☕' },
  { name: 'สืบสวน/ลึกลับ (Mystery)', tagId: 'ee968347-2c5e-40f8-974e-0a93ce3e0325', emoji: '🔍' },
  { name: 'ไซไฟ (Sci-Fi)', tagId: '256c8bd9-4904-450f-bf8f-0d0a1176b055', emoji: '🚀' },
  { name: 'สยองขวัญ (Horror)', tagId: 'cdad7e68-1419-41dd-bdce-27753074a640', emoji: '👻' },
  { name: 'ศิลปะการต่อสู้ (Martial Arts)', tagId: '799c5027-f04e-4940-ab94-49c001a10ffc', emoji: '🥋' },
  { name: 'ดราม่า (Drama)', tagId: 'b9af3a63-f058-46de-a9a0-e0c13906197a', emoji: '🎭' },
  { name: 'เหนือธรรมชาติ (Supernatural)', tagId: 'eabc54f4-2c92-45e0-ab0d-452f8423f73d', emoji: '🔮' },
  { name: 'ผจญภัย (Adventure)', tagId: '87cc87cd-a395-47af-b27a-93258283bbc6', emoji: '🗺️' },
  { name: 'กีฬา (Sports)', tagId: '69964a6f-2cf0-4244-ba3e-3e8edd8b4772', emoji: '⚽' },
  { name: 'จิตวิทยา (Psychological)', tagId: '3b60b75c-a2d7-4860-ab56-05f391bb889c', emoji: '🧠' },
  { name: 'ระทึกขวัญ (Thriller)', tagId: '07064557-a424-4ad3-ab55-55048afab7a3', emoji: '🩸' },
  { name: 'ในโรงเรียน (School Life)', tagId: 'caaa444e-0144-49e6-a5fb-3beab485c737', emoji: '🏫' },
  { name: 'ประวัติศาสตร์ (Historical)', tagId: '33771934-028e-4cb3-8744-691e866a9a71', emoji: '🏰' },
  { name: 'หุ่นยนต์ (Mecha)', tagId: '50880a9d-5440-4732-9afb-8f457127e836', emoji: '🤖' },
  { name: 'ดนตรี (Music)', tagId: 'f42fbf9e-188a-447b-9fdc-f19dc1e4d685', emoji: '🎵' },
];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRating, setSelectedRating] = useState<'all' | 'safe' | 'suggestive' | 'mature'>('all');
  const [sortBy, setSortBy] = useState<'followedCount' | 'latest' | 'rating' | 'relevance'>('followedCount');

  // Manga Results
  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [spotlightManga, setSpotlightManga] = useState<MangaSearchResult | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 24;

  // Resolve contentRating array based on selection
  const getContentRatings = (rating: 'all' | 'safe' | 'suggestive' | 'mature', tag: string): string[] => {
    if (tag === 'erotica_mature' || rating === 'mature') {
      return ['erotica', 'pornographic', 'suggestive'];
    }
    if (rating === 'safe') return ['safe'];
    if (rating === 'suggestive') return ['safe', 'suggestive'];
    return ['safe', 'suggestive', 'erotica', 'pornographic'];
  };

  // Execute Search / Filter Query
  const executeSearch = useCallback(
    async (
      q: string,
      tag: string,
      status: string,
      rating: 'all' | 'safe' | 'suggestive' | 'mature',
      sort: 'followedCount' | 'latest' | 'rating' | 'relevance',
      isLoadMore = false,
      currentOffset = 0
    ) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const activeTag = tag === 'erotica_mature' ? undefined : (tag ? [tag] : undefined);
        const activeRatings = getContentRatings(rating, tag);

        const data = await searchMangaFiltered({
          query: q.trim() || undefined,
          tags: activeTag,
          status: status || undefined,
          contentRating: activeRatings,
          sortBy: sort,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });

        if (isLoadMore) {
          setResults((prev) => [...prev, ...data.results]);
        } else {
          setResults(data.results);
          if (!q && !tag && data.results.length > 0 && currentOffset === 0) {
            setSpotlightManga(data.results[0]);
          }
        }
        setTotal(data.total);
        setOffset(currentOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load: Popular Manga (All ratings)
  useEffect(() => {
    executeSearch('', '', '', 'all', 'followedCount', false, 0);
  }, [executeSearch]);

  // Submit search form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    executeSearch(query, selectedTag, selectedStatus, selectedRating, query ? 'relevance' : sortBy, false, 0);
  };

  // Genre Tag Click
  const handleTagClick = (tagId: string) => {
    setSelectedTag(tagId);
    setOffset(0);
    const newRating = tagId === 'erotica_mature' ? 'mature' : selectedRating;
    if (tagId === 'erotica_mature') setSelectedRating('mature');
    executeSearch(query, tagId, selectedStatus, newRating, sortBy, false, 0);
  };

  // Status Filter Change
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setOffset(0);
    executeSearch(query, selectedTag, status, selectedRating, sortBy, false, 0);
  };

  // Content Rating Change
  const handleRatingChange = (rating: 'all' | 'safe' | 'suggestive' | 'mature') => {
    setSelectedRating(rating);
    setOffset(0);
    executeSearch(query, selectedTag, selectedStatus, rating, sortBy, false, 0);
  };

  // Sort Order Change
  const handleSortChange = (sort: 'followedCount' | 'latest' | 'rating' | 'relevance') => {
    setSortBy(sort);
    setOffset(0);
    executeSearch(query, selectedTag, selectedStatus, selectedRating, sort, false, 0);
  };

  // Load More Next Page
  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE;
    executeSearch(query, selectedTag, selectedStatus, selectedRating, sortBy, true, nextOffset);
  };


  return (
    <div>
      {/* Top Search Hero */}
      <section className="search-section">
        <div className="search-hero">
          <h1>Manga Manman 📖🇹🇭</h1>
          <p>อ่านมังงะสุดมันส์จาก MangaDex พร้อมแปลไทยอัตโนมัติด้วย AI ลื่นไหลทันที</p>
        </div>

        <form onSubmit={handleSubmit} className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อมังงะ... (เช่น Solo Leveling, Mushoku Tensei, One Piece, Jujutsu Kaisen)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" style={{ position: 'absolute', right: '8px', top: '8px' }}>
            ค้นหา
          </button>
        </form>
      </section>

      {/* Featured Spotlight Banner (when no search query) */}
      {!query && !selectedTag && spotlightManga && (
        <section className="hero-spotlight">
          {spotlightManga.coverUrl && (
            <div
              className="hero-spotlight-bg"
              style={{ backgroundImage: `url(${spotlightManga.coverUrl})` }}
            />
          )}
          <div className="hero-spotlight-content">
            <div className="hero-spotlight-cover">
              {spotlightManga.coverUrl ? (
                <img src={spotlightManga.coverUrl} alt={spotlightManga.title} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                  📖
                </div>
              )}
            </div>
            <div className="hero-spotlight-details">
              <span className="hero-spotlight-tag">🌟 มังงะยอดนิยมประจำสัปดาห์</span>
              <h2 className="hero-spotlight-title">{spotlightManga.title}</h2>
              <p className="hero-spotlight-desc">
                {spotlightManga.description || 'เปิดอ่านมังงะเรื่องนี้พร้อมระบบแปลภาษาไทยอัตโนมัติจาก Manga Manman'}
              </p>
              <div className="hero-spotlight-actions">
                <Link href={`/manga/${spotlightManga.id}`} className="btn btn-primary">
                  ⚡ เริ่มอ่านเลย (Read Now)
                </Link>
                <Link href={`/manga/${spotlightManga.id}`} className="btn btn-secondary">
                  📖 ดูรายละเอียดตอน
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter & Comprehensive Genre Explorer Section */}
      <section className="filter-section" style={{ marginBottom: '32px' }}>
        {/* Genre Chips */}
        <div className="filter-row" style={{ alignItems: 'flex-start' }}>
          <span className="filter-label" style={{ paddingTop: '6px' }}>หมวดหมู่ ({ALL_GENRES.length}):</span>
          <div className="filter-chips" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {ALL_GENRES.map((g) => (
              <button
                key={g.tagId}
                type="button"
                className={`chip ${selectedTag === g.tagId ? 'active' : ''}`}
                onClick={() => handleTagClick(g.tagId)}
              >
                <span>{g.emoji}</span>
                <span>{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status & Sort Navigation Row */}
        <div className="filter-row" style={{ justifyContent: 'space-between', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
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
              เรียงลำดับ:
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
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <option value="followedCount">🌟 ยอดนิยมสูงสุด (Most Popular)</option>
              <option value="latest">⚡ อัปเดตล่าสุด (Latest Updates)</option>
              <option value="rating">⭐ คะแนนรีวิวสูงสุด (Top Rated)</option>
              <option value="relevance">🎯 ความตรงของผลค้นหา (Relevance)</option>
            </select>
          </div>
        </div>

        {/* Content Rating Filter Row */}
        <div className="filter-row" style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <span className="filter-label">ระดับเนื้อหา:</span>
          <div className="pill-group">
            <button
              type="button"
              className={`pill-item ${selectedRating === 'all' ? 'active' : ''}`}
              onClick={() => handleRatingChange('all')}
            >
              🔥 รวมทุกเนื้อหา (All)
            </button>
            <button
              type="button"
              className={`pill-item ${selectedRating === 'safe' ? 'active' : ''}`}
              onClick={() => handleRatingChange('safe')}
            >
              🌱 ทุกวัย (Safe)
            </button>
            <button
              type="button"
              className={`pill-item ${selectedRating === 'suggestive' ? 'active' : ''}`}
              onClick={() => handleRatingChange('suggestive')}
            >
              ⚡ ทั่วไป (Suggestive)
            </button>
            <button
              type="button"
              className={`pill-item ${selectedRating === 'mature' ? 'active' : ''}`}
              onClick={() => handleRatingChange('mature')}
              style={{ color: selectedRating === 'mature' ? '#fff' : '#f87171' }}
            >
              🔞 18+ ผู้ใหญ่ (Mature & Erotica)
            </button>
          </div>
        </div>

      </section>

      {/* Error Banner */}
      {error && <div className="error-message">{error}</div>}

      {/* Manga Grid Loading & Content */}
      {loading ? (
        <div className="loading-container" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          <span className="loading-text">กำลังโหลดและจัดเรียงมังงะ...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>ไม่พบมังงะตามเงื่อนไขที่ระบุ</h3>
          <p>ลองปรับคำค้นหาหรือเลือกหมวดหมู่อื่นดูครับ</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{query ? `ผลการค้นหา "${query}"` : selectedTag ? `หมวดหมู่: ${ALL_GENRES.find((g) => g.tagId === selectedTag)?.name || ''}` : '🔥 รายการมังงะแนะนำ & ยอดนิยม'}</span>
            </h2>
            {total > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                แสดง {results.length} จากทั้งหมด {total} เรื่อง
              </span>
            )}
          </div>

          <div className="manga-grid">
            {results.map((manga) => (
              <Link href={`/manga/${manga.id}`} key={manga.id}>
                <div className="manga-card">
                  {manga.status && (
                    <span
                      className="manga-card-status"
                      style={{
                        background: manga.status === 'completed' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(0, 0, 0, 0.75)',
                        color: manga.status === 'completed' ? '#fff' : 'var(--accent-primary)',
                      }}
                    >
                      {manga.status === 'completed' ? 'จบแล้ว' : 'กำลังออน'}
                    </span>
                  )}
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
                          fontSize: '2.5rem',
                          background: 'var(--bg-tertiary)',
                        }}
                      >
                        📖
                      </div>
                    )}
                  </div>
                  <div className="manga-card-info">
                    <div className="manga-card-title" title={manga.title}>{manga.title}</div>
                    <div className="manga-card-meta">{manga.author || manga.artist || 'MangaDex'}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Load More Button */}
          {results.length < total && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <button
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ minWidth: '200px', padding: '12px 28px', fontSize: '0.95rem', fontWeight: 600 }}
              >
                {loadingMore ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    กำลังโหลดเพิ่มเติม...
                  </span>
                ) : (
                  `📖 โหลดมังงะเพิ่มเติม (+${PAGE_SIZE})`
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
