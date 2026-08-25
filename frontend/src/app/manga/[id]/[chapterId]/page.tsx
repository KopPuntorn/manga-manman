'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getChapterPages,
  translatePage,
  getChapterTranslations,
  updateHistory,
  Translation,
  TextBlock,
} from '@/lib/api';

export default function ReaderPage() {
  const params = useParams();
  const mangaId = params.id as string;
  const chapterId = params.chapterId as string;

  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Translation state
  const [showTranslation, setShowTranslation] = useState(false);
  const [translations, setTranslations] = useState<Record<number, Translation>>({});
  const [translatingPages, setTranslatingPages] = useState<Set<number>>(new Set());
  const [translationError, setTranslationError] = useState('');

  // Page tracking
  const [currentPage, setCurrentPage] = useState(0);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load chapter pages
  useEffect(() => {
    if (!chapterId) return;

    const fetchPages = async () => {
      setLoading(true);
      try {
        const data = await getChapterPages(chapterId);
        setPages(data.pages);

        // Load cached translations
        try {
          const cached = await getChapterTranslations(chapterId);
          const map: Record<number, Translation> = {};
          cached.forEach((t) => {
            map[t.pageIndex] = t;
          });
          setTranslations(map);
        } catch {
          // No cached translations, that's fine
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chapter');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [chapterId]);

  // Intersection observer for current page tracking
  useEffect(() => {
    if (pages.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-page-index'));
            if (!isNaN(idx)) {
              setCurrentPage(idx);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => observerRef.current?.disconnect();
  }, [pages]);

  // Save reading history periodically
  useEffect(() => {
    if (!mangaId || !chapterId || pages.length === 0) return;

    const timer = setTimeout(() => {
      updateHistory(mangaId, chapterId, currentPage).catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentPage, mangaId, chapterId, pages.length]);

  // Translate visible page
  const handleTranslateCurrentPage = useCallback(async () => {
    if (translatingPages.has(currentPage)) return;
    if (translations[currentPage]) return;

    setTranslatingPages((prev) => new Set(prev).add(currentPage));
    setTranslationError('');

    try {
      const result = await translatePage(chapterId, currentPage, pages[currentPage]);
      setTranslations((prev) => ({
        ...prev,
        [currentPage]: result,
      }));
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setTranslatingPages((prev) => {
        const next = new Set(prev);
        next.delete(currentPage);
        return next;
      });
    }
  }, [currentPage, chapterId, pages, translations, translatingPages]);

  // Translate all visible pages when translation is toggled on
  const handleToggleTranslation = () => {
    const newState = !showTranslation;
    setShowTranslation(newState);

    if (newState && !translations[currentPage] && !translatingPages.has(currentPage)) {
      handleTranslateCurrentPage();
    }
  };

  // Translate a specific page
  const translateSpecificPage = async (pageIndex: number) => {
    if (translatingPages.has(pageIndex)) return;
    if (translations[pageIndex]) return;

    setTranslatingPages((prev) => new Set(prev).add(pageIndex));

    try {
      const result = await translatePage(chapterId, pageIndex, pages[pageIndex]);
      setTranslations((prev) => ({
        ...prev,
        [pageIndex]: result,
      }));
    } catch (err) {
      console.error(`Translation failed for page ${pageIndex}:`, err);
    } finally {
      setTranslatingPages((prev) => {
        const next = new Set(prev);
        next.delete(pageIndex);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="loading-text">กำลังโหลดหน้ามังงะ...</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div>
      <Link href={`/manga/${mangaId}`} className="back-button">
        ← กลับไปรายการตอน
      </Link>

      <div className="reader">
        {pages.map((pageUrl, idx) => (
          <div
            key={idx}
            className="reader-page"
            ref={(el) => { pageRefs.current[idx] = el; }}
            data-page-index={idx}
          >
            <img
              src={pageUrl}
              alt={`Page ${idx + 1}`}
              loading={idx < 3 ? 'eager' : 'lazy'}
            />

            {/* Translation overlay */}
            {showTranslation && translations[idx] && (
              <TranslationOverlay texts={translations[idx].result.texts} />
            )}

            {/* Translate button for individual pages */}
            {showTranslation && !translations[idx] && !translatingPages.has(idx) && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 20,
              }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => translateSpecificPage(idx)}
                >
                  🌐 แปลหน้านี้
                </button>
              </div>
            )}

            {/* Translating indicator */}
            {translatingPages.has(idx) && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-primary)',
                fontSize: '0.8rem',
              }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                กำลังแปล...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reader controls */}
      <div className="reader-controls">
        <div className="reader-page-info">
          {currentPage + 1} / {pages.length}
        </div>

        <div className="translation-toggle">
          <div
            className={`toggle-switch ${showTranslation ? 'active' : ''}`}
            onClick={handleToggleTranslation}
          />
          <span className="toggle-label">
            {showTranslation ? '🇹🇭 แปลไทย' : 'แปลไทย'}
          </span>
        </div>

        {showTranslation && !translations[currentPage] && !translatingPages.has(currentPage) && (
          <button
            className="btn btn-primary btn-sm btn-translate"
            onClick={handleTranslateCurrentPage}
          >
            🌐 แปลหน้านี้
          </button>
        )}

        {translatingPages.has(currentPage) && (
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
            ⏳ กำลังแปล...
          </span>
        )}
      </div>

      {translationError && (
        <div className="error-message" style={{ marginTop: '16px', maxWidth: '600px', margin: '16px auto' }}>
          {translationError}
        </div>
      )}
    </div>
  );
}

// --- Translation Overlay Component ---
function TranslationOverlay({ texts }: { texts: TextBlock[] }) {
  if (!texts || texts.length === 0) return null;

  return (
    <div className="translation-overlay">
      {texts.map((block, idx) => (
        <div
          key={idx}
          className="translation-bubble"
          style={{
            left: `${block.x * 100}%`,
            top: `${block.y * 100}%`,
            maxWidth: `${Math.max(block.width * 100, 15)}%`,
          }}
        >
          <div>{block.thai}</div>
          <div className="original-text">{block.original}</div>
        </div>
      ))}
    </div>
  );
}
