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
    const lastUpdated = document.getElementById("lastUpdated");
    const selectedBadge = document.getElementById("selectedBadge");
    const refreshIntervalSelect = document.getElementById("refreshInterval");
  
    let refreshTimer = null;
  
    async function fetchFeeds(country, forceRefresh = false) {
      const cacheKey = `news_${country}`;
      const cache = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      const now = Date.now();
  
      // Cache validity: 1 hour
      if (cache && cacheTime && now - cacheTime < 3600000 && !forceRefresh) {
        renderItems(JSON.parse(cache), true);
        return;
      }
  
      cards.innerHTML = '<div class="small">⏳ Fetching latest news...</div>';
  
      try {
        const urls = FEEDS[country];
        let allItems = [];
  
        for (const url of urls) {
          const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
          const res = await fetch(proxy);
          const data = await res.json();
          const parser = new DOMParser();
          const xml = parser.parseFromString(data.contents, "text/xml");
  
          const items = Array.from(xml.querySelectorAll("item")).map((it) => ({
            title: it.querySelector("title")?.textContent || "",
            link: it.querySelector("link")?.textContent || "",
            pubDate: it.querySelector("pubDate")?.textContent || "",
            description: it.querySelector("description")?.textContent || "",
            thumbnail:
              it.querySelector("media\\:content, enclosure")?.getAttribute("url") || ""
          }));
  
          allItems.push(...items);
        }
  
        // Sort & trim to 30
        const sorted = allItems
          .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
          .slice(0, 30);
  
        localStorage.setItem(cacheKey, JSON.stringify(sorted));
        localStorage.setItem(`${cacheKey}_time`, now);
        renderItems(sorted);
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
  
      cards.innerHTML = items
        .map(
          (n) => `
          <div class="card">
            <img src="${n.thumbnail || FALLBACK_IMG}" onerror="this.src='${FALLBACK_IMG}'" alt="">
            <div class="card-content">
              <h3><a href="${n.link}" target="_blank">${n.title}</a></h3>
              <p class="meta">${new Date(n.pubDate).toLocaleString()} — ${new URL(n.link).hostname}</p>
            </div>
          </div>
        `
        )
        .join("");
  
      lastUpdated.textContent = `Loaded ${fromCache ? "from cache" : "live"} • ${new Date().toLocaleTimeString()}`;
    }
  
    // Controls
    refreshBtn.addEventListener("click", () => fetchFeeds(countrySelect.value, true));
    countrySelect.addEventListener("change", () => {
      selectedBadge.textContent = countrySelect.options[countrySelect.selectedIndex].text;
      fetchFeeds(countrySelect.value, true);
    });
    refreshIntervalSelect.addEventListener("change", () => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(
        () => fetchFeeds(countrySelect.value, true),
        Number(refreshIntervalSelect.value)
      );
    });
  
    // Initial
    fetchFeeds(countrySelect.value);
    refreshTimer = setInterval(
      () => fetchFeeds(countrySelect.value, true),
      Number(refreshIntervalSelect.value)
    );
  });
  