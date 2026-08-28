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
import {
  getOfflineChapter,
  saveOfflineChapter,
  isChapterOffline,
} from '@/lib/offlineStorage';

type ReadingMode = 'webtoon' | 'single' | 'double';
type TranslationMode = 'thai' | 'sidebyside' | 'original' | 'off';
type ThaiFontFamily = 'font-prompt' | 'font-kanit' | 'font-mali' | 'font-itim' | 'font-mitr' | 'font-baijamjuree';

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
  const [fontFamily, setFontFamily] = useState<ThaiFontFamily>('font-prompt');
  const [fontScale, setFontScale] = useState<number>(100); // 80 to 140%
  const [bubbleOpacity, setBubbleOpacity] = useState<number>(100); // 60 to 100%
  const [showControls] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Offline Chapter State
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [downloadingOffline, setDownloadingOffline] = useState(false);

  // Translation state
  const [translations, setTranslations] = useState<Record<number, Translation>>({});
  const [translatingPages, setTranslatingPages] = useState<Set<number>>(new Set());
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const [translationError, setTranslationError] = useState('');
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0 });

  // Edit Translation Block Modal
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

  // Restore Reader Preferences from localStorage
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const savedMode = localStorage.getItem('reader_mode') as ReadingMode;
        if (savedMode) setReadingMode(savedMode);
        const savedTransMode = localStorage.getItem('reader_trans_mode') as TranslationMode;
        if (savedTransMode) setTranslationMode(savedTransMode);
        const savedFont = localStorage.getItem('reader_font') as ThaiFontFamily;
        if (savedFont) setFontFamily(savedFont);
        const savedScale = localStorage.getItem('reader_font_scale');
        if (savedScale) setFontScale(Number(savedScale));
        const savedOpacity = localStorage.getItem('reader_bubble_opacity');
        if (savedOpacity) setBubbleOpacity(Number(savedOpacity));
        const savedTheme = localStorage.getItem('reader_bubble_theme') as 'manga' | 'soft' | 'dark';
        if (savedTheme) setBubbleTheme(savedTheme);
        const savedSize = localStorage.getItem('reader_bubble_size') as 'sm' | 'md' | 'lg';
        if (savedSize) setBubbleSize(savedSize);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save Preferences to localStorage
  const handleFontChange = (f: ThaiFontFamily) => {
    setFontFamily(f);
    try { localStorage.setItem('reader_font', f); } catch {}
  };

  const handleFontScaleChange = (scale: number) => {
    setFontScale(scale);
    try { localStorage.setItem('reader_font_scale', scale.toString()); } catch {}
  };

  const handleBubbleOpacityChange = (op: number) => {
    setBubbleOpacity(op);
    try { localStorage.setItem('reader_bubble_opacity', op.toString()); } catch {}
  };

  const handleReadingModeChange = (mode: ReadingMode) => {
    setReadingMode(mode);
    try { localStorage.setItem('reader_mode', mode); } catch {}
  };

  const handleTranslationModeChange = (tmode: TranslationMode) => {
    setTranslationMode(tmode);
    try { localStorage.setItem('reader_trans_mode', tmode); } catch {}
  };

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

  // Load chapter pages & cached translations (IndexedDB -> LocalStorage -> Backend)
  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;
    let hasLoadedPages = false;

    // Check offline status
    isChapterOffline(chapterId)
      .then((saved) => {
        if (!cancelled) setIsOfflineSaved(saved);
      })
      .catch(() => {});

    // 1. Instant check IndexedDB / LocalStorage (0ms)
    getOfflineChapter(chapterId).then((offlineData) => {
      if (cancelled) return;
      if (offlineData && offlineData.pages.length > 0) {
        hasLoadedPages = true;
        setPages(offlineData.pages);
        if (offlineData.translations) {
          setTranslations(offlineData.translations);
        }
        setLoading(false);
      }
    });

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const localPages = localStorage.getItem(`manga_pages_${chapterId}`);
        if (localPages) {
          const parsed = JSON.parse(localPages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasLoadedPages = true;
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
      } catch {}
    });

    const fetchPages = async () => {
      try {
        const [pagesResult, translationsResult] = await Promise.allSettled([
          getChapterPages(chapterId),
          getChapterTranslations(chapterId),
        ]);

        if (cancelled) return;

        if (pagesResult.status === 'fulfilled') {
          hasLoadedPages = true;
          setPages(pagesResult.value.pages);
          try {
            localStorage.setItem(`manga_pages_${chapterId}`, JSON.stringify(pagesResult.value.pages));
          } catch {}
        } else if (!hasLoadedPages) {
          setError(pagesResult.reason instanceof Error ? pagesResult.reason.message : 'Failed to load chapter');
        }

        if (translationsResult.status === 'fulfilled') {
          const map: Record<number, Translation> = {};
          translationsResult.value.forEach((t) => {
            map[t.pageIndex] = t;
          });
          setTranslations((prev) => {
            const merged = { ...prev, ...map };
            try {
              localStorage.setItem(`manga_trans_${chapterId}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPages();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  // Phase 1: High-Performance Image Preloader for Adjacent Pages
  useEffect(() => {
    if (pages.length === 0) return;
    const toPreload = [currentPage + 1, currentPage + 2, currentPage + 3, currentPage - 1];
    const preload = () => toPreload.forEach((idx) => {
      if (idx >= 0 && idx < pages.length && pages[idx]) {
        const img = new Image();
        img.decoding = 'async';
        img.src = pages[idx];
        img.decode?.().catch(() => {});
      }
    });
    const requestIdle = window.requestIdleCallback || ((cb: IdleRequestCallback) => window.setTimeout(cb, 1));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const idleId = requestIdle(preload);
    return () => cancelIdle(idleId);
  }, [currentPage, pages]);

  // Translate a specific page with automatic cooldown and error recovery
  const translateSpecificPage = useCallback(
    async (pageIndex: number, force = false) => {
      if (pageIndex < 0 || pageIndex >= pages.length) return;
      if (translatingPages.has(pageIndex)) return;
      if (translations[pageIndex]) return;
      if (!force && failedPages.has(pageIndex)) return;

      // Limit max parallel background requests to 2 to prevent rate-limit 429
      if (!force && translatingPages.size >= 2) return;

      setTranslatingPages((prev) => new Set(prev).add(pageIndex));
      setTranslationError('');

      try {
        const result = await translatePage(chapterId, pageIndex, pages[pageIndex]);
        setTranslations((prev) => {
          const updated = { ...prev, [pageIndex]: result };
          try {
            localStorage.setItem(`manga_trans_${chapterId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setFailedPages((prev) => {
          const next = new Set(prev);
          next.delete(pageIndex);
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Translation failed';
        setTranslationError(msg);
        setFailedPages((prev) => new Set(prev).add(pageIndex));

        // Auto-clear failed status after 6 seconds so scrolling back re-attempts smoothly
        setTimeout(() => {
          setFailedPages((prev) => {
            const next = new Set(prev);
            next.delete(pageIndex);
            return next;
          });
        }, 6000);
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

  // Webtoon Intersection observer for current page tracking
  useEffect(() => {
    if (readingMode !== 'webtoon' || pages.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-page-index'));
            if (!isNaN(idx)) {
              setCurrentPage(idx);
              if (translationMode !== 'off' && !translations[idx] && !translatingPages.has(idx)) {
                translateSpecificPage(idx, false);
              }
            }
          }
        });
      },
      { rootMargin: '800px 0px 800px 0px', threshold: 0.1 }
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

  // Auto-translate current page
  useEffect(() => {
    let cancelled = false;
    if (
      translationMode !== 'off' &&
      pages.length > 0 &&
      !translations[currentPage] &&
      !failedPages.has(currentPage)
    ) {
      queueMicrotask(() => {
        if (!cancelled) translateSpecificPage(currentPage, false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentPage, translationMode, pages.length, translations, failedPages, translateSpecificPage]);

  // Phase 1: Background Translation Queue for Upcoming Pages (N+1, N+2)
  useEffect(() => {
    if (translationMode === 'off' || pages.length === 0) return;

    const prefetchTimer = setTimeout(async () => {
      // 1. Next Page N+1
      const nextIdx1 = currentPage + 1;
      if (
        nextIdx1 < pages.length &&
        !translations[nextIdx1] &&
        !translatingPages.has(nextIdx1) &&
        !failedPages.has(nextIdx1)
      ) {
        await translateSpecificPage(nextIdx1, false);
      }

      // 2. Next Page N+2
      const nextIdx2 = currentPage + 2;
      if (
        nextIdx2 < pages.length &&
        !translations[nextIdx2] &&
        !translatingPages.has(nextIdx2) &&
        !failedPages.has(nextIdx2)
      ) {
        await translateSpecificPage(nextIdx2, false);
      }
    }, 1000);

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

    const concurrency = 2;
    for (let i = 0; i < untranslatedIndices.length; i += concurrency) {
      const batch = untranslatedIndices.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(async (pageIdx) => {
          try {
            const res = await translatePage(chapterId, pageIdx, pages[pageIdx]);
            setTranslations((prev) => ({ ...prev, [pageIdx]: res }));
          } catch {}
        })
      );
      setTranslateProgress((prev) => ({
        ...prev,
        current: Math.min(prev.total, prev.current + batch.length),
      }));
      if (i + concurrency < untranslatedIndices.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setTranslatingAll(false);
  };

  // Phase 5: Download Chapter for Offline Reading
  const handleSaveOffline = async () => {
    if (pages.length === 0 || downloadingOffline) return;
    setDownloadingOffline(true);
    try {
      await saveOfflineChapter(
        chapterId,
        mangaId,
        manga?.title || 'Manga',
        currentChapter?.chapter || '1',
        pages,
        translations
      );
      setIsOfflineSaved(true);
      alert('✅ บันทึกตอนและคำแปลสำหรับอ่านออฟไลน์เรียบร้อยแล้ว!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ไม่สามารถบันทึกออฟไลน์ได้');
    } finally {
      setDownloadingOffline(false);
    }
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
      if (currentPage > 1) {
        setCurrentPage((prev) => prev - 2);
      } else if (currentPage > 0) {
        setCurrentPage(0);
      } else if (prevChapter) {
        router.push(`/manga/${mangaId}/${prevChapter.id}`);
      }
    } else {
      if (currentPage > 0) {
        setCurrentPage((prev) => prev - 1);
        if (readingMode === 'webtoon' && pageRefs.current[currentPage - 1]) {
          pageRefs.current[currentPage - 1]?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (prevChapter) {
        router.push(`/manga/${mangaId}/${prevChapter.id}`);
      }
    }
  }, [currentPage, readingMode, prevChapter, mangaId, router]);

  const goToNextPage = useCallback(() => {
    if (readingMode === 'double') {
      if (currentPage + 2 < pages.length) {
        setCurrentPage((prev) => prev + 2);
      } else if (nextChapter) {
        router.push(`/manga/${mangaId}/${nextChapter.id}`);
      }
    } else {
      if (currentPage < pages.length - 1) {
        setCurrentPage((prev) => prev + 1);
        if (readingMode === 'webtoon' && pageRefs.current[currentPage + 1]) {
          pageRefs.current[currentPage + 1]?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (nextChapter) {
        router.push(`/manga/${mangaId}/${nextChapter.id}`);
      }
    }
  }, [currentPage, pages.length, readingMode, nextChapter, mangaId, router]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        editingBlock
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        goToPrevPage();
      } else if (e.key === 't' || e.key === 'T') {
        handleTranslationModeChange(
          translationMode === 'thai'
            ? 'sidebyside'
            : translationMode === 'sidebyside'
            ? 'original'
            : translationMode === 'original'
            ? 'off'
            : 'thai'
        );
      } else if (e.key === 'm' || e.key === 'M') {
        handleReadingModeChange(
          readingMode === 'webtoon' ? 'single' : readingMode === 'single' ? 'double' : 'webtoon'
        );
      } else if (e.key === 's' || e.key === 'S') {
        setShowSettingsDrawer((prev) => !prev);
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
  }, [editingBlock, goToNextPage, goToPrevPage, translationMode, readingMode]);

  // Handle Edit Translation Block
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

      setTranslations((prev) => {
        const updated = {
          ...prev,
          [pageIndex]: {
            ...prev[pageIndex],
            result: { texts: updatedTexts },
          },
        };
        try {
          localStorage.setItem(`manga_trans_${chapterId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
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
    <div className={`reader-wrapper ${fontFamily}`}>
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
              {isOfflineSaved && <span className="badge-offline" style={{ marginLeft: '6px' }}>💾 ออฟไลน์</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              onClick={() => handleReadingModeChange('webtoon')}
              title="Webtoon (เลื่อนยาว)"
            >
              📜 Webtoon
            </button>
            <button
              className={`pill-item ${readingMode === 'single' ? 'active' : ''}`}
              onClick={() => handleReadingModeChange('single')}
              title="ทีละหน้า (Single Page)"
            >
              📄 Single
            </button>
            <button
              className={`pill-item ${readingMode === 'double' ? 'active' : ''}`}
              onClick={() => handleReadingModeChange('double')}
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

          {/* Settings Drawer Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSettingsDrawer(true)}
            title="การตั้งค่าการอ่านและฟอนต์ (Settings - S)"
          >
            ⚙️
          </button>

          {/* Shortcuts Help Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowHelpModal(true)}
            title="คีย์ลัด (Shortcuts - ?)"
          >
            ⌨️
          </button>
        </div>
      </header>

      {/* Main Reader Content */}
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
                <img src={pageUrl} alt={`Page ${idx + 1}`} loading={idx < 3 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />

                {/* Translation overlay */}
                {translationMode !== 'off' && translations[idx] && (
                  <TranslationOverlay
                    texts={translations[idx].result.texts}
                    mode={translationMode}
                    theme={bubbleTheme}
                    size={bubbleSize}
                    fontScale={fontScale}
                    bubbleOpacity={bubbleOpacity}
                    fontFamily={fontFamily}
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
              <img src={pages[currentPage]} alt={`Page ${currentPage + 1}`} referrerPolicy="no-referrer" />

              {translationMode !== 'off' && translations[currentPage] && (
                <TranslationOverlay
                  texts={translations[currentPage].result.texts}
                  mode={translationMode}
                  theme={bubbleTheme}
                  size={bubbleSize}
                  fontScale={fontScale}
                  bubbleOpacity={bubbleOpacity}
                  fontFamily={fontFamily}
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

          {/* Right Page (First in spread for RTL manga) */}
          {currentPage + 1 < pages.length && (
            <div className="reader-page" style={{ flex: 1, maxWidth: '50%' }}>
              <div className="reader-image-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                <img src={pages[currentPage + 1]} alt={`Page ${currentPage + 2}`} referrerPolicy="no-referrer" />
                {translationMode !== 'off' && translations[currentPage + 1] && (
                  <TranslationOverlay
                    texts={translations[currentPage + 1].result.texts}
                    mode={translationMode}
                    theme={bubbleTheme}
                    size={bubbleSize}
                    fontScale={fontScale}
                    bubbleOpacity={bubbleOpacity}
                    fontFamily={fontFamily}
                    onEditBlock={(blockIdx, block) => handleOpenEdit(currentPage + 1, blockIdx, block)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Left Page */}
          <div className="reader-page" style={{ flex: 1, maxWidth: '50%' }}>
            <div className="reader-image-container" style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img src={pages[currentPage]} alt={`Page ${currentPage + 1}`} referrerPolicy="no-referrer" />
              {translationMode !== 'off' && translations[currentPage] && (
                <TranslationOverlay
                  texts={translations[currentPage].result.texts}
                  mode={translationMode}
                  theme={bubbleTheme}
                  size={bubbleSize}
                  fontScale={fontScale}
                  bubbleOpacity={bubbleOpacity}
                  fontFamily={fontFamily}
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
            onClick={() => handleTranslationModeChange('thai')}
            title="แปลภาษาไทย (Translation)"
          >
            🇹🇭 แปลไทย
          </button>
          <button
            className={`pill-item ${translationMode === 'sidebyside' ? 'active' : ''}`}
            onClick={() => handleTranslationModeChange('sidebyside')}
            title="โหมดสองภาษา (Bilingual Text Mode: ไทย + ข้อความต้นฉบับ)"
          >
            🌐 โหมดสองภาษา
          </button>
          <button
            className={`pill-item ${translationMode === 'original' ? 'active' : ''}`}
            onClick={() => handleTranslationModeChange('original')}
            title="หน้าต้นฉบับ (Original Page)"
          >
            📄 หน้าต้นฉบับ
          </button>
          <button
            className={`pill-item ${translationMode === 'off' ? 'active' : ''}`}
            onClick={() => handleTranslationModeChange('off')}
            title="ปิดการแสดงคำแปล (Off)"
          >
            🚫 ปิดคำแปล
          </button>
        </div>

        {/* Quick Settings Icon */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSettingsDrawer(true)}
          title="ปรับแต่งฟอนต์และกล่องข้อความ (Text Block Settings)"
        >
          🎨
        </button>

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

      {/* Phase 2: Reader Settings Drawer */}
      {showSettingsDrawer && (
        <div className="modal-overlay" onClick={() => setShowSettingsDrawer(false)}>
          <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>⚙️ การตั้งค่าผู้อ่าน (Reader Settings)</h3>
              <button className="modal-close" onClick={() => setShowSettingsDrawer(false)}>
                ✕
              </button>
            </div>

            {/* Font Family Selection */}
            <div className="settings-section">
              <div className="settings-title">🔤 แบบฟอนต์ภาษาไทย (Thai Manga Font)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'font-prompt', name: 'Prompt (มาตรฐาน)', styleName: 'font-prompt' },
                  { id: 'font-kanit', name: 'Kanit (คมชัด)', styleName: 'font-kanit' },
                  { id: 'font-mali', name: 'Mali (การ์ตูนน่ารัก)', styleName: 'font-mali' },
                  { id: 'font-itim', name: 'Itim (ลายมือชิคๆ)', styleName: 'font-itim' },
                  { id: 'font-mitr', name: 'Mitr (สบายตา)', styleName: 'font-mitr' },
                  { id: 'font-baijamjuree', name: 'Bai Jamjuree', styleName: 'font-baijamjuree' },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`btn btn-sm ${fontFamily === item.id ? 'btn-primary' : 'btn-secondary'} ${item.styleName}`}
                    onClick={() => handleFontChange(item.id as ThaiFontFamily)}
                    style={{ fontSize: '0.85rem', padding: '8px 6px', textAlign: 'center' }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Scale Multiplier */}
            <div className="settings-section">
              <div className="settings-title">
                📏 ขนาดตัวอักษร: {fontScale}%
              </div>
              <div className="slider-container">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>80%</span>
                <input
                  type="range"
                  min="80"
                  max="140"
                  step="5"
                  value={fontScale}
                  onChange={(e) => handleFontScaleChange(Number(e.target.value))}
                  className="custom-slider"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>140%</span>
              </div>
            </div>

            {/* Text Block Theme */}
            <div className="settings-section">
              <div className="settings-title">🎨 ธีมกล่องข้อความ (Text Block Theme)</div>
              <div className="pill-group" style={{ width: '100%', display: 'flex' }}>
                <button
                  className={`pill-item ${bubbleTheme === 'manga' ? 'active' : ''}`}
                  onClick={() => { setBubbleTheme('manga'); try { localStorage.setItem('reader_bubble_theme', 'manga'); } catch {} }}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  ⚪ ขาว (Manga)
                </button>
                <button
                  className={`pill-item ${bubbleTheme === 'soft' ? 'active' : ''}`}
                  onClick={() => { setBubbleTheme('soft'); try { localStorage.setItem('reader_bubble_theme', 'soft'); } catch {} }}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  🌓 นวล (Soft)
                </button>
                <button
                  className={`pill-item ${bubbleTheme === 'dark' ? 'active' : ''}`}
                  onClick={() => { setBubbleTheme('dark'); try { localStorage.setItem('reader_bubble_theme', 'dark'); } catch {} }}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  🌙 มืด (Dark)
                </button>
              </div>
            </div>

            {/* Text Block Opacity */}
            <div className="settings-section">
              <div className="settings-title">
                👁️ ความทึบของกล่องข้อความ: {bubbleOpacity}%
              </div>
              <div className="slider-container">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>60%</span>
                <input
                  type="range"
                  min="60"
                  max="100"
                  step="5"
                  value={bubbleOpacity}
                  onChange={(e) => handleBubbleOpacityChange(Number(e.target.value))}
                  className="custom-slider"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>100%</span>
              </div>
            </div>

            {/* Offline Chapter Download Section */}
            <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div className="settings-title">📱 บันทึกสำหรับอ่านออฟไลน์ (Offline)</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                บันทึกรูปภาพและคำแปลทั้งตอนลงในเครื่อง เพื่อเปิดอ่านได้แม้ไม่มีอินเทอร์เน็ต
              </p>
              <button
                className={`btn ${isOfflineSaved ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                onClick={handleSaveOffline}
                disabled={downloadingOffline}
                style={{ width: '100%' }}
              >
                {downloadingOffline ? '⏳ กำลังบันทึกออฟไลน์...' : isOfflineSaved ? '✅ ออฟไลน์แล้ว (บันทึกซ้ำ)' : '💾 ดาวน์โหลดเก็บไว้อ่านออฟไลน์'}
              </button>
            </div>

            <div style={{ marginTop: 'auto', textAlign: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSettingsDrawer(false)} style={{ width: '100%' }}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Translation Block Modal (Translation Correction) */}
      {editingBlock && (
        <div className="modal-overlay" onClick={() => setEditingBlock(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ แก้ไขคำแปล (Translation Correction)</h3>
              <button className="modal-close" onClick={() => setEditingBlock(null)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                ข้อความต้นฉบับ (Source Text):
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
                คำแปลภาษาไทย (Target Language - Thai):
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
                {savingEdit ? 'กำลังบันทึก...' : '💾 บันทึกคำแปล'}
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
              <span>สลับโหมดการแปล (แปลไทย / โหมดสองภาษา / หน้าต้นฉบับ / ปิดคำแปล)</span>

              <span className="shortcut-key">M</span>
              <span>เปลี่ยนโหมดการจัดหน้า (Webtoon / Single / Double Page)</span>

              <span className="shortcut-key">S</span>
              <span>เปิดการตั้งค่าฟอนต์และกล่องข้อความ (Settings)</span>

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
  fontScale = 100,
  bubbleOpacity = 100,
  fontFamily = 'font-prompt',
  onEditBlock,
}: {
  texts: TextBlock[];
  mode: TranslationMode;
  theme?: 'manga' | 'soft' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  fontScale?: number;
  bubbleOpacity?: number;
  fontFamily?: ThaiFontFamily;
  onEditBlock: (index: number, block: TextBlock) => void;
}) {
  if (!texts || texts.length === 0 || mode === 'off') return null;

  const scaleFactor = (fontScale || 100) / 100;
  const opacityFactor = (bubbleOpacity || 100) / 100;

  return (
    <div className={`translation-overlay ${fontFamily}`}>
      {texts.map((block, idx) => {
        const x = normalizePos(block.x);
        const y = normalizePos(block.y);
        const w = Math.max(0.10, Math.min(0.55, normalizePos(block.width || 0.16)));
        const h = Math.max(0.05, Math.min(0.45, normalizePos(block.height || 0.08)));

        const leftPercent = x * 100;
        const topPercent = y * 100;
        const widthPercent = w * 100;
        const minHeightPercent = h * 100;

        const textLen = (block.thai || '').length;
        let baseRem = 0.84;
        let lineHeightStyle = '1.30';

        if (size === 'sm') {
          if (textLen > 40) baseRem = 0.60;
          else if (textLen > 25) baseRem = 0.66;
          else baseRem = 0.74;
        } else if (size === 'lg') {
          if (textLen > 40) baseRem = 0.82;
          else if (textLen > 25) baseRem = 0.92;
          else baseRem = 1.04;
        } else {
          // Default 'md'
          if (textLen > 45) {
            baseRem = 0.66;
            lineHeightStyle = '1.18';
          } else if (textLen > 30) {
            baseRem = 0.72;
            lineHeightStyle = '1.22';
          } else if (textLen > 18) {
            baseRem = 0.78;
            lineHeightStyle = '1.26';
          }
        }

        const calculatedFontSize = `${(baseRem * scaleFactor).toFixed(2)}rem`;
        const isOvalBubble = widthPercent > 14 && minHeightPercent > 8;

        return (
          <div
            key={idx}
            className={`text-block theme-${theme} size-${size} mode-${mode}`}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              width: `${widthPercent}%`,
              minHeight: `${minHeightPercent}%`,
              height: 'auto',
              borderRadius: isOvalBubble ? '20px' : '8px',
              fontSize: calculatedFontSize,
              lineHeight: lineHeightStyle,
              padding: '4px 6px',
              opacity: opacityFactor,
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
