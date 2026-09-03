import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, type } from '../theme';

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

        <ScrollView
        showsVerticalScrollIndicator={false} style={styles.stackBox}>
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

/*
  ⚠️ RENKLER ELLE YAZILIYDI ('#111112', '#EF4444', '#f5f4f3') VE ÜÇÜ DE
  TEMADAKİ DEĞERLERDEN AZ FARKLIYDI. Sonuç: çöken ekran, uygulamanın
  geri kalanından biraz farklı bir uygulamaya benziyordu.

  ⚠️ "HATA SINIRI TEMAYA BAĞLANMASIN, TEMA ÇÖKERSE O DA ÇÖKER" DİYE
  DÜŞÜNÜLEBİLİR — ama `theme.ts` yalnızca sabit nesneler; içinde
  çalışabilecek bir mantık yok. Çöktüğü senaryoda zaten hiçbir ekran
  çizilemez, sınırın kendisi de yüklenemez. Bağımsızlıktan kazanç yok,
  tutarsızlıktan kayıp var.
*/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    color: colors.loss,
    fontFamily: fonts.bold,
    fontSize: type.title,
    marginBottom: spacing.group,
  },
  message: {
    color: colors.inkBright,
    fontFamily: fonts.regular,
    fontSize: type.emphasis,
    marginBottom: spacing.md,
  },
  stackBox: {
    maxHeight: 260,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.group,
  },
  stack: {
    color: colors.inkMuted,
    fontSize: type.caption,
    /*
      ⚠️ `'monospace'` PLATFORM ADI, TEMA FONTU DEĞİL — VE BİLEREK ÖYLE.
      Yığın izinde satır hizası okunabilirliği belirliyor; uygulama
      fontu yüklenememişse (ki hata anında olabilir) sistem mono'su
      her zaman var.
    */
    fontFamily: 'monospace',
  },
  hint: {
    color: colors.inkFaint,
    fontFamily: fonts.regular,
    fontSize: type.caption,
    marginTop: spacing.md,
  },
});
