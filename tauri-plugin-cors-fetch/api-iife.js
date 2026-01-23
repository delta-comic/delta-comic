class CORSFetch {
  constructor() {
    window.fetchNative = window.fetch.bind(window);
    window.fetch = this.fetchCORS.bind(this);
    window.fetchCORS = (input, init) => this.fetchCORS(input, init, true);
  }

  _config = {
    include: [],
    exclude: [],
    request: {
      proxy: undefined,
      connectTimeout: undefined,
      maxRedirections: undefined,
      userAgent: navigator.userAgent,
      danger: {
        acceptInvalidCerts: false,
        acceptInvalidHostnames: false,
      },
    },
  };

  config(newConfig) {
    this._config = this._deepMerge(this._config, newConfig);
  }

  async fetchCORS(input, init, force = false) {
    const urlStr = input instanceof Request ? input.url : String(input);

    if (!force && !this._shouldUseCORSProxy(urlStr)) {
      return window.fetchNative(input, init);
    }

    const signal = init?.signal;
    if (signal?.aborted) throw this._cancel_error;

    let rid = null;
    let responseRid = null;
    let isFinished = false;

    const cleanup = (_reason) => {
      if (isFinished) return;
      isFinished = true;

      signal?.removeEventListener("abort", onAbort);

      if (responseRid !== null) {
        this.invoke("plugin:cors-fetch|fetch_cancel_body", {
          rid: responseRid,
        }).catch(() => {});
      }

      if (rid !== null) {
        this.invoke("plugin:cors-fetch|fetch_cancel", { rid }).catch(() => {});
      }
    };

    const onAbort = () => cleanup("abort");
    signal?.addEventListener("abort", onAbort);

    const {
      maxRedirections = this._config.request.maxRedirections,
      connectTimeout = this._config.request.connectTimeout,
      proxy = this._config.request.proxy,
      danger = this._config.request.danger,
      userAgent = this._config.request.userAgent,
      ...nativeInit
    } = init || {};

    const req = new Request(input, nativeInit);
    const buffer = await req.arrayBuffer();

    if (signal?.aborted) throw this._cancel_error;

    try {
      rid = await this.invoke("plugin:cors-fetch|fetch", {
        clientConfig: {
          method: req.method,
          url: urlStr,
          headers: Array.from(req.headers.entries()),
          data: buffer.byteLength ? Array.from(new Uint8Array(buffer)) : null,
          maxRedirections,
          connectTimeout,
          proxy,
          danger,
          userAgent,
        },
      });

      if (signal?.aborted) throw this._cancel_error;

      const {
        status,
        statusText,
        url,
        headers: responseHeaders,
        rid: _rid,
      } = await this.invoke("plugin:cors-fetch|fetch_send", {
        rid,
      });
      responseRid = _rid;

      if (signal?.aborted) throw this._cancel_error;

      const readChunk = async (controller) => {
        if (signal?.aborted) {
          controller.error(this._cancel_error);
          return;
        }

        try {
          const data = await this.invoke("plugin:cors-fetch|fetch_read_body", {
            rid: responseRid,
          });
          const dataUint8 = new Uint8Array(data);
          const lastByte = dataUint8[dataUint8.byteLength - 1];
          const actualData = dataUint8.slice(0, dataUint8.byteLength - 1);

          // close when the signal to close (last byte is 1) is sent from the IPC.
          if (lastByte === 1) {
            controller.close();
            return;
          }

          controller.enqueue(actualData);
        } catch (e) {
          controller.error(e);
          cleanup();
        }
      };

      // no body for 101, 103, 204, 205 and 304
      // see https://fetch.spec.whatwg.org/#null-body-status
      const body = [101, 103, 204, 205, 304].includes(status)
        ? null
        : new ReadableStream({ pull: readChunk, cancel: onAbort });

      const res = new Response(body, {
        status,
        statusText,
      });

      // Set `Response` properties that are ignored by the
      // constructor, like url and some headers
      //
      // Since url and headers are read only properties
      // this is the only way to set them.
      Object.defineProperty(res, "url", { value: url });
      Object.defineProperty(res, "headers", {
        value: new Headers(responseHeaders),
      });

      return res;
    } catch (err) {
      cleanup();
      throw err;
    }
  }

  _cancel_error = "User cancelled the request";

  get invoke() {
    return window.__TAURI_INTERNALS__.invoke;
  }

  _matchesPattern(url, patterns) {
    if (!patterns || patterns.length === 0) return false;
    return patterns.some((pattern) => {
      if (typeof pattern === "string") return url.includes(pattern);
      if (pattern instanceof RegExp) return pattern.test(url);
      return false;
    });
  }

  _shouldUseCORSProxy(url) {
    // Exclude Tauri internal protocols (ipc:// or asset://)
    // https://github.com/tauri-apps/tauri/blob/b5c549d1898ecdb712822c02dc665cc6771fbd07/crates/tauri/scripts/core.js#L16
    const isTauriProtocol =
      /^(ipc|asset):\/\/localhost\//i.test(url) ||
      /^http:\/\/(ipc|asset)\.localhost\//i.test(url);
    if (isTauriProtocol) return false;

    const { include, exclude } = this._config;

    // Priority: exclusion list
    if (exclude.length > 0 && this._matchesPattern(url, exclude)) {
      return false;
    }

    // If there is an inclusion list, only proxy URLs in that list
    if (include.length > 0) {
      return this._matchesPattern(url, include);
    }

    // Default: proxy all http(s) requests
    return /^https?:\/\//i.test(url);
  }

  _deepMerge(target, source) {
    const isObject = (item) => {
      return item && typeof item === "object" && !Array.isArray(item);
    };
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }
}

(function () {
  if (
    typeof window !== "undefined" &&
    window.__TAURI_INTERNALS__ &&
    !window.CORSFetch
  ) {
    window.CORSFetch = new CORSFetch();
  }
})();
