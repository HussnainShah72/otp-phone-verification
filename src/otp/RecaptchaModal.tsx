import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors, radius, spacing } from '../theme';

/**
 * Firebase phone auth always requires a reCAPTCHA token, and the JS SDK's
 * RecaptchaVerifier is a DOM widget — which React Native does not have.
 *
 * This hosts the widget inside a WebView instead: the page loads the Firebase
 * compat SDK, lets it run its normal reCAPTCHA flow (it knows how to fetch the
 * project's site key), and posts the resulting token back over the bridge. The
 * token is then handed to `signInWithPhoneNumber` through a custom
 * ApplicationVerifier, which is all the modular SDK actually requires.
 *
 * This replaces `expo-firebase-recaptcha`, which is unmaintained and still
 * imports `expo-firebase-core` — a package removed from Expo after SDK 47.
 */

/** Pinned so the WebView and the app agree on SDK behaviour. */
const FIREBASE_COMPAT_VERSION = '10.14.1';

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

export type RecaptchaModalHandle = {
  /** Resolves with a reCAPTCHA token, or rejects if the user cancels. */
  verify: () => Promise<string>;
};

type Pending = {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
};

function buildHtml(config: FirebaseWebConfig, languageCode: string): string {
  // JSON.stringify guards against quotes/newlines in any config value.
  const cfg = JSON.stringify(config);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0; padding: 0; height: 100%;
        font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
        background: #ffffff;
        display: flex; align-items: center; justify-content: center;
      }
      #status { color: #64748B; font-size: 14px; text-align: center; padding: 24px; }
      #recaptcha-container { display: flex; align-items: center; justify-content: center; }
    </style>
    <script src="https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/${FIREBASE_COMPAT_VERSION}/firebase-auth-compat.js"></script>
  </head>
  <body>
    <div id="status">Checking that you are not a robot...</div>
    <div id="recaptcha-container"></div>
    <script>
      function post(message) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }

      function fail(stage, error) {
        post({ type: 'error', stage: stage, message: String((error && error.message) || error) });
      }

      try {
        firebase.initializeApp(${cfg});
        var auth = firebase.auth();
        auth.languageCode = ${JSON.stringify(languageCode)} || null;

        // "normal" rather than "invisible": an invisible widget resolves without
        // ever drawing, so a challenge the user must actually solve would have
        // nowhere to appear inside this WebView.
        var verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          size: 'normal',
          callback: function (token) {
            document.getElementById('status').textContent = 'Verified.';
            post({ type: 'token', token: token });
          },
          'expired-callback': function () {
            fail('expired', 'The reCAPTCHA challenge expired. Please try again.');
          },
          'error-callback': function (err) {
            fail('widget', err);
          },
        });

        verifier
          .render()
          .then(function () {
            document.getElementById('status').style.display = 'none';
            post({ type: 'ready' });
          })
          .catch(function (err) {
            fail('render', err);
          });
      } catch (err) {
        fail('init', err);
      }
    </script>
  </body>
</html>`;
}

type Props = {
  config: FirebaseWebConfig;
  languageCode?: string;
};

export const RecaptchaModal = React.forwardRef<RecaptchaModalHandle, Props>(
  function RecaptchaModal({ config, languageCode = '' }, ref) {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const pending = useRef<Pending | null>(null);
    // Remount the WebView each time so a consumed challenge is never reused.
    const [attempt, setAttempt] = useState(0);

    const settle = useCallback((fn: (p: Pending) => void) => {
      const p = pending.current;
      pending.current = null;
      setVisible(false);
      if (p) fn(p);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        verify: () =>
          new Promise<string>((resolve, reject) => {
            // A previous challenge still open is abandoned rather than leaked.
            if (pending.current) {
              pending.current.reject(new Error('A previous verification was replaced.'));
            }
            pending.current = { resolve, reject };
            setAttempt((n) => n + 1);
            setLoading(true);
            setVisible(true);
          }),
      }),
      []
    );

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        let payload: any;
        try {
          payload = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }

        if (payload.type === 'ready') {
          setLoading(false);
          return;
        }
        if (payload.type === 'token' && typeof payload.token === 'string') {
          settle((p) => p.resolve(payload.token));
          return;
        }
        if (payload.type === 'error') {
          settle((p) => p.reject(new Error(payload.message || 'reCAPTCHA failed.')));
        }
      },
      [settle]
    );

    const cancel = useCallback(() => {
      settle((p) => p.reject(new Error('Verification was cancelled.')));
    }, [settle]);

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Security check</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={cancel} hitSlop={10}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Firebase asks for this once before sending your code.
            </Text>

            <View style={styles.webWrap}>
              <WebView
                key={attempt}
                originWhitelist={['*']}
                source={{
                  html: buildHtml(config, languageCode),
                  // reCAPTCHA refuses to run from about:blank; it needs a real origin
                  // that is listed under Firebase Authentication > Authorized domains.
                  baseUrl: `https://${config.authDomain}`,
                }}
                onMessage={onMessage}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                style={styles.web}
                onError={() =>
                  settle((p) => p.reject(new Error('Could not load the reCAPTCHA page.')))
                }
              />
              {loading ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '75%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  close: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  subtitle: { marginTop: spacing.xs, fontSize: 13.5, color: colors.textMuted },
  webWrap: {
    marginTop: spacing.lg,
    height: 420,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  web: { flex: 1, backgroundColor: colors.white },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
