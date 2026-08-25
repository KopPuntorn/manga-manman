'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getLibrary,
  removeFromLibrary,
  updateLibraryCategory,
  LibraryEntry,
} from '@/lib/api';

type CategoryTab = 'all' | 'reading' | 'plan_to_read' | 'completed' | 'dropped';

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLibrary = useCallback(async (cat: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getLibrary(cat === 'all' ? undefined : cat);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary(activeCategory);
  }, [activeCategory, fetchLibrary]);

  const handleRemove = async (mangaId: string) => {
    if (!confirm('ต้องการลบมังงะเรื่องนี้ออกจากไลบรารีใช่หรือไม่?')) return;
    try {
      await removeFromLibrary(mangaId);
      setEntries((prev) => prev.filter((e) => e.mangaId !== mangaId));
    } catch (err) {
      console.error('Failed to remove from library:', err);
    }
  };

  const handleCategoryChange = async (mangaId: string, newCategory: string) => {
    try {
      await updateLibraryCategory(mangaId, newCategory);
      setEntries((prev) =>
        prev.map((e) =>
          e.mangaId === mangaId
            ? { ...e, category: newCategory as LibraryEntry['category'] }
            : e
        )
      );
      if (activeCategory !== 'all' && activeCategory !== newCategory) {
        setEntries((prev) => prev.filter((e) => e.mangaId !== mangaId));
      }
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'reading':
        return 'badge-reading';
      case 'plan_to_read':
        return 'badge-plan_to_read';
      case 'completed':
        return 'badge-completed';
      case 'dropped':
        return 'badge-dropped';
      default:
        return 'badge-reading';
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'reading':
        return '📖 กำลังอ่าน';
      case 'plan_to_read':
        return '📌 จะอ่าน';
      case 'completed':
        return '✅ จบแล้ว';
      case 'dropped':
        return '⏸️ พักไว้';
      default:
        return '📖 กำลังอ่าน';
    }
  };

  return (
    <div>
      <div className="library-header">
        <div>
          <h1>📚 ไลบรารีของฉัน</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            รายการมังงะที่คุณติดตามและบันทึกไว้
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {entries.length} เรื่อง
        </span>
      </div>

      {/* Category Tabs */}
      <div className="category-tabs">
        <button
          className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          ทั้งหมด
        </button>
        <button
          className={`category-tab ${activeCategory === 'reading' ? 'active' : ''}`}
          onClick={() => setActiveCategory('reading')}
        >
          📖 กำลังอ่าน (Reading)
        </button>
        <button
          className={`category-tab ${activeCategory === 'plan_to_read' ? 'active' : ''}`}
          onClick={() => setActiveCategory('plan_to_read')}
        >
          📌 วางแผนจะอ่าน (Plan to Read)
        </button>
        <button
          className={`category-tab ${activeCategory === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveCategory('completed')}
        >
          ✅ อ่านจบแล้ว (Completed)
        </button>
        <button
          className={`category-tab ${activeCategory === 'dropped' ? 'active' : ''}`}
          onClick={() => setActiveCategory('dropped')}
        >
          ⏸️ พักไว้ก่อน (Dropped)
        </button>
      </div>

      {loading ? (
        <div className="loading-container" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          <span className="loading-text">กำลังโหลดไลบรารี...</span>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3>ไม่พบมังงะในหมวดนี้</h3>
          <p>
            {activeCategory === 'all'
              ? 'คุณยังไม่มีมังงะในไลบรารี ค้นหาเรื่องที่ชอบแล้วกดเพิ่มได้เลย!'
              : 'ยังไม่มีมังงะที่ถูกจัดอยู่ในหมวดหมู่นี้'}
          </p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
            🔍 ค้นหามังงะ
          </Link>
        </div>
      ) : (
        <div className="manga-grid">
          {entries.map((entry) => (
            <div key={entry.mangaId} style={{ position: 'relative' }}>
              <Link href={`/manga/${entry.mangaId}`}>
                <div className="manga-card">
                  <div className="manga-card-image">
                    {entry.coverUrl ? (
                      <img src={entry.coverUrl} alt={entry.title} loading="lazy" />
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
                    <div className="manga-card-title">{entry.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className={`badge-category ${getCategoryBadgeClass(entry.category)}`}>
                        {getCategoryLabel(entry.category)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Action dropdown on card */}
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  display: 'flex',
                  gap: '4px',
                  zIndex: 10,
                }}
              >
                <select
                  value={entry.category || 'reading'}
                  onChange={(e) => handleCategoryChange(entry.mangaId, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(10, 10, 20, 0.85)',
                    color: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.68rem',
                    padding: '2px 4px',
                    backdropFilter: 'blur(4px)',
                  }}
                  title="เปลี่ยนหมวดหมู่"
                >
                  <option value="reading">📖 กำลังอ่าน</option>
                  <option value="plan_to_read">📌 จะอ่าน</option>
                  <option value="completed">✅ จบแล้ว</option>
                  <option value="dropped">⏸️ พักไว้</option>
                </select>

                <button
                  className="btn btn-icon btn-danger"
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    background: 'rgba(239, 68, 68, 0.85)',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemove(entry.mangaId);
                  }}
                  title="ลบออกจากไลบรารี"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
