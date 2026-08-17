/**
 * Aniworld provider for Nuvio
 * Ported from Bnyro/GermanProviders (CloudStream Kotlin plugin) to Nuvio's JS scraper format.
 *
 * Scope: German-language anime site aniworld.to
 * Flow: TMDB id -> title -> search aniworld -> match series -> find season/episode ->
 *       collect hoster links -> resolve known hosters -> streams
 *
 * === FIXES vs. original port ===
 * [Search]
 *   - Response JSON uses key 'name' not 'title'
 *   - 'link' field has no leading slash -> prepend '/'
 * [Season navigation]
 *   - Link text is "Staffel 1", "Filme", not a bare number
 *   - Parse season number from href suffix (/staffel-N) rather than link text
 *   - Movie section detected via href containing '/filme'
 * [Episode list]
 *   - Confirmed selector: table.seasonEpisodesList tbody tr + meta[itemprop="episodeNumber"]
 *   - Episode URL: first <a> href in the row (not a separate data attribute)
 * [VOE extractor]
 *   - New pipeline (2024-2025): var a168c='...' -> rot13 -> strip junk -> b64 -> shift(-3) -> b64(reversed)
 *   - Falls back to legacy <script type="application/json"> pipeline, then bare m3u8 scan
 * [New hosters]
 *   - Vidmoly (file:'.m3u8' in script tags)
 *   - Filemoon (bare m3u8 fallback)
 * [Dispatch]
 *   - URL hostname checked as fallback when hosterName label is ambiguous
 * [Robustness]
 *   - Levenshtein fuzzy matching for title search
 *   - console.warn debug logging at every failure point (gate with DEBUG flag)
 */

'use strict';

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regeneratorValues(e) { if (null != e) { var t = e["function" == typeof Symbol && Symbol.iterator || "@@iterator"], r = 0; if (t) return t.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) return { next: function next() { return e && r >= e.length && (e = void 0), { value: e && e[r++], done: !e }; } }; } throw new TypeError(_typeof(e) + " is not iterable"); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var cheerio = require('cheerio-without-node-native');
var BASE = 'https://aniworld.to';
var TMDB_API_KEY = '1865f43a0549ca50d341dd9ab8b29f49';
var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/json,*/*',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
};

// Set to true for verbose debug output during development; false for prod silent-fail
var DEBUG = true;
function dbg() {
  var _console;
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }
  if (DEBUG) (_console = console).warn.apply(_console, ['[Aniworld]'].concat(args));
}

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                        */
/* ------------------------------------------------------------------ */
function fetchText(_x) {
  return _fetchText.apply(this, arguments);
}
function _fetchText() {
  _fetchText = _asyncToGenerator(function (url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return /*#__PURE__*/_regenerator().m(function _callee() {
      var res;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.n) {
          case 0:
            _context.n = 1;
            return fetch(url, _objectSpread(_objectSpread({}, options), {}, {
              headers: _objectSpread(_objectSpread({}, DEFAULT_HEADERS), options.headers || {})
            }));
          case 1:
            res = _context.v;
            if (res.ok) {
              _context.n = 2;
              break;
            }
            throw new Error("HTTP ".concat(res.status, " on ").concat(url));
          case 2:
            return _context.a(2, res.text());
        }
      }, _callee);
    })();
  });
  return _fetchText.apply(this, arguments);
}
function fetchJson(_x2) {
  return _fetchJson.apply(this, arguments);
}
function _fetchJson() {
  _fetchJson = _asyncToGenerator(function (url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return /*#__PURE__*/_regenerator().m(function _callee2() {
      var text;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.n) {
          case 0:
            _context2.n = 1;
            return fetchText(url, options);
          case 1:
            text = _context2.v;
            return _context2.a(2, JSON.parse(text));
        }
      }, _callee2);
    })();
  });
  return _fetchJson.apply(this, arguments);
}
function fixUrl(href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  return BASE + (href.startsWith('/') ? href : '/' + href);
}

/* ------------------------------------------------------------------ */
/*  TMDB                                                                */
/* ------------------------------------------------------------------ */
function getTmdbTitles(_x3, _x4) {
  return _getTmdbTitles.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Search                                                              */
/* ------------------------------------------------------------------ */
function _getTmdbTitles() {
  _getTmdbTitles = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(tmdbId, mediaType) {
    var type, _yield$Promise$all, _yield$Promise$all2, de, en, titles, _t;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          type = mediaType === 'movie' ? 'movie' : 'tv';
          _context3.p = 1;
          _context3.n = 2;
          return Promise.all([fetchJson("https://api.themoviedb.org/3/".concat(type, "/").concat(tmdbId, "?api_key=").concat(TMDB_API_KEY, "&language=de-DE")), fetchJson("https://api.themoviedb.org/3/".concat(type, "/").concat(tmdbId, "?api_key=").concat(TMDB_API_KEY, "&language=en-US"))]);
        case 2:
          _yield$Promise$all = _context3.v;
          _yield$Promise$all2 = _slicedToArray(_yield$Promise$all, 2);
          de = _yield$Promise$all2[0];
          en = _yield$Promise$all2[1];
          titles = new Set();
          [de.name, de.title, de.original_name, de.original_title, en.name, en.title, en.original_name, en.original_title].filter(Boolean).forEach(function (t) {
            return titles.add(t);
          });
          dbg('TMDB titles:', Array.from(titles));
          return _context3.a(2, Array.from(titles));
        case 3:
          _context3.p = 3;
          _t = _context3.v;
          dbg('getTmdbTitles error:', _t.message);
          return _context3.a(2, []);
      }
    }, _callee3, null, [[1, 3]]);
  }));
  return _getTmdbTitles.apply(this, arguments);
}
function searchAniworld(_x5) {
  return _searchAniworld.apply(this, arguments);
}
function _searchAniworld() {
  _searchAniworld = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(query) {
    var res, items, results, _t2, _t3;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          dbg('Searching aniworld for:', query);
          _context4.p = 1;
          _context4.n = 2;
          return fetchText("".concat(BASE, "/ajax/search"), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'x-requested-with': 'XMLHttpRequest',
              'Referer': "".concat(BASE, "/search")
            },
            body: "keyword=".concat(encodeURIComponent(query))
          });
        case 2:
          res = _context4.v;
          _context4.n = 4;
          break;
        case 3:
          _context4.p = 3;
          _t2 = _context4.v;
          dbg('searchAniworld fetch error:', _t2.message);
          return _context4.a(2, []);
        case 4:
          items = [];
          _context4.p = 5;
          items = JSON.parse(res);
          _context4.n = 7;
          break;
        case 6:
          _context4.p = 6;
          _t3 = _context4.v;
          dbg('searchAniworld JSON parse error:', _t3.message, '| raw:', res.slice(0, 300));
          return _context4.a(2, []);
        case 7:
          // FIX: response uses 'name' not 'title'; 'link' is a relative path without leading slash
          results = items.filter(function (it) {
            return it.link && !it.link.includes('episode-') && it.link.includes('/stream');
          }).map(function (it) {
            return {
              title: (it.name || it.title || '').replace(/<\/?em>/g, '').trim(),
              link: fixUrl(it.link.startsWith('/') ? it.link : '/' + it.link)
            };
          });
          dbg('searchAniworld results:', results.map(function (r) {
            return "\"".concat(r.title, "\" -> ").concat(r.link);
          }));
          return _context4.a(2, results);
      }
    }, _callee4, null, [[5, 6], [1, 3]]);
  }));
  return _searchAniworld.apply(this, arguments);
}
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function levenshtein(a, b) {
  var m = a.length,
    n = b.length;
  var dp = Array.from({
    length: m + 1
  }, function (_, i) {
    var row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (var j = 0; j <= n; j++) dp[0][j] = j;
  for (var i = 1; i <= m; i++) {
    for (var _j = 1; _j <= n; _j++) {
      dp[i][_j] = a[i - 1] === b[_j - 1] ? dp[i - 1][_j - 1] : 1 + Math.min(dp[i - 1][_j], dp[i][_j - 1], dp[i - 1][_j - 1]);
    }
  }
  return dp[m][n];
}
function findSeriesUrl(_x6) {
  return _findSeriesUrl.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Episode URL                                                         */
/* ------------------------------------------------------------------ */
function _findSeriesUrl() {
  _findSeriesUrl = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(titles) {
    var _iterator2, _step2, _loop, _ret, _t5;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _iterator2 = _createForOfIteratorHelper(titles);
          _context6.p = 1;
          _loop = /*#__PURE__*/_regenerator().m(function _callee5() {
            var title, results, target, exact, fuzzy, _t4;
            return _regenerator().w(function (_context5) {
              while (1) switch (_context5.p = _context5.n) {
                case 0:
                  title = _step2.value;
                  _context5.p = 1;
                  _context5.n = 2;
                  return searchAniworld(title);
                case 2:
                  results = _context5.v;
                  _context5.n = 4;
                  break;
                case 3:
                  _context5.p = 3;
                  _t4 = _context5.v;
                  dbg('findSeriesUrl search error for title:', title, _t4.message);
                  return _context5.a(2, 0);
                case 4:
                  if (results.length) {
                    _context5.n = 5;
                    break;
                  }
                  return _context5.a(2, 0);
                case 5:
                  target = normalize(title); // 1) Exact normalized match
                  exact = results.find(function (r) {
                    return normalize(r.title) === target;
                  });
                  if (!exact) {
                    _context5.n = 6;
                    break;
                  }
                  dbg('findSeriesUrl exact match:', exact.link);
                  return _context5.a(2, {
                    v: exact.link
                  });
                case 6:
                  // 2) Fuzzy: Levenshtein <= 3 or string similarity >= 80%
                  fuzzy = results.find(function (r) {
                    var n = normalize(r.title);
                    var dist = levenshtein(target, n);
                    var maxLen = Math.max(target.length, n.length);
                    return maxLen > 0 && (dist <= 3 || (maxLen - dist) / maxLen >= 0.8);
                  });
                  if (!fuzzy) {
                    _context5.n = 7;
                    break;
                  }
                  dbg('findSeriesUrl fuzzy match:', fuzzy.link, '(title:', title + ')');
                  return _context5.a(2, {
                    v: fuzzy.link
                  });
                case 7:
                  // 3) Fallback: first result
                  dbg('findSeriesUrl fallback to first result:', results[0].link);
                  return _context5.a(2, {
                    v: results[0].link
                  });
              }
            }, _callee5, null, [[1, 3]]);
          });
          _iterator2.s();
        case 2:
          if ((_step2 = _iterator2.n()).done) {
            _context6.n = 6;
            break;
          }
          return _context6.d(_regeneratorValues(_loop()), 3);
        case 3:
          _ret = _context6.v;
          if (!(_ret === 0)) {
            _context6.n = 4;
            break;
          }
          return _context6.a(3, 5);
        case 4:
          if (!_ret) {
            _context6.n = 5;
            break;
          }
          return _context6.a(2, _ret.v);
        case 5:
          _context6.n = 2;
          break;
        case 6:
          _context6.n = 8;
          break;
        case 7:
          _context6.p = 7;
          _t5 = _context6.v;
          _iterator2.e(_t5);
        case 8:
          _context6.p = 8;
          _iterator2.f();
          return _context6.f(8);
        case 9:
          dbg('findSeriesUrl: no result for any title');
          return _context6.a(2, null);
      }
    }, _callee6, null, [[1, 7, 8, 9]]);
  }));
  return _findSeriesUrl.apply(this, arguments);
}
function findEpisodeUrl(_x7, _x8, _x9, _x0) {
  return _findEpisodeUrl.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Hoster collection                                                   */
/* ------------------------------------------------------------------ */
function _findEpisodeUrl() {
  _findEpisodeUrl = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(seriesUrl, mediaType, season, episode) {
    var html, $, seasonLinks, targetSeason, seasonHtml, $$, targetEp, episodeUrl, _t6, _t7;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          dbg('findEpisodeUrl:', {
            seriesUrl: seriesUrl,
            mediaType: mediaType,
            season: season,
            episode: episode
          });
          _context7.p = 1;
          _context7.n = 2;
          return fetchText(seriesUrl);
        case 2:
          html = _context7.v;
          _context7.n = 4;
          break;
        case 3:
          _context7.p = 3;
          _t6 = _context7.v;
          dbg('findEpisodeUrl: fetchText error:', _t6.message);
          return _context7.a(2, null);
        case 4:
          $ = cheerio.load(html);
          seasonLinks = []; // Confirmed from live HTML: div#stream > ul:first-child li a
          $('div#stream > ul:first-child li a').each(function (_, el) {
            var href = fixUrl($(el).attr('href'));
            if (!href) return;
            // FIX: parse season number from href (/staffel-N), not from link text
            var isFilme = /\/filme(\/|$)/i.test(href);
            var staffelMatch = href.match(/\/staffel-(\d+)/i);
            var num = staffelMatch ? parseInt(staffelMatch[1], 10) : isFilme ? 0 : NaN;
            seasonLinks.push({
              num: num,
              href: href,
              isFilme: isFilme
            });
          });
          dbg('Season links:', seasonLinks.map(function (s) {
            return "".concat(s.isFilme ? 'Filme' : 'Staffel ' + s.num, " -> ").concat(s.href);
          }));
          if (seasonLinks.length) {
            _context7.n = 5;
            break;
          }
          dbg('findEpisodeUrl: no season links found in page');
          return _context7.a(2, null);
        case 5:
          if (mediaType === 'movie') {
            // Aniworld lists movies under a "Filme" section (href contains /filme/)
            targetSeason = seasonLinks.find(function (s) {
              return s.isFilme;
            }) || seasonLinks[0];
            dbg('Movie mode: targeting', targetSeason);
          } else {
            targetSeason = seasonLinks.find(function (s) {
              return s.num === season;
            });
            if (!targetSeason) {
              dbg("Season ".concat(season, " not found, falling back to first available"));
              targetSeason = seasonLinks.find(function (s) {
                return !s.isFilme;
              }) || seasonLinks[0];
            }
          }
          if (targetSeason) {
            _context7.n = 6;
            break;
          }
          dbg('findEpisodeUrl: no target season resolved');
          return _context7.a(2, null);
        case 6:
          _context7.p = 6;
          _context7.n = 7;
          return fetchText(targetSeason.href);
        case 7:
          seasonHtml = _context7.v;
          _context7.n = 9;
          break;
        case 8:
          _context7.p = 8;
          _t7 = _context7.v;
          dbg('findEpisodeUrl: error fetching season page:', _t7.message);
          return _context7.a(2, null);
        case 9:
          $$ = cheerio.load(seasonHtml);
          targetEp = mediaType === 'movie' ? 1 : episode;
          episodeUrl = null; // Confirmed selectors from live HTML
          $$('table.seasonEpisodesList tbody tr').each(function (_, row) {
            if (episodeUrl) return;
            var epNum = parseInt($$(row).find('meta[itemprop="episodeNumber"]').attr('content'), 10);
            if (epNum === targetEp) {
              // FIX: take first <a> href in the row (direct episode link)
              var href = $$(row).find('a').first().attr('href');
              episodeUrl = fixUrl(href);
              dbg('Found episode URL:', episodeUrl, '(ep', targetEp + ')');
            }
          });
          if (!episodeUrl) {
            dbg('findEpisodeUrl: ep', targetEp, 'not found in season page');
          }
          return _context7.a(2, episodeUrl);
      }
    }, _callee7, null, [[6, 8], [1, 3]]);
  }));
  return _findEpisodeUrl.apply(this, arguments);
}
function collectHosterLinks(_x1) {
  return _collectHosterLinks.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Redirect resolver                                                   */
/* ------------------------------------------------------------------ */
function _collectHosterLinks() {
  _collectHosterLinks = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(episodeUrl) {
    var html, $, langMap, hosters, _t8;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.p = _context8.n) {
        case 0:
          dbg('collectHosterLinks:', episodeUrl);
          _context8.p = 1;
          _context8.n = 2;
          return fetchText(episodeUrl);
        case 2:
          html = _context8.v;
          _context8.n = 4;
          break;
        case 3:
          _context8.p = 3;
          _t8 = _context8.v;
          dbg('collectHosterLinks fetch error:', _t8.message);
          return _context8.a(2, []);
        case 4:
          $ = cheerio.load(html); // Build lang key -> label map
          langMap = {};
          $('div.changeLanguageBox img').each(function (_, el) {
            var key = $(el).attr('data-lang-key');
            var title = ($(el).attr('title') || '').replace(/^mit\s*/i, '').trim();
            if (key) langMap[key] = title;
          });
          dbg('Language map:', langMap);
          hosters = [];
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
          dbg('Hosters:', hosters.map(function (h) {
            return "".concat(h.hosterName, " [").concat(h.lang, "] -> ").concat(h.redirectPath);
          }));
          return _context8.a(2, hosters);
      }
    }, _callee8, null, [[1, 3]]);
  }));
  return _collectHosterLinks.apply(this, arguments);
}
function resolveRedirect(_x10) {
  return _resolveRedirect.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Hoster extractors                                                   */
/* ------------------------------------------------------------------ */
// --- VOE helpers ---
function _resolveRedirect() {
  _resolveRedirect = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(url) {
    var res, finalUrl, _t9;
    return _regenerator().w(function (_context9) {
      while (1) switch (_context9.p = _context9.n) {
        case 0:
          _context9.p = 0;
          _context9.n = 1;
          return fetch(url, {
            headers: _objectSpread(_objectSpread({}, DEFAULT_HEADERS), {}, {
              'Referer': BASE
            }),
            redirect: 'follow'
          });
        case 1:
          res = _context9.v;
          finalUrl = res.url || url;
          dbg('Redirect:', url.slice(0, 60), '->', finalUrl.slice(0, 80));
          return _context9.a(2, finalUrl);
        case 2:
          _context9.p = 2;
          _t9 = _context9.v;
          dbg('resolveRedirect error:', _t9.message, 'for', url);
          return _context9.a(2, url);
      }
    }, _callee9, null, [[0, 2]]);
  }));
  return _resolveRedirect.apply(this, arguments);
}
var VOE_JUNK_PATTERNS = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
function rot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    var base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
  });
}

/**
 * Decodes VOE's current obfuscation (2024-2025):
 *   1. ROT13
 *   2. Replace junk multi-char patterns with '_', then strip all '_'
 *   3. Base64 decode
 *   4. Shift each character back by 3 (Caesar)
 *   5. Reverse the string, then Base64 decode
 *   Returns { url, quality, type } or null.
 */
function decodeVoeString(encoded) {
  try {
    // Step 1: ROT13
    var s = rot13(encoded);
    // Step 2: junk-strip
    var _iterator = _createForOfIteratorHelper(VOE_JUNK_PATTERNS),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var junk = _step.value;
        s = s.split(junk).join('_');
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    s = s.replace(/_/g, '');
    // Step 3: base64
    var step3 = atob(s);
    // Step 4: shift back by 3
    var step4 = step3.split('').map(function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 3);
    }).join('');
    // Step 5: reverse + base64
    var step5 = atob(step4.split('').reverse().join(''));
    var data = JSON.parse(step5);
    var source = data.direct_access_url || data.source || data.file;
    if (!source) {
      dbg('decodeVoeString: no source field; keys:', Object.keys(data));
      return null;
    }
    dbg('decodeVoeString OK:', source.slice(0, 70));
    return {
      url: source,
      quality: 'Auto',
      type: source.includes('.m3u8') ? 'm3u8' : 'mp4'
    };
  } catch (e) {
    dbg('decodeVoeString error:', e.message);
    return null;
  }
}

/**
 * VOE (voe.sx) — tries four strategies in order.
 */
function extractVoe(_x11) {
  return _extractVoe.apply(this, arguments);
}
function _extractVoe() {
  _extractVoe = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0(url) {
    var html, m, result, _m, str, decoded, data, source, _m2, _m3, _t0, _t1, _t10, _t11, _t12;
    return _regenerator().w(function (_context0) {
      while (1) switch (_context0.p = _context0.n) {
        case 0:
          _context0.p = 0;
          _context0.n = 1;
          return fetchText(url, {
            headers: {
              'Referer': url
            }
          });
        case 1:
          html = _context0.v;
          _context0.n = 3;
          break;
        case 2:
          _context0.p = 2;
          _t0 = _context0.v;
          dbg('extractVoe fetch error:', _t0.message);
          return _context0.a(2, null);
        case 3:
          _context0.p = 3;
          m = html.match(/var\s+a168c\s*=\s*['"]([^'"]+)['"]/);
          if (!m) {
            _context0.n = 4;
            break;
          }
          result = decodeVoeString(m[1]);
          if (!result) {
            _context0.n = 4;
            break;
          }
          return _context0.a(2, result);
        case 4:
          _context0.n = 6;
          break;
        case 5:
          _context0.p = 5;
          _t1 = _context0.v;
          dbg('extractVoe s1 error:', _t1.message);
        case 6:
          _context0.p = 6;
          _m = html.match(/<script type="application\/json">\s*(\[[^]*?\])\s*<\/script>/);
          if (!_m) {
            _context0.n = 7;
            break;
          }
          str = JSON.parse(_m[1])[0];
          str = rot13(str);
          str = str.split('').reverse().join('');
          try {
            decoded = atob(atob(str));
          } catch (_) {
            decoded = atob(str);
          }
          data = JSON.parse(decoded);
          source = data.direct_access_url || data.source || data.file;
          if (!source) {
            _context0.n = 7;
            break;
          }
          dbg('extractVoe s2 (legacy) OK:', source.slice(0, 70));
          return _context0.a(2, {
            url: source,
            quality: 'Auto',
            type: source.includes('.m3u8') ? 'm3u8' : 'mp4'
          });
        case 7:
          _context0.n = 9;
          break;
        case 8:
          _context0.p = 8;
          _t10 = _context0.v;
          dbg('extractVoe s2 error:', _t10.message);
        case 9:
          _context0.p = 9;
          _m2 = html.match(/'hls':\s*'([^']+)'/);
          if (!_m2) {
            _context0.n = 10;
            break;
          }
          dbg('extractVoe s3 (hls) OK:', _m2[1].slice(0, 70));
          return _context0.a(2, {
            url: _m2[1],
            quality: 'Auto',
            type: 'm3u8'
          });
        case 10:
          _context0.n = 12;
          break;
        case 11:
          _context0.p = 11;
          _t11 = _context0.v;
          dbg('extractVoe s3 error:', _t11.message);
        case 12:
          _context0.p = 12;
          _m3 = html.match(/https?:\/\/[^\s'"<>]+?\.m3u8[^\s'"<>]*/);
          if (!_m3) {
            _context0.n = 13;
            break;
          }
          dbg('extractVoe s4 (bare m3u8) OK:', _m3[0].slice(0, 80));
          return _context0.a(2, {
            url: _m3[0],
            quality: 'Auto',
            type: 'm3u8'
          });
        case 13:
          _context0.n = 15;
          break;
        case 14:
          _context0.p = 14;
          _t12 = _context0.v;
          dbg('extractVoe s4 error:', _t12.message);
        case 15:
          dbg('extractVoe: all strategies failed for', url);
          return _context0.a(2, null);
      }
    }, _callee0, null, [[12, 14], [9, 11], [6, 8], [3, 5], [0, 2]]);
  }));
  return _extractVoe.apply(this, arguments);
}
function extractDoodstream(_x12) {
  return _extractDoodstream.apply(this, arguments);
}
function _extractDoodstream() {
  _extractDoodstream = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1(url) {
    var html, origin, m, passUrl, token, base, rand, finalUrl, _t13;
    return _regenerator().w(function (_context1) {
      while (1) switch (_context1.p = _context1.n) {
        case 0:
          _context1.p = 0;
          _context1.n = 1;
          return fetchText(url, {
            headers: {
              'Referer': url
            }
          });
        case 1:
          html = _context1.v;
          origin = (url.match(/https?:\/\/[^/]+/) || ['https://dood.li'])[0];
          m = html.match(/\$\.get\('(\/pass_md5\/[^']+)'/);
          if (m) {
            _context1.n = 2;
            break;
          }
          dbg('extractDoodstream: pass_md5 not found');
          return _context1.a(2, null);
        case 2:
          passUrl = origin + m[1];
          token = m[1].split('/').pop();
          _context1.n = 3;
          return fetchText(passUrl, {
            headers: {
              'Referer': url
            }
          });
        case 3:
          base = _context1.v;
          rand = Math.random().toString(36).slice(2, 12);
          finalUrl = "".concat(base).concat(rand, "?token=").concat(token, "&expiry=").concat(Date.now());
          dbg('extractDoodstream OK:', finalUrl.slice(0, 80));
          return _context1.a(2, {
            url: finalUrl,
            quality: 'Auto',
            type: 'mp4'
          });
        case 4:
          _context1.p = 4;
          _t13 = _context1.v;
          dbg('extractDoodstream error:', _t13.message);
          return _context1.a(2, null);
      }
    }, _callee1, null, [[0, 4]]);
  }));
  return _extractDoodstream.apply(this, arguments);
}
function extractVidoza(_x13) {
  return _extractVidoza.apply(this, arguments);
}
function _extractVidoza() {
  _extractVidoza = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee10(url) {
    var html, m, _t14;
    return _regenerator().w(function (_context10) {
      while (1) switch (_context10.p = _context10.n) {
        case 0:
          _context10.p = 0;
          _context10.n = 1;
          return fetchText(url, {
            headers: {
              'Referer': url
            }
          });
        case 1:
          html = _context10.v;
          m = html.match(/sourcesCode:\s*\[\{src:\s*"([^"]+)"/) || html.match(/src:\s*"([^"]+\.mp4[^"]*)"/);
          if (m) {
            _context10.n = 2;
            break;
          }
          dbg('extractVidoza: src pattern not found');
          return _context10.a(2, null);
        case 2:
          dbg('extractVidoza OK:', m[1].slice(0, 80));
          return _context10.a(2, {
            url: m[1],
            quality: 'Auto',
            type: 'mp4'
          });
        case 3:
          _context10.p = 3;
          _t14 = _context10.v;
          dbg('extractVidoza error:', _t14.message);
          return _context10.a(2, null);
      }
    }, _callee10, null, [[0, 3]]);
  }));
  return _extractVidoza.apply(this, arguments);
}
function extractStreamtape(_x14) {
  return _extractStreamtape.apply(this, arguments);
}
/**
 * Vidmoly — file:'.m3u8' inside script tags.
 */
function _extractStreamtape() {
  _extractStreamtape = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee11(url) {
    var html, m, link, _t15;
    return _regenerator().w(function (_context11) {
      while (1) switch (_context11.p = _context11.n) {
        case 0:
          _context11.p = 0;
          _context11.n = 1;
          return fetchText(url, {
            headers: {
              'Referer': url
            }
          });
        case 1:
          html = _context11.v;
          m = html.match(/robotlink'\)\.innerHTML = ([^]+?)\+\s*\('([^']+)'\)/);
          if (m) {
            _context11.n = 2;
            break;
          }
          dbg('extractStreamtape: robotlink pattern not found');
          return _context11.a(2, null);
        case 2:
          link = m[1].replace(/[\s'"]/g, '') + m[2].substring(3);
          if (!link.startsWith('http')) link = 'https:' + link;
          dbg('extractStreamtape OK:', link.slice(0, 80));
          return _context11.a(2, {
            url: link,
            quality: 'Auto',
            type: 'mp4'
          });
        case 3:
          _context11.p = 3;
          _t15 = _context11.v;
          dbg('extractStreamtape error:', _t15.message);
          return _context11.a(2, null);
      }
    }, _callee11, null, [[0, 3]]);
  }));
  return _extractStreamtape.apply(this, arguments);
}
function extractVidmoly(_x15) {
  return _extractVidmoly.apply(this, arguments);
}
/**
 * Filemoon — bare m3u8 fallback (packed JS, can't eval server-side).
 */
function _extractVidmoly() {
  _extractVidmoly = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee12(url) {
    var html, scripts, re, m, combined, fm, _t16;
    return _regenerator().w(function (_context12) {
      while (1) switch (_context12.p = _context12.n) {
        case 0:
          _context12.p = 0;
          _context12.n = 1;
          return fetchText(url, {
            headers: {
              'Referer': 'https://vidmoly.biz'
            }
          });
        case 1:
          html = _context12.v;
          scripts = [];
          re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
          while ((m = re.exec(html)) !== null) scripts.push(m[1]);
          combined = scripts.join('\n');
          fm = combined.match(/file\s*:\s*['"]([^'"]+?\.m3u8[^'"]*)['"]/);
          if (fm) {
            _context12.n = 2;
            break;
          }
          dbg('extractVidmoly: file pattern not found');
          return _context12.a(2, null);
        case 2:
          dbg('extractVidmoly OK:', fm[1].slice(0, 80));
          return _context12.a(2, {
            url: fm[1],
            quality: 'Auto',
            type: 'm3u8'
          });
        case 3:
          _context12.p = 3;
          _t16 = _context12.v;
          dbg('extractVidmoly error:', _t16.message);
          return _context12.a(2, null);
      }
    }, _callee12, null, [[0, 3]]);
  }));
  return _extractVidmoly.apply(this, arguments);
}
function extractFilemoon(_x16) {
  return _extractFilemoon.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Hoster dispatch                                                     */
/* ------------------------------------------------------------------ */
function _extractFilemoon() {
  _extractFilemoon = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee13(url) {
    var html, m, _t17;
    return _regenerator().w(function (_context13) {
      while (1) switch (_context13.p = _context13.n) {
        case 0:
          _context13.p = 0;
          _context13.n = 1;
          return fetchText(url, {
            headers: {
              'Referer': url
            }
          });
        case 1:
          html = _context13.v;
          m = html.match(/https?:\/\/[^\s'"<>]+?\.m3u8[^\s'"<>]*/);
          if (m) {
            _context13.n = 2;
            break;
          }
          dbg('extractFilemoon: no m3u8 found');
          return _context13.a(2, null);
        case 2:
          dbg('extractFilemoon OK:', m[0].slice(0, 80));
          return _context13.a(2, {
            url: m[0],
            quality: 'Auto',
            type: 'm3u8'
          });
        case 3:
          _context13.p = 3;
          _t17 = _context13.v;
          dbg('extractFilemoon error:', _t17.message);
          return _context13.a(2, null);
      }
    }, _callee13, null, [[0, 3]]);
  }));
  return _extractFilemoon.apply(this, arguments);
}
function resolveHoster(_x17, _x18) {
  return _resolveHoster.apply(this, arguments);
}
/* ------------------------------------------------------------------ */
/*  Nuvio interface                                                     */
/* ------------------------------------------------------------------ */
function _resolveHoster() {
  _resolveHoster = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee14(hosterName, redirectUrl) {
    var finalUrl, nameL, hostL, hit;
    return _regenerator().w(function (_context14) {
      while (1) switch (_context14.n) {
        case 0:
          _context14.n = 1;
          return resolveRedirect(redirectUrl);
        case 1:
          finalUrl = _context14.v;
          nameL = (hosterName || '').toLowerCase();
          hostL = '';
          try {
            hostL = new URL(finalUrl).hostname.toLowerCase();
          } catch (_) {}
          dbg('resolveHoster:', hosterName, '| host:', hostL);
          hit = function hit(kw) {
            return nameL.includes(kw) || hostL.includes(kw);
          };
          if (!hit('voe')) {
            _context14.n = 2;
            break;
          }
          return _context14.a(2, extractVoe(finalUrl));
        case 2:
          if (!hit('dood')) {
            _context14.n = 3;
            break;
          }
          return _context14.a(2, extractDoodstream(finalUrl));
        case 3:
          if (!hit('vidmoly')) {
            _context14.n = 4;
            break;
          }
          return _context14.a(2, extractVidmoly(finalUrl));
        case 4:
          if (!hit('vidoza')) {
            _context14.n = 5;
            break;
          }
          return _context14.a(2, extractVidoza(finalUrl));
        case 5:
          if (!hit('filemoon')) {
            _context14.n = 6;
            break;
          }
          return _context14.a(2, extractFilemoon(finalUrl));
        case 6:
          if (!hit('streamtape')) {
            _context14.n = 7;
            break;
          }
          return _context14.a(2, extractStreamtape(finalUrl));
        case 7:
          dbg('resolveHoster: unsupported hoster, skipping:', hosterName, '/', hostL);
          return _context14.a(2, null);
      }
    }, _callee14);
  }));
  return _resolveHoster.apply(this, arguments);
}
function getStreams(_x19) {
  return _getStreams.apply(this, arguments);
}
function _getStreams() {
  _getStreams = _asyncToGenerator(function (tmdbId) {
    var mediaType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'tv';
    var season = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
    var episode = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1;
    return /*#__PURE__*/_regenerator().m(function _callee16() {
      var titles, seriesUrl, episodeUrl, hosters, settled, streams, _t19;
      return _regenerator().w(function (_context16) {
        while (1) switch (_context16.p = _context16.n) {
          case 0:
            dbg('getStreams:', {
              tmdbId: tmdbId,
              mediaType: mediaType,
              season: season,
              episode: episode
            });
            _context16.p = 1;
            _context16.n = 2;
            return getTmdbTitles(tmdbId, mediaType);
          case 2:
            titles = _context16.v;
            if (titles.length) {
              _context16.n = 3;
              break;
            }
            dbg('no TMDB titles');
            return _context16.a(2, []);
          case 3:
            _context16.n = 4;
            return findSeriesUrl(titles);
          case 4:
            seriesUrl = _context16.v;
            if (seriesUrl) {
              _context16.n = 5;
              break;
            }
            dbg('series not found on aniworld');
            return _context16.a(2, []);
          case 5:
            _context16.n = 6;
            return findEpisodeUrl(seriesUrl, mediaType, season, episode);
          case 6:
            episodeUrl = _context16.v;
            if (episodeUrl) {
              _context16.n = 7;
              break;
            }
            dbg('episode URL not found');
            return _context16.a(2, []);
          case 7:
            _context16.n = 8;
            return collectHosterLinks(episodeUrl);
          case 8:
            hosters = _context16.v;
            if (hosters.length) {
              _context16.n = 9;
              break;
            }
            dbg('no hosters on episode page');
            return _context16.a(2, []);
          case 9:
            _context16.n = 10;
            return Promise.all(hosters.map(/*#__PURE__*/function () {
              var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee15(h) {
                var resolved, _t18;
                return _regenerator().w(function (_context15) {
                  while (1) switch (_context15.p = _context15.n) {
                    case 0:
                      _context15.p = 0;
                      _context15.n = 1;
                      return resolveHoster(h.hosterName, h.redirectPath);
                    case 1:
                      resolved = _context15.v;
                      if (resolved) {
                        _context15.n = 2;
                        break;
                      }
                      return _context15.a(2, null);
                    case 2:
                      return _context15.a(2, {
                        name: "Aniworld [".concat(h.hosterName, "]").concat(h.lang ? " (".concat(h.lang, ")") : ''),
                        title: h.hosterName,
                        url: resolved.url,
                        quality: resolved.quality || 'Auto',
                        type: resolved.type || 'mp4'
                      });
                    case 3:
                      _context15.p = 3;
                      _t18 = _context15.v;
                      dbg('hoster error for', h.hosterName, ':', _t18.message);
                      return _context15.a(2, null);
                  }
                }, _callee15, null, [[0, 3]]);
              }));
              return function (_x20) {
                return _ref.apply(this, arguments);
              };
            }()));
          case 10:
            settled = _context16.v;
            streams = settled.filter(Boolean);
            dbg('returning', streams.length, 'streams');
            return _context16.a(2, streams);
          case 11:
            _context16.p = 11;
            _t19 = _context16.v;
            dbg('getStreams top-level error:', _t19.message);
            return _context16.a(2, []);
        }
      }, _callee16, null, [[1, 11]]);
    })();
  });
  return _getStreams.apply(this, arguments);
}
module.exports = {
  getStreams: getStreams
};
