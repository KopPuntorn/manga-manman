'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getLibrary,
  removeFromLibrary,
  updateLibraryShelf,
  getAllReadingProgress,
  getReadingStats,
  LibraryEntry,
  LibraryShelf,
  GlobalReadingProgressEntry,
  ReadingStats,
} from '@/lib/api';
import {
  getAllOfflineChapters,
  removeOfflineChapter,
  OfflineChapter,
} from '@/lib/offlineStorage';

type MainTab = 'shelves' | 'progress' | 'stats' | 'offline';
type ShelfTab = 'all' | LibraryShelf;

export default function LibraryPage() {
  const [mainTab, setMainTab] = useState<MainTab>('shelves');

  // Library Entries & Shelves state
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [activeShelf, setActiveShelf] = useState<ShelfTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reading Progress state
  const [progressList, setProgressList] = useState<GlobalReadingProgressEntry[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Statistics state
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Offline chapters state
  const [offlineList, setOfflineList] = useState<OfflineChapter[]>([]);
  const [loadingOffline, setLoadingOffline] = useState(false);

  // Fetch Library Entries
  const fetchLibrary = useCallback(async (shelf: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getLibrary(shelf === 'all' ? undefined : shelf);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Reading Progress
  const fetchProgress = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const data = await getAllReadingProgress(50);
      setProgressList(data);
    } catch (err) {
      console.error('Failed to load reading progress:', err);
    } finally {
      setLoadingProgress(false);
    }
  }, []);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getReadingStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Offline Chapters from IndexedDB
  const fetchOffline = useCallback(async () => {
    setLoadingOffline(true);
    try {
      const data = await getAllOfflineChapters();
      setOfflineList(data);
    } catch (err) {
      console.error('Failed to load offline chapters:', err);
    } finally {
      setLoadingOffline(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'shelves') {
      fetchLibrary(activeShelf);
    } else if (mainTab === 'progress') {
      fetchProgress();
    } else if (mainTab === 'stats') {
      fetchStats();
    } else if (mainTab === 'offline') {
      fetchOffline();
    }
  }, [mainTab, activeShelf, fetchLibrary, fetchProgress, fetchStats, fetchOffline]);

  const handleRemove = async (mangaId: string) => {
    if (!confirm('ต้องการลบมังงะเรื่องนี้ออกจากไลบรารีใช่หรือไม่?')) return;
    try {
      await removeFromLibrary(mangaId);
      setEntries((prev) => prev.filter((e) => e.mangaId !== mangaId));
    } catch (err) {
      console.error('Failed to remove from library:', err);
    }
  };

  const handleShelfChange = async (mangaId: string, newShelf: string) => {
    try {
      await updateLibraryShelf(mangaId, newShelf);
      setEntries((prev) =>
        prev.map((e) =>
          e.mangaId === mangaId
            ? { ...e, category: newShelf as LibraryShelf, shelf: newShelf as LibraryShelf }
            : e
        )
      );
      if (activeShelf !== 'all' && activeShelf !== newShelf) {
        setEntries((prev) => prev.filter((e) => e.mangaId !== mangaId));
      }
    } catch (err) {
      console.error('Failed to update shelf:', err);
    }
  };

  const handleDeleteOffline = async (chapterId: string) => {
    if (!confirm('ต้องการลบตอนออฟไลน์นี้ออกจากอุปกรณ์หรือไม่?')) return;
    try {
      await removeOfflineChapter(chapterId);
      setOfflineList((prev) => prev.filter((c) => c.chapterId !== chapterId));
    } catch (err) {
      console.error('Failed to delete offline chapter:', err);
    }
  };

  const getShelfBadgeClass = (shelf?: string) => {
    switch (shelf) {
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

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <div className="library-header">
        <div>
          <h1>📚 คลังส่วนตัว (Reader Library)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            จัดการชั้นหนังสือ ความคืบหน้าการอ่าน สถิติ และตอนที่บันทึกสำหรับอ่านออฟไลน์
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="pill-group" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap' }}>
        <button
          className={`pill-item ${mainTab === 'shelves' ? 'active' : ''}`}
          onClick={() => setMainTab('shelves')}
          style={{ padding: '8px 18px', fontSize: '0.9rem' }}
        >
          📚 ชั้นหนังสือ ({entries.length})
        </button>
        <button
          className={`pill-item ${mainTab === 'progress' ? 'active' : ''}`}
          onClick={() => setMainTab('progress')}
          style={{ padding: '8px 18px', fontSize: '0.9rem' }}
        >
          ⏱️ ความคืบหน้าการอ่าน (Reading Progress)
        </button>
        <button
          className={`pill-item ${mainTab === 'stats' ? 'active' : ''}`}
          onClick={() => setMainTab('stats')}
          style={{ padding: '8px 18px', fontSize: '0.9rem' }}
        >
          📊 สถิติการอ่าน (Stats)
        </button>
        <button
          className={`pill-item ${mainTab === 'offline' ? 'active' : ''}`}
          onClick={() => setMainTab('offline')}
          style={{ padding: '8px 18px', fontSize: '0.9rem' }}
        >
          💾 ออฟไลน์ (Offline)
        </button>
      </div>

      {/* --- TAB 1: LIBRARY SHELVES --- */}
      {mainTab === 'shelves' && (
        <>
          {/* Shelf Tabs */}
          <div className="category-tabs">
            <button
              className={`category-tab ${activeShelf === 'all' ? 'active' : ''}`}
              onClick={() => setActiveShelf('all')}
            >
              ทั้งหมด
            </button>
            <button
              className={`category-tab ${activeShelf === 'reading' ? 'active' : ''}`}
              onClick={() => setActiveShelf('reading')}
            >
              📖 กำลังอ่าน (Reading)
            </button>
            <button
              className={`category-tab ${activeShelf === 'plan_to_read' ? 'active' : ''}`}
              onClick={() => setActiveShelf('plan_to_read')}
            >
              📌 วางแผนจะอ่าน (Plan to Read)
            </button>
            <button
              className={`category-tab ${activeShelf === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveShelf('completed')}
            >
              ✅ อ่านจบแล้ว (Completed)
            </button>
            <button
              className={`category-tab ${activeShelf === 'dropped' ? 'active' : ''}`}
              onClick={() => setActiveShelf('dropped')}
            >
              ⏸️ พักไว้ก่อน (Dropped)
            </button>
          </div>

          {loading ? (
            <div className="loading-container" style={{ minHeight: '40vh' }}>
              <div className="spinner" />
              <span className="loading-text">กำลังโหลดชั้นหนังสือ...</span>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <h3>ไม่พบมังงะในชั้นหนังสือนี้</h3>
              <p>
                {activeShelf === 'all'
                  ? 'คุณยังไม่มีมังงะในไลบรารี ค้นหาเรื่องที่ชอบแล้วกดเพิ่มเข้าชั้นหนังสือได้เลย!'
                  : 'ยังไม่มีมังงะที่ถูกจัดไว้ในชั้นนี้'}
              </p>
              <Link href="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
                🔍 ค้นหามังงะ
              </Link>
            </div>
          ) : (
            <div className="library-grid">
              {entries.map((entry) => {
                const currentShelf = entry.shelf || entry.category;
                return (
                  <div key={entry.id} className="library-card">
                    <Link href={`/manga/${entry.mangaId}`}>
                      <div className="library-card-cover">
                        {entry.coverUrl ? (
                          <img src={entry.coverUrl} alt={entry.title} loading="lazy" referrerPolicy="no-referrer" />
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
                    </Link>

                    <div className="library-card-info">
                      <Link href={`/manga/${entry.mangaId}`}>
                        <div className="library-card-title" title={entry.title}>
                          {entry.title}
                        </div>
                      </Link>

                      <div className="library-card-actions">
                        <select
                          value={currentShelf}
                          onChange={(e) => handleShelfChange(entry.mangaId, e.target.value)}
                          className={`library-category-select ${getShelfBadgeClass(currentShelf)}`}
                          title="เปลี่ยนชั้นหนังสือ"
                        >
                          <option value="reading">📖 กำลังอ่าน</option>
                          <option value="plan_to_read">📌 วางแผนจะอ่าน</option>
                          <option value="completed">✅ อ่านจบแล้ว</option>
                          <option value="dropped">⏸️ พักไว้ก่อน</option>
                        </select>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemove(entry.mangaId)}
                          title="ลบออกจากไลบรารี"
                          style={{ padding: '4px 8px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* --- TAB 2: READING PROGRESS --- */}
      {mainTab === 'progress' && (
        <div>
          {loadingProgress ? (
            <div className="loading-container" style={{ minHeight: '40vh' }}>
              <div className="spinner" />
              <span className="loading-text">กำลังโหลดความคืบหน้าการอ่าน...</span>
            </div>
          ) : progressList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏱️</div>
              <h3>ยังไม่มีความคืบหน้าการอ่าน</h3>
              <p>เมื่อคุณเปิดอ่านมังงะ ตำแหน่งล่าสุดจะถูกบันทึกเพื่อให้อ่านต่อได้ทันที</p>
              <Link href="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
                🔍 ค้นหามังงะเริ่มอ่าน
              </Link>
            </div>
          ) : (
            <div className="history-timeline">
              {progressList.map((item) => (
                <div key={item.id} className="history-card">
                  <div className="history-left">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title || 'Manga'} className="history-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="history-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        📖
                      </div>
                    )}
                    <div className="history-details">
                      <Link href={`/manga/${item.mangaId}`}>
                        <div className="history-title">{item.title || `Manga ID: ${item.mangaId.slice(0, 8)}...`}</div>
                      </Link>
                      <div className="history-chapter">
                        ตำแหน่งล่าสุด: หน้าที่ {item.pageIndex + 1}
                      </div>
                      <div className="history-time">อ่านล่าสุด {formatDate(item.updatedAt)}</div>
                    </div>
                  </div>

                  <Link href={`/manga/${item.mangaId}/${item.chapterId}`} className="btn btn-primary btn-sm">
                    📖 อ่านต่อ →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: READING STATISTICS --- */}
      {mainTab === 'stats' && (
        <div>
          {loadingStats ? (
            <div className="loading-container" style={{ minHeight: '40vh' }}>
              <div className="spinner" />
              <span className="loading-text">กำลังคำนวณสถิติการอ่าน...</span>
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{stats?.totalChaptersRead || 0}</div>
                  <div className="stat-label">📖 ตอนที่อ่านในระบบทั้งหมด</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats?.totalLibraryEntries ?? stats?.totalBookmarked ?? 0}</div>
                  <div className="stat-label">📚 มังงะในชั้นหนังสือทั้งหมด</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{(stats?.shelvesCount || stats?.categoriesCount)?.['reading'] || 0}</div>
                  <div className="stat-label">⚡ เรื่องในชั้น "กำลังอ่าน"</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{(stats?.shelvesCount || stats?.categoriesCount)?.['completed'] || 0}</div>
                  <div className="stat-label">✅ เรื่องในชั้น "อ่านจบแล้ว"</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>🏆 สรุปพฤติกรรมการอ่านของผู้อ่าน</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  ระบบ Manga-Manman จะบันทึกความคืบหน้าการอ่าน (Reading Progress) และแคชคำแปลภาษาไทยโดยอัตโนมัติ ผู้อ่านสามารถเปิดอ่านต่อได้จากตำแหน่งล่าสุดอย่างต่อเนื่อง
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- TAB 4: OFFLINE CHAPTERS --- */}
      {mainTab === 'offline' && (
        <div>
          {loadingOffline ? (
            <div className="loading-container" style={{ minHeight: '40vh' }}>
              <div className="spinner" />
              <span className="loading-text">กำลังตรวจสอบตอนที่บันทึกออฟไลน์...</span>
            </div>
          ) : offlineList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💾</div>
              <h3>ไม่มีตอนที่บันทึกออฟไลน์</h3>
              <p>คุณสามารถกดปุ่ม "⚙️ การตั้งค่า &gt; บันทึกสำหรับอ่านออฟไลน์" ในหน้าอ่าน เพื่อโหลดเก็บไว้อ่านเวลาไม่มีเน็ตได้</p>
            </div>
          ) : (
            <div className="history-timeline">
              {offlineList.map((ch) => (
                <div key={ch.chapterId} className="history-card">
                  <div className="history-left">
                    <div className="history-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      💾
                    </div>
                    <div className="history-details">
                      <div className="history-title">{ch.mangaTitle}</div>
                      <div className="history-chapter">ตอนที่ {ch.chapterNumber} ({ch.pages.length} หน้า)</div>
                      <div className="history-time">บันทึกเมื่อ {formatDate(ch.savedAt)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Link href={`/manga/${ch.mangaId}/${ch.chapterId}`} className="btn btn-primary btn-sm">
                      📖 เปิดอ่านออฟไลน์
                    </Link>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteOffline(ch.chapterId)}
                      title="ลบไฟล์ออฟไลน์"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
