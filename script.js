document.addEventListener("DOMContentLoaded", () => {
    const FEEDS = {
      hungary: [
        "https://index.hu/24ora/rss/",
        "https://telex.hu/rss",
        "https://444.hu/feed",
        "https://24.hu/feed/",
        "https://hvg.hu/rss"
      ],
      slovenia: [
        "https://www.rtvslo.si/rss",
        "https://www.delo.si/rss",
        "https://www.vecer.com/rss",
        "https://siol.net/rss",
        "https://www.24ur.com/rss"
      ],
      croatia: [
        "https://www.jutarnji.hr/rss",
        "https://www.24sata.hr/feeds/news.xml",
        "https://www.index.hr/rss",
        "https://www.vecernji.hr/feed",
        "https://dnevnik.hr/rss"
      ],
      bosnia: [
        "https://www.klix.ba/rss",
        "https://www.aa.com.tr/ba/rss",
        "https://avaz.ba/rss",
        "https://www.nezavisne.com/rss",
        "https://www.zenit.ba/feed/"
      ]
    };
  
    const FALLBACK_IMG = "TV_noise.jpg";
    const cards = document.getElementById("cards");
    const countrySelect = document.getElementById("countrySelect");
    const refreshBtn = document.getElementById("refreshBtn");
    const toggleImages = document.getElementById("toggleImages");
    const lastUpdated = document.getElementById("lastUpdated");
    const selectedBadge = document.getElementById("selectedBadge");
    const refreshIntervalSelect = document.getElementById("refreshInterval");
  
    let showImages = true;
    let refreshTimer = null;
  
    async function translateText(text) {
      if (!text) return text;
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return data[0][0][0];
      } catch (e) {
        console.warn("Translation failed:", e);
        return text;
      }
    }
  
    async function fetchFeeds(country, forceRefresh = false) {
      const cacheKey = `news_${country}`;
      const cache = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      const now = Date.now();
  
      if (cache && cacheTime && now - cacheTime < 3600000 && !forceRefresh) {
        const data = JSON.parse(cache);
        renderItems(data, true);
        return;
      }
  
      cards.innerHTML = '<div class="small">⏳ Fetching latest news...</div>';
  
      try {
        const urls = FEEDS[country];
        const allItems = [];
  
        for (const url of urls) {
          const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
          const data = await response.json();
          if (data.items) allItems.push(...data.items);
        }
  
        const sorted = allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 30);
  
        const translated = [];
        for (const it of sorted) {
          const title = await translateText(it.title);
          translated.push({ ...it, title });
        }
  
        localStorage.setItem(cacheKey, JSON.stringify(translated));
        localStorage.setItem(`${cacheKey}_time`, now);
        renderItems(translated);
      } catch (err) {
        console.error("Error fetching feeds:", err);
        cards.innerHTML = "<p>❌ Failed to load news.</p>";
      }
    }
  
    function renderItems(items, fromCache = false) {
      if (!items.length) {
        cards.innerHTML = "<p>No news found for today.</p>";
        return;
      }
  
      cards.innerHTML = items.map(n => `
        <div class="card">
          ${showImages ? `<img src="${n.thumbnail || n.enclosure?.link || FALLBACK_IMG}" onerror="this.src='${FALLBACK_IMG}'" alt="">` : ""}
          <div class="card-content">
            <h3><a href="${n.link}" target="_blank">${n.title}</a></h3>
            <p class="meta">${new Date(n.pubDate).toLocaleString()} — ${new URL(n.link).hostname}</p>
          </div>
        </div>
      `).join("");
  
      lastUpdated.textContent = `Loaded ${fromCache ? "from cache" : "live"} • ${new Date().toLocaleTimeString()}`;
    }
  
    // --- UI Controls ---
    refreshBtn.addEventListener("click", () => fetchFeeds(countrySelect.value, true));
    toggleImages.addEventListener("click", () => {
      showImages = !showImages;
      toggleImages.textContent = `Images: ${showImages ? "ON" : "OFF"}`;
      renderItems(JSON.parse(localStorage.getItem(`news_${countrySelect.value}`)) || []);
    });
    countrySelect.addEventListener("change", () => {
      selectedBadge.textContent = countrySelect.options[countrySelect.selectedIndex].text;
      fetchFeeds(countrySelect.value, true);
    });
    refreshIntervalSelect.addEventListener("change", () => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(() => fetchFeeds(countrySelect.value, true), Number(refreshIntervalSelect.value));
    });
  
    // Initial setup
    fetchFeeds(countrySelect.value);
    refreshTimer = setInterval(() => fetchFeeds(countrySelect.value, true), Number(refreshIntervalSelect.value));
  });
  