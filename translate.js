// Translation module using @vitalets/google-translate-api
// This is a browser-compatible wrapper

class Translator {
  constructor() {
    this.cache = new Map();
  }

  async translate(text, targetLang = 'en') {
    // Check cache first
    const cacheKey = `${text}_${targetLang}`;
    if (this.cache.has(cacheKey)) {
      console.log('Using cached translation for:', text.substring(0, 50));
      return this.cache.get(cacheKey);
    }

    console.log('Translating:', text.substring(0, 50));
    try {
      // Use the Google Translate API directly
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await response.json();
      
      console.log('Translation API response:', data);
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translatedText = data[0][0][0];
        console.log('Translation successful:', text.substring(0, 30), '->', translatedText.substring(0, 30));
        this.cache.set(cacheKey, translatedText);
        return translatedText;
      } else {
        console.warn('Translation API returned unexpected format:', data);
      }
    } catch (error) {
      console.warn('Translation failed:', error);
    }

    // Fallback to original text
    console.log('Using fallback (original text) for:', text.substring(0, 50));
    this.cache.set(cacheKey, text);
    return text;
  }

  async translateBatch(texts, targetLang = 'en') {
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const cacheKey = `${text}_${targetLang}`;
      
      if (this.cache.has(cacheKey)) {
        results.push(this.cache.get(cacheKey));
      } else {
        // Add delay between requests to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const translated = await this.translate(text, targetLang);
        results.push(translated);
      }
    }
    
    return results;
  }
}

// Create global translator instance
window.translator = new Translator();
