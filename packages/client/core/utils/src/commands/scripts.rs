const DEFAULT_CALLBACK_NAME: &str = "callback";

pub(crate) fn callback_name(value: Option<&str>) -> &str {
  match value {
    Some(value) if !value.trim().is_empty() => value.trim(),
    _ => DEFAULT_CALLBACK_NAME,
  }
}

pub(crate) fn install_bridge_script(
  css: Option<&str>,
  js: Option<&str>,
  callback_name: &str,
) -> String {
  format!(
    r#"(function () {{
  const deltaComicAuthOptions = {{
    css: {css},
    js: {js},
    callbackName: {callback_name}
  }};
  const source = 'delta-comic-auth';
  const bridgeKey = '__DELTA_COMIC_AUTH_BRIDGE__';
  const resultKey = '__DELTA_COMIC_AUTH_CALLBACK_RESULT__';

  const errorText = error => {{
    if (!error) return 'unknown error';
    return error && error.message ? String(error.message) : String(error);
  }};

  const normalizeValue = value => {{
    try {{
      return JSON.parse(JSON.stringify(value));
    }} catch (error) {{
      return String(value);
    }}
  }};

  const readCookie = errors => {{
    try {{
      return document.cookie || '';
    }} catch (error) {{
      errors.push('cookie: ' + errorText(error));
      return '';
    }}
  }};

  const readStorage = (name, errors) => {{
    const entries = [];
    try {{
      const storage = window[name];
      if (!storage) return entries;
      for (let index = 0; index < storage.length; index += 1) {{
        const key = storage.key(index);
        if (key === null) continue;
        entries.push({{ key, value: storage.getItem(key) || '' }});
      }}
    }} catch (error) {{
      errors.push(name + ': ' + errorText(error));
    }}
    return entries;
  }};

  const collect = reason => {{
    const errors = [];
    const callback = window[resultKey] || null;
    return {{
      frameId: window[bridgeKey] && window[bridgeKey].frameId ? window[bridgeKey].frameId : '',
      reason: reason || 'snapshot',
      top: window.top === window,
      href: String(location.href),
      origin: String(location.origin),
      title: String(document.title || ''),
      cookie: readCookie(errors),
      localStorage: readStorage('localStorage', errors),
      sessionStorage: readStorage('sessionStorage', errors),
      callback,
      errors,
      collectedAt: Date.now()
    }};
  }};

  const ensureTopStore = bridge => {{
    if (window.top !== window) return;
    if (!bridge.frames) bridge.frames = {{}};
  }};

  const directFrameSnapshots = () => {{
    const frames = [];
    const inaccessibleFrames = [];
    document.querySelectorAll('iframe').forEach((iframe, index) => {{
      try {{
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) throw new Error('missing contentWindow');
        if (frameWindow[bridgeKey] && frameWindow[bridgeKey].collect) {{
          frames.push(frameWindow[bridgeKey].collect('direct'));
          return;
        }}
        const errors = [];
        const readFrameStorage = name => {{
          const entries = [];
          const storage = frameWindow[name];
          if (!storage) return entries;
          for (let storageIndex = 0; storageIndex < storage.length; storageIndex += 1) {{
            const key = storage.key(storageIndex);
            if (key === null) continue;
            entries.push({{ key, value: storage.getItem(key) || '' }});
          }}
          return entries;
        }};
        frames.push({{
          frameId: 'direct-' + index,
          reason: 'direct',
          top: false,
          href: String(frameWindow.location.href),
          origin: String(frameWindow.location.origin),
          title: String(frameWindow.document.title || ''),
          cookie: frameWindow.document.cookie || '',
          localStorage: readFrameStorage('localStorage'),
          sessionStorage: readFrameStorage('sessionStorage'),
          callback: frameWindow[resultKey] || null,
          errors,
          collectedAt: Date.now()
        }});
      }} catch (error) {{
        inaccessibleFrames.push({{
          index,
          src: iframe.getAttribute('src') || '',
          error: errorText(error)
        }});
      }}
    }});
    return {{ frames, inaccessibleFrames }};
  }};

  let bridge = window[bridgeKey];
  if (!bridge) {{
    bridge = {{
      frameId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      frames: undefined,
      collect,
      send(reason) {{
        const payload = collect(reason);
        if (window.top === window) {{
          ensureTopStore(bridge);
          bridge.frames[payload.frameId] = payload;
          return;
        }}
        try {{
          window.top.postMessage({{ source, type: 'frame-snapshot', payload }}, '*');
        }} catch (error) {{
          // Ignore postMessage failures; the caller still gets direct snapshots when possible.
        }}
      }},
      requestFrames() {{
        bridge.send('request');
        document.querySelectorAll('iframe').forEach(iframe => {{
          try {{
            if (iframe.contentWindow) {{
              iframe.contentWindow.postMessage({{ source, type: 'snapshot-request' }}, '*');
            }}
          }} catch (error) {{
            // Cross-origin frames are expected here. If the bridge was installed in the frame,
            // it can still reply to the postMessage request.
          }}
        }});
      }},
      collectFrames() {{
        ensureTopStore(bridge);
        const direct = directFrameSnapshots();
        const byId = {{}};
        Object.values(bridge.frames || {{}}).forEach(frame => {{
          if (frame && !frame.top) byId[frame.frameId] = frame;
        }});
        direct.frames.forEach(frame => {{
          byId[frame.frameId] = frame;
        }});
        return {{
          top: collect('collect'),
          frames: Object.values(byId),
          inaccessibleFrames: direct.inaccessibleFrames
        }};
      }}
    }};
    Object.defineProperty(window, bridgeKey, {{
      configurable: true,
      enumerable: false,
      value: bridge,
      writable: false
    }});
    window.addEventListener('message', event => {{
      const data = event.data;
      if (!data || data.source !== source) return;
      if (data.type === 'snapshot-request') {{
        bridge.send('message');
      }}
      if (window.top === window && data.type === 'frame-snapshot' && data.payload) {{
        ensureTopStore(bridge);
        bridge.frames[data.payload.frameId] = data.payload;
      }}
    }});
    window.addEventListener('load', () => bridge.send('load'));
  }}

  const authCallback = value => {{
    const snapshot = collect('callback');
    const callback = {{
      value: normalizeValue(value),
      href: snapshot.href,
      title: snapshot.title,
      cookie: snapshot.cookie,
      localStorage: snapshot.localStorage,
      sessionStorage: snapshot.sessionStorage,
      collectedAt: Date.now()
    }};
    window[resultKey] = callback;
    bridge.send('callback');
    return value;
  }};

  try {{
    Object.defineProperty(window, deltaComicAuthOptions.callbackName, {{
      configurable: true,
      enumerable: false,
      value: authCallback,
      writable: true
    }});
  }} catch (error) {{
    window[deltaComicAuthOptions.callbackName] = authCallback;
  }}
  if (deltaComicAuthOptions.callbackName !== 'callback' && typeof window.callback !== 'function') {{
    window.callback = authCallback;
  }}

  const injectStyle = () => {{
    if (!deltaComicAuthOptions.css || !document.documentElement) return;
    const style = document.createElement('style');
    style.setAttribute('data-delta-comic-auth', 'true');
    style.textContent = deltaComicAuthOptions.css;
    (document.head || document.documentElement).appendChild(style);
  }};

  if (document.head || document.documentElement) {{
    injectStyle();
  }} else {{
    document.addEventListener('DOMContentLoaded', injectStyle, {{ once: true }});
  }}

  bridge.send('install');

  if (deltaComicAuthOptions.js) {{
    try {{
      (0, eval)(deltaComicAuthOptions.js);
    }} catch (error) {{
      console.error('[delta-comic auth] injected script failed', error);
    }}
  }}
}})();"#,
    css = json_literal(css.unwrap_or_default()),
    js = json_literal(js.unwrap_or_default()),
    callback_name = json_literal(callback_name),
  )
}

pub(crate) fn top_snapshot_script() -> &'static str {
  r#"(function () {
  const bridge = window.__DELTA_COMIC_AUTH_BRIDGE__;
  if (bridge && bridge.collect) return bridge.collect('snapshot');
  const errors = [];
  const readStorage = name => {
    const entries = [];
    try {
      const storage = window[name];
      if (!storage) return entries;
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key === null) continue;
        entries.push({ key, value: storage.getItem(key) || '' });
      }
    } catch (error) {
      errors.push(name + ': ' + (error && error.message ? error.message : String(error)));
    }
    return entries;
  };
  let cookie = '';
  try {
    cookie = document.cookie || '';
  } catch (error) {
    errors.push('cookie: ' + (error && error.message ? error.message : String(error)));
  }
  return {
    frameId: 'top',
    reason: 'snapshot',
    top: true,
    href: String(location.href),
    origin: String(location.origin),
    title: String(document.title || ''),
    cookie,
    localStorage: readStorage('localStorage'),
    sessionStorage: readStorage('sessionStorage'),
    callback: window.__DELTA_COMIC_AUTH_CALLBACK_RESULT__ || null,
    errors,
    collectedAt: Date.now()
  };
})()"#
}

pub(crate) fn iframe_request_script() -> &'static str {
  r#"(function () {
  const bridge = window.__DELTA_COMIC_AUTH_BRIDGE__;
  if (bridge && bridge.requestFrames) bridge.requestFrames();
})()"#
}

pub(crate) fn iframe_collect_script() -> &'static str {
  r#"(function () {
  const bridge = window.__DELTA_COMIC_AUTH_BRIDGE__;
  if (bridge && bridge.collectFrames) return bridge.collectFrames();
  return {
    top: (function () {
      const errors = [];
      const readStorage = name => {
        const entries = [];
        try {
          const storage = window[name];
          if (!storage) return entries;
          for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key === null) continue;
            entries.push({ key, value: storage.getItem(key) || '' });
          }
        } catch (error) {
          errors.push(name + ': ' + (error && error.message ? error.message : String(error)));
        }
        return entries;
      };
      let cookie = '';
      try {
        cookie = document.cookie || '';
      } catch (error) {
        errors.push('cookie: ' + (error && error.message ? error.message : String(error)));
      }
      return {
        frameId: 'top',
        reason: 'collect',
        top: true,
        href: String(location.href),
        origin: String(location.origin),
        title: String(document.title || ''),
        cookie,
        localStorage: readStorage('localStorage'),
        sessionStorage: readStorage('sessionStorage'),
        callback: window.__DELTA_COMIC_AUTH_CALLBACK_RESULT__ || null,
        errors,
        collectedAt: Date.now()
      };
    })(),
    frames: [],
    inaccessibleFrames: []
  };
})()"#
}

fn json_literal(value: &str) -> String {
  serde_json::to_string(value).expect("string serialization should not fail")
}

#[cfg(test)]
#[path = "../../test/src/commands/scripts.rs"]
mod tests;
