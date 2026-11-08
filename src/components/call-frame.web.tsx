/** Web preview: the call page in an iframe with camera/mic allowed. */
import { createElement, useEffect } from 'react';

export function CallFrame({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const on = (e: MessageEvent) => {
      try {
        if (JSON.parse(String(e.data)).type === 'close') onClose();
      } catch {}
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onClose]);
  return createElement('iframe', { src: url, allow: 'camera; microphone; autoplay', style: { border: 0, width: '100%', height: '100%', background: '#000' } });
}
