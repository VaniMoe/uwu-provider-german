/**
 * Aniworld provider for Nuvio Local Scrapers
 * Compatible with Hermes & React Native environments.
 */

var cheerio = require('cheerio-without-node-native');

var BASE = 'https://aniworld.to';
var TMDB_API_KEY = '1865f43a0549ca50d341dd9ab8b29f49';
var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/json,*/*',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
};

function fixUrl(href) {
  if (!href) return null;
  if (href.indexOf('http') === 0) return href;
  if (href.indexOf('//') === 0) return 'https:' + href;
  return BASE + (href.indexOf('/') === 0 ? href : '/' + href);
}

function fetchText(url, options) {
  var opts = options || {};
  var headers = Object.assign({}, DEFAULT_HEADERS, opts.headers || {});
  return fetch(url, Object.assign({}, opts, { headers: headers }))
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' on ' + url);
      return res.text();
    });
}

function fetchJson(url, options) {
  return fetchText(url, options).then(function (text) {
    return JSON.parse(text);
  });
}

/**
 * Handles TMDB IDs, IMDb IDs (tt...), and Kitsu IDs
 */
function getTitles(id, mediaType) {
  var type = (mediaType === 'movie') ? 'movie' : 'tv';
  var idStr = String(id || '');

  // 1. IMDb ID (e.g. tt14208870)
  if (idStr.indexOf('tt') === 0) {
    var findUrl = 'https://api.themoviedb.org/3/find/' + idStr + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id';
    return fetchJson(findUrl)
      .then(function (data) {
        var results = (type === 'movie') ? (data.movie_results || []) : (data.tv_results || []);
        if (results.length > 0 && results[0].id) {
          return getTitlesFromTmdb(results[0].id, type);
        }
        return [];
      })
      .catch(function () { return []; });
  }

  // 2. Kitsu ID (e.g. kitsu:1234)
  if (idStr.indexOf('kitsu:') === 0) {
    var kId = idStr.replace('kitsu:', '');
    var kitsuUrl = 'https://kitsu.io/api/edge/anime/' + kId;
    return fetchJson(kitsuUrl)
      .then(function (data) {
        var attr = (data && data.data && data.data.attributes) || {};
        var titles = [];
        if (attr.canonicalTitle) titles.push(attr.canonicalTitle);
        if (attr.titles) {
          if (attr.titles.en) titles.push(attr.titles.en);
          if (attr.titles.en_jp) titles.push(attr.titles.en_jp);
          if (attr.titles.ja_jp) titles.push(attr.titles.ja_jp);
        }
        return titles;
      })
      .catch(function () { return []; });
  }

  // 3. Regular numeric TMDB ID
  return getTitlesFromTmdb(idStr, type);
}

function getTitlesFromTmdb(tmdbId, type) {
  var deUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=de-DE';
  var enUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=en-US';

  return Promise.all([
    fetchJson(deUrl).catch(function () { return null; }),
    fetchJson(enUrl).catch(function () { return null; })
  ]).then(function (res) {
    var de = res[0] || {};
    var en = res[1] || {};
    var titleSet = {};
    [de.name, de.title, de.original_name, de.original_title,
     en.name, en.title, en.original_name, en.original_title]
      .filter(Boolean)
      .forEach(function (t) { titleSet[t] = true; });
    return Object.keys(titleSet);
  });
}

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function searchAniworld(query) {
  return fetchText(BASE + '/ajax/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
      'Referer': BASE + '/search'
    },
    body: 'keyword=' + encodeURIComponent(query)
  })
  .then(function (res) {
    var items = JSON.parse(res);
    return items
      .filter(function (it) { return it.link && it.link.indexOf('episode-') === -1 && it.link.indexOf('/stream') !== -1; })
      .map(function (it) {
        var link = it.link.indexOf('/') === 0 ? it.link : '/' + it.link;
        return {
          title: (it.name || it.title || '').replace(/<\/?em>/g, '').trim(),
          link: fixUrl(link)
        };
      });
  })
  .catch(function () { return []; });
}

function findSeriesUrl(titles) {
  if (!titles || titles.length === 0) return Promise.resolve(null);

  var index = 0;
  function next() {
    if (index >= titles.length) return Promise.resolve(null);
    var title = titles[index++];
    return searchAniworld(title).then(function (results) {
      if (!results || results.length === 0) return next();
      var target = normalize(title);
      var exact = results.find(function (r) { return normalize(r.title) === target; });
      if (exact) return exact.link;
      return results[0].link;
    });
  }
  return next();
}

function findEpisodeUrl(seriesUrl, mediaType, season, episode) {
  return fetchText(seriesUrl).then(function (html) {
    var $ = cheerio.load(html);
    var seasonLinks = [];

    $('div#stream > ul:first-child li a').each(function (_, el) {
      var href = fixUrl($(el).attr('href'));
      if (!href) return;
      var isFilme = /\/filme(\/|$)/i.test(href);
      var staffelMatch = href.match(/\/staffel-(\d+)/i);
      var num = staffelMatch ? parseInt(staffelMatch[1], 10) : (isFilme ? 0 : NaN);
      seasonLinks.push({ num: num, href: href, isFilme: isFilme });
    });

    if (seasonLinks.length === 0) return null;

    var targetSeason;
    if (mediaType === 'movie') {
      targetSeason = seasonLinks.find(function (s) { return s.isFilme; }) || seasonLinks[0];
    } else {
      var reqSeason = parseInt(season, 10) || 1;
      targetSeason = seasonLinks.find(function (s) { return s.num === reqSeason; }) || seasonLinks[0];
    }

    if (!targetSeason) return null;

    return fetchText(targetSeason.href).then(function (seasonHtml) {
      var $$ = cheerio.load(seasonHtml);
      var targetEp = (mediaType === 'movie') ? 1 : (parseInt(episode, 10) || 1);
      var episodeUrl = null;

      $$('table.seasonEpisodesList tbody tr').each(function (_, row) {
        if (episodeUrl) return;
        var epNum = parseInt($$(row).find('meta[itemprop="episodeNumber"]').attr('content'), 10);
        if (epNum === targetEp) {
          var href = $$(row).find('a').first().attr('href');
          episodeUrl = fixUrl(href);
        }
      });

      return episodeUrl;
    });
  }).catch(function () { return null; });
}

function collectHosterLinks(episodeUrl) {
  return fetchText(episodeUrl).then(function (html) {
    var $ = cheerio.load(html);
    var langMap = {};
    $('div.changeLanguageBox img').each(function (_, el) {
      var key = $(el).attr('data-lang-key');
      var title = ($(el).attr('title') || '').replace(/^mit\s*/i, '').trim();
      if (key) langMap[key] = title;
    });

    var hosters = [];
    $('div.hosterSiteVideo ul li').each(function (_, el) {
      var langKey = $(el).attr('data-lang-key');
      var linkTarget = $(el).attr('data-link-target');
      var hosterName = $(el).find('h4').text().trim();
      if (linkTarget) {
        hosters.push({
          hosterName: hosterName,
          lang: langMap[langKey] || langKey || '',
          redirectPath: fixUrl(linkTarget)
        });
      }
    });
    return hosters;
  }).catch(function () { return []; });
}

function resolveRedirect(url) {
  return fetch(url, { headers: Object.assign({}, DEFAULT_HEADERS, { 'Referer': BASE }), redirect: 'follow' })
    .then(function (res) { return res.url || url; })
    .catch(function () { return url; });
}

/* ---------------- Extractors ---------------- */

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    var base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function decodeVoeString(encoded) {
  try {
    var s = rot13(encoded);
    var JUNK = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
    for (var i = 0; i < JUNK.length; i++) s = s.split(JUNK[i]).join('_');
    s = s.replace(/_/g, '');
    var step3 = atob(s);
    var step4 = step3.split('').map(function (c) { return String.fromCharCode(c.charCodeAt(0) - 3); }).join('');
    var step5 = atob(step4.split('').reverse().join(''));
    var data = JSON.parse(step5);
    var source = data.direct_access_url || data.source || data.file;
    if (!source) return null;
    return { url: source, quality: 'Auto', type: source.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4' };
  } catch (e) { return null; }
}

function extractVoe(url) {
  return fetchText(url, { headers: { 'Referer': url } }).then(function (html) {
    var m = html.match(/var\s+a168c\s*=\s*['"]([^'"]+)['"]/);
    if (m) {
      var r = decodeVoeString(m[1]);
      if (r) return r;
    }
    var hls = html.match(/'hls':\s*'([^']+)'/) || html.match(/https?:\/\/[^\s'"<>]+?\.m3u8[^\s'"<>]*/);
    if (hls) {
      return { url: hls[1] || hls[0], quality: 'Auto', type: 'm3u8' };
    }
    return null;
  }).catch(function () { return null; });
}

function extractStreamtape(url) {
  return fetchText(url, { headers: { 'Referer': url } }).then(function (html) {
    var m = html.match(/robotlink'\)\.innerHTML = (.+?)\+\s*\('([^']+)'\)/s);
    if (!m) return null;
    var link = m[1].replace(/[\s'"]/g, '') + m[2].substring(3);
    if (link.indexOf('http') !== 0) link = 'https:' + link;
    return { url: link, quality: 'Auto', type: 'mp4' };
  }).catch(function () { return null; });
}

function extractVidoza(url) {
  return fetchText(url, { headers: { 'Referer': url } }).then(function (html) {
    var m = html.match(/sourcesCode:\s*\[\{src:\s*"([^"]+)"/) || html.match(/src:\s*"([^"]+\.mp4[^"]*)"/);
    if (!m) return null;
    return { url: m[1], quality: 'Auto', type: 'mp4' };
  }).catch(function () { return null; });
}

function resolveHoster(hosterName, redirectUrl) {
  return resolveRedirect(redirectUrl).then(function (finalUrl) {
    var name = (hosterName || '').toLowerCase();
    if (name.indexOf('voe') !== -1 || finalUrl.indexOf('voe') !== -1) return extractVoe(finalUrl);
    if (name.indexOf('streamtape') !== -1 || finalUrl.indexOf('streamtape') !== -1) return extractStreamtape(finalUrl);
    if (name.indexOf('vidoza') !== -1 || finalUrl.indexOf('vidoza') !== -1) return extractVidoza(finalUrl);
    return null;
  });
}

/* ---------------- Main Interface ---------------- */

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var s = parseInt(seasonNum, 10) || 1;
  var ep = parseInt(episodeNum, 10) || 1;
  var mType = mediaType || 'tv';

  return getTitles(tmdbId, mType)
    .then(function (titles) {
      if (!titles || titles.length === 0) return [];
      return findSeriesUrl(titles);
    })
    .then(function (seriesUrl) {
      if (!seriesUrl) return [];
      return findEpisodeUrl(seriesUrl, mType, s, ep);
    })
    .then(function (episodeUrl) {
      if (!episodeUrl) return [];
      return collectHosterLinks(episodeUrl);
    })
    .then(function (hosters) {
      if (!hosters || hosters.length === 0) return [];
      var promises = hosters.map(function (h) {
        return resolveHoster(h.hosterName, h.redirectPath)
          .then(function (res) {
            if (!res) return null;
            return {
              name: 'Aniworld [' + h.hosterName + ']' + (h.lang ? ' (' + h.lang + ')' : ''),
              title: h.hosterName,
              url: res.url,
              quality: res.quality || 'Auto',
              type: res.type || 'mp4',
              headers: { 'Referer': BASE }
            };
          })
          .catch(function () { return null; });
      });
      return Promise.all(promises);
    })
    .then(function (settled) {
      return settled.filter(Boolean);
    })
    .catch(function () {
      return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
