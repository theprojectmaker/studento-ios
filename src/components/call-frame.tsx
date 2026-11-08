/** The call page in a WebView (iOS/Android). WKWebView runs WebRTC; camera/mic prompts are granted to the page. */
import { WebView } from 'react-native-webview';

export function CallFrame({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: '#000' }}
      originWhitelist={['https://*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      javaScriptEnabled
      onMessage={(e) => {
        try {
          if (JSON.parse(e.nativeEvent.data).type === 'close') onClose();
        } catch {}
      }}
    />
  );
}
