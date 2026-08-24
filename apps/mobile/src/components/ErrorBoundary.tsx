import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * ErrorBoundary — çöken ekranı BOŞ SAYFA yerine okunur hata gösterir.
 *
 * ⚠️ NEDEN GEREKLİ OLDUĞU ACI BİR ŞEKİLDE ÖĞRENİLDİ.
 *
 * Bir bileşen çizim sırasında hata fırlatırsa React **bütün ağacı söker**.
 * Sonuç: kapkara ekran. Hangi ekranın, hangi satırın çöktüğü hiçbir yerde
 * yazmaz — tarayıcı konsolunu açmayan biri için hata görünmezdir.
 *
 * Sınır (boundary) bunu keser: kendi altındaki ağaç çökerse mesajı yakalar
 * ve ekrana basar. Uygulamanın geri kalanı ayakta kalır.
 *
 * ⚠️ SINIF BİLEŞENİ OLMAK ZORUNDA. `componentDidCatch` ve
 * `getDerivedStateFromError` kancalarının fonksiyon karşılığı YOK —
 * React'te hook'la yazılamayan birkaç şeyden biri. Bu yüzden projedeki
 * tek sınıf bileşen bu.
 *
 * ⚠️ NEYİ YAKALAMAZ: olay işleyicilerindeki (onPress) hatalar, zaman
 * aşımı geri çağrıları, ve async fonksiyonlardaki reddedilen promise'ler.
 * Sınır yalnızca ÇİZİM sırasındaki hataları görür. Onlar için try/catch
 * hâlâ gerekli.
 */
type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Konsola da yazılıyor: ekrandaki özet kısa, yığın izi burada tam.
    console.error('[ErrorBoundary] ekran çöktü:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;

    if (error === null) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Bir şey ters gitti</Text>

        <Text style={styles.message}>{error.message}</Text>

        <ScrollView style={styles.stackBox}>
          <Text style={styles.stack}>{error.stack ?? 'Yığın izi yok'}</Text>
        </ScrollView>

        <Text style={styles.hint}>
          Bu metni geliştiriciye ilet. Uygulamayı yeniden başlatmak için
          sayfayı yenile.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111112',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    color: '#f5f4f3',
    fontSize: 15,
    marginBottom: 16,
  },
  stackBox: {
    maxHeight: 260,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 12,
  },
  stack: {
    color: 'rgba(245,244,243,0.7)',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  hint: {
    color: 'rgba(245,244,243,0.45)',
    fontSize: 12,
    marginTop: 16,
  },
});
