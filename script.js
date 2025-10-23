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

      // Keep last 24h for new items
      const now = new Date();
      newItems = newItems
        .filter((it) => {
          const d = new Date(it.pubDate);
          return now - d < 86400000;
        });

      // Merge with existing articles
      const allItems = mergeArticles(existingArticles, newItems);
      allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      
      // Keep all articles from today (no limit)
      const finalItems = allItems;
      
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

  async function renderItems(items) {
    if (!items.length) {
      cards.innerHTML = "<p>No news found for today.</p>";
      cards.classList.remove('has-sections');
      return;
    }

    // Split articles into "Latest" and "Earlier Today" based on time
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // 3 hours ago
    
    const latestItems = items.filter(item => {
      const itemDate = new Date(item.pubDate);
      return itemDate >= threeHoursAgo;
    });
    
    const earlierItems = items.filter(item => {
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
      .replace("🇧🇦", "");
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
    await fetchFeedsFor(countrySelect.value);
    // Start auto-refresh after initial load
    startAutoRefresh();
  })();
});