'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getChapterPages,
  translatePage,
  updateTranslation,
  getChapterTranslations,
  updateHistory,
  getChapters,
  getMangaDetail,
  Translation,
  TextBlock,
  Chapter,
  MangaDetail,
} from '@/lib/api';

type ReadingMode = 'webtoon' | 'single' | 'double';
type TranslationMode = 'thai' | 'sidebyside' | 'original' | 'off';

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const mangaId = params.id as string;
  const chapterId = params.chapterId as string;

  // Manga & Chapter metadata
  const [manga, setManga] = useState<MangaDetail | null>(null);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);

  // Pages & Loading
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reader Settings & Mode
  const [readingMode, setReadingMode] = useState<ReadingMode>('webtoon');
  const [translationMode, setTranslationMode] = useState<TranslationMode>('thai');
  const [bubbleTheme, setBubbleTheme] = useState<'manga' | 'soft' | 'dark'>('manga');
  const [bubbleSize, setBubbleSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showControls, setShowControls] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);


  // Translation state
  const [translations, setTranslations] = useState<Record<number, Translation>>({});
  const [translatingPages, setTranslatingPages] = useState<Set<number>>(new Set());
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const [translationError, setTranslationError] = useState('');
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });

  // Edit Translation Bubble Modal
  const [editingBlock, setEditingBlock] = useState<{
    pageIndex: number;
    blockIndex: number;
    block: TextBlock;
  } | null>(null);
  const [editThaiText, setEditThaiText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Page tracking
  const [currentPage, setCurrentPage] = useState(0);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load Manga detail & Chapter list for navigation
  useEffect(() => {
    if (!mangaId) return;
    getMangaDetail(mangaId).then(setManga).catch(console.error);
    getChapters(mangaId, 500, 0, 'asc')
      .then((res) => {
        setChapterList(res.chapters);
        const match = res.chapters.find((c) => c.id === chapterId);
        if (match) setCurrentChapter(match);
      })
      .catch(console.error);
  }, [mangaId, chapterId]);

  // Load chapter pages & cached translations with instant browser local storage
  useEffect(() => {
    if (!chapterId) return;

    // 1. Instant cache load from browser storage (0ms)
    try {
      const localPages = localStorage.getItem(`manga_pages_${chapterId}`);
      if (localPages) {
        const parsed = JSON.parse(localPages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPages(parsed);
          setLoading(false);
        }
      }
      const localTrans = localStorage.getItem(`manga_trans_${chapterId}`);
      if (localTrans) {
        const parsed = JSON.parse(localTrans);
        if (parsed && typeof parsed === 'object') {
          setTranslations(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }

    const fetchPages = async () => {
      try {
        const data = await getChapterPages(chapterId);
        setPages(data.pages);
        try {
          localStorage.setItem(`manga_pages_${chapterId}`, JSON.stringify(data.pages));
        } catch {}

        // Load backend cached translations
        try {
          const cached = await getChapterTranslations(chapterId);
          const map: Record<number, Translation> = {};
          cached.forEach((t) => {
            map[t.pageIndex] = t;
          });
          setTranslations((prev) => {
            const merged = { ...prev, ...map };
            try {
              localStorage.setItem(`manga_trans_${chapterId}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        } catch {
          // No cached translations yet
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chapter');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [chapterId]);


  // Translate a specific page
  const translateSpecificPage = useCallback(
    async (pageIndex: number, force = false) => {
      if (pageIndex < 0 || pageIndex >= pages.length) return;
      if (translatingPages.has(pageIndex)) return;
      if (translations[pageIndex]) return;
      if (!force && failedPages.has(pageIndex)) return;

      setTranslatingPages((prev) => new Set(prev).add(pageIndex));
      setTranslationError('');

      try {
        const result = await translatePage(chapterId, pageIndex, pages[pageIndex]);
        setTranslations((prev) => ({
          ...prev,
          [pageIndex]: result,
        }));
        setFailedPages((prev) => {
          const next = new Set(prev);
          next.delete(pageIndex);
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Translation failed';
        setTranslationError(msg);
        setFailedPages((prev) => new Set(prev).add(pageIndex));
      } finally {
        setTranslatingPages((prev) => {
          const next = new Set(prev);
          next.delete(pageIndex);
          return next;
        });
      }
    },
    [chapterId, pages, translations, translatingPages, failedPages]
  );

  // Webtoon Intersection observer for current page tracking & predictive auto-translation
  useEffect(() => {
    if (readingMode !== 'webtoon' || pages.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-page-index'));
            if (!isNaN(idx)) {
              setCurrentPage(idx);
              // Predictive auto-translate: trigger translation for this page and next page immediately
              if (translationMode !== 'off' && !translations[idx] && !translatingPages.has(idx)) {
                translateSpecificPage(idx, false);
              }
            }
          }
        });
      },
      { rootMargin: '1000px 0px 1000px 0px', threshold: 0.1 }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => observerRef.current?.disconnect();
  }, [pages, readingMode, translationMode, translations, translatingPages, translateSpecificPage]);

  // Save reading history periodically
  useEffect(() => {
    if (!mangaId || !chapterId || pages.length === 0) return;

    const timer = setTimeout(() => {
      updateHistory(mangaId, chapterId, currentPage).catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentPage, mangaId, chapterId, pages.length]);

  // Auto-translate current page if translation enabled
  useEffect(() => {
    if (
      translationMode !== 'off' &&
      pages.length > 0 &&
      !translations[currentPage] &&
      !failedPages.has(currentPage)
    ) {
      translateSpecificPage(currentPage, false);
    }
  }, [currentPage, translationMode, pages.length, translations, failedPages, translateSpecificPage]);

  // Intelligent Prefetching: Auto-translate next page ahead in background after user settles on current page
  useEffect(() => {
    if (translationMode === 'off' || pages.length === 0) return;

    const prefetchTimer = setTimeout(() => {
      const nextIdx = currentPage + 1;
      if (
        nextIdx < pages.length &&
        !translations[nextIdx] &&
        !translatingPages.has(nextIdx) &&
        !failedPages.has(nextIdx)
      ) {
        translateSpecificPage(nextIdx, false);
      }
    }, 1200);

    return () => clearTimeout(prefetchTimer);
  }, [currentPage, translationMode, pages.length, translations, failedPages, translatingPages, translateSpecificPage]);

  // Translate all pages of the chapter in parallel batches

  const translateAllPages = async () => {
    if (translatingAll || pages.length === 0) return;
    setTranslatingAll(true);

    const untranslatedIndices = pages
      .map((_, i) => i)
      .filter((i) => !translations[i]);

    setTranslateProgress({ current: pages.length - untranslatedIndices.length, total: pages.length });

    // Process in gentle concurrent pools of 2
    const concurrency = 2;
    for (let i = 0; i < untranslatedIndices.length; i += concurrency) {
      const batch = untranslatedIndices.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(async (pageIdx) => {
          try {
            const res = await translatePage(chapterId, pageIdx, pages[pageIdx]);
            setTranslations((prev) => ({ ...prev, [pageIdx]: res }));
          } catch {
            // Handled individually
          }
        })
      );
      setTranslateProgress((prev) => ({
        ...prev,
        current: Math.min(prev.total, prev.current + batch.length),
      }));
      // Gentle pacing to avoid Free Tier 15 RPM quota spikes
      if (i + concurrency < untranslatedIndices.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setTranslatingAll(false);
  };





  // Chapter Navigation
  const currentChapterIndex = chapterList.findIndex((c) => c.id === chapterId);
  const prevChapter = currentChapterIndex > 0 ? chapterList[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapterList.length - 1
      ? chapterList[currentChapterIndex + 1]
      : null;

  const goToPrevPage = useCallback(() => {
    if (readingMode === 'double') {
      setCurrentPage((p) => Math.max(0, p - 2));
    } else {
      if (currentPage > 0) {
        setCurrentPage((p) => p - 1);
      } else if (prevChapter) {
        router.push(`/manga/${mangaId}/${prevChapter.id}`);
      }
    }
  }, [readingMode, currentPage, prevChapter, router, mangaId]);

  const goToNextPage = useCallback(() => {
    if (readingMode === 'double') {
      if (currentPage + 2 < pages.length) {
        setCurrentPage((p) => p + 2);
      } else if (nextChapter) {
        router.push(`/manga/${mangaId}/${nextChapter.id}`);
      }
    } else {
      if (currentPage < pages.length - 1) {
        setCurrentPage((p) => p + 1);
      } else if (nextChapter) {
        router.push(`/manga/${mangaId}/${nextChapter.id}`);
      }
    }
  }, [readingMode, currentPage, pages.length, nextChapter, router, mangaId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in modal textarea
      if (editingBlock) return;

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        goToPrevPage();
      } else if (e.key === 't' || e.key === 'T') {
        setTranslationMode((curr) => {
          if (curr === 'thai') return 'sidebyside';
          if (curr === 'sidebyside') return 'original';
          if (curr === 'original') return 'off';
          return 'thai';
        });
      } else if (e.key === 'm' || e.key === 'M') {
        setReadingMode((curr) => {
          if (curr === 'webtoon') return 'single';
          if (curr === 'single') return 'double';
          return 'webtoon';
        });
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        setShowHelpModal((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingBlock, goToNextPage, goToPrevPage]);



  // Handle Edit Bubble
  const handleOpenEdit = (pageIdx: number, blockIdx: number, block: TextBlock) => {
    setEditingBlock({ pageIndex: pageIdx, blockIndex: blockIdx, block });
    setEditThaiText(block.thai);
  };

  const handleSaveEdit = async () => {
    if (!editingBlock) return;
    const { pageIndex, blockIndex } = editingBlock;
    const pageTranslation = translations[pageIndex];
    if (!pageTranslation) return;

    setSavingEdit(true);
    try {
      const updatedTexts = [...pageTranslation.result.texts];
      updatedTexts[blockIndex] = {
        ...updatedTexts[blockIndex],
        thai: editThaiText,
      };

      await updateTranslation(chapterId, pageIndex, updatedTexts);

      setTranslations((prev) => ({
        ...prev,
        [pageIndex]: {
          ...prev[pageIndex],
          result: { texts: updatedTexts },
        },
      }));
      setEditingBlock(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save translation failed');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '80vh' }}>
        <div className="spinner" />
        <span className="loading-text">กำลังโหลดหน้ามังงะและคำแปล...</span>
      </div>
    );
  }

  if (error || (!loading && pages.length === 0)) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="error-message" style={{ marginBottom: '20px' }}>
          {error || '⚠️ ตอนนี้เป็นลิงก์ภายนอกของ MangaPlus / สำนักพิมพ์ (ไม่มีไฟล์รูปภาพบน MangaDex)'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link href={`/manga/${mangaId}`} className="btn btn-secondary">
            ← กลับไปรายการตอน
          </Link>
          {nextChapter && (
            <Link href={`/manga/${mangaId}/${nextChapter.id}`} className="btn btn-primary">
              ▶️ ข้ามไปอ่านตอนถัดไป (Ch. {nextChapter.chapter}) →
            </Link>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="reader-wrapper">
      {/* Top Floating Control Bar */}
      <header className={`reader-top-bar ${showControls ? '' : 'hidden'}`}>
        <div className="reader-title-info">
          <Link href={`/manga/${mangaId}`} className="btn btn-secondary btn-sm" title="กลับไปรายการตอน">
            ← ตอนทั้งหมด
          </Link>
          <div>
            <div className="reader-manga-title">{manga?.title || 'Manga Reader'}</div>
            <div className="reader-chapter-title">
              {currentChapter ? `Ch. ${currentChapter.chapter} ${currentChapter.title ? `- ${currentChapter.title}` : ''}` : `ตอนที่อ่าน`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Chapter Quick Jump Selector */}
          {chapterList.length > 1 && (
            <select
              value={chapterId}
              onChange={(e) => router.push(`/manga/${mangaId}/${e.target.value}`)}
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 8px',
                fontSize: '0.8rem',
              }}
            >
              {chapterList.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Ch. {ch.chapter} {ch.title ? `(${ch.title})` : ''}
                </option>
              ))}
            </select>
          )}

          {/* Reading Mode Switcher */}
          <div className="pill-group">
            <button
              className={`pill-item ${readingMode === 'webtoon' ? 'active' : ''}`}
              onClick={() => setReadingMode('webtoon')}
              title="Webtoon (เลื่อนยาว)"
            >
              📜 Webtoon
            </button>
            <button
              className={`pill-item ${readingMode === 'single' ? 'active' : ''}`}
              onClick={() => setReadingMode('single')}
              title="ทีละหน้า (Single Page)"
            >
              📄 Single
            </button>
            <button
              className={`pill-item ${readingMode === 'double' ? 'active' : ''}`}
              onClick={() => setReadingMode('double')}
              title="สองหน้าคู่ (Double Page)"
            >
              📖 Double
            </button>
          </div>

          {/* Translate Full Chapter Button */}
          <button
            className={`btn btn-sm ${translatingAll ? 'btn-secondary' : 'btn-primary'}`}
            onClick={translateAllPages}
            disabled={translatingAll || pages.length === 0}
            title="แปลล่วงหน้าทั้งตอนพร้อมกันอัตโนมัติ"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {translatingAll ? (
              <>
                <div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                <span>แปลทั้งตอน ({translateProgress.current}/{translateProgress.total})</span>
              </>
            ) : (
              <>
                <span>⚡ แปลทั้งตอน</span>
              </>
            )}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowHelpModal(true)}
            title="คีย์ลัด (Shortcuts)"
          >
            ⌨️
          </button>
        </div>
      </header>


      {/* Main Reader Content according to Reading Mode */}
      {readingMode === 'webtoon' && (
        <div className="reader-webtoon">
          {pages.map((pageUrl, idx) => (
            <div
              key={idx}
              className="reader-page"
              ref={(el) => {
                pageRefs.current[idx] = el;
              }}
              data-page-index={idx}
            >
              <div className="reader-image-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                <img src={pageUrl} alt={`Page ${idx + 1}`} loading={idx < 3 ? 'eager' : 'lazy'} />

                {/* Translation overlay */}
                {translationMode !== 'off' && translations[idx] && (
                  <TranslationOverlay
                    texts={translations[idx].result.texts}
                    mode={translationMode}
                    theme={bubbleTheme}
                    size={bubbleSize}
                    onEditBlock={(blockIdx, block) => handleOpenEdit(idx, blockIdx, block)}
                  />
                )}

                {/* Individual Translate button */}
                {translationMode !== 'off' && !translations[idx] && !translatingPages.has(idx) && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => translateSpecificPage(idx)}>
                      🌐 แปลหน้านี้
                    </button>
                  </div>
                )}

                {/* Translating Spinner */}
                {translatingPages.has(idx) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      zIndex: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      background: 'rgba(0, 0, 0, 0.85)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--accent-primary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    กำลังแปล...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {readingMode === 'single' && (
        <div className="reader-single">
          <div className="reader-nav-zone left" onClick={goToPrevPage} title="หน้าก่อนหน้า (←)">
            <div className="reader-nav-arrow">‹</div>
          </div>
          <div className="reader-nav-zone right" onClick={goToNextPage} title="หน้าถัดไป (→)">
            <div className="reader-nav-arrow">›</div>
          </div>

          <div className="reader-page" style={{ margin: '0 auto', maxWidth: '100%' }}>
            <div className="reader-image-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img src={pages[currentPage]} alt={`Page ${currentPage + 1}`} />

              {translationMode !== 'off' && translations[currentPage] && (
                <TranslationOverlay
                  texts={translations[currentPage].result.texts}
                  mode={translationMode}
                  theme={bubbleTheme}
                  size={bubbleSize}
                  onEditBlock={(blockIdx, block) => handleOpenEdit(currentPage, blockIdx, block)}
                />
              )}

              {translationMode !== 'off' && !translations[currentPage] && !translatingPages.has(currentPage) && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => translateSpecificPage(currentPage)}>
                    🌐 แปลหน้านี้
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {readingMode === 'double' && (
        <div className="reader-double">
          <div className="reader-nav-zone left" onClick={goToPrevPage} title="หน้าก่อนหน้า (←)">
            <div className="reader-nav-arrow">‹</div>
          </div>
          <div className="reader-nav-zone right" onClick={goToNextPage} title="หน้าถัดไป (→)">
            <div className="reader-nav-arrow">›</div>
          </div>

          {/* Right Page (First in spread for Manga RTL reading) */}
          {currentPage + 1 < pages.length && (
            <div className="reader-page" style={{ flex: 1, maxWidth: '50%' }}>
              <div className="reader-image-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                <img src={pages[currentPage + 1]} alt={`Page ${currentPage + 2}`} />
                {translationMode !== 'off' && translations[currentPage + 1] && (
                  <TranslationOverlay
                    texts={translations[currentPage + 1].result.texts}
                    mode={translationMode}
                    theme={bubbleTheme}
                    size={bubbleSize}
                    onEditBlock={(blockIdx, block) => handleOpenEdit(currentPage + 1, blockIdx, block)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Left Page */}
          <div className="reader-page" style={{ flex: 1, maxWidth: '50%' }}>
            <div className="reader-image-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img src={pages[currentPage]} alt={`Page ${currentPage + 1}`} />
              {translationMode !== 'off' && translations[currentPage] && (
                <TranslationOverlay
                  texts={translations[currentPage].result.texts}
                  mode={translationMode}
                  theme={bubbleTheme}
                  size={bubbleSize}
                  onEditBlock={(blockIdx, block) => handleOpenEdit(currentPage, blockIdx, block)}
                />
              )}
            </div>
          </div>
        </div>
      )}



      {/* Chapter end navigation footer */}
      <div style={{ textAlign: 'center', marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
        {prevChapter && (
          <Link href={`/manga/${mangaId}/${prevChapter.id}`} className="btn btn-secondary">
            ← ตอนก่อนหน้า (Ch. {prevChapter.chapter})
          </Link>
        )}
        {nextChapter && (
          <Link href={`/manga/${mangaId}/${nextChapter.id}`} className="btn btn-primary">
            ตอนถัดไป (Ch. {nextChapter.chapter}) →
          </Link>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="reader-controls">
        {/* Navigation buttons */}
        <button className="btn btn-secondary btn-sm" onClick={goToPrevPage} disabled={currentPage === 0 && !prevChapter}>
          ◀
        </button>

        <div className="reader-page-info">
          {currentPage + 1} / {pages.length}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={goToNextPage}
          disabled={currentPage >= pages.length - 1 && !nextChapter}
        >
          ▶
        </button>

        {/* Translation Mode selector */}
        <div className="pill-group" style={{ margin: '0 4px' }}>
          <button
            className={`pill-item ${translationMode === 'thai' ? 'active' : ''}`}
            onClick={() => setTranslationMode('thai')}
            title="แปลไทยอย่างเดียว"
          >
            🇹🇭 ไทย
          </button>
          <button
            className={`pill-item ${translationMode === 'sidebyside' ? 'active' : ''}`}
            onClick={() => setTranslationMode('sidebyside')}
            title="คู่ขนาน (ไทย + ญี่ปุ่น)"
          >
            คู่ขนาน
          </button>
          <button
            className={`pill-item ${translationMode === 'original' ? 'active' : ''}`}
            onClick={() => setTranslationMode('original')}
            title="ภาษาต้นฉบับ"
          >
            ต้นฉบับ
          </button>
          <button
            className={`pill-item ${translationMode === 'off' ? 'active' : ''}`}
            onClick={() => setTranslationMode('off')}
            title="ปิดการแปล"
          >
            ปิด
          </button>
        </div>

        {/* Bubble Style & Font Size Controls */}
        {translationMode !== 'off' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '8px' }}>
            {/* Bubble Theme Toggle */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setBubbleTheme(bubbleTheme === 'manga' ? 'dark' : bubbleTheme === 'dark' ? 'soft' : 'manga')}
              title={`ธีมกล่อง: ${bubbleTheme === 'manga' ? '⚪ มังงะสีขาว' : bubbleTheme === 'dark' ? '🌙 มืดโปร่ง' : '🌓 นวล'}`}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            >
              {bubbleTheme === 'manga' ? '⚪ ขาว' : bubbleTheme === 'dark' ? '🌙 มืด' : '🌓 นวล'}
            </button>

            {/* Font Size Toggle */}
            <div className="pill-group" style={{ margin: 0 }}>
              <button
                className={`pill-item ${bubbleSize === 'sm' ? 'active' : ''}`}
                onClick={() => setBubbleSize('sm')}
                title="ตัวหนังสือเล็ก"
                style={{ padding: '3px 7px', fontSize: '0.72rem' }}
              >
                A-
              </button>
              <button
                className={`pill-item ${bubbleSize === 'md' ? 'active' : ''}`}
                onClick={() => setBubbleSize('md')}
                title="ตัวหนังสือขนาดกลาง (แนะนำ)"
                style={{ padding: '3px 7px', fontSize: '0.78rem' }}
              >
                A
              </button>
              <button
                className={`pill-item ${bubbleSize === 'lg' ? 'active' : ''}`}
                onClick={() => setBubbleSize('lg')}
                title="ตัวหนังสือใหญ่"
                style={{ padding: '3px 7px', fontSize: '0.86rem' }}
              >
                A+
              </button>
            </div>
          </div>
        )}

        {/* Translate current page trigger */}
        {translationMode !== 'off' && !translations[currentPage] && !translatingPages.has(currentPage) && (
          <button className="btn btn-primary btn-sm btn-translate" onClick={() => translateSpecificPage(currentPage)}>
            🌐 แปลหน้านี้
          </button>
        )}


        {translatingPages.has(currentPage) && (
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            กำลังแปล...
          </span>
        )}
      </div>

      {/* Translation Error Banner */}
      {translationError && (
        <div className="error-message" style={{ maxWidth: '600px', margin: '20px auto' }}>
          {translationError}
        </div>
      )}

      {/* Edit Translation Bubble Modal */}
      {editingBlock && (
        <div className="modal-overlay" onClick={() => setEditingBlock(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ แก้ไขคำแปลภาษาไทย</h3>
              <button className="modal-close" onClick={() => setEditingBlock(null)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                ข้อความต้นฉบับ (Original):
              </label>
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {editingBlock.block.original || '(ไม่พบข้อความต้นฉบับ)'}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                คำแปลภาษาไทย (แก้ไขได้):
              </label>
              <textarea
                value={editThaiText}
                onChange={(e) => setEditThaiText(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingBlock(null)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⌨️ คีย์ลัดสำหรับการอ่าน (Keyboard Shortcuts)</h3>
              <button className="modal-close" onClick={() => setShowHelpModal(false)}>
                ✕
              </button>
            </div>

            <div className="shortcuts-grid">
              <span className="shortcut-key">→ / D</span>
              <span>หน้าถัดไป (Next Page / Next Chapter)</span>

              <span className="shortcut-key">← / A</span>
              <span>หน้าก่อนหน้า (Previous Page)</span>

              <span className="shortcut-key">T</span>
              <span>สลับโหมดการแปล (ไทย / คู่ขนาน / ต้นฉบับ / ปิด)</span>

              <span className="shortcut-key">M</span>
              <span>เปลี่ยนโหมดการอ่าน (Webtoon / Single / Double)</span>

              <span className="shortcut-key">F</span>
              <span>เข้า/ออกจากโหมดเต็มจอ (Fullscreen)</span>

              <span className="shortcut-key">? / H</span>
              <span>เปิด/ปิดหน้าต่างคีย์ลัดนี้</span>
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setShowHelpModal(false)}>
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Translation Overlay Component ---
function normalizePos(val: number): number {
  if (val > 100) return val / 1000;
  if (val > 1) return val / 100;
  return Math.max(0, Math.min(1, val));
}

function TranslationOverlay({
  texts,
  mode,
  theme = 'manga',
  size = 'md',
  onEditBlock,
}: {
  texts: TextBlock[];
  mode: TranslationMode;
  theme?: 'manga' | 'soft' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  onEditBlock: (index: number, block: TextBlock) => void;
}) {
  if (!texts || texts.length === 0 || mode === 'off') return null;

  return (
    <div className="translation-overlay">
      {texts.map((block, idx) => {
        const x = normalizePos(block.x);
        const y = normalizePos(block.y);
        const w = Math.max(0.10, Math.min(0.55, normalizePos(block.width || 0.16)));
        const h = Math.max(0.05, Math.min(0.45, normalizePos(block.height || 0.08)));

        const leftPercent = x * 100;
        const topPercent = y * 100;
        const widthPercent = w * 100;
        const minHeightPercent = h * 100;

        // Auto-scale font size dynamically based on Thai text length
        const textLen = (block.thai || '').length;
        let fontSizeStyle = '0.84rem';
        let lineHeightStyle = '1.30';

        if (size === 'sm') {
          if (textLen > 40) fontSizeStyle = '0.60rem';
          else if (textLen > 25) fontSizeStyle = '0.66rem';
          else fontSizeStyle = '0.74rem';
        } else if (size === 'lg') {
          if (textLen > 40) fontSizeStyle = '0.82rem';
          else if (textLen > 25) fontSizeStyle = '0.92rem';
          else fontSizeStyle = '1.04rem';
        } else {
          // Default 'md'
          if (textLen > 45) {
            fontSizeStyle = '0.66rem';
            lineHeightStyle = '1.18';
          } else if (textLen > 30) {
            fontSizeStyle = '0.72rem';
            lineHeightStyle = '1.22';
          } else if (textLen > 18) {
            fontSizeStyle = '0.78rem';
            lineHeightStyle = '1.26';
          }
        }

        // Oval balloon vs rectangular box detection based on aspect ratio
        const isOvalBubble = widthPercent > 14 && minHeightPercent > 8;

        return (
          <div
            key={idx}
            className={`translation-bubble theme-${theme} size-${size} mode-${mode}`}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              width: `${widthPercent}%`,
              minHeight: `${minHeightPercent}%`,
              height: 'auto',
              borderRadius: isOvalBubble ? '20px' : '8px',
              fontSize: fontSizeStyle,
              lineHeight: lineHeightStyle,
              padding: '4px 6px',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onEditBlock(idx, block);
            }}
            title="คลิกเพื่อแก้ไขคำแปล"
          >
            <span className="edit-badge">✏️</span>

            {mode === 'thai' && <div className="thai-text">{block.thai}</div>}

            {mode === 'sidebyside' && (
              <>
                <div className="thai-text">{block.thai}</div>
                <div className="original-text">{block.original}</div>
              </>
            )}

            {mode === 'original' && (
              <div className="original-text" style={{ fontSize: 'inherit', border: 'none', color: 'inherit' }}>
                {block.original}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}




