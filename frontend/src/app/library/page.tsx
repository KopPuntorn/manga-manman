'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLibrary, removeFromLibrary, LibraryEntry } from '@/lib/api';

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLibrary = async () => {
      setLoading(true);
      try {
        const data = await getLibrary();
        setEntries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load library');
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  const handleRemove = async (mangaId: string) => {
    try {
      await removeFromLibrary(mangaId);
      setEntries((prev) => prev.filter((e) => e.mangaId !== mangaId));
    } catch (err) {
      console.error('Failed to remove from library:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="loading-text">กำลังโหลดไลบรารี...</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div>
      <div className="library-header">
        <h1>📚 ไลบรารีของฉัน</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {entries.length} เรื่อง
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3>ยังไม่มีมังงะในไลบรารี</h3>
          <p>ค้นหามังงะที่ชอบแล้วเพิ่มเข้าไลบรารีเลย!</p>
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
                      <img
                        src={entry.coverUrl}
                        alt={entry.title}
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
                    <div className="manga-card-title">{entry.title}</div>
                    <div className="manga-card-meta">
                      เพิ่มเมื่อ {new Date(entry.addedAt).toLocaleDateString('th-TH')}
                    </div>
                  </div>
                </div>
              </Link>
              <button
                className="btn btn-icon btn-danger"
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  zIndex: 10,
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  background: 'rgba(239, 68, 68, 0.8)',
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
          ))}
        </div>
      )}
    </div>
  );
}
