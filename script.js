document.addEventListener("DOMContentLoaded", () => {
  const FEEDS = {
    hungary: [
      "https://index.hu/24ora/rss/",
      "https://telex.hu/rss",
      "https://444.hu/feed",
      "https://hvg.hu/rss",
      "https://www.origo.hu/rss"
    ],
    croatia: [
      "https://www.24sata.hr/feeds/news.xml",
      "https://www.jutarnji.hr/rss",
      "https://www.vecernji.hr/rss",
      "https://www.nacional.hr/rss",
      "https://www.net.hr/rss"
    ],
    slovenia: [
      "https://www.rtvslo.si/rss",
      "https://www.delo.si/rss",
      "https://www.sta.si/rss",
      "https://www.24ur.com/rss",
      "https://www.siol.net/rss"
    ],
    moldova: [
      // Preferred sources (corrected Jurnal feed)
      "https://www.jurnal.md/ro/rss",
      "https://tv8.md/rss",
      "https://stiri.md/rss",
      // Additional strong sources for fuller coverage
      "https://unimedia.info/rss/",
      "https://www.ipn.md/en/rss",
      "https://deschide.md/rss.xml",
      "https://newsmaker.md/rss/",
      "https://agora.md/rss",
      "https://noi.md/rss",
      "https://point.md/ro/rss",
      "https://point.md/ru/rss",
      "https://www.zdg.md/feed/",
      "http://rss.publika.md/rss/?lang=ro"
    ],
    bosnia: [
      "https://www.klix.ba/rss",
      "https://www.avaz.ba/rss",
      "https://www.oslobodjenje.ba/rss",
      "https://www.dnevni.ba/rss",
      "https://www.faktor.ba/rss"
    ]
  };

  const cards = document.getElementById("cards");
  const countrySelect = document.getElementById("countrySelect");
  const refreshBtn = document.getElementById("refreshBtn");
  const translateBtn = document.getElementById("translateBtn");
  const toggleImages = document.getElementById("toggleImages");
  const refreshInterval = document.getElementById("refreshInterval");
  const selectedBadge = document.getElementById("selectedBadge");
  const lastUpdated = document.getElementById("lastUpdated");
  const autoRefreshStatus = document.getElementById("autoRefreshStatus");

  let imagesEnabled = true;
  let translationEnabled = false;
  let autoRefreshInterval = null;
  let autoRefreshTimer = null;
  const FALLBACK_IMG = "TV_noise.jpg"; // local image in your project folder

  // Auto-refresh functionality
  function startAutoRefresh() {
    // Clear existing interval
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
    }

    const intervalMs = parseInt(refreshInterval.value);
    const intervalMinutes = intervalMs / 60000;
    
    // Start the auto-refresh interval
    autoRefreshInterval = setInterval(async () => {
      console.log('Auto-refreshing news...');
      await fetchFeedsFor(countrySelect.value, true);
    }, intervalMs);

    // Start countdown timer
    startCountdownTimer(intervalMinutes);
    
    // Update status indicator
    autoRefreshStatus.textContent = `🔄 Auto-refresh active (${intervalMinutes}min)`;
    autoRefreshStatus.style.color = "var(--accent)";
    
    console.log(`Auto-refresh started: every ${intervalMinutes} minutes`);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    
    // Update status indicator
    autoRefreshStatus.textContent = "⏸️ Auto-refresh paused";
    autoRefreshStatus.style.color = "#ff6b6b";
    
    console.log('Auto-refresh stopped');
  }

  function startCountdownTimer(intervalMinutes) {
    let timeLeft = intervalMinutes * 60; // Convert to seconds
    
    autoRefreshTimer = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Update the refresh button to show countdown
      refreshBtn.textContent = `Next: ${timeString}`;
      
      timeLeft--;
      
      if (timeLeft < 0) {
        timeLeft = intervalMinutes * 60; // Reset for next cycle
      }
    }, 1000);
  }

  // Timezone conversion function
  function formatLocalTime(pubDateString) {
    try {
      // Parse the date string (RSS feeds often use RFC 2822 format)
      const date = new Date(pubDateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return pubDateString; // Return original if parsing fails
      }
      
      // Convert to local timezone and format as dd/mm/yy
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
      const hour12 = date.getHours() % 12 || 12;
      
      return `${day}/${month}/${year} ${String(hour12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    } catch (error) {
      console.warn('Date parsing failed:', error);
      return pubDateString; // Return original if conversion fails
    }
  }

  // Translation function
  async function translateText(text, targetLang = 'en') {
    try {
      // Simple translation using Google Translate API (free tier)
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await response.json();
      return data[0][0][0] || text;
    } catch (error) {
      console.warn('Translation failed:', error);
      return text; // Return original text if translation fails
    }
  }

  // Local storage functions
  function getTodayKey() {
    return `news_${new Date().toDateString()}`;
  }

  function getStoredArticles() {
    const todayKey = getTodayKey();
    const stored = localStorage.getItem(todayKey);
    return stored ? JSON.parse(stored) : {};
  }

  function saveArticles(country, articles) {
    // Separate articles into today and yesterday
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    // Use a smaller buffer window (6 hours) to catch articles from yesterday while maintaining performance
    const yesterdayWindowStart = new Date(startOfYesterday.getTime() - 6 * 60 * 60 * 1000); // 6 hours before yesterday
    
    const todayArticles = [];
    const yesterdayArticles = [];
    
    articles.forEach(article => {
      const d = new Date(article.pubDate);
      if (isNaN(d.getTime())) {
        // Invalid dates - assume they're from today
        todayArticles.push(article);
      } else {
        if (d >= startOfDay && d < endOfDay) {
          todayArticles.push(article);
        } else if (d >= yesterdayWindowStart && d < startOfDay) {
          // Include articles from yesterday (with wide buffer for timezone/parsing issues)
          yesterdayArticles.push(article);
        }
        // Articles older than yesterday are not saved (they're filtered out)
      }
    });
    
    // Get existing articles to merge (don't overwrite, merge)
    // This is CRITICAL: we must preserve all existing yesterday articles, even if RSS feeds don't include them
    const todayKey = getTodayKey();
    const todayStored = getStoredArticles();
    const existingToday = todayStored[country] || [];
    todayStored[country] = mergeArticles(existingToday, todayArticles);
    localStorage.setItem(todayKey, JSON.stringify(todayStored));
    
    // Merge yesterday's articles (preserve all existing yesterday articles)
    // This ensures that even if RSS feeds don't include yesterday articles, we keep what we have
    const yesterdayKey = getYesterdayKey();
    const yesterdayStored = getYesterdayStoredArticles();
    const existingYesterday = yesterdayStored[country] || [];
    // Always merge - never overwrite yesterday articles, as RSS feeds might not include them
    yesterdayStored[country] = mergeArticles(existingYesterday, yesterdayArticles);
    localStorage.setItem(yesterdayKey, JSON.stringify(yesterdayStored));
  }

  function getYesterdayKey() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `news_${yesterday.toDateString()}`;
  }

  function getYesterdayStoredArticles() {
    const yesterdayKey = getYesterdayKey();
    const stored = localStorage.getItem(yesterdayKey);
    return stored ? JSON.parse(stored) : {};
  }

  function getStoredArticlesForCountry(country) {
    // Get today's articles
    const todayStored = getStoredArticles();
    const todayArticles = todayStored[country] || [];
    
    // Get yesterday's articles and merge
    // IMPORTANT: Always include yesterday articles even if RSS feeds don't provide them today
    const yesterdayStored = getYesterdayStoredArticles();
    const yesterdayArticles = yesterdayStored[country] || [];
    
    // Debug logging (can be removed later)
    if (yesterdayArticles.length > 0) {
      console.log(`[${country}] Found ${yesterdayArticles.length} yesterday articles in localStorage`);
    }
    
    // Merge and return, removing duplicates by link
    const allArticles = mergeArticles(todayArticles, yesterdayArticles);
    return allArticles;
  }

  function clearOldArticles() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('news_') && key !== `news_${todayStr}` && key !== `news_${yesterdayStr}`) {
        localStorage.removeItem(key);
      }
    });
  }

  // Function to ensure we only have past 2 days data (today + yesterday)
  function ensureCurrentDayData() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();
    const keys = Object.keys(localStorage);
    let cleaned = false;
    
    keys.forEach(key => {
      if (key.startsWith('news_') && key !== `news_${todayStr}` && key !== `news_${yesterdayStr}`) {
        localStorage.removeItem(key);
        cleaned = true;
      }
    });
    
    if (cleaned) {
      console.log('Cleaned old news data from previous days (keeping today and yesterday)');
    }
  }

  function mergeArticles(existing, newArticles) {
    const existingMap = new Map();
    existing.forEach(article => {
      existingMap.set(article.link, article);
    });
    
    newArticles.forEach(article => {
      if (!existingMap.has(article.link)) {
        existingMap.set(article.link, article);
      }
    });
    
    return Array.from(existingMap.values());
  }

  // Read articles tracking functions
  function getReadArticles() {
    try {
      const stored = localStorage.getItem('readArticles');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function markArticleAsRead(articleLink) {
    const readArticles = getReadArticles();
    readArticles.add(articleLink);
    try {
      localStorage.setItem('readArticles', JSON.stringify(Array.from(readArticles)));
    } catch (e) {
      console.warn('Failed to save read articles:', e);
    }
  }

  function isArticleRead(articleLink) {
    return getReadArticles().has(articleLink);
  }

  async function fetchFeedsFor(country, isRefresh = false) {
    // Special handling for Politico source which is not an RSS feed
    if (country === 'politico') {
      // Clear old articles from previous days
      clearOldArticles();
      const existingArticles = getStoredArticlesForCountry(country);
      if (existingArticles.length > 0 && !isRefresh) {
        await renderItems(existingArticles);
        lastUpdated.textContent = `\ud83d\udcf1 Cache: ${existingArticles.length} items`;
      }

      cards.innerHTML = '<div class="small">\u23f3 Fetching latest news...</div>';
      const start = Date.now();
      try {
        // Fast path: fetch without image enrichment, render immediately
        const politicoItems = await fetchPoliticoLatest(false);

        // Keep articles from current day + yesterday (past 2 days)
        const now = new Date();
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const todayItems = politicoItems.filter((it) => {
          const d = new Date(it.pubDate);
          // Include yesterday and today
          return d >= startOfYesterday && d < endOfDay;
        });

        // Merge with cache
        const allItems = mergeArticles(existingArticles, todayItems)
          .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        saveArticles(country, allItems);
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        lastUpdated.textContent = `\ud83d\udd04 ${allItems.length} items (${todayItems.length} new) • ${duration}s`;
        await renderItems(allItems);

        // Background image enrichment to improve thumbnails without delaying UI
        // Reduced enrichment limit for better performance
        ;(async () => {
          try {
            const enriched = await fetchPoliticoLatest(true);
            const enrichedToday = enriched.filter((it) => {
              const d = new Date(it.pubDate);
              return d >= startOfYesterday && d < endOfDay;
            });
            const merged = mergeArticles(allItems, enrichedToday)
              .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            saveArticles(country, merged);
            await renderItems(merged);
          } catch {}
        })();
      } catch (e) {
        console.error('Error fetching Politico:', e);
        if (existingArticles.length > 0) {
          await renderItems(existingArticles);
          lastUpdated.textContent = `Using cached • ${existingArticles.length} items (failed)`;
        } else {
          cards.innerHTML = "<p style='color:#ff6b6b'>❌ Failed to load news.</p>";
          cards.classList.remove('has-sections');
        }
      }
      return;
    }

    const urls = country === 'moldova'
      ? (FEEDS[country] || []).slice(0, 12)
      : (FEEDS[country] || []).slice(0, 5);
    
    // Clear old articles from previous days
    clearOldArticles();
    
    // Get existing articles from storage
    const existingArticles = getStoredArticlesForCountry(country);
    
    // If we have existing articles and this is not a refresh, show them immediately
    if (existingArticles.length > 0 && !isRefresh) {
      await renderItems(existingArticles);
        lastUpdated.textContent = `📱 Cache: ${existingArticles.length} items`;
    }
    
    cards.innerHTML = '<div class="small">⏳ Fetching latest news...</div>';
    const start = Date.now();

    try {
      const responses = await Promise.all(
        urls.map(async (u) => {
          const proxies = [
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
            `https://corsproxy.io/?${encodeURIComponent(u)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
          ];

          let xmlText = null;
          try {
            const controller = new AbortController();
            const timeoutMs = country === 'moldova' ? 3000 : 5000; // Reduced for faster loading
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const text = await Promise.any(
              proxies.map(p => fetch(p, { signal: controller.signal }).then(r => r.ok ? r.text() : Promise.reject()))
            );
            clearTimeout(timeoutId);
            if (text && text.trim().startsWith('<')) xmlText = text;
          } catch (e) {
            // no xmlText; return [] below
          }

          if (!xmlText) return [];

          const parser = new DOMParser();
          const xml = parser.parseFromString(xmlText, "text/xml");

          const nodes = xml.querySelectorAll("item, entry");
          return Array.from(nodes).map((it) => {
            const desc = it.querySelector("description")?.textContent || "";
            const imgMatch = desc.match(/<img[^>]+src=\"([^\">]+)\"/);
            const image =
              it.querySelector("media\\:content, media\\:thumbnail, enclosure, thumbnail")?.getAttribute("url") ||
              (imgMatch ? imgMatch[1] : FALLBACK_IMG);

            // Extract date from multiple possible fields and formats
            let dateText = (
              it.querySelector("pubDate, updated, published, dc\\:date, date")?.textContent || ""
            ).trim();
            if (!dateText) {
              const t = it.querySelector("time[datetime]")?.getAttribute("datetime") || "";
              if (t) dateText = t;
            }
            // Also check for other common date fields
            if (!dateText) {
              dateText = it.getAttribute("date") || it.getAttribute("timestamp") || "";
            }
            const pubDate = dateText || "";

            let link = it.querySelector("link")?.textContent?.trim() || "";
            if (!link) {
              const linkEl = it.querySelector("link[href][rel='alternate']") || it.querySelector("link[href]");
              if (linkEl) link = linkEl.getAttribute("href") || "";
            }

            return {
              title: it.querySelector("title")?.textContent?.trim() || "",
              link,
              pubDate,
              thumbnail: image
            };
          });
        })
      );

      let newItems = responses.flat();
      if (!newItems.length) {
      // If no new items but we have existing ones, show them
      if (existingArticles.length > 0) {
        await renderItems(existingArticles);
        lastUpdated.textContent = `No new articles • ${existingArticles.length} cached`;
        return;
      }
        throw new Error("No items loaded");
      }

      newItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      // Keep articles from current day + yesterday (past 2 days)
      const now = new Date();
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      // Slightly relax the window for sources that may timezone-shift
      const relaxMsStart = country === 'moldova' ? 3 * 60 * 60 * 1000 : 0; // include up to 3h before midnight
      const relaxMsEnd = country === 'moldova' ? 1 * 60 * 60 * 1000 : 0;   // include up to 1h after midnight

      // Filter articles - use a smaller buffer for performance (only 6 hours before yesterday)
      const bufferStart = new Date(startOfYesterday.getTime() - 6 * 60 * 60 * 1000); // 6 hours before yesterday
      
      newItems = newItems
        .filter((it) => {
          const d = new Date(it.pubDate);
          // If date is invalid or missing, assume it's today to avoid dropping fresh items
          if (isNaN(d.getTime())) return true;
          // Include articles from yesterday to today (with small buffer for timezone)
          return d >= bufferStart && d < new Date(endOfDay.getTime() + relaxMsEnd);
        });

      // Merge with existing articles
      const allItems = mergeArticles(existingArticles, newItems);
      allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      
      // Filter all articles to show past 2 days (yesterday + today)
      // Use a smaller buffer for better performance
      const currentTime = new Date();
      const yesterdayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() - 1);
      const dayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
      const dayEnd = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1);
      
      // Use a smaller buffer (6 hours) to capture yesterday articles while maintaining performance
      const windowStart = new Date(yesterdayStart.getTime() - 6 * 60 * 60 * 1000); // 6 hours before yesterday
      
      const finalItems = allItems.filter((it) => {
        const d = new Date(it.pubDate);
        if (isNaN(d.getTime())) {
          // Invalid dates - include them (they'll be treated as today in saveArticles)
          return true;
        }
        // Include articles from yesterday (with small buffer) to tomorrow
        return d >= windowStart && d < dayEnd;
      });
      
      // Save to localStorage
      saveArticles(country, finalItems);

      const duration = ((Date.now() - start) / 1000).toFixed(1);
      const newCount = newItems.length;
      const totalCount = finalItems.length;
        lastUpdated.textContent = `🔄 ${totalCount} items (${newCount} new) • ${duration}s`;
      await renderItems(finalItems);
    } catch (err) {
      console.error("Error fetching feeds:", err);
      // If we have cached articles, show them even if fetch failed
      if (existingArticles.length > 0) {
        await renderItems(existingArticles);
        lastUpdated.textContent = `Using cached • ${existingArticles.length} items (failed)`;
      } else {
        cards.innerHTML = "<p style='color:#ff6b6b'>❌ Failed to load news.</p>";
        cards.classList.remove('has-sections');
      }
    }
  }

  async function fetchPoliticoLatest(enrichImages = true) {
    const url = 'https://www.politico.eu/latest/';
    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];

    // 0) FAST PATH: use paginated RSS feed to collect items from past 2 days
    async function fetchPoliticoFeedItemsPaged() {
      const today = new Date();
      const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const results = [];
      const MAX_FEED_PAGES = 3; // Reduced from 4 for faster loading
      const MAX_ITEMS = 80; // Reduced from 120 for better performance
      for (let page = 1; page <= MAX_FEED_PAGES; page++) {
        const feedUrl = page === 1 ? 'https://www.politico.eu/feed/' : `https://www.politico.eu/feed/?paged=${page}`;
        const proxiesLocal = [
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(feedUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`
        ];
        let xmlText = null;
        // Use Promise.race with timeout for faster proxy selection
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          const text = await Promise.race(
            proxiesLocal.map(p => 
              fetch(p, { signal: controller.signal })
                .then(r => r.ok ? r.text() : Promise.reject())
                .catch(() => Promise.reject())
            )
          );
          clearTimeout(timeoutId);
          if (text && text.trim().startsWith('<')) xmlText = text;
        } catch {}
        if (!xmlText) break;
        const parserLocal = new DOMParser();
        const xml = parserLocal.parseFromString(xmlText, 'text/xml');
        const pageItems = Array.from(xml.querySelectorAll('item')).map(it => {
          const title = it.querySelector('title')?.textContent?.trim() || '';
          const link = it.querySelector('link')?.textContent?.trim() || '';
          const pubDate = it.querySelector('pubDate, dc\\:date, updated, published')?.textContent?.trim() || '';
          const media = it.querySelector('media\\:content, enclosure, media\\:thumbnail');
          let image = media?.getAttribute('url') || '';
          if (!image) {
            const desc = it.querySelector('description')?.textContent || '';
            const m = desc.match(/<img[^>]+src=\"([^\">]+)\"/);
            if (m) image = m[1];
          }
          return { title, link, pubDate, thumbnail: image || FALLBACK_IMG };
        });
        // Stop if feed page is empty
        if (!pageItems.length) break;
        // Partition into yesterday+today vs older - stop early for performance
        let sawOlder = false;
        let foundToday = false;
        for (const it of pageItems) {
          const d = new Date(it.pubDate);
          if (!isNaN(d.getTime())) {
            if (d >= startOfDay && d < endOfDay) {
              foundToday = true;
              results.push(it);
            } else if (d >= startOfYesterday && d < startOfDay) {
              results.push(it);
            } else if (d < startOfYesterday) {
              sawOlder = true;
            }
          }
        }
        // Stop early if we found today's articles but this page has older ones
        if (foundToday && sawOlder) break;
        // If this feed page is all older than yesterday, stop
        if (sawOlder && !foundToday) break;
        // Stop if we have enough items
        if (results.length >= MAX_ITEMS) break;
      }
      results.sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));
      return results;
    }

    // Enrich thumbnails only for items that still use fallback; keep limit small for speed
    async function enrichMissingImages(items, maxToEnrich = 4) {
      const targets = items.filter(it => !it.thumbnail || it.thumbnail === FALLBACK_IMG).slice(0, maxToEnrich);
      if (!targets.length) return items;

      const proxiesLocal = (u) => [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        `https://corsproxy.io/?${encodeURIComponent(u)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
      ];

      await Promise.all(targets.map(async (it) => {
        try {
          let html = null;
          for (const p of proxiesLocal(it.link)) {
            try {
              const r = await fetch(p);
              if (r.ok) {
                const t = await r.text();
                if (t && t.length > 500) { html = t; break; }
              }
            } catch {}
          }
          if (!html) return;
          const parserLocal = new DOMParser();
          const doc = parserLocal.parseFromString(html, 'text/html');
          const og = doc.querySelector('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]');
          let img = og?.getAttribute('content') || '';
          if (!img) {
            const firstImg = doc.querySelector('article img, figure img, img');
            if (firstImg) img = firstImg.getAttribute('src') || '';
          }
          if (img) {
            it.thumbnail = img.startsWith('http') ? img : new URL(img, it.link).toString();
          }
        } catch {}
      }));

      return items;
    }

    let htmlText = null;
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy);
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 100) {
            htmlText = text;
            break;
          }
        }
      } catch (e) {
        console.warn('Proxy failed for Politico:', proxy);
      }
    }

    if (!htmlText) throw new Error('No HTML from Politico');

    // 1) Use paginated RSS to get full day coverage quickly
    try {
      const feedToday = await fetchPoliticoFeedItemsPaged();
      if (feedToday.length > 0) {
        if (enrichImages) {
          await enrichMissingImages(feedToday, 6); // Reduced from 12
        }
        return feedToday;
      }
    } catch {}

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Helper to fetch via proxies (reused below) — HTML fallback
    async function fetchViaProxies(pageUrl) {
      const proxiesLocal = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(pageUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(pageUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(pageUrl)}`
      ];
      for (const p of proxiesLocal) {
        try {
          const r = await fetch(p);
          if (r.ok) {
            const t = await r.text();
            if (t && t.length > 200) return t;
          }
        } catch (e) {
          // continue trying next proxy
        }
      }
      throw new Error('all proxies failed');
    }

    async function collectPageLinks(documentNode, currentPageIndex, baseUrl) {
      const scope = documentNode.querySelector('main') || documentNode;
      const anchors = Array.from(scope.querySelectorAll('h1 a[href], h2 a[href], h3 a[href], h4 a[href], a[href*="/article/"], a[href*="/news/"]'));
      const links = [];
      let numOld = 0;
      let numRel = 0;
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        if (!href) continue;
        if (href.startsWith('#')) continue;
        const abs = href.startsWith('http') ? href : new URL(href, 'https://www.politico.eu').toString();
        const u = new URL(abs);
        // allow both politico.eu and politico.com
        if (!/\.politico\.(eu|com)$/i.test(u.hostname)) continue;
        // skip pro subdomain on EU
        if (u.hostname.toLowerCase().startsWith('pro.')) continue;
        if (/\bfilters?\b/i.test(abs)) continue;
        const title = (a.textContent || '').trim();
        if (!title || title.length < 6 || /^filters$/i.test(title)) continue;
        // Try to capture relative label from the date element (faster decision: today vs old)
        const container = a.closest('article, li, div') || a.parentElement;
        let relText = '';
        if (container) {
          const timeNode = container.querySelector('.date-time__time') || container.querySelector('time') || container;
          relText = (timeNode.textContent || '').trim();
        }
        const upper = relText.toUpperCase();
        const isRelative = /(\d+)\s*(HRS?|MINS?)\s*AGO|JUST NOW/.test(upper);
        const isAbsoluteDate = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}/.test(upper);
        if (isRelative) numRel += 1;
        if (isAbsoluteDate && !isRelative) numOld += 1;
        links.push({ href: abs, title, anchor: a, relText });
      }
      // Try to discover next page link
      let next = null;
      const nextRel = documentNode.querySelector('link[rel="next"]');
      if (nextRel) next = nextRel.getAttribute('href');
      if (!next) {
        const more = Array.from(scope.querySelectorAll('a')).find(a => /load\s*more|more\s*results/i.test(a.textContent || ''));
        if (more) next = more.getAttribute('href');
      }
      if (next && !next.startsWith('http')) next = new URL(next, 'https://www.politico.eu').toString();
      // Fallback to classic WordPress pagination /latest/page/{n}/
      if (!next && typeof currentPageIndex === 'number' && baseUrl) {
        const pageNum = currentPageIndex + 2; // next page (1-indexed pages)
        next = new URL(`page/${pageNum}/`, baseUrl).toString();
      }
      return { links, next, numRel, numOld };
    }

    // Crawl up to N pages to gather all current-day links
    const seenLinks = new Set();
    const collected = [];
    let currentHtml = htmlText;
    let currentDoc = doc;
    let depth = 0;
    const MAX_PAGES = 20; // crawl deeper to capture full current day
    while (depth < MAX_PAGES) {
      const { links, next } = await collectPageLinks(currentDoc, depth, url);
      for (const { href, title, anchor } of links) {
        if (!seenLinks.has(href)) {
          seenLinks.add(href);
          collected.push({ href, title, anchor });
        }
      }
      // Stop if no next or no new links were found
      if (links.length === 0) break;
      if (!next) break;
      // Try multiple next-page URL forms in case /page/N/ is blocked
      const candidates = [next];
      try {
        const urlObj = new URL(next);
        if (!/page\//.test(urlObj.pathname)) {
          const alt = new URL(`page/${depth + 2}/`, urlObj.origin + urlObj.pathname);
          candidates.push(alt.toString());
        }
        const qp = new URL(next);
        qp.searchParams.set('page', String(depth + 2));
        candidates.push(qp.toString());
        const qp2 = new URL(next);
        qp2.searchParams.set('paged', String(depth + 2));
        candidates.push(qp2.toString());
      } catch {}

      let fetched = false;
      for (const cand of candidates) {
        try {
          const html = await fetchViaProxies(cand);
          if (html && html.length > 5000) {
            currentHtml = html;
            currentDoc = parser.parseFromString(currentHtml, 'text/html');
            fetched = true;
            break;
          }
        } catch {}
      }
      if (!fetched) break;
      depth += 1;
    }

    // Defensive: explicitly try classic paged URLs 2..N to ensure we don't stop at the button
    if (collected.length > 0) {
      for (let pageNum = 2; pageNum <= MAX_PAGES + 1; pageNum++) {
        let html = null;
        try {
          const pagedUrl = new URL(`page/${pageNum}/`, url).toString();
          html = await fetchViaProxies(pagedUrl);
        } catch {}
        if (!html) break;
        const docN = parser.parseFromString(html, 'text/html');
        const { links: linksN } = await collectPageLinks(docN, pageNum - 1, url);
        for (const { href, title, anchor } of linksN) {
          if (!seenLinks.has(href)) {
            seenLinks.add(href);
            collected.push({ href, title, anchor });
          }
        }
        if (linksN.length === 0) break;
      }
    }

    // Build initial result objects from collected links and attempt list-page image/time extraction
    const scope = doc.querySelector('main') || doc;
    // Build results from collected link entries
    const titleAnchors = [];

    const seen = new Map();
    const now = Date.now();

    const results = [];

    function extractRelativeDelta(container) {
      const text = ((container && container.textContent) || '').toUpperCase();
      if (!text) return null;
      if (text.includes('JUST NOW')) return 0;
      const m = text.match(/(\d+)\s*MINS?\s*AGO/);
      const h = text.match(/(\d+)\s*HRS?\s*AGO/);
      const hr = text.match(/(\d+)\s*HOURS?\s*AGO/);
      const d = text.match(/(\d+)\s*DAYS?\s*AGO/);
      let minutes = 0;
      if (m) minutes += parseInt(m[1], 10);
      if (h) minutes += parseInt(h[1], 10) * 60;
      if (hr) minutes += parseInt(hr[1], 10) * 60;
      if (d) minutes += parseInt(d[1], 10) * 1440;
      return minutes > 0 ? minutes : (text.includes('MIN AGO') || text.includes('HR AGO') ? minutes : null);
    }

    for (const entry of collected) {
      const a = entry.anchor;
      let href = a.getAttribute('href') || '';
      if (!href) continue;
      if (href.startsWith('#')) continue;
      const abs = href.startsWith('http') ? href : new URL(href, 'https://www.politico.eu').toString();
      const u = new URL(abs);
      if (u.hostname && !u.hostname.includes('politico.eu')) continue; // keep only Politico EU
      // Skip pro subdomain
      if (u.hostname.startsWith('pro.')) continue;
      // Skip filter or utility links
      if (/\bfilters?\b/i.test(abs)) continue;

      const title = (a.textContent || '').trim();
      if (!title || /^filters$/i.test(title)) continue; // remove stray "Filters" item
      if (!title || title.length < 6) continue;

      // Find the closest card container to also extract image/time
      const container = a.closest('article, li, div');
      let img = null;
      if (container) {
        const imgEl = container.querySelector('img');
        if (imgEl) {
          const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || null;
          const srcset = imgEl.getAttribute('srcset') || imgEl.getAttribute('data-srcset') || '';
          let chosen = src;
          if (!chosen && srcset) {
            // take first URL from srcset
            const first = srcset.split(',')[0].trim().split(' ')[0];
            if (first) chosen = first;
          }
          if (chosen) {
            img = chosen.startsWith('http') ? chosen : new URL(chosen, 'https://www.politico.eu').toString();
          }
        }
      }
      if (!img) {
        // Try any image sibling of the anchor
        const sibImg = a.parentElement && a.parentElement.querySelector && a.parentElement.querySelector('img');
        if (sibImg) {
          const src = sibImg.getAttribute('src') || sibImg.getAttribute('data-src') || null;
          const srcset = sibImg.getAttribute('srcset') || sibImg.getAttribute('data-srcset') || '';
          let chosen = src;
          if (!chosen && srcset) {
            const first = srcset.split(',')[0].trim().split(' ')[0];
            if (first) chosen = first;
          }
          if (chosen) {
            img = chosen.startsWith('http') ? chosen : new URL(chosen, 'https://www.politico.eu').toString();
          }
        }
      }
      const thumbnail = img || FALLBACK_IMG;

      // Time: prefer list-page relative label first for speed
      if (entry.relText) {
        const rel = entry.relText.toUpperCase();
        const m = rel.match(/(\d+)\s*MINS?\s*AGO/);
        const h = rel.match(/(\d+)\s*HRS?\s*AGO/);
        if (m || h || /JUST NOW/.test(rel)) {
          const delta = (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
          pubDate = new Date(now - delta * 60 * 1000).toISOString();
        } else if (/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}/.test(rel)) {
          // Not today, skip early
          continue;
        }
      }

      // Time: prefer machine-readable time tag
      let pubDate = null;
      let minutesAgo = null;
      let hoursAgo = null;
      if (container) {
        const timeEl = container.querySelector('time');
        if (timeEl) {
          const dt = timeEl.getAttribute('datetime');
          if (dt) {
            pubDate = dt;
          } else {
            const rel = (timeEl.textContent || '').toUpperCase();
            const m = rel.match(/(\d+)\s*MINS?\s*AGO/);
            const h = rel.match(/(\d+)\s*HRS?\s*AGO/);
            if (m) minutesAgo = parseInt(m[1], 10);
            if (h) hoursAgo = parseInt(h[1], 10);
          }
        } else {
          const delta = extractRelativeDelta(container);
          if (delta != null) minutesAgo = delta; // in minutes
        }
      }

      // If still no relative from DOM, try the captured relText for this link
      if (minutesAgo == null && hoursAgo == null && entry.relText) {
        const rel = entry.relText.toUpperCase();
        const m = rel.match(/(\d+)\s*MINS?\s*AGO/);
        const h = rel.match(/(\d+)\s*HRS?\s*AGO/);
        if (m) minutesAgo = parseInt(m[1], 10);
        if (h) hoursAgo = parseInt(h[1], 10);
        // If label looks like a date (e.g., OCT 28), we can skip early (not today)
        if (!m && !h && /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}/.test(rel)) {
          // don't add this one; it's previous day
          continue;
        }
      }

      if (minutesAgo != null || hoursAgo != null) {
        const delta = (hoursAgo || 0) * 60 + (minutesAgo || 0);
        pubDate = new Date(now - delta * 60 * 1000).toISOString();
      }

      // If no time was found, skip to avoid assigning identical timestamps
      if (!pubDate) {
        const delta = extractRelativeDelta(a.closest('li'));
        if (delta != null) pubDate = new Date(now - delta * 60 * 1000).toISOString();
      }

      // If still missing time, we will assign later by DOM order

      if (!seen.has(abs)) {
        seen.set(abs, true);
        results.push({ title, link: abs, pubDate, thumbnail });
      }
      if (results.length >= 40) break;
    }

    // If we still got nothing, fall back to broad link scan under main
    if (!results.length) {
      const anchors = Array.from(scope.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const text = (a.textContent || '').trim();
        if (text.length < 8 || /^filters$/i.test(text)) continue;
        const href = a.getAttribute('href') || '';
        if (!href) continue;
        const abs = href.startsWith('http') ? href : new URL(href, 'https://www.politico.eu').toString();
        const u = new URL(abs);
        if (!u.hostname.includes('politico.eu')) continue;
        if (u.hostname.startsWith('pro.')) continue;
        // Try to find a relative time near this anchor
        let pubDate = null;
        const delta = extractRelativeDelta(a.closest('article, li, div'));
        if (delta != null) pubDate = new Date(now - delta * 60 * 1000).toISOString();
        // Allow DOM-order fallback later if missing
        if (!seen.has(abs)) {
          seen.set(abs, true);
          results.push({ title: text, link: abs, pubDate, thumbnail: FALLBACK_IMG });
        }
        if (results.length >= 40) break;
      }
    }

    // Helper to fetch via proxies (reused below)
    async function fetchViaProxies(pageUrl) {
      const proxiesLocal = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(pageUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(pageUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(pageUrl)}`
      ];
      for (const p of proxiesLocal) {
        try {
          const r = await fetch(p);
          if (r.ok) {
            const t = await r.text();
            if (t && t.length > 200) return t;
          }
        } catch (e) {}
      }
      throw new Error('all proxies failed');
    }

    // Enrich items by visiting their article pages for precise datetime and og:image
    async function enrichItem(item) {
      try {
        const html = await fetchViaProxies(item.link);
        const parserLocal = new DOMParser();
        const page = parserLocal.parseFromString(html, 'text/html');
        // Prefer structured meta time
        let pub = page.querySelector('meta[property="article:published_time"], meta[name="article:published_time"]')?.getAttribute('content') || null;
        if (!pub) {
          const timeEl = page.querySelector('time[datetime]');
          if (timeEl) pub = timeEl.getAttribute('datetime');
        }
        if (!pub) {
          // Try JSON-LD
          const ldNodes = Array.from(page.querySelectorAll('script[type="application/ld+json"]'));
          for (const s of ldNodes) {
            try {
              const json = JSON.parse(s.textContent || '{}');
              const arr = Array.isArray(json) ? json : [json];
              for (const obj of arr) {
                if (obj && (obj.datePublished || (obj.article && obj.article.datePublished))) {
                  pub = obj.datePublished || (obj.article && obj.article.datePublished);
                  break;
                }
              }
              if (pub) break;
            } catch (e) {}
          }
        }
        if (!pub) {
          const dateText = page.querySelector('.date-time__date')?.textContent?.trim() || '';
          const timeText = page.querySelector('.date-time__time')?.textContent?.trim() || '';
          if (dateText && timeText) pub = new Date(`${dateText} ${timeText}`).toISOString();
        }
        if (pub) item.pubDate = pub;

        // Prefer og:image for thumbnail if missing or fallback
        if (!item.thumbnail || item.thumbnail === FALLBACK_IMG) {
          const og = page.querySelector('meta[property="og:image"], meta[name="og:image"]')?.getAttribute('content') || '';
          if (og) item.thumbnail = og.startsWith('http') ? og : new URL(og, item.link).toString();
        }
      } catch (e) {
        // ignore enrichment failure
      }
      return item;
    }

    // Assign fallback times by DOM order for any items lacking time
    let orderIndex = 0;
    for (const item of results) {
      if (!item.pubDate) {
        // assign decreasing minutes to preserve order within recent window
        const t = new Date(now - orderIndex * 60 * 1000).toISOString();
        item.pubDate = t;
        orderIndex += 1;
      }
    }

    // Enrich items in parallel (reduced limit for better performance)
    const ENRICH_LIMIT = 60;
    const enrichTargets = results.slice(0, ENRICH_LIMIT);
    // Enrich all to normalize times accurately
    await Promise.all(enrichTargets.map(enrichItem));

    // Keep articles from past 2 days (yesterday + today) and sort by time desc; break ties deterministically
    const today = new Date();
    const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
    const filtered = enrichTargets.filter(it => {
      const t = new Date(it.pubDate).getTime();
      return !isNaN(t) && t >= startOfYesterday && t < endOfDay;
    });

    filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i].pubDate === filtered[i - 1].pubDate) {
        const t = new Date(filtered[i].pubDate).getTime() - i * 1000;
        filtered[i].pubDate = new Date(t).toISOString();
      }
    }

    return filtered;
  }

  async function renderItems(items) {
    if (!items.length) {
      cards.innerHTML = "<p>No news found for the past 2 days.</p>";
      cards.classList.remove('has-sections');
      return;
    }

    // Filter items to show past 2 days (yesterday + today)
    // Use a wider window to capture all yesterday articles, accounting for timezone differences
    const renderTime = new Date();
    const yesterdayStart = new Date(renderTime.getFullYear(), renderTime.getMonth(), renderTime.getDate() - 1);
    const renderDayStart = new Date(renderTime.getFullYear(), renderTime.getMonth(), renderTime.getDate());
    const renderDayEnd = new Date(renderTime.getFullYear(), renderTime.getMonth(), renderTime.getDate() + 1);
    
    // Use a smaller buffer window for better performance (6 hours before yesterday)
    const yesterdayWindowStart = new Date(yesterdayStart.getTime() - 6 * 60 * 60 * 1000);
    
    const twoDayItems = items.filter(item => {
      const itemDate = new Date(item.pubDate);
      if (isNaN(itemDate.getTime())) {
        // Invalid dates - include them (they'll be shown in today)
        return true;
      }
      // Include articles from yesterday (with buffer) to tomorrow
      return itemDate >= yesterdayWindowStart && itemDate < renderDayEnd;
    });

    if (!twoDayItems.length) {
      cards.innerHTML = "<p>No news found for the past 2 days.</p>";
      cards.classList.remove('has-sections');
      return;
    }

    // Split articles into "Latest", "Earlier Today", and "Yesterday"
    const threeHoursAgo = new Date(renderTime.getTime() - (3 * 60 * 60 * 1000)); // 3 hours ago
    
    const latestItems = twoDayItems.filter(item => {
      const itemDate = new Date(item.pubDate);
      // Today's articles within last 3 hours
      return itemDate >= threeHoursAgo && itemDate >= renderDayStart;
    });
    
    const earlierTodayItems = twoDayItems.filter(item => {
      const itemDate = new Date(item.pubDate);
      // Today's articles older than 3 hours
      return itemDate >= renderDayStart && itemDate < threeHoursAgo;
    });
    
    const yesterdayItems = twoDayItems.filter(item => {
      const itemDate = new Date(item.pubDate);
      if (isNaN(itemDate.getTime())) {
        // Invalid dates are shown in today, not yesterday
        return false;
      }
      // Yesterday's articles (with buffer window to catch all of yesterday)
      return itemDate >= yesterdayWindowStart && itemDate < renderDayStart;
    });
    

    const renderCard = async (n) => {
      let displayTitle = n.title;
      if (translationEnabled) {
        displayTitle = await translateText(n.title);
      }
      
      const isRead = isArticleRead(n.link);
      const readClass = isRead ? ' read' : '';
      
      return `
        <div class="card${readClass}" data-article-link="${n.link}">
          ${
            imagesEnabled
              ? `<img src="${n.thumbnail}" alt=""
                 onerror="this.src='${FALLBACK_IMG}'">`
              : ""
          }
          <div class="card-content">
            <h3><a href="${n.link}" target="_blank" rel="noopener noreferrer" data-link="${n.link}">${displayTitle}</a></h3>
            <p class="meta">${formatLocalTime(n.pubDate)} — ${
           n.link ? new URL(n.link).hostname : "Source"
         }</p>
          </div>
        </div>
      `;
    };

    let html = '';
    
    // Latest section
    if (latestItems.length > 0) {
      const latestCards = await Promise.all(latestItems.map(renderCard));
      html += `
        <div class="section">
          <h2 class="section-title">Latest News (Last 3 Hours) <span class="count">(${latestItems.length})</span></h2>
          <div class="articles-grid">
            ${latestCards.join('')}
          </div>
        </div>
      `;
    }
    
    // Earlier Today section
    if (earlierTodayItems.length > 0) {
      const earlierCards = await Promise.all(earlierTodayItems.map(renderCard));
      html += `
        <div class="section">
          <h2 class="section-title">Earlier Today <span class="count">(${earlierTodayItems.length})</span></h2>
          <div class="articles-grid">
            ${earlierCards.join('')}
          </div>
        </div>
      `;
    }
    
    // Yesterday section
    if (yesterdayItems.length > 0) {
      const yesterdayCards = await Promise.all(yesterdayItems.map(renderCard));
      html += `
        <div class="section">
          <h2 class="section-title">Yesterday <span class="count">(${yesterdayItems.length})</span></h2>
          <div class="articles-grid">
            ${yesterdayCards.join('')}
          </div>
        </div>
      `;
    }
    
    cards.innerHTML = html;
    cards.classList.add('has-sections');
    
    // Add click listeners to mark articles as read
    cards.querySelectorAll('a[data-link]').forEach(link => {
      link.addEventListener('click', (e) => {
        const articleLink = link.getAttribute('data-link');
        if (articleLink) {
          markArticleAsRead(articleLink);
          // Update the card styling immediately
          const card = link.closest('.card');
          if (card) {
            card.classList.add('read');
          }
        }
      });
    });
  }

  refreshBtn.addEventListener("click", async () => {
    // Reset button text temporarily
    refreshBtn.textContent = "Refreshing...";
    await fetchFeedsFor(countrySelect.value, true);
    // Restart auto-refresh after manual refresh
    startAutoRefresh();
  });

  // Make CE logo clickable for refresh
  const ceLogo = document.getElementById('ceLogo');
  if (ceLogo) {
    console.log('CE Logo found, adding click listener');
    ceLogo.addEventListener("click", async () => {
      console.log('CE Logo clicked! Refreshing...');
      await fetchFeedsFor(countrySelect.value, true);
      startAutoRefresh();
    });
  } else {
    console.log('CE Logo not found!');
  }

  // Double-click to pause/resume auto-refresh
  refreshBtn.addEventListener("dblclick", () => {
    if (autoRefreshInterval) {
      stopAutoRefresh();
      refreshBtn.textContent = "Paused - Click to resume";
      refreshBtn.style.backgroundColor = "#ff6b6b";
    } else {
      startAutoRefresh();
      refreshBtn.style.backgroundColor = "";
    }
  });

  translateBtn.addEventListener("click", async () => {
    translationEnabled = !translationEnabled;
    translateBtn.textContent = translationEnabled ? "Original" : "Translate";
    translateBtn.style.backgroundColor = translationEnabled ? "var(--accent)" : "";
    translateBtn.style.color = translationEnabled ? "white" : "";
    
    // Re-render current articles with new translation state
    const existingArticles = getStoredArticlesForCountry(countrySelect.value);
    if (existingArticles.length > 0) {
      await renderItems(existingArticles);
    }
  });

  toggleImages.addEventListener("click", async () => {
    imagesEnabled = !imagesEnabled;
    toggleImages.textContent = `Images: ${imagesEnabled ? "ON" : "OFF"}`;
    await fetchFeedsFor(countrySelect.value, false);
  });

  countrySelect.addEventListener("change", async () => {
    selectedBadge.textContent = countrySelect.options[countrySelect.selectedIndex].text
      .replace("🇭🇺", "")
      .replace("🇸🇮", "")
      .replace("🇭🇷", "")
      .replace("🇧🇦", "")
      .replace("🇲🇩", "")
      .replace("📰", "");
    await fetchFeedsFor(countrySelect.value, false);
    // Restart auto-refresh when country changes
    startAutoRefresh();
  });

  // Auto-refresh interval change
  refreshInterval.addEventListener("change", () => {
    console.log('Auto-refresh interval changed to:', refreshInterval.value);
    startAutoRefresh();
  });

  // Initial load
  (async () => {
    // Clean old data first
    ensureCurrentDayData();
    await fetchFeedsFor(countrySelect.value);
    // Start auto-refresh after initial load
    startAutoRefresh();
  })();
});