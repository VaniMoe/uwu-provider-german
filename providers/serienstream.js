/**
 * Serienstream provider for Nuvio
 * Ported from Bnyro/GermanProviders (CloudStream Kotlin plugin) to Nuvio's JS scraper format.
 *
 * Scope: German-language series site serienstream.to / s.to (TV shows only)
 * Flow: TMDB id -> title -> search -> match series -> find season/episode ->
 *       collect hoster links -> resolve known hosters -> streams
 *
 * === FIXES vs. original port ===
 * [BASE URL]
 *   - Use direct IP http://186.2.175.5/ with Host: s.to header to bypass
 *     the serienstream.to -> s.to Cloudflare redirect chain
 * [Search]
 *   - Old selector '.results-group .card' DOES NOT EXIST on the real site
 *   - Real selector: 'div.seriesListContainer ul li a' (href + title attribute)
 * [Season navigation]
 *   - Old selector '#season-nav ul > li a' DOES NOT EXIST
 *   - Real selector: 'div#stream ul li a' (identical to aniworld structure)
 *   - Parse season number from href (/staffel-N) not from link text ("Staffel 1")
 * [Episode list]
 *   - Old selector '.episode-section .episode-row' DOES NOT EXIST
 *   - Real selector: 'table.seasonEpisodesList tbody tr' (identical to aniworld)
 *   - Episode number: meta[itemprop="episodeNumber"] (identical to aniworld)
 *   - Episode URL: first <a> href in the row
 * [Hoster collection]
 *   - Old selector '.link-wrapper > button' DOES NOT EXIST
 *   - Real selector: 'div.hosterSiteVideo ul li[data-link-target]' (identical to aniworld)
 *   - Language map: 'div.changeLanguageBox img[data-lang-key]' (identical to aniworld)
 * [Extractors]
 *   - VOE updated pipeline (2024-2025): rot13 -> junk-strip -> b64 -> shift(-3) -> b64(reversed)
 *   - Added Vidmoly, Filemoon extractors
 *   - URL hostname used as fallback when hosterName label is ambiguous
 * [Robustness]
 *   - Levenshtein fuzzy title matching
 *   - console.warn debug logging at every failure point (gate with DEBUG flag)
 */

'use strict';

const cheerio = require('cheerio-without-node-native');

// Direct IP bypasses serienstream.to -> s.to Cloudflare redirect
const BASE = 'http://186.2.175.5';
// Host header tells the server which vhost to serve
const VHOST = 's.to';

const TMDB_API_KEY = '1865f43a0549ca50d341dd9ab8b29f49';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/json,*/*',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
  'Host': VHOST
};

// Set to true for verbose debug output during development; false for prod silent-fail
const DEBUG = true;

function dbg(...args) {
  if (DEBUG) console.warn('[Serienstream]', ...args);
}

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

/**
 * Normalise any URL/path to an absolute URL using BASE (IP).
 * Strips any s.to / serienstream.to domain that may appear in href attributes
 * so we always route through the IP.
 */
function fixUrl(href) {
  if (!href) return null;
  // Replace known domain origins with our IP base
  href = href
    .replace(/^https?:\/\/s\.to/i, BASE)
    .replace(/^https?:\/\/serienstream\.to/i, BASE)
    .replace(/^https?:\/\/www\.serienstream\.to/i, BASE);
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'http:' + href;
  return BASE + (href.startsWith('/') ? href : '/' + href);
}

/* ------------------------------------------------------------------ */
/*  TMDB                                                                */
/* ------------------------------------------------------------------ */

async function getTmdbTitles(tmdbId) {
  try {
    const [de, en] = await Promise.all([
      fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=de-DE`),
      fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`)
    ]);
    const titles = new Set();
    [de.name, de.original_name, en.name, en.original_name]
      .filter(Boolean)
      .forEach(t => titles.add(t));
    dbg('TMDB titles:', Array.from(titles));
    return Array.from(titles);
  } catch (e) {
    dbg('getTmdbTitles error:', e.message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Search                                                              */
/* ------------------------------------------------------------------ */

async function searchSerienstream(query) {
  dbg('Searching for:', query);
  // FIX: use /suche?term=...&tab=shows (no change needed here, but selector was wrong)
  const url = `${BASE}/suche?term=${encodeURIComponent(query)}&tab=shows`;
  let html;
  try {
    html = await fetchText(url, {
      headers: { 'Referer': `${BASE}/suche` }
    });
  } catch (e) {
    dbg('searchSerienstream fetch error:', e.message);
    return [];
  }

  const $ = cheerio.load(html);
  const results = [];

  // FIX: Real selector confirmed from live HTML inspection.
  // Old broken: '.results-group .card'
  // Real structure: div.seriesListContainer > div.seriesListContent > div.seriesList > ul > li > a
  $('div.seriesListContainer ul li a').each((_, el) => {
    const href = fixUrl($(el).attr('href'));
    // Title is in the <a>'s title attribute or in a child h3.series-title / img alt
    const title =
      $(el).attr('title') ||
      $(el).find('h3').text().trim() ||
      $(el).find('img').attr('alt') ||
      '';
    if (href && title) results.push({ title: title.trim(), link: href });
  });

  dbg('Search results:', results.map(r => `"${r.title}" -> ${r.link}`));
  return results;
}

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

async function findSeriesUrl(titles) {
  for (const title of titles) {
    let results;
    try {
      results = await searchSerienstream(title);
    } catch (e) {
      dbg('findSeriesUrl search error for title:', title, e.message);
      continue;
    }
    if (!results.length) continue;

    const target = normalize(title);

    // 1) Exact normalized match
    const exact = results.find(r => normalize(r.title) === target);
    if (exact) {
      dbg('findSeriesUrl exact match:', exact.link);
      return exact.link;
    }

    // 2) Fuzzy: Levenshtein <= 3 or similarity >= 80%
    const fuzzy = results.find(r => {
      const n = normalize(r.title);
      const dist = levenshtein(target, n);
      const maxLen = Math.max(target.length, n.length);
      return maxLen > 0 && (dist <= 3 || (maxLen - dist) / maxLen >= 0.8);
    });
    if (fuzzy) {
      dbg('findSeriesUrl fuzzy match:', fuzzy.link, '(title:', title + ')');
      return fuzzy.link;
    }

    // 3) Fallback: first result
    dbg('findSeriesUrl fallback to first result:', results[0].link);
    return results[0].link;
  }
  dbg('findSeriesUrl: no result found for any title');
  return null;
}

/* ------------------------------------------------------------------ */
/*  Episode URL                                                         */
/* ------------------------------------------------------------------ */

async function findEpisodeUrl(seriesUrl, season, episode) {
  dbg('findEpisodeUrl:', { seriesUrl, season, episode });
  let html;
  try {
    html = await fetchText(seriesUrl);
  } catch (e) {
    dbg('findEpisodeUrl: fetch series page error:', e.message);
    return null;
  }
  const $ = cheerio.load(html);

  const seasonLinks = [];
  // FIX: Real selector confirmed from live HTML.
  // Old broken: '#season-nav ul > li a'
  // Real: 'div#stream ul li a' (identical to aniworld structure)
  $('div#stream ul li a').each((_, el) => {
    const href = fixUrl($(el).attr('href'));
    if (!href) return;
    // Parse season number from href suffix /staffel-N
    const staffelMatch = href.match(/\/staffel-(\d+)/i);
    const num = staffelMatch ? parseInt(staffelMatch[1], 10) : NaN;
    if (!isNaN(num)) seasonLinks.push({ num, href });
  });

  dbg('Season links:', seasonLinks.map(s => `Staffel ${s.num} -> ${s.href}`));

  if (!seasonLinks.length) {
    dbg('findEpisodeUrl: no season links found');
    return null;
  }

  let targetSeason = seasonLinks.find(s => s.num === season);
  if (!targetSeason) {
    dbg(`Season ${season} not found, falling back to first`);
    targetSeason = seasonLinks[0];
  }

  let seasonHtml;
  try {
    seasonHtml = await fetchText(targetSeason.href);
  } catch (e) {
    dbg('findEpisodeUrl: error fetching season page:', e.message);
    return null;
  }
  const $$ = cheerio.load(seasonHtml);

  let episodeUrl = null;
  // FIX: Real selector confirmed from live HTML.
  // Old broken: '.episode-section .episode-row'
  // Real: 'table.seasonEpisodesList tbody tr' + meta[itemprop="episodeNumber"]
  $$('table.seasonEpisodesList tbody tr').each((_, row) => {
    if (episodeUrl) return;
    const epNum = parseInt($$(row).find('meta[itemprop="episodeNumber"]').attr('content'), 10);
    if (epNum === episode) {
      // Episode URL: first <a> href in the row
      const href = $$(row).find('a').first().attr('href');
      episodeUrl = fixUrl(href);
      dbg('Found episode URL:', episodeUrl, '(ep', episode + ')');
    }
  });

  if (!episodeUrl) {
    dbg('findEpisodeUrl: ep', episode, 'not found in season page');
  }
  return episodeUrl;
}

/* ------------------------------------------------------------------ */
/*  Hoster collection                                                   */
/* ------------------------------------------------------------------ */

async function collectHosterLinks(episodeUrl) {
  dbg('collectHosterLinks:', episodeUrl);
  let html;
  try {
    html = await fetchText(episodeUrl);
  } catch (e) {
    dbg('collectHosterLinks fetch error:', e.message);
    return [];
  }
  const $ = cheerio.load(html);

  // Build lang key -> label map
  const langMap = {};
  $('div.changeLanguageBox img').each((_, el) => {
    const key = $(el).attr('data-lang-key');
    const title = ($(el).attr('title') || '').replace(/^mit\s*/i, '').trim();
    if (key) langMap[key] = title;
  });
  dbg('Language map:', langMap);

  const hosters = [];
  // FIX: Real selector confirmed from live HTML.
  // Old broken: '.link-wrapper > button'
  // Real: 'div.hosterSiteVideo ul li[data-link-target]' (identical to aniworld structure)
  $('div.hosterSiteVideo ul li').each((_, el) => {
    const langKey = $(el).attr('data-lang-key');
    const linkTarget = $(el).attr('data-link-target');
    const hosterName = $(el).find('h4').text().trim();
    if (linkTarget) {
      hosters.push({
        hosterName,
        lang: langMap[langKey] || langKey || '',
        redirectPath: fixUrl(linkTarget)
      });
    }
  });

  dbg('Hosters:', hosters.map(h => `${h.hosterName} [${h.lang}] -> ${h.redirectPath}`));
  return hosters;
}

/* ------------------------------------------------------------------ */
/*  Redirect resolver                                                   */
/* ------------------------------------------------------------------ */

async function resolveRedirect(url) {
  try {
    const res = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, 'Referer': BASE },
      redirect: 'follow'
    });
    const finalUrl = res.url || url;
    dbg('Redirect:', url.slice(0, 60), '->', finalUrl.slice(0, 80));
    return finalUrl;
  } catch (e) {
    dbg('resolveRedirect error:', e.message, 'for', url);
    return url;
  }
}

/* ------------------------------------------------------------------ */
/*  Hoster extractors (identical logic to aniworld provider)            */
/* ------------------------------------------------------------------ */

const VOE_JUNK_PATTERNS = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function decodeVoeString(encoded) {
  try {
    let s = rot13(encoded);
    for (const junk of VOE_JUNK_PATTERNS) s = s.split(junk).join('_');
    s = s.replace(/_/g, '');
    const step3 = atob(s);
    const step4 = step3.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join('');
    const step5 = atob(step4.split('').reverse().join(''));
    const data = JSON.parse(step5);
    const source = data.direct_access_url || data.source || data.file;
    if (!source) { dbg('decodeVoeString: no source field; keys:', Object.keys(data)); return null; }
    dbg('decodeVoeString OK:', source.slice(0, 70));
    return { url: source, quality: 'Auto', type: source.includes('.m3u8') ? 'm3u8' : 'mp4' };
  } catch (e) {
    dbg('decodeVoeString error:', e.message);
    return null;
  }
}

async function extractVoe(url) {
  let html;
  try {
    html = await fetchText(url, { headers: { 'Referer': url } });
  } catch (e) {
    dbg('extractVoe fetch error:', e.message);
    return null;
  }

  // Strategy 1: new pipeline — var a168c='...'
  try {
    const m = html.match(/var\s+a168c\s*=\s*['"]([^'"]+)['"]/);
    if (m) { const r = decodeVoeString(m[1]); if (r) return r; }
  } catch (e) { dbg('extractVoe s1 error:', e.message); }

  // Strategy 2: legacy — <script type="application/json">["..."]</script>
  try {
    const m = html.match(/<script type="application\/json">\s*(\[.*?\])\s*<\/script>/s);
    if (m) {
      let str = JSON.parse(m[1])[0];
      str = rot13(str);
      str = str.split('').reverse().join('');
      let decoded;
      try { decoded = atob(atob(str)); } catch (_) { decoded = atob(str); }
      const data = JSON.parse(decoded);
      const source = data.direct_access_url || data.source || data.file;
      if (source) {
        dbg('extractVoe s2 (legacy) OK:', source.slice(0, 70));
        return { url: source, quality: 'Auto', type: source.includes('.m3u8') ? 'm3u8' : 'mp4' };
      }
    }
  } catch (e) { dbg('extractVoe s2 error:', e.message); }

  // Strategy 3: 'hls': '...' literal
  try {
    const m = html.match(/'hls':\s*'([^']+)'/);
    if (m) {
      dbg('extractVoe s3 (hls) OK:', m[1].slice(0, 70));
      return { url: m[1], quality: 'Auto', type: 'm3u8' };
    }
  } catch (e) { dbg('extractVoe s3 error:', e.message); }

  // Strategy 4: bare m3u8 URL anywhere in page
  try {
    const m = html.match(/https?:\/\/[^\s'"<>]+?\.m3u8[^\s'"<>]*/);
    if (m) {
      dbg('extractVoe s4 (bare m3u8) OK:', m[0].slice(0, 80));
      return { url: m[0], quality: 'Auto', type: 'm3u8' };
    }
  } catch (e) { dbg('extractVoe s4 error:', e.message); }

  dbg('extractVoe: all strategies failed for', url);
  return null;
}

async function extractDoodstream(url) {
  try {
    const html = await fetchText(url, { headers: { 'Referer': url } });
    const origin = (url.match(/https?:\/\/[^/]+/) || ['https://dood.li'])[0];
    const m = html.match(/\$\.get\('(\/pass_md5\/[^']+)'/);
    if (!m) { dbg('extractDoodstream: pass_md5 not found'); return null; }
    const passUrl = origin + m[1];
    const token = m[1].split('/').pop();
    const base = await fetchText(passUrl, { headers: { 'Referer': url } });
    const rand = Math.random().toString(36).slice(2, 12);
    const finalUrl = `${base}${rand}?token=${token}&expiry=${Date.now()}`;
    dbg('extractDoodstream OK:', finalUrl.slice(0, 80));
    return { url: finalUrl, quality: 'Auto', type: 'mp4' };
  } catch (e) {
    dbg('extractDoodstream error:', e.message);
    return null;
  }
}

async function extractVidoza(url) {
  try {
    const html = await fetchText(url, { headers: { 'Referer': url } });
    const m = html.match(/sourcesCode:\s*\[\{src:\s*"([^"]+)"/) ||
              html.match(/src:\s*"([^"]+\.mp4[^"]*)"/);;
    if (!m) { dbg('extractVidoza: src pattern not found'); return null; }
    dbg('extractVidoza OK:', m[1].slice(0, 80));
    return { url: m[1], quality: 'Auto', type: 'mp4' };
  } catch (e) {
    dbg('extractVidoza error:', e.message);
    return null;
  }
}

async function extractStreamtape(url) {
  try {
    const html = await fetchText(url, { headers: { 'Referer': url } });
    const m = html.match(/robotlink'\)\.innerHTML = (.+?)\+\s*\('([^']+)'\)/s);
    if (!m) { dbg('extractStreamtape: robotlink pattern not found'); return null; }
    let link = m[1].replace(/[\s'"]/g, '') + m[2].substring(3);
    if (!link.startsWith('http')) link = 'https:' + link;
    dbg('extractStreamtape OK:', link.slice(0, 80));
    return { url: link, quality: 'Auto', type: 'mp4' };
  } catch (e) {
    dbg('extractStreamtape error:', e.message);
    return null;
  }
}

async function extractVidmoly(url) {
  try {
    const html = await fetchText(url, { headers: { 'Referer': 'https://vidmoly.biz' } });
    const scripts = [];
    const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) scripts.push(m[1]);
    const combined = scripts.join('\n');
    const fm = combined.match(/file\s*:\s*['"]([^'"]+?\.m3u8[^'"]*)['"]/);
    if (!fm) { dbg('extractVidmoly: file pattern not found'); return null; }
    dbg('extractVidmoly OK:', fm[1].slice(0, 80));
    return { url: fm[1], quality: 'Auto', type: 'm3u8' };
  } catch (e) {
    dbg('extractVidmoly error:', e.message);
    return null;
  }
}

async function extractFilemoon(url) {
  try {
    const html = await fetchText(url, { headers: { 'Referer': url } });
    const m = html.match(/https?:\/\/[^\s'"<>]+?\.m3u8[^\s'"<>]*/);
    if (!m) { dbg('extractFilemoon: no m3u8 found'); return null; }
    dbg('extractFilemoon OK:', m[0].slice(0, 80));
    return { url: m[0], quality: 'Auto', type: 'm3u8' };
  } catch (e) {
    dbg('extractFilemoon error:', e.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Hoster dispatch                                                     */
/* ------------------------------------------------------------------ */

async function resolveHoster(hosterName, redirectUrl) {
  const finalUrl = await resolveRedirect(redirectUrl);
  const nameL = (hosterName || '').toLowerCase();
  let hostL = '';
  try { hostL = new URL(finalUrl).hostname.toLowerCase(); } catch (_) {}

  dbg('resolveHoster:', hosterName, '| host:', hostL);

  const hit = (kw) => nameL.includes(kw) || hostL.includes(kw);

  if (hit('voe'))         return extractVoe(finalUrl);
  if (hit('dood'))        return extractDoodstream(finalUrl);
  if (hit('vidmoly'))     return extractVidmoly(finalUrl);
  if (hit('vidoza'))      return extractVidoza(finalUrl);
  if (hit('filemoon'))    return extractFilemoon(finalUrl);
  if (hit('streamtape'))  return extractStreamtape(finalUrl);

  dbg('resolveHoster: unsupported hoster, skipping:', hosterName, '/', hostL);
  return null;
}

/* ------------------------------------------------------------------ */
/*  Nuvio interface                                                     */
/* ------------------------------------------------------------------ */

async function getStreams(tmdbId, mediaType = 'tv', season = 1, episode = 1) {
  dbg('getStreams:', { tmdbId, mediaType, season, episode });
  try {
    if (mediaType === 'movie') {
      dbg('Serienstream is TV-only, skipping movie request');
      return [];
    }

    const titles = await getTmdbTitles(tmdbId);
    if (!titles.length) { dbg('no TMDB titles'); return []; }

    const seriesUrl = await findSeriesUrl(titles);
    if (!seriesUrl) { dbg('series not found on serienstream'); return []; }

    const episodeUrl = await findEpisodeUrl(seriesUrl, season, episode);
    if (!episodeUrl) { dbg('episode URL not found'); return []; }

    const hosters = await collectHosterLinks(episodeUrl);
    if (!hosters.length) { dbg('no hosters on episode page'); return []; }

    const settled = await Promise.all(
      hosters.map(async h => {
        try {
          const resolved = await resolveHoster(h.hosterName, h.redirectPath);
          if (!resolved) return null;
          return {
            name: `Serienstream [${h.hosterName}]${h.lang ? ` (${h.lang})` : ''}`,
            title: h.hosterName,
            url: resolved.url,
            quality: resolved.quality || 'Auto',
            type: resolved.type || 'mp4'
          };
        } catch (e) {
          dbg('hoster error for', h.hosterName, ':', e.message);
          return null;
        }
      })
    );

    const streams = settled.filter(Boolean);
    dbg('returning', streams.length, 'streams');
    return streams;
  } catch (e) {
    dbg('getStreams top-level error:', e.message);
    return [];
  }
}

module.exports = { getStreams };
