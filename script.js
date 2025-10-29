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
      // Preferred sources
      "https://www.jurnal.md/ro/rss",
      "https://tv8.md/rss",
      "https://stiri.md/rss",
      // Keep two reliable fallbacks to maintain 5 feeds
      "https://unimedia.info/rss/",
      "https://www.ipn.md/en/rss"
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
      
      // Convert to local timezone and format
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
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
    const todayKey = getTodayKey();
    const stored = getStoredArticles();
    stored[country] = articles;
    localStorage.setItem(todayKey, JSON.stringify(stored));
  }

  function getStoredArticlesForCountry(country) {
    const stored = getStoredArticles();
    return stored[country] || [];
  }

  function clearOldArticles() {
    const today = new Date().toDateString();
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('news_') && key !== `news_${today}`) {
        localStorage.removeItem(key);
      }
    });
  }

  // Function to ensure we only have current day data
  function ensureCurrentDayData() {
    const today = new Date().toDateString();
    const keys = Object.keys(localStorage);
    let cleaned = false;
    
    keys.forEach(key => {
      if (key.startsWith('news_') && key !== `news_${today}`) {
        localStorage.removeItem(key);
        cleaned = true;
      }
    });
    
    if (cleaned) {
      console.log('Cleaned old news data from previous days');
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
        const politicoItems = await fetchPoliticoLatest();

        // Keep only articles from current day
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const todayItems = politicoItems.filter((it) => {
          const d = new Date(it.pubDate);
          return d >= startOfDay && d < endOfDay;
        });

        // Merge with cache
        const allItems = mergeArticles(existingArticles, todayItems)
          .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        saveArticles(country, allItems);
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        lastUpdated.textContent = `\ud83d\udd04 ${allItems.length} items (${todayItems.length} new) • ${duration}s`;
        await renderItems(allItems);
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

    const urls = FEEDS[country] || [];
    
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
          for (const proxy of proxies) {
            try {
              const res = await fetch(proxy);
              if (res.ok) {
                const text = await res.text();
                if (text.trim().startsWith("<")) {
                  xmlText = text;
                  break;
                }
              }
            } catch (e) {
              console.warn("Proxy failed:", proxy);
            }
          }

          if (!xmlText) return [];

          const parser = new DOMParser();
          const xml = parser.parseFromString(xmlText, "text/xml");

          return Array.from(xml.querySelectorAll("item")).map((it) => {
            const desc = it.querySelector("description")?.textContent || "";
            const imgMatch = desc.match(/<img[^>]+src="([^">]+)"/);
            const image =
              it.querySelector("media\\:content, enclosure")?.getAttribute("url") ||
              (imgMatch ? imgMatch[1] : FALLBACK_IMG);

            return {
              title: it.querySelector("title")?.textContent?.trim() || "",
              link: it.querySelector("link")?.textContent?.trim() || "",
              pubDate: it.querySelector("pubDate")?.textContent?.trim() || "",
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

      // Keep only articles from current day (midnight to midnight)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      newItems = newItems
        .filter((it) => {
          const d = new Date(it.pubDate);
          return d >= startOfDay && d < endOfDay;
        });

      // Merge with existing articles
      const allItems = mergeArticles(existingArticles, newItems);
      allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      
      // Filter all articles to only show current day
      const currentTime = new Date();
      const dayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
      const dayEnd = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1);
      
      const finalItems = allItems.filter((it) => {
        const d = new Date(it.pubDate);
        return d >= dayStart && d < dayEnd;
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

  async function fetchPoliticoLatest() {
    const url = 'https://www.politico.eu/latest/';
    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];

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

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const scope = doc.querySelector('main') || doc;

    // Collect likely article links under main content
    const titleAnchors = Array.from(scope.querySelectorAll('h2 a[href], h3 a[href], h4 a[href], a[href*="/article/"], a[href*="/news/"]'));

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

    for (const a of titleAnchors) {
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

    // Enrich items in parallel (limit to first 40 for performance)
    const slice = results.slice(0, 40);
    await Promise.all(slice.map(enrichItem));

    // Keep only current day and sort by time desc; break ties deterministically
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
    const filtered = slice.filter(it => {
      const t = new Date(it.pubDate).getTime();
      return !isNaN(t) && t >= startOfDay && t < endOfDay;
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
      cards.innerHTML = "<p>No news found for today.</p>";
      cards.classList.remove('has-sections');
      return;
    }

    // Filter items to only show current day articles
    const renderTime = new Date();
    const renderDayStart = new Date(renderTime.getFullYear(), renderTime.getMonth(), renderTime.getDate());
    const renderDayEnd = new Date(renderTime.getFullYear(), renderTime.getMonth(), renderTime.getDate() + 1);
    
    const currentDayItems = items.filter(item => {
      const itemDate = new Date(item.pubDate);
      return itemDate >= renderDayStart && itemDate < renderDayEnd;
    });

    if (!currentDayItems.length) {
      cards.innerHTML = "<p>No news found for today.</p>";
      cards.classList.remove('has-sections');
      return;
    }

    // Split articles into "Latest" and "Earlier Today" based on time
    const threeHoursAgo = new Date(renderTime.getTime() - (3 * 60 * 60 * 1000)); // 3 hours ago
    
    const latestItems = currentDayItems.filter(item => {
      const itemDate = new Date(item.pubDate);
      return itemDate >= threeHoursAgo;
    });
    
    const earlierItems = currentDayItems.filter(item => {
      const itemDate = new Date(item.pubDate);
      return itemDate < threeHoursAgo;
    });
    

    const renderCard = async (n) => {
      let displayTitle = n.title;
      if (translationEnabled) {
        displayTitle = await translateText(n.title);
      }
      
      return `
        <div class="card">
          ${
            imagesEnabled
              ? `<img src="${n.thumbnail}" alt=""
                 onerror="this.src='${FALLBACK_IMG}'">`
              : ""
          }
          <div class="card-content">
            <h3><a href="${n.link}" target="_blank" rel="noopener noreferrer">${displayTitle}</a></h3>
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
    if (earlierItems.length > 0) {
      const earlierCards = await Promise.all(earlierItems.map(renderCard));
      html += `
        <div class="section">
          <h2 class="section-title">Earlier Today <span class="count">(${earlierItems.length})</span></h2>
          <div class="articles-grid">
            ${earlierCards.join('')}
          </div>
        </div>
      `;
    }
    
    cards.innerHTML = html;
    cards.classList.add('has-sections');
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