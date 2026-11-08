/**
 * The call page in a WebView (iOS/Android). WKWebView runs WebRTC; camera/mic prompts are granted to the page.
 * The page is bundled in the app (src/lib/call-html.ts) and loaded inline; its API requests come back here
 * and are answered from Firestore (CallBridge), so no server needs to be reachable for a call.
 */
import { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';

import { API_BASE } from '@/lib/api';
import { CallBridge } from '@/lib/call-bridge';
import { CALL_HTML } from '@/lib/call-html';

export function CallFrame({ params, onClose }: { url: string; params: Record<string, string>; onClose: () => void }) {
  const ref = useRef<WebView>(null);
  const bridge = useMemo(() => new CallBridge(Number(params.call)), [params.call]);
  useEffect(() => () => bridge.stop(), [bridge]);

  const reply = (id: number, ok: boolean, data: unknown) => ref.current?.injectJavaScript(`window.__apiReply(${id}, ${ok}, ${JSON.stringify(data)}); true;`);

  return (
    <WebView
      ref={ref}
      source={{ html: CALL_HTML, baseUrl: API_BASE + '/call' }}
      injectedJavaScriptBeforeContentLoaded={`window.__P = ${JSON.stringify(params)}; true;`}
      style={{ flex: 1, backgroundColor: '#000' }}
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      javaScriptEnabled
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data) as { type: string; id: number; path: string; method: string; body?: { kind?: string; data?: unknown } };
          if (m.type === 'close') onClose();
          else if (m.type === 'api')
            bridge.handle(m.path, m.method, m.body).then(
              (d) => reply(m.id, true, d),
              (err: unknown) => reply(m.id, false, { error: err instanceof Error ? err.message : 'failed' })
            );
        } catch {}
      }}
    />
  );
}
