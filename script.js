document.addEventListener("DOMContentLoaded", () => {
    const FEEDS = {
      hungary: [
        "https://index.hu/24ora/rss/",
        "https://telex.hu/rss",
        "https://444.hu/feed"
      ],
      croatia: [
        "https://www.24sata.hr/feeds/news.xml",
        "https://www.jutarnji.hr/rss"
      ],
      slovenia: [
        "https://www.rtvslo.si/rss",
        "https://www.delo.si/rss"
      ],
      bosnia: [
        "https://www.klix.ba/rss"
      ]
    };
  
    const cards = document.getElementById("cards");
    const countrySelect = document.getElementById("countrySelect");
    const refreshBtn = document.getElementById("refreshBtn");
    const toggleImages = document.getElementById("toggleImages");
    const selectedBadge = document.getElementById("selectedBadge");
    const lastUpdated = document.getElementById("lastUpdated");
  
    let imagesEnabled = true;
    const FALLBACK_IMG = "TV_noise.jpg"; // local image in your project folder
  
    async function fetchFeedsFor(country) {
      const urls = FEEDS[country] || [];
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
  
        let items = responses.flat();
        if (!items.length) throw new Error("No items loaded");
  
        items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
        // Keep last 24h
        const now = new Date();
        items = items
          .filter((it) => {
            const d = new Date(it.pubDate);
            return now - d < 86400000;
          })
          .slice(0, 30);
  
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        lastUpdated.textContent = `Updated: ${new Date().toLocaleString()} • ${items.length} items • ${duration}s`;
        renderItems(items);
      } catch (err) {
        console.error("Error fetching feeds:", err);
        cards.innerHTML = "<p style='color:#ff6b6b'>❌ Failed to load news.</p>";
      }
    }
  
    function renderItems(items) {
      if (!items.length) {
        cards.innerHTML = "<p>No news found for today.</p>";
        return;
      }
  
      cards.innerHTML = items
        .map(
          (n) => `
          <div class="card">
            ${
              imagesEnabled
                ? `<img src="${n.thumbnail}" alt=""
                   onerror="this.src='${FALLBACK_IMG}'">`
                : ""
            }
            <div class="card-content">
              <h3><a href="${n.link}" target="_blank" rel="noopener noreferrer">${n.title}</a></h3>
              <p class="meta">${new Date(n.pubDate).toLocaleString()} — ${
            n.link ? new URL(n.link).hostname : "Source"
          }</p>
            </div>
          </div>
        `
        )
        .join("");
    }
  
    refreshBtn.addEventListener("click", () => {
      fetchFeedsFor(countrySelect.value);
    });
  
    toggleImages.addEventListener("click", () => {
      imagesEnabled = !imagesEnabled;
      toggleImages.textContent = `Images: ${imagesEnabled ? "ON" : "OFF"}`;
      fetchFeedsFor(countrySelect.value);
    });
  
    countrySelect.addEventListener("change", () => {
      selectedBadge.textContent = countrySelect.options[countrySelect.selectedIndex].text
        .replace("🇭🇺", "")
        .replace("🇸🇮", "")
        .replace("🇭🇷", "")
        .replace("🇧🇦", "");
      fetchFeedsFor(countrySelect.value);
    });
  
    // Initial load
    fetchFeedsFor(countrySelect.value);
  });
  