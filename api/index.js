var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
import { createHash } from "node:crypto";
function randomCnIp() {
  const a = CN_IP_A[Math.floor(Math.random() * CN_IP_A.length)];
  const b = 1 + Math.floor(Math.random() * 254);
  const c = 1 + Math.floor(Math.random() * 254);
  const d = 1 + Math.floor(Math.random() * 254);
  return `${a}.${b}.${c}.${d}`;
}
function withOsPcCookie(cookie) {
  if (!cookie) return "os=pc; appver=3.1.29.205117";
  if (/(?:^|;\s*)os=/.test(cookie)) return cookie;
  return `${cookie}; os=pc; appver=3.1.29.205117`;
}
function bootstrapBase() {
  const raw2 = process.env.MC_QQ_PYQ_BOOTSTRAP ?? "https://music.90svip.cn/";
  const trimmed = raw2.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}
function apiSecret(coreMarker) {
  const explicit = process.env.MC_API_SECRET;
  if (explicit) return explicit;
  return createHash("sha256").update(`${coreMarker}|ryanmusic-api`).digest("hex");
}
var VERSION, UA, NETEASE_UA, CN_IP_A;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    VERSION = "1.8.60";
    UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    NETEASE_UA = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.29.205117";
    CN_IP_A = [36, 58, 111, 112, 114, 117, 120, 123, 183, 218, 223];
  }
});

// src/http.ts
var http_exports = {};
__export(http_exports, {
  followLocation: () => followLocation,
  request: () => request,
  requestBuffer: () => requestBuffer,
  resolveHost: () => resolveHost
});
function ipToInt(ip2) {
  const p = ip2.split(".").map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return 0;
  return (p[0] << 24 >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] >>> 0;
}
function isFakeIp(ip2) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip2)) return false;
  return (ipToInt(ip2) & FAKE_IP_MASK) === FAKE_IP_NET;
}
async function dohResolve(host) {
  const endpoints = [
    `https://dns.alidns.com/resolve?name=${encodeURIComponent(host)}&type=A`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json", "User-Agent": "RyanMusic/1.0" },
        signal: AbortSignal.timeout(4e3)
      });
      const json = await res.json();
      for (const ans of json.Answer || []) {
        if (ans.type === 1 && ans.data && !isFakeIp(ans.data)) return ans.data;
      }
    } catch {
    }
  }
  return null;
}
async function resolveHost(host) {
  const key = host.toLowerCase();
  if (hostCache.has(key)) return hostCache.get(key) || null;
  const ip2 = await dohResolve(key);
  hostCache.set(key, ip2);
  return ip2;
}
function parseSetCookies(headers) {
  const getSetCookie = headers.getSetCookie;
  const lines = typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
  const map = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const pair = line.split(";")[0]?.trim() || "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (v === "" && map.has(k) && map.get(k).slice(k.length + 1) !== "") continue;
    map.set(k, `${k}=${v}`);
  }
  return [...map.values()].join("; ");
}
async function request(method, url, options = {}) {
  const headers = {
    "User-Agent": UA,
    ...options.headers || {}
  };
  let body;
  if (method === "POST" && options.body != null) {
    if (typeof options.body === "string") {
      body = options.body;
      if (body.startsWith("{") && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      } else if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
    } else if (options.body instanceof URLSearchParams) {
      body = options.body.toString();
      headers["Content-Type"] = headers["Content-Type"] || "application/x-www-form-urlencoded";
    } else {
      body = new URLSearchParams(
        Object.entries(options.body).map(([k, v]) => [k, String(v)])
      ).toString();
      headers["Content-Type"] = headers["Content-Type"] || "application/x-www-form-urlencoded";
    }
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      redirect: options.redirect || "manual",
      signal: AbortSignal.timeout(options.timeoutMs || 2e4)
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      const m = text.trim().match(/^\w+\((.*)\);?\s*$/s);
      if (m) {
        try {
          json = JSON.parse(m[1]);
        } catch {
          json = null;
        }
      }
    }
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      body: text,
      json,
      cookies: parseSetCookies(res.headers),
      headers: res.headers,
      error: ""
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: "",
      json: null,
      cookies: "",
      headers: new Headers(),
      error: err instanceof Error ? err.message : "request failed"
    };
  }
}
async function requestBuffer(url, options = {}) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: options.headers,
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs || 25e3)
    });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body, cookies: parseSetCookies(res.headers) };
  } catch {
    return null;
  }
}
async function followLocation(url, referer) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": UA, Referer: referer },
      signal: AbortSignal.timeout(2e4)
    });
    const loc = res.headers.get("location");
    if (loc) return new URL(loc, url).toString();
    const text = await res.text();
    const code = text.match(/[?&]code=([^&\s'"]+)/);
    if (code) return `${url}${url.includes("?") ? "&" : "?"}code=${code[1]}`;
    return null;
  } catch {
    return null;
  }
}
var FAKE_IP_MASK, FAKE_IP_NET, hostCache;
var init_http = __esm({
  "src/http.ts"() {
    "use strict";
    init_config();
    FAKE_IP_MASK = 4294836224;
    FAKE_IP_NET = ipToInt("198.18.0.0") & FAKE_IP_MASK;
    hostCache = /* @__PURE__ */ new Map();
  }
});

// src/sign.ts
var sign_exports = {};
__export(sign_exports, {
  proxyUrl: () => proxyUrl,
  sign: () => sign,
  verifySign: () => verifySign
});
import { createHmac, timingSafeEqual } from "node:crypto";
function sign(secret, get, type, id, t) {
  const payload = `${get}|${type}|${id}|${t}`;
  const raw2 = createHmac("sha256", secret).update(payload).digest();
  return raw2.toString("base64").replace(/\+/g, ".").replace(/\//g, "_").replace(/=/g, "-").slice(0, 13);
}
function verifySign(secret, get, type, id, t, given) {
  if (!given || !t) return false;
  if (Math.abs(Date.now() / 1e3 - Number(t)) > 86400) return false;
  const expected = sign(secret, get, type, id, t);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
function proxyUrl(secret, get, type, id) {
  const t = String(Math.floor(Date.now() / 1e3));
  const params = new URLSearchParams({
    get,
    type,
    id,
    sign: sign(secret, get, type, id, t),
    t
  });
  return `api.php?${params.toString()}`;
}
var init_sign = __esm({
  "src/sign.ts"() {
    "use strict";
  }
});

// src/vercel.ts
import { join as join7 } from "node:path";

// src/app.ts
import { createReadStream, existsSync as existsSync4, statSync } from "node:fs";
import { join as join6, normalize, extname } from "node:path";
import { Readable } from "node:stream";

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/hono/dist/utils/body.js
var isRawRequest = (request2) => "headers" in request2;
var parseBody = async (request2, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request2) ? request2.headers : request2.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request2, { all, dot });
  }
  return {};
};
async function parseFormData(request2, options) {
  if (!isRawRequest(request2) && request2.bodyCache.formData) {
    return convertFormDataToBodyData(
      await request2.bodyCache.formData,
      options
    );
  }
  const headers = isRawRequest(request2) ? request2.headers : request2.raw.headers;
  const arrayBuffer = await request2.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request2)) {
    request2.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request2) => {
  const url = request2.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request2) => {
  const result = getPath(request2);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request2, path = "/", matchResult = [[]]) {
    this.raw = request2;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    ;
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers();
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request2) => request2;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request2) => {
        const url = new URL(request2.url);
        url.pathname = this.getPath(request2).slice(pathPrefixLength) || "/";
        return new Request(url, request2);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request2, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request2, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request2, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request2, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request2, ...rest) => {
    return this.#dispatch(request2, rest[1], rest[0], request2.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  // handler index of a dynamic path, or -1 for a static path terminal
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if (
                // a single-char pattern coexists with single-char literals as a literal does
                (regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
              ) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  // dynamic path -> [handler index, param assoc]; static paths are not registered
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (; paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length; i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length; k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  node.#params,
                  params
                );
              }
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/accounts/netease.ts
import { join as join2 } from "node:path";

// src/crypto/netease.ts
init_config();
init_http();
import { createCipheriv, createHash as createHash2, randomInt } from "node:crypto";
var LINUX_KEY = Buffer.from("7246674226682325323F5E6544673A51", "hex");
var WEAPI_PRESET = "0CoJUm6Qyw8W8jud";
var WEAPI_IV = Buffer.from("0102030405060708");
var EAPI_KEY = Buffer.from("e82ckenh8dichen8");
var BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var RSA_N = BigInt(
  "0x00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7"
);
var RSA_E = BigInt("0x010001");
function modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = result * b % mod;
    b = b * b % mod;
    e >>= 1n;
  }
  return result;
}
function aesEcb(key, data) {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  const input = typeof data === "string" ? Buffer.from(data) : data;
  return Buffer.concat([cipher.update(input), cipher.final()]);
}
function aesCbc(text, key) {
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(key), WEAPI_IV);
  return Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
}
function encodeLinuxData(data) {
  const json = JSON.stringify(data);
  const raw2 = aesEcb(LINUX_KEY, json);
  return { eparams: raw2.toString("hex").toUpperCase() };
}
function rsaEncrypt(secretKey) {
  const reversed = Buffer.from(secretKey, "utf8").reverse();
  const padded = Buffer.concat([Buffer.alloc(128 - reversed.length), reversed]);
  const m = BigInt("0x" + padded.toString("hex"));
  const c = modPow(m, RSA_E, RSA_N);
  return c.toString(16).padStart(256, "0");
}
function weapiEncode(object) {
  let secretKey = "";
  for (let i = 0; i < 16; i++) secretKey += BASE62[randomInt(0, 62)];
  const text = JSON.stringify(object);
  const params = aesCbc(aesCbc(text, WEAPI_PRESET).toString("base64"), secretKey).toString("base64");
  return { params, encSecKey: rsaEncrypt(secretKey) };
}
function eapiEncode(apiPath, object) {
  const text = JSON.stringify(object);
  const digest = createHash2("md5").update(`nobody${apiPath}use${text}md5forencrypt`).digest("hex");
  const payload = `${apiPath}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return { params: aesEcb(EAPI_KEY, payload).toString("hex").toUpperCase() };
}
function cookieCsrf(cookie) {
  const m = cookie.match(/(?:^|;\s*)(?:__csrf|MUSIC_CSRF)=([^;]+)/);
  return m ? m[1].trim() : "";
}
function mergeCookies(existing, incoming) {
  const map = /* @__PURE__ */ new Map();
  for (const part of `${existing};${incoming}`.split(";")) {
    const item = part.trim();
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    map.set(item.slice(0, eq).trim(), item);
  }
  return [...map.values()].join("; ");
}
function cookieMap(headers, cookie) {
  const headersOut = { ...headers };
  if (cookie) headersOut.Cookie = cookie;
  return headersOut;
}
async function neteaseHttp(method, url, body, cookie = "", extraHeaders = {}) {
  const cnIp = randomCnIp();
  const headers = {
    "User-Agent": extraHeaders["User-Agent"] || NETEASE_UA,
    Referer: "https://music.163.com/",
    Origin: "https://music.163.com",
    "X-Real-IP": cnIp,
    "X-Forwarded-For": cnIp,
    ...extraHeaders
  };
  return request(method, url, {
    headers: cookieMap(headers, cookie ? withOsPcCookie(cookie) : cookie),
    body,
    redirect: "manual"
  });
}
async function linuxForward(apiPath, params, cookie = "", method = "POST") {
  const encoded = encodeLinuxData({
    method,
    url: `https://music.163.com${apiPath}`,
    params
  });
  return neteaseHttp("POST", "https://music.163.com/api/linux/forward", encoded, cookie);
}
async function neteaseApi(apiPath, params = {}, cookie = "", method = "GET") {
  if (method === "GET") {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
    ).toString();
    const url = `https://music.163.com${apiPath}${qs ? `?${qs}` : ""}`;
    const res = await neteaseHttp("GET", url, void 0, cookie);
    if (res.ok && res.json) return res;
  } else {
    const body = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
    );
    const res = await neteaseHttp("POST", `https://music.163.com${apiPath}`, body, cookie);
    if (res.ok && res.json) return res;
  }
  return linuxForward(apiPath, params, cookie, method);
}
async function weapiRequest(path, data, cookie = "") {
  const encoded = weapiEncode(data);
  const csrf = cookieCsrf(cookie);
  const url = `https://music.163.com${path}${path.includes("?") ? "&" : "?"}csrf_token=${encodeURIComponent(csrf)}`;
  return neteaseHttp("POST", url, encoded, cookie);
}
function eapiClientHeader(cookie) {
  const now = String(Math.floor(Date.now() / 1e3));
  const header = {
    osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
    deviceId: `p${createHash2("md5").update(now + String(randomInt(0, 999999))).digest("hex").slice(0, 15)}`,
    os: "pc",
    appver: "3.1.17.204416",
    versioncode: "140",
    mobilename: "",
    buildver: now.slice(0, 10),
    resolution: "1920x1080",
    __csrf: cookieCsrf(cookie),
    channel: "netease",
    requestId: `${now}_${String(randomInt(0, 9999)).padStart(4, "0")}`
  };
  const m = cookie.match(/(?:^|;\s*)MUSIC_U=([^;]+)/);
  if (m) header.MUSIC_U = m[1].trim();
  return header;
}
async function eapiRequest(apiPath, data, cookie = "") {
  const header = eapiClientHeader(cookie);
  const payload = { ...data, header, e_r: data.e_r ?? false };
  const encoded = eapiEncode(apiPath, payload);
  const eapiSuffix = `/eapi/${apiPath.replace(/^\/api\//, "")}`;
  const hosts = [
    "https://interfacepc.music.163.com",
    "https://interface.music.163.com",
    "https://music.163.com"
  ];
  const cookieParts = Object.entries(header).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  if (cookie) cookieParts.push(withOsPcCookie(cookie));
  const cnIp = randomCnIp();
  let last = {
    ok: false,
    status: 0,
    body: "",
    json: null,
    cookies: "",
    headers: new Headers(),
    error: "eapi \u5168\u90E8\u5931\u8D25"
  };
  for (const host of hosts) {
    last = await request("POST", host + eapiSuffix, {
      headers: {
        "User-Agent": NETEASE_UA,
        Referer: "https://music.163.com/",
        Origin: "https://music.163.com",
        Cookie: cookieParts.join("; "),
        "X-Real-IP": cnIp,
        "X-Forwarded-For": cnIp
      },
      body: encoded
    });
    if (last.ok && last.json) return last;
  }
  return last;
}

// src/accounts/session.ts
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}
function removeFile(path) {
  try {
    unlinkSync(path);
  } catch {
  }
}
function cookieGet(cookie, key) {
  const map = cookieToMap(cookie);
  return map[key] || "";
}
function cookieToMap(cookie) {
  const map = {};
  for (const part of cookie.split(";")) {
    const item = part.trim();
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    map[item.slice(0, eq).trim()] = item.slice(eq + 1).trim();
  }
  return map;
}
function mergeCookies2(existing, incoming) {
  const map = cookieToMap(existing);
  const extra = cookieToMap(incoming);
  for (const [k, v] of Object.entries(extra)) {
    if (v === "" && map[k]) continue;
    map[k] = v;
  }
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join("; ");
}
function normalizeCookie(raw2) {
  return raw2.replace(/\r?\n/g, ";").replace(/;;+/g, ";").trim();
}
function hash33(text) {
  let e = 0;
  for (let n = 0; n < text.length; n++) {
    e += (e << 5) + text.charCodeAt(n);
  }
  return e & 2147483647;
}
function getGtk(pSkey) {
  let hash = 5381;
  for (let i = 0; i < pSkey.length; i++) {
    hash += (hash << 5) + pSkey.charCodeAt(i);
  }
  return hash & 2147483647;
}
function qqGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16 | 0;
    const value = char === "x" ? rand : rand & 3 | 8;
    return value.toString(16);
  }).toUpperCase();
}

// src/accounts/netease.ts
var NeteaseAccount = class {
  constructor(cache, netease) {
    this.netease = netease;
    this.file = join2(cache.dir("netease_auth"), "session.json");
  }
  file;
  read() {
    return readJson(this.file);
  }
  write(data) {
    writeJson(this.file, { ...data, updatedAt: Math.floor(Date.now() / 1e3) });
  }
  status() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    return {
      loggedIn: true,
      uid: auth.uid,
      nickname: auth.nickname,
      avatar: auth.avatar,
      vip: auth.vip ?? 0,
      updatedAt: auth.updatedAt || 0
    };
  }
  sessionCookie() {
    return this.read()?.cookie ?? null;
  }
  logout() {
    removeFile(this.file);
    return { ok: true };
  }
  async handle(action, post) {
    switch (action) {
      case "netease_status":
        return ok(this.status());
      case "netease_logout":
        return ok(this.logout());
      case "netease_cookie_save":
        return this.cookieSave(post.cookie || "");
      case "netease_qr_key":
        return this.qrKey();
      case "netease_qr_check":
        return this.qrCheck(post.key || "");
      case "netease_playlists":
        return this.playlists();
      case "netease_likelist":
        return this.likelist(post);
      case "netease_like":
        return this.likeSong(post);
      case "netease_like_check":
        return this.likeCheck(post);
      case "netease_playlist_detail":
        return this.playlistDetail(post);
      case "netease_songs_by_ids":
        return this.songsByIds(post.ids || "");
      default:
        return fail(400, "\u672A\u77E5\u64CD\u4F5C");
    }
  }
  async accountGet(cookie) {
    let res = await neteaseApi("/api/nuser/account/get", {}, cookie, "POST");
    if (!res.json) res = await neteaseApi("/api/w/nuser/account/get", {}, cookie, "POST");
    if (!res.json) return null;
    const profile = res.json.profile;
    const account = res.json.account;
    const uid = Number(profile?.userId || account?.id || 0);
    if (uid <= 0) return null;
    return {
      uid,
      nickname: String(profile?.nickname || ""),
      avatar: String(profile?.avatarUrl || ""),
      vip: Number(profile?.vipType ?? account?.vipType ?? 0)
    };
  }
  async cookieSave(raw2) {
    const cookie = normalizeCookie(raw2);
    if (!cookie || !/MUSIC_U=/.test(cookie)) return fail(400, "\u8BF7\u7C98\u8D34\u5305\u542B MUSIC_U \u7684 Cookie");
    const account = await this.accountGet(cookie);
    if (!account) return fail(401, "Cookie \u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u4ECE\u6D4F\u89C8\u5668\u590D\u5236");
    this.write({ cookie, csrf: cookieCsrf(cookie), ...account });
    return ok(this.status());
  }
  async qrKey() {
    let unikey = "";
    let via = "";
    let res = await eapiRequest("/api/login/qrcode/unikey", { type: 3 }, "");
    unikey = String(res.json?.unikey || "");
    if (unikey) via = "eapi";
    if (!unikey) {
      res = await weapiRequest("/weapi/login/qrcode/unikey", { type: 3 }, "");
      unikey = String(res.json?.unikey || "");
      if (unikey) via = "weapi-t3";
    }
    if (!unikey) {
      res = await neteaseApi("/api/login/qrcode/unikey", { type: 3 }, "", "POST");
      unikey = String(res.json?.unikey || "");
      if (unikey) via = "api-t3";
    }
    if (!unikey) return fail(502, "\u65E0\u6CD5\u83B7\u53D6\u4E8C\u7EF4\u7801\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u6539\u7528 Cookie");
    return ok({
      key: unikey,
      qrurl: `https://music.163.com/login?codekey=${encodeURIComponent(unikey)}`,
      via
    });
  }
  extractLoginCookie(res) {
    let cookie = res.cookies || "";
    const bodyCookie = res.json?.cookie;
    if (typeof bodyCookie === "string") cookie = mergeCookies(cookie, bodyCookie);
    if (Array.isArray(bodyCookie)) cookie = mergeCookies(cookie, bodyCookie.join("; "));
    return cookie;
  }
  async qrCheck(key) {
    if (!key) return fail(400, "\u7F3A\u5C11\u4E8C\u7EF4\u7801 key");
    const params = { type: 3, key };
    let res = await eapiRequest("/api/login/qrcode/client/login", params, "");
    let via = "eapi";
    let code = Number(res.json?.code || 0);
    if (!res.json || code === 0) {
      res = await weapiRequest("/weapi/login/qrcode/client/login", params, "");
      via = "weapi-t3";
      code = Number(res.json?.code || 0);
    }
    const payload = {
      status: code,
      message: String(res.json?.message || ""),
      via
    };
    if (code !== 803) return ok(payload);
    let cookie = this.extractLoginCookie(res);
    if (!/MUSIC_U=/.test(cookie)) {
      const retry = await eapiRequest("/api/login/qrcode/client/login", params, "");
      cookie = mergeCookies(cookie, this.extractLoginCookie(retry));
    }
    if (!/MUSIC_U=/.test(cookie)) {
      return { code: 502, error: "\u626B\u7801\u6210\u529F\u4F46\u672A\u62FF\u5230 Cookie\uFF0C\u8BF7\u6539\u7528 Cookie \u767B\u5F55", data: { ...payload, loggedIn: false } };
    }
    const account = await this.accountGet(cookie);
    if (!account) {
      return { code: 502, error: "\u767B\u5F55\u6001\u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u6539\u7528 Cookie", data: { ...payload, loggedIn: false } };
    }
    this.write({ cookie, csrf: cookieCsrf(cookie), ...account });
    return ok({ ...payload, loggedIn: true, ...account });
  }
  requireAuth() {
    const auth = this.read();
    if (!auth) return null;
    return auth;
  }
  async playlists() {
    const auth = this.requireAuth();
    if (!auth) return fail(401, "\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91");
    const res = await neteaseApi(
      "/api/user/playlist",
      { uid: auth.uid, limit: 1e3, offset: 0 },
      auth.cookie,
      "POST"
    );
    const list = res.json?.playlist;
    if (!Array.isArray(list)) return fail(502, "\u62C9\u53D6\u6B4C\u5355\u5931\u8D25");
    return ok({
      playlists: list.map((pl) => ({
        id: String(pl.id || ""),
        name: String(pl.name || "\u672A\u547D\u540D\u6B4C\u5355"),
        cover: String(pl.coverImgUrl || ""),
        trackCount: Number(pl.trackCount || 0),
        specialType: Number(pl.specialType || 0),
        subscribed: Boolean(pl.subscribed)
      }))
    });
  }
  pageParams(post) {
    const offset = Math.max(0, Number(post.offset || 0));
    let limit = Number(post.limit || 10);
    if (limit <= 0) limit = 10;
    if (limit > 200) limit = 200;
    return [offset, limit];
  }
  async playlistPage(playlistId, cookie, offset, limit) {
    const res = await neteaseApi(
      "/api/v6/playlist/detail",
      { id: playlistId, n: 0, s: 0 },
      cookie,
      "POST"
    );
    const playlist = res.json?.playlist || {};
    const ids = Array.isArray(playlist.trackIds) ? playlist.trackIds.map((t) => Number(t.id)).filter(Boolean) : [];
    const pageIds = ids.slice(offset, offset + limit);
    const tracks = await this.netease.songsByIdsV3(pageIds, cookie);
    return {
      id: String(playlistId),
      name: String(playlist.name || ""),
      total: ids.length || Number(playlist.trackCount || 0),
      trackIds: ids.map(String),
      tracks
    };
  }
  async likeSong(post) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, "\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91");
    const id = String(post.id || "").replace(/\D/g, "");
    if (!id) return fail(400, "\u6B4C\u66F2 ID \u65E0\u6548");
    const like = post.like !== "0" && post.like !== "false";
    const res = await weapiRequest(
      `/weapi/radio/like?alg=itembased&trackId=${id}&like=${like}&time=25`,
      {
        trackId: id,
        like,
        csrf_token: cookieCsrf(auth.cookie) || auth.csrf || ""
      },
      auth.cookie
    );
    const code = Number(res.json?.code ?? 0);
    if (code !== 200) {
      return fail(502, String(res.json?.message || res.error || "\u559C\u6B22\u64CD\u4F5C\u5931\u8D25"), {
        liked: like,
        code
      });
    }
    return ok({ liked: like, id });
  }
  async likeCheck(post) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, "\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91");
    const id = Number(String(post.id || "").replace(/\D/g, ""));
    if (!id) return fail(400, "\u6B4C\u66F2 ID \u65E0\u6548");
    const res = await neteaseApi("/api/song/like/get", { uid: auth.uid }, auth.cookie, "POST");
    const ids = Array.isArray(res.json?.ids) ? res.json.ids.map(Number) : [];
    return ok({ liked: ids.includes(id), id: String(id) });
  }
  async likelist(post) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, "\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91");
    const [offset, limit] = this.pageParams(post);
    const res = await neteaseApi("/api/song/like/get", { uid: auth.uid }, auth.cookie, "POST");
    const ids = Array.isArray(res.json?.ids) ? res.json.ids.map(Number) : [];
    if (!ids.length) {
      const plRes = await neteaseApi(
        "/api/user/playlist",
        { uid: auth.uid, limit: 50, offset: 0 },
        auth.cookie,
        "POST"
      );
      let likedId = 0;
      for (const pl of plRes.json?.playlist || []) {
        if (Number(pl.specialType || 0) === 5) {
          likedId = Number(pl.id || 0);
          break;
        }
      }
      if (likedId > 0) {
        const page = await this.playlistPage(likedId, auth.cookie, offset, limit);
        return ok({
          playlistId: String(likedId),
          name: page.name || "\u6211\u559C\u6B22",
          total: page.total,
          trackIds: page.trackIds,
          tracks: page.tracks
        });
      }
      return ok({ playlistId: "", name: "\u6211\u559C\u6B22", total: 0, trackIds: [], tracks: [] });
    }
    const pageIds = ids.slice(offset, offset + limit);
    return ok({
      playlistId: "likelist",
      name: "\u6211\u559C\u6B22",
      total: ids.length,
      trackIds: ids.map(String),
      tracks: await this.netease.songsByIdsV3(pageIds, auth.cookie)
    });
  }
  async playlistDetail(post) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, "\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91");
    const id = (post.id || "").trim();
    if (!/^\d+$/.test(id)) return fail(400, "\u6B4C\u5355 ID \u65E0\u6548");
    const [offset, limit] = this.pageParams(post);
    const page = await this.playlistPage(Number(id), auth.cookie, offset, limit);
    return ok(page);
  }
  async songsByIds(raw2) {
    const auth = this.requireAuth();
    if (!auth) return fail(401, "\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91");
    if (!raw2.trim()) return ok({ tracks: [] });
    let ids = raw2.split(",").map((n) => Number(n)).filter((n) => n > 0);
    if (ids.length > 10) ids = ids.slice(0, 10);
    return ok({ tracks: await this.netease.songsByIdsV3(ids, auth.cookie) });
  }
};
function ok(data) {
  return { code: 200, error: "", data };
}
function fail(code, error, data = "") {
  return { code, error, data };
}

// src/accounts/qq.ts
init_http();
import { createHash as createHash3 } from "node:crypto";
import { join as join3 } from "node:path";
var QqAccount = class {
  constructor(cache, qq) {
    this.qq = qq;
    this.authFile = join3(cache.dir("qq_auth"), "session.json");
    this.qrFile = join3(cache.dir("qq_auth"), "qr_session.json");
  }
  authFile;
  qrFile;
  read() {
    return readJson(this.authFile);
  }
  write(data) {
    writeJson(this.authFile, { ...data, updatedAt: Math.floor(Date.now() / 1e3) });
  }
  status() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    return {
      loggedIn: true,
      uin: auth.uin,
      nickname: auth.nickname,
      vip: auth.vip ?? 0,
      updatedAt: auth.updatedAt || 0
    };
  }
  sessionCookie() {
    return this.read()?.cookie ?? null;
  }
  async handle(action, post) {
    switch (action) {
      case "qq_status":
        return ok2(await this.statusFresh());
      case "qq_logout":
        removeFile(this.authFile);
        removeFile(this.qrFile);
        return ok2({ ok: true });
      case "qq_cookie_save":
        return this.cookieSave(post.cookie || "");
      case "qq_qr_key":
        return this.qrKey();
      case "qq_qr_check":
        return this.qrCheck();
      case "qq_playlists":
        return this.playlists();
      case "qq_likelist":
        return this.likelist();
      case "qq_like":
        return this.likeSong(post);
      case "qq_like_check":
        return this.likeCheck(post);
      case "qq_playlist_detail":
        return this.playlistDetail(post.id || "");
      default:
        return fail2(400, "\u672A\u77E5\u64CD\u4F5C");
    }
  }
  extractUin(cookie) {
    const map = cookieToMap(cookie);
    const raw2 = map.uin || map.wxuin || map.qqmusic_uin || "";
    return raw2.replace(/^o/, "").replace(/^0+/, "") || raw2;
  }
  hasMusicKey(cookie) {
    const map = cookieToMap(cookie);
    return Boolean(map.qm_keyst || map.qqmusic_key);
  }
  async profileValidate(cookie, allowFallback = false) {
    const uin = this.extractUin(cookie);
    if (!uin || !this.hasMusicKey(cookie)) return null;
    const qs = new URLSearchParams({
      cid: "205360838",
      userid: uin,
      loginUin: uin,
      reqfrom: "1",
      format: "json"
    });
    const res = await request(
      "GET",
      `https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?${qs}`,
      {
        headers: {
          Cookie: cookie,
          Referer: `https://y.qq.com/portal/profile.html?uin=${encodeURIComponent(uin)}`
        }
      }
    );
    if (!res.json || Number(res.json.code) === 1e3) {
      return allowFallback ? { uin, nickname: `QQ ${uin}`, cookie } : null;
    }
    const nickname = res.json.data?.creator?.nick || res.json.data?.userinfo?.nick || `QQ ${uin}`;
    return { uin, nickname: String(nickname), cookie };
  }
  async fetchVip(uin, cookie) {
    const payload = {
      comm: { ct: 24, cv: 0, uin, format: "json" },
      req: {
        module: "userInfo.VipQueryServer",
        method: "SRFVipQuery_V2",
        param: { uin_list: [uin] }
      }
    };
    const res = await request("POST", "https://u.y.qq.com/cgi-bin/musicu.fcg", {
      headers: {
        Cookie: cookie,
        Referer: "https://y.qq.com/",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      timeoutMs: 6e3
    });
    const data = res.json?.req?.data || {};
    const info = data.info_map?.[uin] || data.infoMap?.[uin] || data;
    const current = info.cur || info;
    const value = Number(
      current.vip_flag ?? current.iVipFlag ?? current.iSuperVip ?? current.iYearVip ?? info.iVipFlag ?? 0
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  async withVip(account) {
    return { ...account, vip: await this.fetchVip(account.uin, account.cookie) };
  }
  async statusFresh() {
    const auth = this.read();
    if (!auth) return { loggedIn: false };
    if (auth.vip == null) {
      this.write({ ...auth, vip: await this.fetchVip(auth.uin, auth.cookie) });
    }
    return this.status();
  }
  async cookieSave(raw2) {
    let cookie = normalizeCookie(raw2);
    if (!cookie) return fail2(400, "\u8BF7\u7C98\u8D34 Cookie");
    const map = cookieToMap(cookie);
    if (Number(map.login_type) === 2 && map.wxuin) {
      cookie = mergeCookies2(cookie, `uin=${map.wxuin}`);
    }
    const account = await this.profileValidate(cookie);
    if (!account) return fail2(401, "Cookie \u65E0\u6548\uFF1A\u9700\u542B uin \u4E0E qm_keyst/qqmusic_key\uFF0C\u8BF7\u4ECE y.qq.com \u590D\u5236");
    this.write(await this.withVip(account));
    return ok2(this.status());
  }
  async qqGet(url, cookie = "", extra = {}) {
    const headers = {
      Referer: extra.Referer || "https://y.qq.com/",
      Cookie: cookie,
      ...extra
    };
    if (!headers.Origin && !/ptlogin2\.qq\.com/i.test(url)) {
      headers.Origin = "https://y.qq.com";
    }
    return request("GET", url, { headers, redirect: "manual" });
  }
  async qqPost(url, body, cookie = "") {
    return request("POST", url, {
      headers: {
        Referer: "https://y.qq.com/",
        Origin: "https://y.qq.com",
        Cookie: cookie
      },
      body,
      redirect: "manual"
    });
  }
  async qrKey() {
    const t = String(Math.random());
    const url = `https://ssl.ptlogin2.qq.com/ptqrshow?${new URLSearchParams({
      appid: "716027609",
      e: "2",
      l: "M",
      s: "3",
      d: "72",
      v: "4",
      t,
      daid: "383",
      pt_3rd_aid: "100497308",
      u1: "https://graph.qq.com/oauth2.0/login_jump"
    })}`;
    const buf = await (await Promise.resolve().then(() => (init_http(), http_exports))).requestBuffer(url, {
      headers: { Referer: "https://xui.ptlogin2.qq.com/" }
    });
    const qrsig = cookieGet(buf?.cookies || "", "qrsig");
    if (!buf || buf.status >= 400 || !qrsig) return fail2(502, "\u65E0\u6CD5\u83B7\u53D6 QQ \u4E8C\u7EF4\u7801\uFF0C\u8BF7\u6539\u7528 Cookie");
    const img = buf.body.toString("base64");
    const ptqrtoken = hash33(qrsig);
    writeJson(this.qrFile, { qrsig, ptqrtoken, createdAt: Date.now() / 1e3 });
    return ok2({
      qrimg: `data:image/png;base64,${img}`,
      token: createHash3("sha256").update(qrsig).digest("hex").slice(0, 16)
    });
  }
  parsePtui(body) {
    const m = body.match(/ptuiCB\s*\(\s*['"](\d+)['"]/);
    if (!m) return null;
    const code = Number(m[1]);
    let checkUrl = "";
    if (code === 0) {
      const um = body.match(
        /ptuiCB\s*\(\s*['"]0['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/
      );
      checkUrl = um ? unescapeRedirect(um[1]) : "";
    }
    return { code, checkUrl };
  }
  headerLocation(headers) {
    return headers.get("location") || "";
  }
  async followCollect(url, cookie, maxHops = 10, referer = "https://xui.ptlogin2.qq.com/") {
    let hops = 0;
    let last = null;
    for (let i = 0; i < maxHops; i++) {
      if (!url) break;
      const res = await this.qqGet(url, cookie, { Referer: referer });
      hops++;
      cookie = mergeCookies2(cookie, res.cookies);
      last = res;
      let loc = this.headerLocation(res.headers);
      if (!loc && res.body) {
        const href = res.body.match(/(?:location\.href|window\.location)\s*=\s*["']([^"']+)["']/i);
        if (href) loc = href[1];
      }
      if (!loc) break;
      referer = url;
      url = new URL(unescapeRedirect(loc), url).toString();
    }
    return { cookie, last, hops };
  }
  extractOauthCode(headers, body, loc = "") {
    const hay = `${loc}
${[...headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n")}
${body}`;
    const m = hay.replace(/\\\//g, "/").match(/[?&#]code=([^&"'<>\s]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }
  applyMusicLogin(cookie, data) {
    if (!data || typeof data !== "object") return cookie;
    if (data.musicid) {
      const mid = String(data.musicid).replace(/\D/g, "");
      if (mid) cookie = mergeCookies2(cookie, `uin=o${mid.padStart(10, "0")}; qqmusic_uin=${mid}`);
    }
    const key = data.musickey || data.key || data.qm_keyst;
    if (key) cookie = mergeCookies2(cookie, `qm_keyst=${key}; qqmusic_key=${key}`);
    return cookie;
  }
  async finishQr(checkSigUrl, qrsigCookie) {
    let cookie = qrsigCookie;
    let url = checkSigUrl;
    let pSkey = "";
    for (let hop = 0; hop < 8 && url; hop++) {
      const res = await request("GET", url, {
        headers: {
          Cookie: cookie,
          Referer: hop === 0 ? "https://xui.ptlogin2.qq.com/" : url
        },
        redirect: "manual"
      });
      cookie = mergeCookies2(cookie, res.cookies);
      pSkey = cookieGet(cookie, "p_skey") || cookieGet(cookie, "skey");
      const loc2 = this.headerLocation(res.headers);
      if (!loc2) break;
      url = new URL(unescapeRedirect(loc2), url).toString();
      if (pSkey && /y\.qq\.com|graph\.qq\.com/i.test(url)) break;
    }
    if (!pSkey) return null;
    const gtk = getGtk(pSkey);
    const authFields = {
      response_type: "code",
      client_id: "100497308",
      redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/",
      scope: "get_user_info,get_app_friends",
      state: "state",
      switch: "",
      from_ptlogin: "1",
      src: "1",
      update_auth: "1",
      openapi: "1010_1030",
      g_tk: String(gtk),
      auth_time: (/* @__PURE__ */ new Date()).toString(),
      ui: qqGuid()
    };
    const postAuthorize = async (body, contentType) => request("POST", "https://graph.qq.com/oauth2.0/authorize", {
      headers: {
        Cookie: cookie,
        Referer: "https://graph.qq.com/oauth2.0/login_jump",
        Origin: "https://graph.qq.com",
        ...contentType ? { "Content-Type": contentType } : {}
      },
      body,
      redirect: "manual"
    });
    let auth = await postAuthorize(new URLSearchParams(authFields));
    cookie = mergeCookies2(cookie, auth.cookies);
    let loc = this.headerLocation(auth.headers);
    let code = this.extractOauthCode(auth.headers, auth.body, loc);
    if (!code) {
      auth = await postAuthorize(new URLSearchParams(authFields).toString(), "application/x-www-form-urlencoded");
      cookie = mergeCookies2(cookie, auth.cookies);
      loc = this.headerLocation(auth.headers);
      code = this.extractOauthCode(auth.headers, auth.body, loc);
    }
    if (!code && loc) {
      const jump = await this.followCollect(loc, cookie, 6, "https://graph.qq.com/");
      cookie = jump.cookie;
      code = this.extractOauthCode(jump.last?.headers || new Headers(), jump.last?.body || "", loc);
    }
    if (!code) {
      if (this.hasMusicKey(cookie) && this.extractUin(cookie)) {
        return this.profileValidate(cookie, true);
      }
      return null;
    }
    const payloads = [
      {
        comm: { g_tk: gtk, platform: "yqq", ct: 24, cv: 0 },
        req: { module: "QQConnectLogin.LoginServer", method: "QQLogin", param: { code } }
      },
      {
        comm: { g_tk: gtk, platform: "yqq", ct: 24, cv: 0 },
        req_0: { module: "QQConnectLogin.LoginServer", method: "QQLogin", param: { code } }
      }
    ];
    for (const payload of payloads) {
      const body = JSON.stringify(payload);
      const attempts = [
        { "Content-Type": "application/json" },
        { "Content-Type": "application/x-www-form-urlencoded" }
      ];
      for (const headers of attempts) {
        const login = await request("POST", "https://u.y.qq.com/cgi-bin/musicu.fcg", {
          headers: { Referer: "https://y.qq.com/", Cookie: cookie, ...headers },
          body
        });
        cookie = mergeCookies2(cookie, login.cookies);
        const json = login.json;
        let data = null;
        if (json) {
          for (const rk of ["req", "req_0", "req1", "req0"]) {
            if (json[rk]?.data) {
              data = json[rk].data;
              break;
            }
          }
        }
        if (data && (data.musickey || data.key || data.qm_keyst)) {
          cookie = this.applyMusicLogin(cookie, data);
          break;
        }
      }
      if (this.hasMusicKey(cookie)) break;
    }
    return this.profileValidate(cookie, true);
  }
  async qrCheck() {
    const sess = readJson(this.qrFile);
    if (!sess?.qrsig) return fail2(400, "\u4E8C\u7EF4\u7801\u5DF2\u5931\u6548\uFF0C\u8BF7\u5237\u65B0");
    if (sess.finishFailed) {
      return {
        code: 502,
        error: "\u626B\u7801\u6210\u529F\u4F46\u6362\u53D6\u97F3\u4E50\u51ED\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u4E8C\u7EF4\u7801\u6216\u6539\u7528 Cookie",
        data: { status: 0, loggedIn: false, message: "\u626B\u7801\u6210\u529F\u4F46\u6362\u53D6\u97F3\u4E50\u51ED\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u4E8C\u7EF4\u7801\u6216\u6539\u7528 Cookie" }
      };
    }
    if (sess.finishing) return ok2({ status: 67, message: "\u6B63\u5728\u5B8C\u6210\u767B\u5F55\u2026" });
    const url = `https://ssl.ptlogin2.qq.com/ptqrlogin?${new URLSearchParams({
      u1: "https://graph.qq.com/oauth2.0/login_jump",
      ptqrtoken: String(sess.ptqrtoken || hash33(sess.qrsig)),
      ptredirect: "0",
      h: "1",
      t: "1",
      g: "1",
      from_ui: "1",
      ptlang: "2052",
      action: `0-0-${Date.now()}`,
      js_ver: "20102616",
      js_type: "1",
      login_sig: "",
      pt_uistyle: "40",
      aid: "716027609",
      daid: "383",
      pt_3rd_aid: "100497308",
      has_onekey: "1"
    })}`;
    const res = await this.qqGet(url, `qrsig=${sess.qrsig}`, { Referer: "https://xui.ptlogin2.qq.com/" });
    const parsed = this.parsePtui(res.body);
    if (!parsed) return ok2({ status: -1, message: "\u8F6E\u8BE2\u5F02\u5E38" });
    const payload = { status: parsed.code, message: "" };
    if (parsed.code === 66) payload.message = "\u7B49\u5F85\u626B\u7801\u2026";
    else if (parsed.code === 67) payload.message = "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728\u624B\u673A\u4E0A\u786E\u8BA4";
    else if (parsed.code === 65) payload.message = "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0";
    else if (parsed.code === 0) {
      if (!parsed.checkUrl) {
        return { code: 502, error: "\u767B\u5F55\u6210\u529F\u4F46\u7F3A\u5C11\u8DF3\u8F6C\u5730\u5740\uFF0C\u8BF7\u6539\u7528 Cookie", data: { ...payload, loggedIn: false } };
      }
      sess.finishing = true;
      writeJson(this.qrFile, sess);
      const account = await this.finishQr(parsed.checkUrl, mergeCookies2(`qrsig=${sess.qrsig}`, res.cookies));
      if (!account) {
        sess.finishFailed = true;
        delete sess.finishing;
        writeJson(this.qrFile, sess);
        return {
          code: 502,
          error: "\u626B\u7801\u6210\u529F\u4F46\u6362\u53D6\u97F3\u4E50\u51ED\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u4E8C\u7EF4\u7801\u6216\u6539\u7528 Cookie",
          data: { ...payload, loggedIn: false, message: "\u626B\u7801\u6210\u529F\u4F46\u6362\u53D6\u97F3\u4E50\u51ED\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u4E8C\u7EF4\u7801\u6216\u6539\u7528 Cookie" }
        };
      }
      this.write(await this.withVip(account));
      removeFile(this.qrFile);
      payload.loggedIn = true;
      payload.uin = account.uin;
      payload.nickname = account.nickname;
      payload.message = "\u767B\u5F55\u6210\u529F";
    }
    return ok2(payload);
  }
  async fetchPlaylists(uin, cookie) {
    const out = [];
    const created = await this.qqGet(
      `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?${new URLSearchParams({
        hostUin: "0",
        hostuin: uin,
        sin: "0",
        size: "200",
        g_tk: "5381",
        loginUin: uin,
        format: "json",
        inCharset: "utf8",
        outCharset: "utf-8",
        notice: "0",
        platform: "yqq.json",
        needNewCode: "0"
      })}`,
      cookie,
      { Referer: "https://y.qq.com/portal/profile.html" }
    );
    for (const pl of created.json?.data?.disslist || []) {
      const tid = String(pl.tid || pl.diss_id || "");
      if (!tid || tid === "0") continue;
      out.push({
        id: tid,
        name: String(pl.diss_name || "\u672A\u547D\u540D\u6B4C\u5355"),
        cover: String(pl.diss_cover || ""),
        trackCount: Number(pl.song_cnt || 0),
        dirid: Number(pl.dirid || 0),
        subscribed: false
      });
    }
    const fav = await this.qqGet(
      `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?${new URLSearchParams({
        ct: "20",
        cid: "205360956",
        userid: uin,
        reqtype: "3",
        sin: "0",
        ein: "49"
      })}`,
      cookie
    );
    for (const pl of fav.json?.data?.cdlist || []) {
      const tid = String(pl.disstid || pl.tid || pl.id || "");
      if (!tid || tid === "0") continue;
      out.push({
        id: tid,
        name: String(pl.dissname || pl.title || "\u6536\u85CF\u6B4C\u5355"),
        cover: String(pl.logo || pl.pic || ""),
        trackCount: Number(pl.song_cnt || pl.songnum || 0),
        dirid: 0,
        subscribed: true
      });
    }
    const seen = /* @__PURE__ */ new Set();
    return out.filter((pl) => seen.has(pl.id) ? false : (seen.add(pl.id), true));
  }
  async playlistTracks(id, cookie) {
    const dissid = id.replace(/\D/g, "");
    if (!dissid) return [];
    const res = await this.qqGet(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${new URLSearchParams({
        type: "1",
        utf8: "1",
        disstid: dissid,
        format: "json"
      })}`,
      cookie
    );
    const songs = res.json?.cdlist?.[0]?.songlist || [];
    const out = [];
    for (const song of songs) {
      const t = this.qq.trackFromSong(song);
      if (t) out.push(t);
    }
    return out;
  }
  async playlists() {
    const auth = this.read();
    if (!auth) return fail2(401, "\u8BF7\u5148\u767B\u5F55 QQ \u97F3\u4E50");
    return ok2({ playlists: await this.fetchPlaylists(auth.uin, auth.cookie) });
  }
  async likeSong(post) {
    const auth = this.read();
    if (!auth) return fail2(401, "\u8BF7\u5148\u767B\u5F55 QQ \u97F3\u4E50");
    const songId = Number(String(post.id || "").replace(/\D/g, ""));
    if (!songId) return fail2(400, "\u6B4C\u66F2 ID \u65E0\u6548");
    const like = post.like !== "0" && post.like !== "false";
    const map = cookieToMap(auth.cookie);
    const pSkey = map.p_skey || map.pskey || map.skey || "";
    const gtk = getGtk(pSkey || map.qqmusic_key || "");
    const method = like ? "AddSonglist" : "DelSonglist";
    const payload = {
      comm: {
        g_tk: gtk,
        uin: Number(auth.uin) || auth.uin,
        format: "json",
        platform: "yqq.json",
        ct: 24,
        cv: 0
      },
      req_1: {
        module: "music.musicasset.PlaylistDetailWrite",
        method,
        param: {
          dirId: 201,
          v_songInfo: [{ songId, songType: 0 }]
        }
      }
    };
    const res = await request("POST", "https://u.y.qq.com/cgi-bin/musicu.fcg", {
      headers: {
        Referer: "https://y.qq.com/",
        Origin: "https://y.qq.com",
        Cookie: auth.cookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = res.json?.req_1;
    const code = Number(data?.code ?? res.json?.code ?? -1);
    if (!res.ok || code !== 0) {
      if (like) {
        const form = new URLSearchParams({
          loginUin: auth.uin,
          hostUin: "0",
          format: "json",
          inCharset: "utf8",
          outCharset: "utf-8",
          notice: "0",
          platform: "yqq.json",
          needNewCode: "0",
          uin: auth.uin,
          dirid: "201",
          idlist: String(songId),
          source: "103",
          g_tk: String(gtk)
        });
        const legacy = await this.qqPost(
          "https://c.y.qq.com/splcloud/fcgi-bin/fcg_music_add2songdir.fcg",
          form.toString(),
          auth.cookie
        );
        const legacyCode = Number(legacy.json?.code ?? -1);
        if (legacyCode === 0 || legacyCode === 1e3) {
          return ok2({ liked: true, id: String(songId) });
        }
        return fail2(502, String(legacy.json?.msg || data?.msg || "\u6DFB\u52A0\u5230\u6211\u559C\u6B22\u5931\u8D25"));
      }
      return fail2(502, String(data?.msg || res.error || "\u53D6\u6D88\u559C\u6B22\u5931\u8D25"));
    }
    return ok2({ liked: like, id: String(songId) });
  }
  async likeCheck(post) {
    const auth = this.read();
    if (!auth) return fail2(401, "\u8BF7\u5148\u767B\u5F55 QQ \u97F3\u4E50");
    const songId = String(post.id || "").replace(/\D/g, "");
    if (!songId) return fail2(400, "\u6B4C\u66F2 ID \u65E0\u6548");
    const list = await this.fetchPlaylists(auth.uin, auth.cookie);
    const liked = list.find((pl) => Number(pl.dirid) === 201);
    if (!liked) return ok2({ liked: false, id: songId });
    const tracks = await this.playlistTracks(liked.id, auth.cookie);
    return ok2({ liked: tracks.some((t) => String(t.songid) === songId), id: songId });
  }
  async likelist() {
    const auth = this.read();
    if (!auth) return fail2(401, "\u8BF7\u5148\u767B\u5F55 QQ \u97F3\u4E50");
    const list = await this.fetchPlaylists(auth.uin, auth.cookie);
    const liked = list.find((pl) => Number(pl.dirid) === 201);
    if (!liked) return ok2({ playlistId: "", tracks: [], name: "\u6211\u559C\u6B22", total: 0 });
    const tracks = await this.playlistTracks(liked.id, auth.cookie);
    return ok2({ playlistId: liked.id, name: "\u6211\u559C\u6B22", tracks, total: tracks.length });
  }
  async playlistDetail(id) {
    const auth = this.read();
    if (!auth) return fail2(401, "\u8BF7\u5148\u767B\u5F55 QQ \u97F3\u4E50");
    if (!/^\d+$/.test(id.trim())) return fail2(400, "\u6B4C\u5355 ID \u65E0\u6548");
    const tracks = await this.playlistTracks(id.trim(), auth.cookie);
    const meta = await this.qqGet(
      `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${new URLSearchParams({
        type: "1",
        utf8: "1",
        disstid: id.trim(),
        format: "json"
      })}`,
      auth.cookie
    );
    return ok2({
      id: id.trim(),
      name: String(meta.json?.cdlist?.[0]?.dissname || ""),
      tracks,
      total: tracks.length
    });
  }
};
function unescapeRedirect(url) {
  return url.replace(/\\\//g, "/").replace(/&amp;/g, "&");
}
function ok2(data) {
  return { code: 200, error: "", data };
}
function fail2(code, error, data = "") {
  return { code, error, data };
}

// src/cache.ts
import { mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2 } from "node:fs";
import { join as join4 } from "node:path";
var FileCache = class {
  constructor(root) {
    this.root = root;
    mkdirSync2(root, { recursive: true });
  }
  dir(subdir) {
    const path = join4(this.root, subdir);
    mkdirSync2(path, { recursive: true });
    return path;
  }
  file(subdir, key) {
    const safe = key.replace(/[^a-zA-Z0-9]/g, "_");
    return join4(this.dir(subdir), `${safe}.json`);
  }
  read(subdir, key) {
    const path = this.file(subdir, key);
    if (!existsSync2(path)) return null;
    try {
      return JSON.parse(readFileSync2(path, "utf8"));
    } catch {
      return null;
    }
  }
  write(subdir, key, data) {
    writeFileSync2(this.file(subdir, key), JSON.stringify(data));
  }
  getTtl(subdir, key, field = "url") {
    const data = this.read(subdir, key);
    if (!data || !data[field] || !data.expires || data.expires < Date.now() / 1e3) return null;
    return String(data[field]);
  }
  setTtl(subdir, key, value, ttlSec, field = "url") {
    this.write(subdir, key, { [field]: value, expires: Math.floor(Date.now() / 1e3) + ttlSec });
  }
};

// src/app.ts
init_config();

// src/crypto/qrcDecrypt.ts
import { inflateSync, unzipSync } from "node:zlib";

// src/crypto/qrcDes.ts
var QQ_KEY = Buffer.from("!@#)(*$%123ZXC!@!@#)(NHL", "ascii");
var ENCRYPT = 1;
var DECRYPT = 0;
var SBOX = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
];
function bitnum(a, b, c) {
  const byteIdx = Math.floor(b / 32) * 4 + 3 - Math.floor(b % 32 / 8);
  return (a[byteIdx] >>> 7 - b % 8 & 1) << c >>> 0;
}
function bitnumIntr(a, b, c) {
  return (a >>> 31 - b & 1) << c & 255;
}
function bitnumIntl(a, b, c) {
  return (a << b >>> 0 & 2147483648) >>> c >>> 0;
}
function sboxBit(a) {
  return (a & 32 | (a & 31) >>> 1 | (a & 1) << 4) & 63;
}
function keySchedule(key, mode) {
  const KEY_RND_SHIFT = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
  const KEY_PERM_C = [56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35];
  const KEY_PERM_D = [62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3];
  const KEY_COMPRESSION = [13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26, 19, 12, 1, 40, 51, 30, 36, 46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31];
  const schedule = Array.from({ length: 16 }, () => new Uint8Array(6));
  let c = 0;
  let d = 0;
  let j = 31;
  for (let i = 0; i < 28; i++) {
    c = (c | bitnum(key, KEY_PERM_C[i], j)) >>> 0;
    j--;
  }
  j = 31;
  for (let i = 0; i < 28; i++) {
    d = (d | bitnum(key, KEY_PERM_D[i], j)) >>> 0;
    j--;
  }
  for (let i = 0; i < 16; i++) {
    const shift = KEY_RND_SHIFT[i];
    c = (c << shift >>> 0 | c >>> 28 - shift) >>> 0;
    c = (c & 4294967280) >>> 0;
    d = (d << shift >>> 0 | d >>> 28 - shift) >>> 0;
    d = (d & 4294967280) >>> 0;
    const toGen = mode === DECRYPT ? 15 - i : i;
    const round = schedule[toGen];
    round.fill(0);
    for (let k = 0; k < 24; k++) round[Math.floor(k / 8)] |= bitnumIntr(c, KEY_COMPRESSION[k], 7 - k % 8);
    for (let k = 24; k < 48; k++) round[Math.floor(k / 8)] |= bitnumIntr(d, KEY_COMPRESSION[k] - 27, 7 - k % 8);
  }
  return schedule;
}
function ip(input) {
  const bits = [57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
  const bits2 = [56, 48, 40, 32, 24, 16, 8, 0, 58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6];
  let s0 = 0;
  let s1 = 0;
  for (let i = 0; i < 32; i++) {
    s0 |= bitnum(input, bits[i], 31 - i);
    s1 |= bitnum(input, bits2[i], 31 - i);
  }
  return [s0 >>> 0, s1 >>> 0];
}
function invIp(state, output) {
  const [s0, s1] = state;
  output[3] = bitnumIntr(s1, 7, 7) | bitnumIntr(s0, 7, 6) | bitnumIntr(s1, 15, 5) | bitnumIntr(s0, 15, 4) | bitnumIntr(s1, 23, 3) | bitnumIntr(s0, 23, 2) | bitnumIntr(s1, 31, 1) | bitnumIntr(s0, 31, 0);
  output[2] = bitnumIntr(s1, 6, 7) | bitnumIntr(s0, 6, 6) | bitnumIntr(s1, 14, 5) | bitnumIntr(s0, 14, 4) | bitnumIntr(s1, 22, 3) | bitnumIntr(s0, 22, 2) | bitnumIntr(s1, 30, 1) | bitnumIntr(s0, 30, 0);
  output[1] = bitnumIntr(s1, 5, 7) | bitnumIntr(s0, 5, 6) | bitnumIntr(s1, 13, 5) | bitnumIntr(s0, 13, 4) | bitnumIntr(s1, 21, 3) | bitnumIntr(s0, 21, 2) | bitnumIntr(s1, 29, 1) | bitnumIntr(s0, 29, 0);
  output[0] = bitnumIntr(s1, 4, 7) | bitnumIntr(s0, 4, 6) | bitnumIntr(s1, 12, 5) | bitnumIntr(s0, 12, 4) | bitnumIntr(s1, 20, 3) | bitnumIntr(s0, 20, 2) | bitnumIntr(s1, 28, 1) | bitnumIntr(s0, 28, 0);
  output[7] = bitnumIntr(s1, 3, 7) | bitnumIntr(s0, 3, 6) | bitnumIntr(s1, 11, 5) | bitnumIntr(s0, 11, 4) | bitnumIntr(s1, 19, 3) | bitnumIntr(s0, 19, 2) | bitnumIntr(s1, 27, 1) | bitnumIntr(s0, 27, 0);
  output[6] = bitnumIntr(s1, 2, 7) | bitnumIntr(s0, 2, 6) | bitnumIntr(s1, 10, 5) | bitnumIntr(s0, 10, 4) | bitnumIntr(s1, 18, 3) | bitnumIntr(s0, 18, 2) | bitnumIntr(s1, 26, 1) | bitnumIntr(s0, 26, 0);
  output[5] = bitnumIntr(s1, 1, 7) | bitnumIntr(s0, 1, 6) | bitnumIntr(s1, 9, 5) | bitnumIntr(s0, 9, 4) | bitnumIntr(s1, 17, 3) | bitnumIntr(s0, 17, 2) | bitnumIntr(s1, 25, 1) | bitnumIntr(s0, 25, 0);
  output[4] = bitnumIntr(s1, 0, 7) | bitnumIntr(s0, 0, 6) | bitnumIntr(s1, 8, 5) | bitnumIntr(s0, 8, 4) | bitnumIntr(s1, 16, 3) | bitnumIntr(s0, 16, 2) | bitnumIntr(s1, 24, 1) | bitnumIntr(s0, 24, 0);
}
function f(state, key) {
  const lrgstate = new Uint8Array(6);
  const t1 = (bitnumIntl(state, 31, 0) | (state & 4026531840) >>> 1 | bitnumIntl(state, 4, 5) | bitnumIntl(state, 3, 6) | (state & 251658240) >>> 3 | bitnumIntl(state, 8, 11) | bitnumIntl(state, 7, 12) | (state & 15728640) >>> 5 | bitnumIntl(state, 12, 17) | bitnumIntl(state, 11, 18) | (state & 983040) >>> 7 | bitnumIntl(state, 16, 23)) >>> 0;
  const t2 = (bitnumIntl(state, 15, 0) | (state & 61440) << 15 >>> 0 | bitnumIntl(state, 20, 5) | bitnumIntl(state, 19, 6) | (state & 3840) << 13 >>> 0 | bitnumIntl(state, 24, 11) | bitnumIntl(state, 23, 12) | (state & 240) << 11 >>> 0 | bitnumIntl(state, 28, 17) | bitnumIntl(state, 27, 18) | (state & 15) << 9 >>> 0 | bitnumIntl(state, 0, 23)) >>> 0;
  lrgstate[0] = t1 >>> 24 & 255;
  lrgstate[1] = t1 >>> 16 & 255;
  lrgstate[2] = t1 >>> 8 & 255;
  lrgstate[3] = t2 >>> 24 & 255;
  lrgstate[4] = t2 >>> 16 & 255;
  lrgstate[5] = t2 >>> 8 & 255;
  for (let i = 0; i < 6; i++) lrgstate[i] ^= key[i];
  const sboxed = (SBOX[0][sboxBit(lrgstate[0] >>> 2)] << 28 | SBOX[1][sboxBit((lrgstate[0] & 3) << 4 | lrgstate[1] >>> 4)] << 24 | SBOX[2][sboxBit((lrgstate[1] & 15) << 2 | lrgstate[2] >>> 6)] << 20 | SBOX[3][sboxBit(lrgstate[2] & 63)] << 16 | SBOX[4][sboxBit(lrgstate[3] >>> 2)] << 12 | SBOX[5][sboxBit((lrgstate[3] & 3) << 4 | lrgstate[4] >>> 4)] << 8 | SBOX[6][sboxBit((lrgstate[4] & 15) << 2 | lrgstate[5] >>> 6)] << 4 | SBOX[7][sboxBit(lrgstate[5] & 63)]) >>> 0;
  return (bitnumIntl(sboxed, 15, 0) | bitnumIntl(sboxed, 6, 1) | bitnumIntl(sboxed, 19, 2) | bitnumIntl(sboxed, 20, 3) | bitnumIntl(sboxed, 28, 4) | bitnumIntl(sboxed, 11, 5) | bitnumIntl(sboxed, 27, 6) | bitnumIntl(sboxed, 16, 7) | bitnumIntl(sboxed, 0, 8) | bitnumIntl(sboxed, 14, 9) | bitnumIntl(sboxed, 22, 10) | bitnumIntl(sboxed, 25, 11) | bitnumIntl(sboxed, 4, 12) | bitnumIntl(sboxed, 17, 13) | bitnumIntl(sboxed, 30, 14) | bitnumIntl(sboxed, 9, 15) | bitnumIntl(sboxed, 1, 16) | bitnumIntl(sboxed, 7, 17) | bitnumIntl(sboxed, 23, 18) | bitnumIntl(sboxed, 13, 19) | bitnumIntl(sboxed, 31, 20) | bitnumIntl(sboxed, 26, 21) | bitnumIntl(sboxed, 2, 22) | bitnumIntl(sboxed, 8, 23) | bitnumIntl(sboxed, 18, 24) | bitnumIntl(sboxed, 12, 25) | bitnumIntl(sboxed, 29, 26) | bitnumIntl(sboxed, 5, 27) | bitnumIntl(sboxed, 21, 28) | bitnumIntl(sboxed, 10, 29) | bitnumIntl(sboxed, 3, 30) | bitnumIntl(sboxed, 24, 31)) >>> 0;
}
function cryptBlock(input, output, schedule) {
  const state = ip(input);
  for (let round = 0; round < 15; round++) {
    const tmp = state[1];
    state[1] = (f(state[1], schedule[round]) ^ state[0]) >>> 0;
    state[0] = tmp;
  }
  state[0] = (f(state[1], schedule[15]) ^ state[0]) >>> 0;
  invIp(state, output);
}
function tripleDesKeySetup(key, mode) {
  if (mode === ENCRYPT) {
    return [keySchedule(key.subarray(0, 8), mode), keySchedule(key.subarray(8, 16), DECRYPT), keySchedule(key.subarray(16, 24), mode)];
  }
  return [keySchedule(key.subarray(16, 24), mode), keySchedule(key.subarray(8, 16), ENCRYPT), keySchedule(key.subarray(0, 8), mode)];
}
function tripleDesCrypt(input, output, schedules) {
  const tmp1 = new Uint8Array(8);
  const tmp2 = new Uint8Array(8);
  cryptBlock(input, tmp1, schedules[0]);
  cryptBlock(tmp1, tmp2, schedules[1]);
  cryptBlock(tmp2, output, schedules[2]);
}
function qrcTripleDesDecrypt(hexCipher) {
  const clean = hexCipher.replace(/\s+/g, "");
  const cipher = Buffer.from(clean, "hex");
  if (!cipher.length || cipher.length % 8 !== 0) {
    throw new Error("QRC ciphertext length invalid");
  }
  const schedules = tripleDesKeySetup(QQ_KEY, DECRYPT);
  const out = Buffer.alloc(cipher.length);
  const inBlock = Buffer.alloc(8);
  const outBlock = Buffer.alloc(8);
  for (let i = 0; i < cipher.length; i += 8) {
    cipher.copy(inBlock, 0, i, i + 8);
    tripleDesCrypt(inBlock, outBlock, schedules);
    outBlock.copy(out, i, 0, 8);
  }
  return out;
}

// src/crypto/qrcDecrypt.ts
function inflateAuto(data) {
  const candidates = [data];
  for (const magic of [Buffer.from([120, 156]), Buffer.from([120, 1]), Buffer.from([120, 218])]) {
    const pos = data.indexOf(magic);
    if (pos > 0) candidates.push(data.subarray(pos));
  }
  for (const chunk of candidates) {
    try {
      return unzipSync(chunk);
    } catch {
    }
    try {
      return inflateSync(chunk);
    } catch {
    }
  }
  throw new Error("QRC inflate failed");
}
function extractQrcLyricContent(xml) {
  if (!xml) return "";
  const m = xml.match(/LyricContent="([^"]*)"/s) || xml.match(/LyricContent='([^']*)'/s);
  if (!m) return xml;
  const text = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, "\n").replace(/\\n/g, "\n");
  return text.replace(/\r\n/g, "\n");
}
function looksLikeQrc(content) {
  return /\[\d+,\d+\]/.test(content) && content.includes("(");
}
function qrcPlainOrDecrypt(raw2) {
  const text = String(raw2 || "").trim();
  if (!text) return "";
  if (looksLikeQrc(text) || text.startsWith("[")) return text;
  if (!/^[0-9a-fA-F]+$/.test(text.replace(/\s+/g, ""))) return text;
  try {
    const decrypted = qrcTripleDesDecrypt(text);
    const plain = inflateAuto(decrypted).toString("utf8");
    return extractQrcLyricContent(plain) || plain;
  } catch {
    return "";
  }
}

// src/util.ts
function decodeEntities(str) {
  return str.replace(/&#13;/g, "").replace(/&#10;/g, "\n").replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function timedLyricScore(text) {
  const raw2 = text || "";
  if (!raw2.trim()) return 0;
  const word = (raw2.match(/\[\d+,\d+\]/g) || []).length;
  const lrc = (raw2.match(/\[\d{2}:\d{2}/g) || []).length;
  return word * 10 + lrc;
}
function pickRicherLyric(primary, fallback) {
  return timedLyricScore(primary) >= timedLyricScore(fallback) ? primary || fallback : fallback;
}
function convertNeteaseJsonLyricLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj.t !== "number" || !Array.isArray(obj.c)) return null;
    const text = obj.c.map((part) => part?.tx || "").join("");
    const ms = Math.max(0, obj.t);
    const m = Math.floor(ms / 6e4);
    const s = Math.floor(ms % 6e4 / 1e3);
    const cs = ms % 1e3;
    return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(3, "0")}]${text}`;
  } catch {
    return null;
  }
}
function normalizeNeteaseLyric(text) {
  if (!text) return "";
  return text.split(/\r?\n/).map((line) => convertNeteaseJsonLyricLine(line) ?? line).join("\n");
}
function neteaseLyricText(payload, field) {
  if (!payload || typeof payload !== "object") return "";
  let raw2 = "";
  if (field === "yrc") {
    raw2 = payload.yrc?.lyric ? String(payload.yrc.lyric) : payload.lrc?.yrc?.lyric ? String(payload.lrc.yrc.lyric) : "";
  } else if (field === "tlyric") {
    if (payload.yrc?.lyric && payload.ytlrc?.lyric) raw2 = String(payload.ytlrc.lyric);
    else if (payload.lrc?.ytlrc?.lyric) raw2 = String(payload.lrc.ytlrc.lyric);
    else if (payload.tlyric?.lyric) raw2 = String(payload.tlyric.lyric);
  } else {
    raw2 = payload.lrc?.lyric ? String(payload.lrc.lyric) : "";
  }
  return normalizeNeteaseLyric(raw2);
}
function sliceNameSearchSongids(songids, page) {
  if (!Array.isArray(songids)) {
    return { songids: [], has_more: false };
  }
  void page;
  const limit = 10;
  const slice = songids.slice(0, limit);
  return {
    songids: slice,
    has_more: songids.length >= limit
  };
}
function nameSearchSourcePage(page) {
  const n = Number(page);
  return n < 1 || Number.isNaN(n) ? 1 : n;
}
function firstTruthy(tasks) {
  return new Promise((resolve) => {
    let pending = tasks.length;
    let settled = false;
    if (!pending) {
      resolve(null);
      return;
    }
    for (const task of tasks) {
      void task().then((value) => {
        if (!settled && value) {
          settled = true;
          resolve(value);
          return;
        }
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      }).catch(() => {
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      });
    }
  });
}
function jsonpToJson(raw2) {
  const text = raw2.trim();
  if (!text) return null;
  if (text[0] === "[" || text[0] === "{") {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start + 1, end));
    } catch {
      return null;
    }
  }
  return null;
}
function isBadMediaUrl(url) {
  if (!url) return true;
  if (!/^https?:\/\//i.test(url)) return true;
  if (/\/404/i.test(url) || /music\.163\.com\/404/i.test(url)) return true;
  return isTrialMediaUrl(url);
}
function isTrialMediaUrl(url) {
  if (!url) return true;
  return /trial|preview|freeTrial|limit=1/i.test(url);
}
function httpsNeteaseUrl(url) {
  if (url.startsWith("http://") && /(126\.net|163\.com)/i.test(url)) {
    return `https://${url.slice(7)}`;
  }
  return url;
}
function mediaReferer(url) {
  if (/(163\.com|126\.net|netease)/i.test(url)) return "https://music.163.com/";
  if (/myhkw\.cn/i.test(url)) return "https://s.myhkw.cn/";
  return "https://y.qq.com/";
}
function parseSongUrl(url) {
  const netease = url.match(/music\.163\.com\/(#(\/m)?|m)\/song(\?id=|\/)(\d+)/i);
  if (netease?.[4]) return { site: "netease", id: netease[4] };
  const qq = url.match(
    /(y\.qq\.com\/n\/(ryqq|yqq)\/songDetail\/|y\.qq\.com\/n\/yqq\/song\/|data\.music\.qq\.com\/playsong\.html\?songmid=)([a-zA-Z0-9]+)/i
  );
  if (qq?.[3]) return { site: "qq", id: qq[3] };
  return null;
}

// src/lyrics.ts
var LyricsService = class {
  constructor(cache, netease, qq, neteaseCookie, qqCookie) {
    this.cache = cache;
    this.netease = netease;
    this.qq = qq;
    this.neteaseCookie = neteaseCookie;
    this.qqCookie = qqCookie;
  }
  async fetch(type, id) {
    if (type === "qq") return this.fetchQq(id);
    return this.fetchNetease(id);
  }
  readCache(bucket, key) {
    const data = this.cache.read(bucket, key);
    if (!data?.lyrics || !data.expires || data.expires < Date.now() / 1e3) return null;
    return data.lyrics;
  }
  writeCache(bucket, key, lyrics, ttlSec) {
    this.cache.write(bucket, key, { lyrics, expires: Math.floor(Date.now() / 1e3) + ttlSec });
  }
  async fetchNetease(songid) {
    const cookie = this.neteaseCookie() || "";
    const bucket = cookie ? "netease_lyric_auth_v2" : "netease_lyric_v2";
    const cached = this.readCache(bucket, songid);
    if (cached && timedLyricScore(cached.lrc) + timedLyricScore(cached.yrc) > 0) return cached;
    let official = null;
    if (cookie) {
      const res = await eapiRequest(
        "/api/song/lyric/v1",
        {
          id: Number(songid),
          cp: false,
          tv: 0,
          lv: 0,
          rv: 0,
          kv: 0,
          yv: 0,
          ytv: 0,
          yrv: 0
        },
        cookie
      );
      if (res.json && (res.json.lrc || res.json.yrc)) official = res.json;
    }
    const anonymous = await this.netease.fetchLyric(songid, cookie);
    const lyrics = {
      lrc: pickRicherLyric(neteaseLyricText(official, "lrc"), neteaseLyricText(anonymous, "lrc")),
      yrc: pickRicherLyric(neteaseLyricText(official, "yrc"), neteaseLyricText(anonymous, "yrc")),
      tlyric: pickRicherLyric(neteaseLyricText(official, "tlyric"), neteaseLyricText(anonymous, "tlyric"))
    };
    if (timedLyricScore(lyrics.lrc) + timedLyricScore(lyrics.yrc) > 0) {
      this.writeCache(bucket, songid, lyrics, cookie ? 1800 : 3600);
    }
    return lyrics;
  }
  async fetchQq(songmid) {
    const cached = this.readCache("qq_lyric_v2", songmid);
    if (cached && timedLyricScore(cached.lrc) + timedLyricScore(cached.yrc) > 0) return cached;
    const cookie = this.qqCookie() || "tmeLoginType=-1;";
    const songId = await this.qq.songNumericId(songmid);
    let yrc = "";
    let tlyric = "";
    let lrc = "";
    if (songId > 0) {
      const data = await this.qq.playLyricInfo(songmid, songId, cookie);
      if (data?.lyric) {
        yrc = qrcPlainOrDecrypt(String(data.lyric));
        if (data.trans) tlyric = qrcPlainOrDecrypt(String(data.trans));
      }
    }
    const line = await this.qq.fetchLyric(songmid);
    if (line.lyric) lrc = decodeEntities(String(line.lyric));
    if (!tlyric && line.trans) tlyric = decodeEntities(String(line.trans));
    if (yrc && !looksLikeQrc(yrc)) {
      if (!lrc) lrc = yrc;
      yrc = "";
    }
    const lyrics = { lrc, yrc, tlyric };
    if (timedLyricScore(yrc) + timedLyricScore(lrc) > 0) this.writeCache("qq_lyric_v2", songmid, lyrics, 3600);
    return lyrics;
  }
};

// src/netease.ts
init_config();
init_http();
init_sign();
var NeteaseService = class _NeteaseService {
  constructor(cache, secret) {
    this.cache = cache;
    this.secret = secret;
  }
  playInflight = /* @__PURE__ */ new Map();
  wrap(track) {
    return {
      ...track,
      url: proxyUrl(this.secret, "url", "netease", track.songid),
      pic: proxyUrl(this.secret, "pic", "netease", track.songid)
    };
  }
  async searchByName(query, page) {
    const sourcePage = nameSearchSourcePage(page);
    const encoded = encodeLinuxData({
      method: "POST",
      url: "http://music.163.com/api/cloudsearch/pc",
      params: { s: query, type: 1, offset: sourcePage * 10 - 10, limit: 10 }
    });
    const res = await neteaseHttp("POST", "http://music.163.com/api/linux/forward", encoded, "", {
      Referer: "http://music.163.com/"
    });
    const songs = res.json?.result?.songs;
    if (!Array.isArray(songs) || !songs.length) return null;
    const ids = songs.map((s) => String(s.id));
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return null;
    const byId = new Map(songs.map((song) => [String(song.id), song]));
    const tracks = sliced.songids.map((id) => this.trackFromSong(byId.get(String(id)))).filter((item) => Boolean(item)).map((item) => this.wrap({ ...item, lrc: "", url: "" }));
    return { tracks, hasMore: sliced.has_more };
  }
  async songsByIds(ids, cookie = "") {
    const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
    if (!unique.length) return [];
    const encoded = encodeLinuxData({
      method: "GET",
      url: "http://music.163.com/api/song/detail",
      params: { id: unique.join(","), ids: `[${unique.join(",")}]` }
    });
    const res = await neteaseHttp("POST", "http://music.163.com/api/linux/forward", encoded, cookie, {
      Referer: "http://music.163.com/"
    });
    const songs = res.json?.songs;
    if (!Array.isArray(songs)) return [];
    return songs.map((value) => {
      const id = String(value.id);
      const authors = Array.isArray(value.artists) ? value.artists.map((a) => a.name).filter(Boolean) : [];
      const pic = value.album?.picUrl ? `${value.album.picUrl}?param=300x300` : "";
      return this.wrap({
        type: "netease",
        songid: id,
        title: String(value.name || "\u672A\u77E5\u66F2\u76EE"),
        author: authors.join(",") || "\u672A\u77E5\u827A\u4EBA",
        link: `http://music.163.com/#/song?id=${id}`,
        lrc: "",
        yrc: "",
        tlyric: "",
        url: "",
        pic
      });
    });
  }
  async fetchLyric(id, cookie = "") {
    const encoded = encodeLinuxData({
      method: "GET",
      url: "http://music.163.com/api/song/lyric",
      params: { id, lv: -1, tv: -1, rv: -1, kv: -1, yv: -1 }
    });
    const res = await neteaseHttp("POST", "http://music.163.com/api/linux/forward", encoded, cookie, {
      Referer: "http://music.163.com/"
    });
    return res.json;
  }
  static QUALITY_LEVELS = [
    { level: "jymaster", label: "\u8D85\u6E05\u6BCD\u5E26", encodeType: "flac" },
    { level: "sky", label: "\u6C89\u6D78\u73AF\u7ED5", encodeType: "flac" },
    { level: "jyeffect", label: "\u9AD8\u6E05\u73AF\u7ED5\u58F0", encodeType: "flac" },
    { level: "hires", label: "Hi-Res", encodeType: "flac" },
    { level: "lossless", label: "\u65E0\u635F", encodeType: "flac" },
    { level: "exhigh", label: "\u6781\u9AD8", encodeType: "mp3" },
    { level: "higher", label: "\u8F83\u9AD8", encodeType: "mp3" },
    { level: "standard", label: "\u6807\u51C6", encodeType: "mp3" }
  ];
  async resolvePlayUrl(songid, cookie = "", level = "") {
    const inflightKey = `${cookie ? "auth" : "private"}:${level || "auto"}:${songid}`;
    const inflight = this.playInflight.get(inflightKey);
    if (inflight) return inflight;
    const pending = this.resolvePlayUrlInner(songid, cookie, level).finally(() => {
      this.playInflight.delete(inflightKey);
    });
    this.playInflight.set(inflightKey, pending);
    return pending;
  }
  async resolvePlayUrlInner(songid, cookie = "", level = "") {
    const cacheKey = cookie ? `netease_play_auth_v4_${level || "auto"}` : "netease_play_v4";
    const cached = this.cache.getTtl(cacheKey, songid);
    if (cached) return cached;
    if (cookie) {
      const authUrl = await this.cookiePlayUrl(songid, cookie, level);
      if (authUrl) {
        this.cache.setTtl(cacheKey, songid, authUrl, 600);
        return authUrl;
      }
    }
    let url = await this.bootstrapPlayUrl(songid);
    if (url && !isBadMediaUrl(url) && !/\/404/.test(url)) {
      const safeUrl = httpsNeteaseUrl(url);
      this.cache.setTtl("netease_play_v4", songid, safeUrl, 600);
      return safeUrl;
    }
    return null;
  }
  async probePlayQualities(songid, cookie) {
    const id = Number(songid);
    if (!id || !cookie) return [];
    const hits = await Promise.all(
      _NeteaseService.QUALITY_LEVELS.map(async (item) => {
        const hit = await this.fetchPlayUrlForLevel(id, cookie, item.level, item.encodeType);
        if (!hit) return null;
        return {
          level: item.level,
          label: item.label,
          br: hit.br,
          size: hit.size
        };
      })
    );
    return hits.filter((item) => Boolean(item));
  }
  async cookiePlayUrl(songid, cookie, preferredLevel = "") {
    const id = Number(songid);
    if (!id || !cookie) return null;
    const preferred = _NeteaseService.QUALITY_LEVELS.find((item2) => item2.level === preferredLevel);
    const ordered = preferred ? [preferred] : _NeteaseService.QUALITY_LEVELS.filter(
      (item2) => ["exhigh", "higher", "standard"].includes(item2.level)
    );
    if (!preferred) {
      const fastUrl = await firstTruthy(
        ordered.map((item2) => async () => {
          const hit = await this.fetchPlayUrlForLevel(id, cookie, item2.level, item2.encodeType);
          return hit?.url;
        })
      );
      if (fastUrl) return fastUrl;
    } else {
      const hit = await this.fetchPlayUrlForLevel(id, cookie, preferred.level, preferred.encodeType);
      if (hit?.url) return hit.url;
    }
    if (preferred) {
      for (const item2 of _NeteaseService.QUALITY_LEVELS.filter((item3) => item3.level !== preferred.level)) {
        const hit = await this.fetchPlayUrlForLevel(id, cookie, item2.level, item2.encodeType);
        if (hit?.url) return hit.url;
      }
    }
    const weapi = await weapiRequest(
      "/weapi/song/enhance/player/url/v1",
      { ids: `[${id}]`, level: preferredLevel || "exhigh", encodeType: preferredLevel ? "flac" : "mp3" },
      cookie
    );
    const item = weapi.json?.data?.[0];
    const url = item?.url;
    if (url && !this.isTrialPlayItem(item) && !isBadMediaUrl(url) && !/\/404/i.test(url)) {
      return httpsNeteaseUrl(url);
    }
    return null;
  }
  async fetchPlayUrlForLevel(id, cookie, level, encodeType) {
    const res = await eapiRequest(
      "/api/song/enhance/player/url/v1",
      { ids: `[${id}]`, level, encodeType },
      cookie
    );
    const item = res.json?.data?.[0];
    const url = item?.url;
    if (this.isTrialPlayItem(item)) return null;
    if (!url || isBadMediaUrl(url) || /\/404/i.test(url)) return null;
    return {
      url: httpsNeteaseUrl(url),
      br: typeof item?.br === "number" ? item.br : void 0,
      size: typeof item?.size === "number" ? item.size : void 0
    };
  }
  isTrialPlayItem(item) {
    if (!item) return false;
    if (item.freeTrialInfo) return true;
    const time = Number(item.time || 0);
    if (time > 0 && time <= 6e4) return true;
    const privilege = item.freeTrialPrivilege;
    return Boolean(
      privilege && (privilege.resConsumable || privilege.userConsumable) && time > 0
    );
  }
  async bootstrapPlayUrl(songid) {
    const base = bootstrapBase();
    if (!base) return null;
    const res = await request("POST", `${base}/`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${base}/`
      },
      body: { input: songid, filter: "id", type: "netease", page: 1 }
    });
    const apiPath = res.json?.data?.[0]?.url;
    if (!apiPath) return null;
    const api = `${base}/${apiPath.replace(/^\//, "")}`;
    let loc = await followLocation(api, `${base}/`);
    if (!loc) return null;
    if (/(126\.net|163\.com|music\.163)/i.test(loc)) return loc;
    return await followLocation(loc, `${base}/`) || loc;
  }
  async metingPlayUrl(songid) {
    const endpoints = [
      `https://api.injahow.cn/meting/?server=netease&type=url&id=${encodeURIComponent(songid)}`,
      `https://api.injahow.cn/meting/?type=url&id=${encodeURIComponent(songid)}`
    ];
    for (const endpoint of endpoints) {
      const loc = await followLocation(endpoint, "https://api.injahow.cn/");
      if (loc && !isBadMediaUrl(loc) && /(126\.net|163\.com|music\.163)/i.test(loc)) return loc;
    }
    return null;
  }
  async resolvePicUrl(songid) {
    const encoded = encodeLinuxData({
      method: "GET",
      url: "http://music.163.com/api/song/detail",
      params: { id: songid, ids: `[${songid}]` }
    });
    const res = await neteaseHttp("POST", "http://music.163.com/api/linux/forward", encoded, "", {
      Referer: "http://music.163.com/"
    });
    const pic = res.json?.songs?.[0]?.album?.picUrl;
    if (!pic) return null;
    const withSize = pic.includes("?") ? pic : `${pic}?param=300x300`;
    return httpsNeteaseUrl(withSize);
  }
  trackFromSong(song) {
    const id = song?.id;
    if (!id) return null;
    const artists = [];
    if (Array.isArray(song.ar)) {
      for (const a of song.ar) if (a?.name) artists.push(a.name);
    } else if (Array.isArray(song.artists)) {
      for (const a of song.artists) if (a?.name) artists.push(a.name);
    }
    const pic = song.al?.picUrl || song.album?.picUrl || "";
    return {
      type: "netease",
      songid: String(id),
      title: String(song.name || "\u672A\u77E5\u66F2\u76EE"),
      author: artists.join(", ") || "\u672A\u77E5\u827A\u4EBA",
      link: `https://music.163.com/#/song?id=${id}`,
      pic
    };
  }
  async songsByIdsV3(ids, cookie) {
    const unique = [...new Set(ids.filter((n) => n > 0))];
    const out = [];
    for (let i = 0; i < unique.length; i += 200) {
      const chunk = unique.slice(i, i + 200);
      const res = await neteaseApi(
        "/api/v3/song/detail",
        {
          c: JSON.stringify(chunk.map((id) => ({ id }))),
          ids: chunk.join(",")
        },
        cookie,
        "POST"
      );
      const songs = res.json?.songs;
      if (!Array.isArray(songs)) continue;
      for (const song of songs) {
        const t = this.trackFromSong(song);
        if (t) out.push(this.wrap({ ...t, lrc: "", url: "" }));
      }
    }
    return out;
  }
};

// src/pages.ts
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "node:fs";
import { join as join5 } from "node:path";
function spaHtml(webRoot2) {
  const manifestPath = [
    join5(webRoot2, "static/app/manifest.json"),
    join5(webRoot2, "static/app/.vite/manifest.json")
  ].find((p) => existsSync3(p));
  if (!manifestPath) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync3(manifestPath, "utf8"));
  } catch {
    return null;
  }
  const entry = manifest["index.html"];
  if (!entry?.file) return null;
  const css = Array.isArray(entry.css) ? entry.css : [];
  const cssTags = css.map((file) => `    <link rel="stylesheet" href="static/app/${file}">`).join("\n");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>RyanMusic - \u7F51\u6613\u4E91 \xB7 QQ \u97F3\u4E50\u641C\u7D22</title>
    <meta name="renderer" content="webkit">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
${cssTags}
</head>
<body>
    <div id="root"></div>
    <script type="module" src="static/app/${entry.file}"></script>
</body>
</html>`;
}

// src/qq.ts
init_config();
init_http();
init_sign();
var QqService = class {
  constructor(cache, secret) {
    this.cache = cache;
    this.secret = secret;
  }
  playInflight = /* @__PURE__ */ new Map();
  wrap(track) {
    return {
      ...track,
      url: proxyUrl(this.secret, "url", "qq", track.songid),
      pic: proxyUrl(this.secret, "pic", "qq", track.songid)
    };
  }
  async songNumericId(songmid, hint = 0) {
    if (hint > 0) return hint;
    const qs = new URLSearchParams({ songmid, format: "json" });
    const res = await request("GET", `http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${qs}`, {
      headers: { Referer: "http://m.y.qq.com" }
    });
    return Number(res.json?.data?.[0]?.id || 0);
  }
  async playLyricInfo(songmid, songId, cookie) {
    const payload = {
      comm: { ct: 11, cv: "1003006", v: "1003006", tmeAppID: "qqmusiclight", nettype: "NETWORK_WIFI", uid: "0", udid: "0" },
      request: {
        module: "music.musichallSong.PlayLyricInfo",
        method: "GetPlayLyricInfo",
        param: {
          albumName: Buffer.from("").toString("base64"),
          crypt: 1,
          ct: 19,
          cv: 2111,
          interval: 0,
          lrc_t: 0,
          qrc: 1,
          qrc_t: 0,
          roma: 1,
          roma_t: 0,
          singerName: Buffer.from("").toString("base64"),
          songID: songId,
          songMid: songmid,
          songName: Buffer.from("").toString("base64"),
          trans: 1,
          trans_t: 0,
          type: 0
        }
      }
    };
    const res = await request("POST", "https://u.y.qq.com/cgi-bin/musicu.fcg", {
      headers: {
        Referer: "https://y.qq.com/",
        "User-Agent": "okhttp/3.14.9",
        "Content-Type": "application/json",
        Cookie: cookie
      },
      body: JSON.stringify(payload)
    });
    return res.json?.request?.data ?? null;
  }
  async searchByName(query, page) {
    const sourcePage = nameSearchSourcePage(page);
    const qs = new URLSearchParams({ w: query, p: String(sourcePage), n: "10", format: "json" });
    const res = await request("GET", `http://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp?${qs}`, {
      headers: {
        Referer: "http://m.y.qq.com",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1"
      }
    });
    const list = res.json?.data?.song?.list;
    if (!Array.isArray(list) || !list.length) return null;
    const ids = list.map((s) => String(s.songmid || s.mid || "")).filter(Boolean);
    const sliced = sliceNameSearchSongids(ids, page);
    if (!sliced.songids.length) return null;
    const byId = new Map(list.map((song) => [String(song.songmid || song.mid || ""), song]));
    const tracks = sliced.songids.map((id) => this.trackFromSong(byId.get(String(id)))).filter((item) => Boolean(item));
    return { tracks, hasMore: sliced.has_more };
  }
  async songsByIds(ids) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return [];
    const qs = new URLSearchParams({ songmid: unique.join(","), format: "json" });
    const res = await request("GET", `http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${qs}`, {
      headers: { Referer: "http://m.y.qq.com" }
    });
    const data = res.json?.data;
    if (!Array.isArray(data)) return [];
    return data.map((value) => {
      const id = String(value.mid || "");
      const authors = Array.isArray(value.singer) ? value.singer.map((s) => s.title || s.name).filter(Boolean) : [];
      const albumMid = value.album?.mid || "";
      const pic = albumMid ? `http://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : "";
      return this.wrap({
        type: "qq",
        songid: id,
        title: String(value.title || "\u672A\u77E5\u66F2\u76EE"),
        author: authors.join(",") || "\u672A\u77E5\u827A\u4EBA",
        link: `https://y.qq.com/n/ryqq/songDetail/${id}`,
        lrc: "",
        tlyric: "",
        url: "",
        pic
      });
    });
  }
  async fetchLyric(songmid) {
    const qs = new URLSearchParams({
      songmid,
      format: "json",
      nobase64: "1",
      songtype: "0",
      callback: "c"
    });
    const res = await request(
      "GET",
      `http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg?${qs}`,
      { headers: { Referer: "http://m.y.qq.com" } }
    );
    if (res.json && (res.json.lyric || res.json.trans)) return res.json;
    return jsonpToJson(res.body) || {};
  }
  async resolvePlayUrl(songmid, cookie = "") {
    const inflightKey = `${cookie ? "auth" : "private"}:${songmid}`;
    const inflight = this.playInflight.get(inflightKey);
    if (inflight) return inflight;
    const pending = this.resolvePlayUrlInner(songmid, cookie).finally(() => {
      this.playInflight.delete(inflightKey);
    });
    this.playInflight.set(inflightKey, pending);
    return pending;
  }
  async resolvePlayUrlInner(songmid, cookie = "") {
    const cacheKey = cookie ? "qq_play_auth" : "qq_play";
    const cached = this.cache.getTtl(cacheKey, songmid);
    if (cached) return cached;
    if (cookie) {
      const official = await this.officialPlayUrl(songmid, cookie);
      if (official) {
        this.cache.setTtl(cacheKey, songmid, official, 600);
        return official;
      }
    }
    const url = await firstTruthy([
      () => this.pyqPlayUrl(songmid),
      () => this.bootstrapPlayUrl(songmid)
    ]);
    if (url && !isBadMediaUrl(url)) {
      this.cache.setTtl("qq_play", songmid, url, 1800);
      return url;
    }
    return null;
  }
  async pyqPlayUrl(songmid) {
    const code = await this.getPyqCode(songmid);
    if (!code) return null;
    const url = await this.pyqFollow(songmid, code);
    return url && !isBadMediaUrl(url) ? url : null;
  }
  async officialPlayUrl(songmid, cookie) {
    const map = Object.fromEntries(
      cookie.split(";").map((part) => {
        const index = part.indexOf("=");
        return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1).trim()] : ["", ""];
      })
    );
    const rawUin = map.uin || map.wxuin || map.qqmusic_uin || "0";
    const uin = rawUin.replace(/^o/i, "").replace(/^0+/, "") || "0";
    const payload = {
      comm: { uin, format: "json", ct: 24, cv: 0, platform: "wk_v17" },
      req_0: {
        module: "vkey.GetVkeyServer",
        method: "CgiGetVkey",
        param: {
          guid: "10000",
          songmid: [songmid],
          songtype: [0],
          uin,
          loginflag: 1,
          platform: "20"
        }
      }
    };
    const res = await request("POST", "https://u.y.qq.com/cgi-bin/musicu.fcg", {
      headers: {
        Cookie: cookie,
        Referer: "https://y.qq.com/",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      timeoutMs: 6e3
    });
    const data = res.json?.req_0?.data;
    const purl = String(data?.midurlinfo?.[0]?.purl || "");
    if (!purl) return null;
    const sip = String(data?.sip?.[0] || "https://dl.stream.qqmusic.qq.com/");
    const url = `${sip.replace(/\/$/, "")}/${purl.replace(/^\//, "")}`;
    return isBadMediaUrl(url) ? null : url;
  }
  async getPyqCode(songmid) {
    const cached = this.cache.getTtl("qq_pyq", songmid, "code");
    if (cached) return cached;
    const base = bootstrapBase();
    if (!base) return null;
    const res = await request("POST", `${base}/`, {
      headers: { "X-Requested-With": "XMLHttpRequest", Referer: `${base}/` },
      body: { input: songmid, filter: "id", type: "qq", page: 1 }
    });
    const apiPath = res.json?.data?.[0]?.url;
    if (!apiPath) return null;
    const api = `${base}/${String(apiPath).replace(/^\//, "")}`;
    const loc = await followLocation(api, `${base}/`);
    const hay = loc || "";
    const m = hay.match(/[?&]code=([^&\s'"]+)/);
    if (!m) {
      const raw2 = await request("GET", api, { headers: { Referer: `${base}/`, "User-Agent": UA } });
      const fromBody = raw2.body.match(/[?&]code=([^&\s'"]+)/);
      if (fromBody) {
        this.cache.setTtl("qq_pyq", songmid, fromBody[1], 86400 * 7, "code");
        return fromBody[1];
      }
      return null;
    }
    this.cache.setTtl("qq_pyq", songmid, m[1], 86400 * 7, "code");
    return m[1];
  }
  async pyqFollow(songmid, code) {
    const play = `https://c6.y.qq.com/rsc/fcgi-bin/fcg_pyq_play.fcg?${new URLSearchParams({
      songid: "",
      songmid,
      songtype: "1",
      fromtag: "myhkw.cn",
      uin: "10001",
      code,
      cache: formatCacheStamp()
    })}`;
    const loc = await followLocation(play, "https://y.qq.com/");
    if (!loc) return null;
    if (/stream\.qqmusic\.qq\.com|aqqmusic\.tc\.qq\.com/i.test(loc)) return loc;
    return await followLocation(loc, "https://y.qq.com/") || loc;
  }
  async bootstrapPlayUrl(songmid) {
    const base = bootstrapBase();
    if (!base) return null;
    const res = await request("POST", `${base}/`, {
      headers: { "X-Requested-With": "XMLHttpRequest", Referer: `${base}/` },
      body: { input: songmid, filter: "id", type: "qq", page: 1 }
    });
    const apiPath = res.json?.data?.[0]?.url;
    if (!apiPath) return null;
    const api = `${base}/${String(apiPath).replace(/^\//, "")}`;
    let loc = await followLocation(api, `${base}/`);
    if (!loc) return null;
    if (/stream\.qqmusic\.qq\.com|aqqmusic\.tc\.qq\.com/i.test(loc)) return loc;
    return await followLocation(loc, `${base}/`) || loc;
  }
  async resolvePicUrl(songmid) {
    const qs = new URLSearchParams({ songmid, format: "json" });
    const res = await request(
      "GET",
      `http://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?${qs}`,
      { headers: { Referer: "https://y.qq.com/" } }
    );
    const albumMid = res.json?.data?.[0]?.album?.mid;
    if (!albumMid) return null;
    return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`;
  }
  async resolveLrcText(songmid) {
    const qs = new URLSearchParams({ songmid, format: "json", nobase64: "1" });
    const res = await request(
      "GET",
      `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${qs}`,
      { headers: { Referer: "https://y.qq.com/" } }
    );
    if (!res.json?.lyric) return "[00:00.00] \u6682\u65E0\u6B4C\u8BCD\n";
    return decodeEntities(String(res.json.lyric));
  }
  trackFromSong(song) {
    const mid = song.songmid || song.mid || "";
    if (!mid) return null;
    const artists = [];
    if (Array.isArray(song.singer)) {
      for (const s of song.singer) if (s?.name) artists.push(s.name);
    }
    const albummid = song.albummid || song.album?.mid || "";
    const pic = albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : "";
    return this.wrap({
      type: "qq",
      songid: String(mid),
      title: String(song.songname || song.title || song.name || "\u672A\u77E5\u66F2\u76EE"),
      author: artists.join(", ") || "\u672A\u77E5\u827A\u4EBA",
      link: `https://y.qq.com/n/ryqq/songDetail/${mid}`,
      lrc: "",
      url: "",
      pic
    });
  }
};
function formatCacheStamp() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// src/app.ts
init_sign();
function jsonResponse(data, code, error, extra = {}) {
  return new Response(JSON.stringify({ data, code, error, ...extra }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
async function proxyMedia(url, req, opts) {
  const neteaseCdn = /(163\.com|126\.net|netease)/i.test(url);
  const cnIp = neteaseCdn ? randomCnIp() : "";
  const headers = {
    "User-Agent": neteaseCdn ? NETEASE_UA : UA,
    Referer: mediaReferer(url),
    Accept: "*/*"
  };
  if (cnIp) {
    headers["X-Real-IP"] = cnIp;
    headers["X-Forwarded-For"] = cnIp;
  }
  if (opts.cookie) headers.Cookie = opts.cookie;
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  try {
    const res = await fetch(url, { headers, redirect: "follow" });
    if (res.status >= 400) {
      return new Response(opts.download ? "\u65E0\u6CD5\u83B7\u53D6\u64AD\u653E\u5730\u5740" : "\u4E0A\u6E38\u8D44\u6E90\u4E0D\u53EF\u7528", { status: res.status });
    }
    const out = new Headers();
    out.set("Content-Type", res.headers.get("content-type") || opts.contentType || "audio/mpeg");
    out.set("Cache-Control", opts.contentType?.startsWith("image/") ? "public, max-age=86400" : "no-store");
    out.set("Accept-Ranges", "bytes");
    const len = res.headers.get("content-length");
    if (len) out.set("Content-Length", len);
    const cr = res.headers.get("content-range");
    if (cr) out.set("Content-Range", cr);
    if (opts.download && opts.filename) {
      out.set(
        "Content-Disposition",
        `attachment; filename="${opts.filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(opts.filename)}`
      );
    }
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return new Response(opts.download || !opts.contentType?.startsWith("image/") ? "\u65E0\u6CD5\u83B7\u53D6\u64AD\u653E\u5730\u5740" : "\u5C01\u9762\u4E0D\u53EF\u7528", {
      status: 502
    });
  }
}
function createApp(options) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || "0";
  const secret = apiSecret(options.coreMarker || join6(options.webRoot, "core"));
  const cache = new FileCache(options.cacheDir);
  const netease = new NeteaseService(cache, secret);
  const qq = new QqService(cache, secret);
  const neteaseAccount = new NeteaseAccount(cache, netease);
  const qqAccount = new QqAccount(cache, qq);
  const lyrics = new LyricsService(
    cache,
    netease,
    qq,
    () => neteaseAccount.sessionCookie(),
    () => qqAccount.sessionCookie()
  );
  const app2 = new Hono2();
  const mime = {
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".map": "application/json",
    ".webp": "image/webp"
  };
  const sendFile = (rel) => {
    const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
    const file = join6(options.webRoot, safe);
    if (!file.startsWith(options.webRoot) || !existsSync4(file) || !statSync(file).isFile()) {
      return new Response("Not found", { status: 404 });
    }
    const stream = Readable.toWeb(createReadStream(file));
    return new Response(stream, {
      headers: { "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream" }
    });
  };
  app2.get("/static/*", (c) => sendFile(c.req.path.slice(1)));
  app2.get("/favicon.ico", () => sendFile("favicon.ico"));
  app2.get("/help.php", (c) => c.redirect("/?doc=help", 302));
  app2.get("/help", (c) => c.redirect("/?doc=help", 302));
  app2.get("/disclaimer.php", (c) => c.redirect("/?doc=disclaimer", 302));
  app2.get("/disclaimer", (c) => c.redirect("/?doc=disclaimer", 302));
  app2.get("/privacy.php", (c) => c.redirect("/?doc=privacy", 302));
  app2.get("/privacy", (c) => c.redirect("/?doc=privacy", 302));
  app2.all("/api.php", async (c) => {
    const get = (c.req.query("get") || "").trim();
    const typeRaw = (c.req.query("type") || "").trim();
    const id = (c.req.query("id") || "").trim();
    const given = (c.req.query("sign") || "").trim();
    const t = (c.req.query("t") || "").trim();
    if (!get || !typeRaw || !id || !given || !t) return c.text("\u7F3A\u5C11\u8BF7\u6C42\u53C2\u6570", 400);
    if (!verifySign(secret, get, typeRaw, id, t, given)) return c.text("\u975E\u6CD5\u8BF7\u6C42", 403);
    let type = typeRaw === "wy" ? "netease" : typeRaw;
    if (type !== "qq" && type !== "netease") return c.text("\u6682\u4E0D\u652F\u6301\u8BE5\u97F3\u6E90", 400);
    if (type === "qq" && !/^[a-zA-Z0-9]+$/.test(id)) return c.text("Invalid id", 400);
    if (type === "netease" && !/^\d+$/.test(id)) return c.text("Invalid id", 400);
    if (get === "url") {
      const useAuth = Boolean(c.req.query("auth"));
      const level = String(c.req.query("level") || "").trim();
      const neteaseCookie = useAuth ? neteaseAccount.sessionCookie() || "" : "";
      const qqCookie = useAuth ? qqAccount.sessionCookie() || "" : "";
      let play = type === "qq" ? await qq.resolvePlayUrl(id, qqCookie) : await netease.resolvePlayUrl(id, neteaseCookie, level);
      if (!play && useAuth) {
        play = type === "qq" ? await qq.resolvePlayUrl(id) : await netease.resolvePlayUrl(id, "", level);
      }
      if (!play) return c.text("\u65E0\u6CD5\u83B7\u53D6\u64AD\u653E\u5730\u5740", 502);
      if (c.req.query("probe")) return new Response(null, { status: 204 });
      let name = c.req.query("name") || "RyanMusic";
      name = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_");
      if (!/\.mp3$/i.test(name)) name += ".mp3";
      const proxyOpts = {
        download: Boolean(c.req.query("dl")),
        filename: name,
        contentType: "audio/mpeg",
        cookie: type === "netease" ? neteaseCookie : type === "qq" ? qqCookie : void 0
      };
      let streamed = await proxyMedia(play, c.req.raw, proxyOpts);
      if (streamed.status >= 400 && useAuth) {
        const fallback = type === "qq" ? await qq.resolvePlayUrl(id) : await netease.resolvePlayUrl(id, "");
        if (fallback && fallback !== play) {
          streamed = await proxyMedia(fallback, c.req.raw, { ...proxyOpts, cookie: void 0 });
        }
      }
      return streamed;
    }
    if (get === "pic") {
      const pic = type === "qq" ? await qq.resolvePicUrl(id) : await netease.resolvePicUrl(id);
      if (!pic) return c.text("\u5C01\u9762\u4E0D\u5B58\u5728", 404);
      const streamed = await proxyMedia(pic, c.req.raw, { contentType: "image/jpeg" });
      return streamed.status >= 400 ? c.text("\u5C01\u9762\u4E0D\u5B58\u5728", 404) : streamed;
    }
    if (get === "lrc") {
      if (type !== "qq") return c.text("\u8BE5\u97F3\u6E90\u6B4C\u8BCD\u65E0\u9700\u4EE3\u7406", 400);
      return c.text(await qq.resolveLrcText(id));
    }
    return c.text("\u672A\u77E5\u8D44\u6E90\u7C7B\u578B", 400);
  });
  const handleIndex = async (c) => {
    if (c.req.query("cover") && c.req.query("type") && c.req.query("id")) {
      let type = c.req.query("type") === "wy" ? "netease" : c.req.query("type");
      const id = c.req.query("id") || "";
      if (type !== "netease" && type !== "qq" || !id) return c.text("Invalid cover", 400);
      const { proxyUrl: proxyUrl2 } = await Promise.resolve().then(() => (init_sign(), sign_exports));
      c.header("Cache-Control", "public, max-age=3600");
      return c.redirect(proxyUrl2(secret, "pic", type, id), 302);
    }
    if (c.req.query("download") && c.req.query("url")) {
      const url = c.req.query("url") || "";
      if (!/^https?:\/\//i.test(url)) return c.text("Invalid url", 400);
      let name = c.req.query("name") || "RyanMusic";
      name = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_");
      if (!/\.mp3$/i.test(name)) name += ".mp3";
      return proxyMedia(url, c.req.raw, { download: true, filename: name });
    }
    const xhr = (c.req.header("x-requested-with") || "") === "XMLHttpRequest";
    if (c.req.method === "POST" && xhr) {
      const body = await c.req.parseBody();
      const post = {};
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "string") post[k] = v;
      }
      const action = (post.action || "").trim();
      if (action.startsWith("netease_")) {
        if (action === "netease_qualities") {
          const songid = String(post.id || post.songid || "").trim();
          const cookie = neteaseAccount.sessionCookie() || "";
          if (!songid || !cookie) {
            return jsonResponse({ qualities: [] }, 200);
          }
          const qualities = await netease.probePlayQualities(songid, cookie);
          return jsonResponse({ qualities }, 200);
        }
        const result = await neteaseAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action.startsWith("qq_")) {
        const result = await qqAccount.handle(action, post);
        return jsonResponse(result.data, result.code, result.error);
      }
      if (action === "lyrics") {
        const lyricType = (post.type || "").trim();
        const lyricId = (post.id || "").trim();
        if (lyricType !== "netease" && lyricType !== "qq") {
          return jsonResponse("", 403, "\u6B4C\u8BCD\u7C7B\u578B\u65E0\u6548");
        }
        if (!lyricId) return jsonResponse("", 403, "\u7F3A\u5C11\u6B4C\u66F2 ID");
        try {
          const data = await lyrics.fetch(lyricType, lyricId);
          return jsonResponse(data, 200, "");
        } catch (err) {
          return jsonResponse("", 502, `(\xB0\u30FC\xB0\u3003) ${err instanceof Error ? err.message : "\u6B4C\u8BCD\u83B7\u53D6\u5931\u8D25"}`);
        }
      }
      const input = (post.input || "").trim();
      const filter = post.filter;
      const type = post.type;
      const page = Number(post.page || 1) || 1;
      if (!input || !filter || !type) {
        return jsonResponse("", 403, "(\xB0\u30FC\xB0\u3003) \u4F20\u5165\u7684\u6570\u636E\u4E0D\u5BF9\u554A");
      }
      if (filter !== "url" && type !== "netease" && type !== "qq") {
        return jsonResponse("", 403, "(\xB0\u30FC\xB0\u3003) \u76EE\u524D\u8FD8\u4E0D\u652F\u6301\u8FD9\u4E2A\u7F51\u7AD9");
      }
      const patterns = {
        name: /^.+$/i,
        id: /^[\w/|]+$/i,
        url: /^https?:\/\/\S+$/i
      };
      if (!patterns[filter]?.test(input)) {
        return jsonResponse("", 403, "(\u30FB-\u30FB*) \u8BF7\u68C0\u67E5\u60A8\u7684\u8F93\u5165\u662F\u5426\u6B63\u786E");
      }
      try {
        let result = null;
        if (filter === "name") {
          result = type === "qq" ? await qq.searchByName(input, page) : await netease.searchByName(input, page);
        } else if (filter === "id") {
          const tracks = type === "qq" ? await qq.songsByIds([input]) : await netease.songsByIds([input]);
          result = { tracks, hasMore: false };
        } else {
          const parsed = parseSongUrl(input);
          if (!parsed) return jsonResponse("", 404, "\u311F( \u2594, \u2594 )\u310F \u6CA1\u6709\u627E\u5230\u76F8\u5173\u4FE1\u606F");
          const tracks = parsed.site === "qq" ? await qq.songsByIds([parsed.id]) : await netease.songsByIds([parsed.id]);
          result = { tracks, hasMore: false };
        }
        if (!result || !result.tracks.length) {
          return jsonResponse("", 404, "\u311F( \u2594, \u2594 )\u310F \u6CA1\u6709\u627E\u5230\u76F8\u5173\u4FE1\u606F");
        }
        return jsonResponse(result.tracks, 200, "", { has_more: Boolean(result.hasMore) });
      } catch (err) {
        return jsonResponse("", 502, `(\xB0\u30FC\xB0\u3003) ${err instanceof Error ? err.message : "\u641C\u7D22\u5931\u8D25"}`);
      }
    }
    const html = spaHtml(options.webRoot);
    if (!html) {
      return c.text(
        `RyanMusic ${VERSION}: \u524D\u7AEF\u672A\u6784\u5EFA\u3002\u8BF7\u5148\u8FD0\u884C web \u76EE\u5F55 npm run build\u3002`,
        500
      );
    }
    return c.html(html);
  };
  app2.get("/", handleIndex);
  app2.post("/", handleIndex);
  app2.get("/index.php", handleIndex);
  app2.post("/index.php", handleIndex);
  return app2;
}

// src/vercel.ts
var webRoot = join7(process.cwd(), "maicong-music");
var app = createApp({
  webRoot,
  cacheDir: process.env.RYANMUSIC_CACHE_DIR || "/tmp/ryanmusic-cache",
  coreMarker: join7(webRoot, "core")
});
async function handleRequest(request2) {
  try {
    return await app.fetch(request2);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    return new Response(message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
var vercel_default = app;
var GET = handleRequest;
var POST = handleRequest;
var PUT = handleRequest;
var PATCH = handleRequest;
var DELETE = handleRequest;
var HEAD = handleRequest;
var OPTIONS = handleRequest;
var config = { runtime: "nodejs", maxDuration: 60 };
export {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  PATCH,
  POST,
  PUT,
  config,
  vercel_default as default
};
