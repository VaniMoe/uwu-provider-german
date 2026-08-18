/**
 * Serienstream provider for Nuvio
 */

var BASE = 'http://186.2.175.5';
var VHOST = 's.to';
var TMDB_KEY = '1865f43a0549ca50d341dd9ab8b29f49';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/json,*/*',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
  'Host': VHOST
};

function fixUrl(href) {
  if (!href) return null;
  href = href
    .replace(/^https?:\/\/s\.to/i, BASE)
    .replace(/^https?:\/\/serienstream\.to/i, BASE)
    .replace(/^https?:\/\/www\.serienstream\.to/i, BASE);
  if (href.indexOf('http') === 0) return href;
  if (href.indexOf('//') === 0) return 'http:' + href;
  return BASE + (href.indexOf('/') === 0 ? href : '/' + href);
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fetchText(url, headers) {
  var reqHeaders = Object.assign({}, HEADERS, headers || {});
  return fetch(url, { headers: reqHeaders })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' on ' + url);
      return res.text();
    });
}

function fetchJson(url) {
  return fetchText(url).then(function (text) {
    return JSON.parse(text);
  });
}

function getTitles(id, mediaType) {
  var idStr = String(id || '');

  if (idStr.indexOf('tt') === 0) {
    return fetchJson('https://api.themoviedb.org/3/find/' + idStr + '?api_key=' + TMDB_KEY + '&external_source=imdb_id')
      .then(function (data) {
        var results = data.tv_results || [];
        if (results.length > 0 && results[0].id) {
          return fetchTmdbTitles(results[0].id);
        }
        return [];
      })
      .catch(function () { return []; });
  }

  return fetchTmdbTitles(idStr);
}

function fetchTmdbTitles(tmdbId) {
  var deUrl = 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=de-DE';
  var enUrl = 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';

  return Promise.all([
    fetchJson(deUrl).catch(function () { return {}; }),
    fetchJson(enUrl).catch(function () { return {}; })
  ]).then(function (res) {
    var de = res[0] || {};
    var en = res[1] || {};
    var titles = [];
    var add = function (t) { if (t && titles.indexOf(t) === -1) titles.push(t); };
    add(de.name); add(de.original_name);
    add(en.name); add(en.original_name);
    return titles;
  });
}

function searchSerienstream(query) {
  var url = BASE + '/suche?term=' + encodeURIComponent(query) + '&tab=shows';
  return fetchText(url, { 'Referer': BASE + '/suche' })
    .then(function (html) {
      var cardRe = /<div class="seriesListContainer"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i;
      var match = html.match(cardRe);
      var searchBlock = match ? match[0] : html;

      var linkRe = /<a[^>]+href="(\/serie\/stream\/[^"]+)"[^>]*title="([^"]*)"/gi;
      var lm;
      var results = [];
      while ((lm = linkRe.exec(searchBlock)) !== null) {
        results.push({ link: fixUrl(lm[1]), title: lm[2].trim() });
      }
      return results;
    })
    .catch(function () { return []; });
}

function findSeriesUrl(titles) {
  if (!titles || titles.length === 0) return Promise.resolve(null);
  var i = 0;
  function step() {
    if (i >= titles.length) return Promise.resolve(null);
    var t = titles[i++];
    return searchSerienstream(t).then(function (list) {
      if (!list || list.length === 0) return step();
      var normT = normalize(t);
      for (var j = 0; j < list.length; j++) {
        if (normalize(list[j].title) === normT) return list[j].link;
      }
      return list[0].link;
    });
  }
  return step();
}

function findEpisodeUrl(seriesUrl, season, episode) {
  return fetchText(seriesUrl).then(function (html) {
    var seasonRe = /<a[^>]+href="(\/serie\/stream\/[^"]+\/staffel-(\d+))"[^>]*>/gi;
    var match;
    var seasonLinks = [];
    while ((match = seasonRe.exec(html)) !== null) {
      seasonLinks.push({ num: parseInt(match[2], 10), href: fixUrl(match[1]) });
    }

    var reqS = parseInt(season, 10) || 1;
    var targetSeason = null;
    for (var k = 0; k < seasonLinks.length; k++) {
      if (seasonLinks[k].num === reqS) { targetSeason = seasonLinks[k]; break; }
    }
    if (!targetSeason) targetSeason = seasonLinks[0] || { href: seriesUrl };

    return fetchText(targetSeason.href).then(function (sHtml) {
      var reqEp = parseInt(episode, 10) || 1;
      
      var epRe = /itemprop="episodeNumber"\s+content="(\d+)"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/gi;
      var epMatch;
      while ((epMatch = epRe.exec(sHtml)) !== null) {
        if (parseInt(epMatch[1], 10) === reqEp) {
          return fixUrl(epMatch[2]);
        }
      }

      var fbRe = new RegExp('href="([^"]+/staffel-' + reqS + '/episode-' + reqEp + '[^"]*)"', 'i');
      var fb = sHtml.match(fbRe);
      if (fb) return fixUrl(fb[1]);

      return null;
    });
  }).catch(function () { return null; });
}

function collectHosters(epUrl) {
  return fetchText(epUrl).then(function (html) {
    var langMap = { '1': 'Deutsch', '2': 'Englisch', '3': 'Ger-Sub' };
    var langRe = /data-lang-key="(\d+)"[^>]*title="([^"]*)"/gi;
    var lm;
    while ((lm = langRe.exec(html)) !== null) {
      langMap[lm[1]] = lm[2].replace(/^mit\s*/i, '').trim();
    }

    var hosters = [];
    var hosterRe = /<li[^>]+data-lang-key="(\d+)"[^>]+data-link-target="([^"]+)"[^>]*>[\s\S]*?<h4>([^<]+)<\/h4>/gi;
    var hm;
    while ((hm = hosterRe.exec(html)) !== null) {
      hosters.push({
        lang: langMap[hm[1]] || 'Deutsch',
        redirectUrl: fixUrl(hm[2]),
        name: hm[3].trim()
      });
    }

    return hosters;
  }).catch(function () { return []; });
}

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    var b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b);
  });
}

function decodeVoeString(raw) {
  try {
    var s = rot13(raw);
    var JUNK = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
    for (var i = 0; i < JUNK.length; i++) s = s.split(JUNK[i]).join('_');
    s = s.replace(/_/g, '');
    var s3 = atob(s);
    var s4 = s3.split('').map(function (c) { return String.fromCharCode(c.charCodeAt(0) - 3); }).join('');
    var s5 = atob(s4.split('').reverse().join(''));
    var data = JSON.parse(s5);
    return data.direct_access_url || data.source || data.file || null;
  } catch (e) {
    return null;
  }
}

function resolveVoe(url) {
  return fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'], 'Referer': url } })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      var jsRedirect = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (jsRedirect) {
        return resolveVoe(jsRedirect[1]);
      }

      var jsonScript = html.match(/<script type="application\/json">\s*(\[.*?\])\s*<\/script>/s);
      if (jsonScript) {
        try {
          var raw = JSON.parse(jsonScript[1])[0];
          var direct = decodeVoeString(raw);
          if (direct) return { url: direct, quality: '1080p', type: direct.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4' };
        } catch (e) {}
      }

      var m = html.match(/var\s+a168c\s*=\s*['"]([^'"]+)['"]/);
      if (m) {
        var direct2 = decodeVoeString(m[1]);
        if (direct2) return { url: direct2, quality: '1080p', type: direct2.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4' };
      }

      var hls = html.match(/'hls':\s*'([^']+)'/) || html.match(/https?:\/\/[^\s'"<>]+?\.m3u8[^\s'"<>]*/);
      if (hls) {
        return { url: hls[1] || hls[0], quality: '1080p', type: 'm3u8' };
      }

      return null;
    })
    .catch(function () { return null; });
}

function resolveStreamtape(url) {
  return fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'], 'Referer': url } })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      var m = html.match(/robotlink'\)\.innerHTML = (.+?)\+\s*\('([^']+)'\)/s);
      if (!m) return null;
      var link = m[1].replace(/[\s'"]/g, '') + m[2].substring(3);
      if (link.indexOf('http') !== 0) link = 'https:' + link;
      return { url: link, quality: '720p', type: 'mp4' };
    })
    .catch(function () { return null; });
}

function resolveHoster(name, redirectPath) {
  return fetch(redirectPath, { headers: Object.assign({}, HEADERS, { 'Referer': BASE }), redirect: 'follow' })
    .then(function (res) { return res.url || redirectPath; })
    .then(function (finalUrl) {
      var n = (name || '').toLowerCase();
      if (n.indexOf('voe') !== -1 || finalUrl.indexOf('voe') !== -1) return resolveVoe(finalUrl);
      if (n.indexOf('streamtape') !== -1 || finalUrl.indexOf('streamtape') !== -1) return resolveStreamtape(finalUrl);
      return null;
    })
    .catch(function () { return null; });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  if (mediaType === 'movie') return Promise.resolve([]);

  var s = parseInt(seasonNum, 10) || 1;
  var ep = parseInt(episodeNum, 10) || 1;

  return getTitles(tmdbId, 'tv')
    .then(function (titles) {
      if (!titles || titles.length === 0) return [];
      return findSeriesUrl(titles);
    })
    .then(function (seriesUrl) {
      if (!seriesUrl) return [];
      return findEpisodeUrl(seriesUrl, s, ep);
    })
    .then(function (epUrl) {
      if (!epUrl) return [];
      return collectHosters(epUrl);
    })
    .then(function (hosters) {
      if (!hosters || hosters.length === 0) return [];
      var jobs = hosters.map(function (h) {
        return resolveHoster(h.name, h.redirectUrl).then(function (res) {
          if (!res || !res.url) return null;
          return {
            name: "Serienstream",
            title: h.name + " (" + h.lang + ")",
            url: res.url,
            quality: res.quality || "1080p",
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              "Referer": BASE
            }
          };
        });
      });
      return Promise.all(jobs);
    })
    .then(function (streams) {
      var valid = (streams || []).filter(Boolean);
      var qualityOrder = { "1080p": 3, "720p": 2, "480p": 1 };
      return valid.sort(function (a, b) {
        return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
      });
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
