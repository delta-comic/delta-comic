import darkStyle from './dark.css?inline'
import lightStyle from './light.css?inline'

export const createTemplate = (cfg: {
  color: string
  isDark: boolean
  content: string
  messageKey: string
  delegateLinkOpen: boolean
}) => `
<!doctype html>
<html lang="zh-cn" class="static size-full">
  <head>
    <meta charset="UTF-8" />
    <title>Markdown</title>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
  </head>
  <body>
    <style>
      :root {
        --p-color: ${cfg.color};
      }
      ${cfg.isDark ? darkStyle : lightStyle}
    </style>
    <div id="write">
      ${cfg.content}
    </div>
    <script>
      document.addEventListener('click', function(e){
        const el = e.target.closest('a');
        if(!el) return;
        const href = el.dataset.href || el.getAttribute('href');
        if(!href) return;
        e.preventDefault();
        if(!${cfg.delegateLinkOpen}) {
          window.open(href, '_blank', 'noopener,noreferrer');
          return;
        }
        // 发送请求给父窗口，请求导航
        window.parent.postMessage({ type:'${cfg.messageKey}', href });
      });
    </script>
  </body>
</html>
`