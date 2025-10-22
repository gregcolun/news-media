document.addEventListener("DOMContentLoaded", () => {
    // === 5 major sources per country ===
    const FEEDS = {
      hungary: [
        "https://index.hu/24ora/rss/",
        "https://telex.hu/rss",
        "https://444.hu/feed",
        "https://hvg.hu/rss",
        "https://magyarnemzet.hu/rss"
      ],
      croatia: [
        "https://www.24sata.hr/feeds/news.xml",
        "https://www.jutarnji.hr/rss",
        "https://www.vecernji.hr/rss",
        "https://www.dnevnik.hr/rss",
        "https://slobodnadalmacija.hr/feed"
      ],
      slovenia: [
        "https://www.rtvslo.si/rss",
        "https://www.delo.si/rss",
        "https://www.siol.net/rss",
        "https://www.24ur.com/rss",
        "https://www.slovenskenovice.si/rss"
      ],
      bosnia: [
        "https://www.klix.ba/rss",
        "https://www.avaz.ba/rss",
        "https://www.oslobodjenje.ba/rss",
        "https://www.nezavisne.com/rss",
        "https://radiosarajevo.ba/rss"
      ]
    };
  
    const cards = document.getElementById("cards");
    const countrySelect = document.getElementById("countrySelect");
    const refreshBtn = document.getElementById("refreshBtn");
    const refreshIntervalSelect = document.getElementById("refreshInterval");
    const toggleImagesBtn = document.getElementById("toggleImages");
    const selectedBadge = document.getElementById("selectedBadge");
    const lastUpdated = document.getElementById("lastUpdated");
  
    const FALLBACK_IMG = "TV_noise.jpg";
    let refreshTimer = null;
    let imagesEnabled = true;
  
    // === Daily cache reset ===
    const today = new Date().toDateString();
    const savedDay = localStorage.getItem("cacheDay");
    if (savedDay !== today) {
      localStorage.clear();
      localStorage.setItem("cacheDay", today);
    }
  
    // === Fetch feeds with caching ===
    async function fetchFeedsFor(country, force = false) {
      const cacheKey = `news_${country}`;
      const interval = Number(refreshIntervalSelect.value) || 3600000;
      const now = Date.now();
  
      // Use cache if fresh AND not forced
      if (!force) {
        const cache = localStorage.getItem(cacheKey);
        if (cache) {
          try {
            const parsed = JSON.parse(cache);
            if (now - parsed.fetchedAt < interval) {
              renderGrouped(parsed.items);
              lastUpdated.textContent = `Loaded from cache • ${new Date(parsed.fetchedAt).toLocaleTimeString()}`;
              return;
            }
          } catch {}
        }
      }
  
      cards.innerHTML = '<div class="small">⏳ Fetching latest news...</div>';
      const start = Date.now();
  
      try {
        const urls = FEEDS[country] || [];
        const responses = await Promise.all(
          urls.map(async (u) => {
            const proxies = [
              `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
              `https://corsproxy.io/?${encodeURIComponent(u)}`,
              `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
            ];
            let xmlText = null;
            for (const p of proxies) {
              try {
                // Add cache-busting param to be extra sure proxies don't hand us stale
                const bust = p.includes("?") ? "&_ts=" + Date.now() : "?_ts=" + Date.now();
                const r = await fetch(p + bust, { cache: "no-store" });
                if (r.ok) {
                  const text = await r.text();
                  if (text.trim().startsWith("<")) {
                    xmlText = text;
                    break;
                  }
                }
              } catch {}
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
  
        let items = responses.flat();
        items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        // keep a deeper pool so groups have content
        items = items.filter((i) => i.title && i.link).slice(0, 120);
  
        localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: now, items }));
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        lastUpdated.textContent = `Fetched • ${items.length} items • ${duration}s${force ? " • (manual refresh)" : ""}`;
        renderGrouped(items);
      } catch (e) {
        console.error(e);
        cards.innerHTML = "<p style='color:#ff6b6b'>❌ Failed to load news.</p>";
      }
    }
  
    // === Group news by time window (client-side only) ===
    function renderGrouped(items) {
      const now = Date.now();
      const oneH = 3600000, threeH = 10800000;
  
      const group1 = items.filter((i) => now - new Date(i.pubDate) < oneH);
      const group2 = items.filter((i) => {
        const age = now - new Date(i.pubDate);
        return age >= oneH && age < threeH;
      });
      const group3 = items.filter((i) => now - new Date(i.pubDate) >= threeH);
  
      const block = (label, arr) => {
        if (!arr.length) return "";
        const cardsHtml = arr.map(n => `
          <div class="card">
            ${imagesEnabled ? `<img src="${n.thumbnail}" alt="" onerror="this.src='${FALLBACK_IMG}'">` : ""}
            <div class="card-content">
              <h3><a href="${n.link}" target="_blank" rel="noopener noreferrer">${n.title}</a></h3>
              <p class="meta">${new Date(n.pubDate).toLocaleString()} — ${new URL(n.link).hostname}</p>
            </div>
          </div>
        `).join("");
        return `<h2 style="font-size:16px;margin:12px 0">${label}</h2>${cardsHtml}`;
      };
  
      const html =
        block("🕐 Last 1 hour", group1) +
        block("🕒 Last 3 hours", group2) +
        block("🕗 Earlier Today", group3);
  
      cards.innerHTML = html || "<p>No news for this period.</p>";
    }
  
    // === UI events ===
    refreshBtn.addEventListener("click", () => {
      // Force a fresh network fetch regardless of cache
      fetchFeedsFor(countrySelect.value, true);
    });
  
    countrySelect.addEventListener("change", () => {
      selectedBadge.textContent = countrySelect.options[countrySelect.selectedIndex].text
        .replace("🇭🇺","").replace("🇸🇮","").replace("🇭🇷","").replace("🇧🇦","");
      // On country switch, prefer fresh if cache is stale; normal path is fine
      fetchFeedsFor(countrySelect.value);
    });
  
    refreshIntervalSelect.addEventListener("change", setupAutoRefresh);
  
    toggleImagesBtn.addEventListener("click", () => {
      imagesEnabled = !imagesEnabled;
      toggleImagesBtn.textContent = `Images: ${imagesEnabled ? "ON" : "OFF"}`;
      // Re-render from cache (no refetch)
      const cacheKey = `news_${countrySelect.value}`;
      const cache = localStorage.getItem(cacheKey);
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          renderGrouped(parsed.items);
        } catch {}
      }
    });
  
    function setupAutoRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      const ms = Number(refreshIntervalSelect.value) || 3600000;
      refreshTimer = setInterval(() => fetchFeedsFor(countrySelect.value), ms);
    }
  
    // === Init ===
    fetchFeedsFor(countrySelect.value);
    setupAutoRefresh();
  });
  