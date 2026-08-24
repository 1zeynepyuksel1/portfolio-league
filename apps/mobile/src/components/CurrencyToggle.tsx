import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCurrency } from '../lib/currency';
import { colors, fonts } from '../theme';

/**
 * CurrencyToggle — ₺ / $ arasında geçiş.
 *
 * NEDEN AYRI BİLEŞEN: aynı düğme hem Piyasa hem Cüzdan başlığında var.
 * İki yere kopyalasaydık biri güncellenmeyi unuturdu ve kullanıcı bir
 * sekmede dolar, diğerinde TL görürdü — üstelik ikisi de "doğru" görünür.
 *
 * ⚠️ İKİ SEÇENEK DE HER ZAMAN EKRANDA.
 *
 * Tek bir düğme koyup üstüne aktif olmayanı yazmak (klasik "toggle")
 * kısa yoldu ama belirsiz: "₺" yazan düğme "şu an TL'deyim" mi demek,
 * "bas da TL'ye geç" mi? İkisini yan yana gösterip aktif olanı
 * vurgulamak bu soruyu ortadan kaldırıyor.
 */
export function CurrencyToggle() {
  const { currency, toggle } = useCurrency();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, currency === 'try' && styles.optionActive]}
        onPress={() => {
          // Zaten seçiliyse dokunma — gereksiz yeniden çizim ve
          // gereksiz depo yazması olmasın.
          if (currency !== 'try') toggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: currency === 'try' }}
        accessibilityLabel="Türk lirası olarak göster"
      >
        <Text
          style={[styles.label, currency === 'try' && styles.labelActive]}
        >
          ₺
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, currency === 'usd' && styles.optionActive]}
        onPress={() => {
          if (currency !== 'usd') toggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: currency === 'usd' }}
        accessibilityLabel="Amerikan doları olarak göster"
      >
        <Text
          style={[styles.label, currency === 'usd' && styles.labelActive]}
        >
          $
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.fieldFill,
    borderRadius: 8,
    padding: 2,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionActive: {
    backgroundColor: colors.hairline,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.inkFaint,
  },
  labelActive: {
    color: colors.ink,
  },
});
