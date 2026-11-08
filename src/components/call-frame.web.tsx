/** Web preview: the bundled call page in an iframe (srcdoc), API requests answered from Firestore. */
import { createElement, useEffect, useMemo, useState } from 'react';

import { CallBridge } from '@/lib/call-bridge';
import { CALL_HTML } from '@/lib/call-html';

export function CallFrame({ params, onClose }: { url: string; params: Record<string, string>; onClose: () => void }) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const bridge = useMemo(() => new CallBridge(Number(params.call)), [params.call]);
  useEffect(() => () => bridge.stop(), [bridge]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame?.contentWindow) return;
      try {
        const m = JSON.parse(String(e.data)) as { type: string; id: number; path: string; method: string; body?: { kind?: string; data?: unknown } };
        const reply = (ok: boolean, data: unknown) => frame?.contentWindow?.postMessage(JSON.stringify({ type: 'apiReply', id: m.id, ok, data }), '*');
        if (m.type === 'close') onClose();
        else if (m.type === 'api')
          bridge.handle(m.path, m.method, m.body).then(
            (d) => reply(true, d),
            (err: unknown) => reply(false, { error: err instanceof Error ? err.message : 'failed' })
          );
      } catch {}
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onClose, bridge, frame]);

  const html = CALL_HTML.replace('<script>', `<script>window.__P = ${JSON.stringify({ ...params, bridge: '1' })};</script><script>`);
  return createElement('iframe', { ref: setFrame, srcDoc: html, allow: 'camera; microphone; autoplay', style: { border: 0, width: '100%', height: '100%', background: '#000' } });
}
