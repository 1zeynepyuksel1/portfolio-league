import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../api/client';
import { BehaviorChat } from './BehaviorChat';
import { colors, fonts } from '../theme';

/**
 * BehaviorCard — kullanıcının kendi yatırım alışkanlıkları.
 *
 * ⚠️ ÖNCE PROFİL'DEYDİ, ARTIK KENDİ SEKMESİNDE (`CoachScreen`).
 *
 * İlk yerleştirmenin gerekçesi şuydu: alt çubukta beş sekme vardı ve
 * `TabBar.tsx` "beşten fazlası okunmaz" diyordu. Özellik büyüyünce
 * (yedi gösterge + yorum + sohbet) karar değişti ve altıncı sekme açıldı.
 *
 * ⚠️ BİLEŞEN İKİ YERDE DEĞİL, TAŞINDI. Profil'de de bırakmak aynı veriyi
 * iki kez çeken ve biri düzeltilince öteki eskiyen bir kopya üretirdi.
 *
 * ⚠️ HANGİ KULLANICI OLDUĞU BURAYA PARAMETRE OLARAK GELMİYOR — ve bu
 * sunucudaki kararla aynı hizada: `GET /me/behavior` kimliği token'dan
 * alıyor, adresten değil. Başkasınınkini istemek mümkün değil.
 *
 * Sebebi ürünle ilgili: bu veri kişinin kendi hataları. Arkadaş
 * profilinde görünseydi ("bak bu adam panik satıyor") özellik alay
 * konusuna dönerdi ve kimse gerçek portföyünü paylaşmak istemezdi.
 *
 * ⚠️ DÖRT DURUM VAR VE DÖRDÜ DE FARKLI ŞEY SÖYLÜYOR:
 *
 *   yükleniyor          -> henüz bilmiyoruz
 *   yeterli veri yok    -> HENÜZ ölçemiyoruz (emir sayısı eşiğin altında)
 *   veri var, bulgu yok -> ölçtük, sorun ÇIKMADI
 *   bulgu var           -> ölçtük, şunları bulduk
 *
 * İkinci ile üçüncüyü aynı boş kutuya indirmek en kolay yol olurdu ve
 * yanlış olurdu: biri "sana bir şey diyemem", diğeri "temizsin". Kullanıcı
 * ikisini karıştırırsa ya boşuna güvenir ya boşuna endişelenir.
 */

type Finding = {
  key: string;
  title: string;
  message: string;
  orderIds: string[];
};

type BehaviorResponse = {
  orderCount: number;
  hasEnoughData: boolean;
  minOrders: number;
  findings: Finding[];
};

/**
 * Bulgu anahtarına göre şerit rengi.
 *
 * ⚠️ HEPSİ KIRMIZI DEĞİL — VE BU BİR OKUNABİLİRLİK KARARI.
 *
 * Yedi bulgunun tamamı kırmızı olsaydı ekran bir hata listesine benzerdi
 * ve kullanıcı ilk bakışta kapatırdı. Oysa hepsi aynı ağırlıkta değil:
 * ödenmiş komisyon kesin bir kayıp, yoğunlaşma ise yalnızca bir durum.
 *
 * `loss` = para gitti · `warn` = dikkat et · `inkFaint` = bilgi.
 *
 * ⚠️ Yön renkleri (`gain`/`loss`) bu uygulamada fiyat yönü için ayrılmış.
 * Burada `loss` kullanmak tutarlı: ikisi de "senin aleyhine" demek.
 */
const ACCENT: Record<string, string> = {
  overtrading: colors.loss,
  wash_trade: colors.loss,
  panic_selling: colors.loss,
  disposition_effect: colors.warn,
  averaging_down: colors.warn,
  fomo_buying: colors.warn,
  concentration: colors.inkFaint,
};

export function BehaviorCard() {
  const [data, setData] = useState<BehaviorResponse | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /*
      ⚠️ `cancelled` BAYRAĞI SIZINTI KORUMASI.

      Kullanıcı istek dönmeden Profil'i kapatırsa `setData` sökülmüş bir
      bileşene yazmaya çalışır. React bunu uyarı olarak basar ve gerçek
      hatalar o gürültünün içinde kaybolur.
    */
    let cancelled = false;

    apiFetch<BehaviorResponse>('/me/behavior')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        /*
          ⚠️ HATA SESSİZ DEĞİL AMA GÜRÜLTÜLÜ DE DEĞİL.

          Bu bölüm profilin yardımcı bir parçası; okunamazsa sayfanın geri
          kalanı (kimlik, dağılım, gizlilik) çalışmaya devam etmeli.
          Kırmızı bir hata bloğu basmak, asıl içeriği olmayan bir şeyin
          başarısızlığını abartmak olurdu.
        */
        if (!cancelled) setError('Alışkanlıklar şu an okunamadı.');
      });

    /*
      ⚠️ YORUM AYRI BİR İSTEK — VE BU ÖLÇÜMDEN DOĞAN BİR DÜZELTME.

      Yorum eskiden aynı cevabın içinde geliyordu. Gerçek isteklerde
      ölçüldü: ilk çağrı 5-10 saniye sürüyor (bazen zaman aşımına
      uğruyor), sonrakiler önbellekten 0,01 saniye. Yani kullanıcı
      profili ilk açtığında KARTLARI da 10 saniye bekliyordu — oysa
      kartların modele hiç ihtiyacı yok.

      Şimdi iki istek paralel gidiyor: kartlar hemen çiziliyor, yorum
      hazır olunca üstlerine düşüyor.

      ⚠️ Bu isteğin hatası YUTULUYOR. Yorum bir süs; başarısızlığı
      ekranda görünmemeli, `comment` null kalır ve blok çizilmez.
    */
    apiFetch<{ comment: string | null }>('/me/behavior/comment')
      .then((r) => {
        if (!cancelled) setComment(r.comment);
      })
      .catch(() => {
        /* sessiz: yorum yoksa blok hiç çizilmiyor */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>ALIŞKANLIKLARIN</Text>
        <Text style={styles.hint}>{error}</Text>
      </View>
    );
  }

  if (data === null) {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>ALIŞKANLIKLARIN</Text>
        <ActivityIndicator color={colors.inkFaint} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>ALIŞKANLIKLARIN</Text>

      {!data.hasEnoughData ? (
        /*
          ⚠️ "HENÜZ" KELİMESİ ÖNEMLİ. Kullanıcıya kapalı bir kapı değil,
          bir sayaç gösteriyoruz: kaç işlem daha yapması gerektiği yazılı.
          "Veri yetersiz" demek suçlayıcı ve eylemsiz olurdu.
        */
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Henüz yeterli işlem yok</Text>
          <Text style={styles.hint}>
            {`Alım-satım desenlerini okuyabilmek için en az ${data.minOrders} işlem gerekiyor. `}
            {`Şu an ${data.orderCount} işlemin var.`}
          </Text>
        </View>
      ) : data.findings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Belirgin bir sorun görünmüyor</Text>
          <Text style={styles.hint}>
            {`${data.orderCount} işlemin incelendi; sık rastlanan yatırımcı hatalarından hiçbiri öne çıkmadı.`}
          </Text>
        </View>
      ) : (
        <>
          {/*
            YAPAY ZEKÂ YORUMU — kartların ÜSTÜNDE.

            ⚠️ SAYILAR BURADA DEĞİL, KARTLARDA. Model sayı yazmıyor
            (`narrator.ts`): tutar ve yüzdeler sunucunun kesin
            aritmetiğinden gelip kartlarda gösteriliyor. Model yalnızca
            bulgular arasındaki bağı kuruyor ve ne yapılacağını söylüyor.
            Böylece model yanılsa bile ortada yanlış bir SAYI olmuyor.

            ⚠️ Yorum yoksa BLOK HİÇ ÇİZİLMİYOR — "yorum alınamadı" gibi
            bir uyarı basmıyoruz. Kullanıcının kaybettiği bir şey yok;
            olmayan bir eksiği haber vermek gereksiz endişe yaratır.
          */}
          {comment !== null && (
            <View style={styles.comment}>
              <Text style={styles.commentLabel}>YORUM</Text>
              <Text style={styles.commentText}>{comment}</Text>
            </View>
          )}

          {data.findings.map((finding) => (
            <View
              key={finding.key}
              style={[
                styles.card,
                // Sol şerit — kartın ağırlığını renkle taşıyor.
                { borderLeftColor: ACCENT[finding.key] ?? colors.inkFaint },
              ]}
            >
              <Text style={styles.cardTitle}>{finding.title}</Text>
              <Text style={styles.cardBody}>{finding.message}</Text>

              {/*
                ⚠️ KANIT SAYISI GÖSTERİLİYOR — VE BU BOŞ BİR SÜS DEĞİL.

                Sunucu her bulguyu gerçek emir kimliklerine bağlıyor
                (`indicators.ts`: bağlanamayan bir iddia uydurmadır).
                Sayıyı ekranda göstermek o sözleşmeyi kullanıcıya görünür
                kılıyor: ortada bir tahmin değil, sayılmış işlemler var.
              */}
              <Text style={styles.evidence}>
                {`${finding.orderIds.length} işleme dayanıyor`}
              </Text>
            </View>
          ))}
        </>
      )}

      {/*
        SOHBET — HER ZAMAN ÇİZİLİYOR.

        ⚠️ ÖNCE ÜÇLÜ DALIN İÇİNDEYDİ, YANİ YALNIZCA BULGU VARSA
        GÖRÜNÜYORDU — ve bu yanlıştı.

        Bulgusu olmayan kullanıcı (yeni başlayan, ki en çok yardıma
        ihtiyacı olan kişi) hiçbir şey soramıyordu. Oysa "tek varlığa
        yüklenmek mantıklı mı" sorusunun ölçülmüş bir bulguyla ilgisi
        yok; bir İLKE sorusu ve her zaman cevaplanabilir.

        ⚠️ Sıra hâlâ önemli: önce ÖLÇÜM (kartlar, kesin sayılarla),
        sonra yorum, en sonda sohbet. Sohbeti üste koysaydık özellik bir
        "yapay zekâ asistanı" gibi okunurdu; oysa asıl iş ölçüm.
      */}
      <BehaviorChat hasFindings={data.findings.length > 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 26 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 12,
  },
  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    // Tasarım gölge kullanmıyor; derinlik yüzey tonundan geliyor.
    // Sol şerit tek renkli vurgu, `borderLeftColor` satır içinde veriliyor.
    borderLeftWidth: 3,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
  },
  evidence: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkDisabled,
    marginTop: 8,
  },
  comment: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    // ⚠️ Kartlardan FARKLI yüzey: yorum bir kart değil, kartların
    // üstüne konan bir not. Aynı `surfaceRaised` olsaydı sekizinci bir
    // bulgu gibi okunurdu.
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.inkDisabled,
    marginBottom: 6,
  },
  commentText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkBright,
  },
  empty: {
    padding: 14,
    borderRadius: 14,
    // ⚠️ Ekrandan DAHA KOYU yüzey: boş durum girintili görünmeli,
    // kart gibi yükselmiş değil. `theme.ts` bu kademeyi bunun için tutuyor.
    backgroundColor: colors.surfaceSunken,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.inkBright,
    marginBottom: 4,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
  },
});
