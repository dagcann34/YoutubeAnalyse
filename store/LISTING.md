# Chrome Web Store Başvuru Paketi — DagcanYT v1.1.0

Bu dosya, Chrome Web Store Developer Dashboard'daki her alana ne yazılacağını sırasıyla listeler.

## 0. Hazırlık (bir kez)

1. https://chrome.google.com/webstore/devconsole adresinden geliştirici hesabı aç (tek seferlik 5 $ kayıt ücreti).
2. Hesap ayarlarında iletişim e-postasını doğrula.
3. `store/privacy-policy.html` dosyasını herkese açık bir adreste yayınla (GitHub Pages, Google Sites veya kendi siten). Bu adres aşağıdaki "Gizlilik politikası URL'si" alanına yazılacak.

## 1. Paket

```bash
npm run zip        # → release/dagcanyt-v1.1.0.zip
```

Dashboard → **Yeni öğe** → bu zip dosyasını yükle.

## 2. Mağaza girişi (Store listing)

| Alan | Değer |
|---|---|
| Ad / kısa açıklama | Manifest'ten otomatik gelir (`_locales`: EN varsayılan, TR çeviri) |
| Kategori | Tools (Araçlar) |
| Dil | English (varsayılan) + Türkçe ekle |
| Simge | `public/icon-128.png` |
| Küçük tanıtım görseli (440×280) | `design/promo-440x280.png` |
| Ekran görüntüleri (1280×800) | EN: `design/store-screenshots/en/*.png` · TR: `design/store-screenshots/tr/*.png` |
| Resmi URL / Ana sayfa | (isteğe bağlı) |
| Destek URL'si | (isteğe bağlı) GitHub Issues veya e-posta |

### Ayrıntılı açıklama — English

```
DagcanYT is a 100% free YouTube analytics and SEO toolkit that lives in Chrome's side panel. No account, no subscription, no limits.

Open any YouTube video and instantly see:

📊 OVERVIEW
• Outlier score: how this video performs against the channel's own median (e.g. 4.5x = outlier)
• Estimated earnings range (RPM based)
• Views, likes, engagement rate and an SEO health score

🏷️ HIDDEN TAGS
• See the tags creators hide from viewers, search and copy them in one click
• Ready-made AI prompt for Claude or ChatGPT to get better titles and tags

🛠️ CREATOR TOOLS
• Keyword research from real YouTube search suggestions, with a deep A–Z scan and one-click "copy as tags" that fits YouTube's 500-character limit
• Transcript: copy or download any video's transcript, with or without timestamps, plus an AI prompt for summaries and chapters
• Thumbnail tool: download thumbnails in every size and preview how a thumbnail looks in the home feed (dark and light)

🔥 THUMBNAIL BADGES
• On the home page, search and related videos, every thumbnail shows its average views per day
• On channel pages, each video shows how many times it beat the channel median, so you can spot viral topics at a glance

📈 TRACKING
• Track up to 50 videos (yours or competitors') and the extension records their views every few hours
• Real growth charts and views-per-day from actual measurements, CSV export

📤 SHARE
• Download a story-sized (1080×1920) analysis card, or share stats on WhatsApp and X

Privacy first: everything runs in your browser. DagcanYT has no server, collects no personal data and shows no ads. Available in English and Turkish.

DagcanYT is an independent tool and is not affiliated with or endorsed by YouTube or Google.
```

### Ayrıntılı açıklama — Türkçe

```
DagcanYT, Chrome'un yan panelinde çalışan %100 ücretsiz bir YouTube analiz ve SEO aracıdır. Hesap yok, abonelik yok, limit yok.

Herhangi bir YouTube videosunu aç ve anında gör:

📊 ÖZET
• Outlier skoru: video, kanalın kendi ortancasına göre kaç kat iyi performans gösteriyor (ör. 4.5x = outlier)
• Tahmini kazanç aralığı (RPM'e göre)
• İzlenme, beğeni, etkileşim oranı ve SEO sağlık skoru

🏷️ GİZLİ ETİKETLER
• İçerik üreticilerinin izleyiciden gizlediği etiketleri gör, ara ve tek tıkla kopyala
• Daha iyi başlık ve etiketler için Claude veya ChatGPT'ye hazır AI prompt'u

🛠️ İÇERİK ÜRETİCİ ARAÇLARI
• Gerçek YouTube arama önerilerinden anahtar kelime araştırması: A–Z derin tarama ve YouTube'un 500 karakter sınırına uyan "etiket olarak kopyala"
• Transkript: herhangi bir videonun transkriptini zaman damgalı ya da damgasız kopyala veya indir; özet ve bölümler için AI prompt'u
• Thumbnail aracı: küçük resimleri tüm boyutlarda indir, ana sayfa akışında nasıl göründüğünü önizle (koyu ve açık tema)

🔥 THUMBNAIL ROZETLERİ
• Ana sayfada, aramada ve önerilen videolarda her küçük resmin üstünde günlük ortalama izlenme
• Kanal sayfalarında her videonun kanal ortancasını kaç kat geçtiği: viral konuları bir bakışta yakala

📈 TAKİP
• 50 videoya kadar (kendi videoların veya rakiplerin) takip et; eklenti izlenmeleri birkaç saatte bir kaydeder
• Gerçek ölçümlerden büyüme grafiği ve günlük izlenme, CSV dışa aktarma

📤 PAYLAŞ
• Hikaye boyutunda (1080×1920) analiz kartı indir veya istatistikleri WhatsApp ve X'te paylaş

Önce gizlilik: her şey tarayıcında çalışır. DagcanYT'nin sunucusu yoktur, kişisel veri toplamaz, reklam göstermez. Türkçe ve İngilizce.

DagcanYT bağımsız bir araçtır; YouTube veya Google ile bağlantılı değildir ve onlar tarafından onaylanmamıştır.
```

## 3. Gizlilik uygulamaları (Privacy practices)

**Tek amaç (Single purpose):**

```
DagcanYT helps YouTube creators analyze videos: it shows analytics and SEO information (stats, hidden tags, outlier score, transcripts, keyword ideas, view tracking) for YouTube videos in Chrome's side panel and on YouTube thumbnails.
```

**İzin gerekçeleri:**

| İzin | Gerekçe (İngilizce yapıştır) |
|---|---|
| `sidePanel` | The extension's whole interface is shown in Chrome's side panel next to the YouTube video. |
| `storage` | Saves the user's settings (language, badges on/off) and their video tracking list locally on the device. |
| `alarms` | Refreshes the view counts of videos on the user's tracking list every few hours so the extension can show real growth over time. |
| Host: `https://www.youtube.com/*` | Reads public video information (title, views, tags, publish date, transcript) on YouTube pages to calculate the statistics shown, adds view-pace badges to thumbnails, and loads public channel and watch pages to compute the outlier score and refresh tracked videos. |
| Host: `https://i.ytimg.com/*` | Downloads video thumbnails in different sizes for the Thumbnail Tool. |
| Host: `https://suggestqueries.google.com/*` | Fetches YouTube search suggestions for the keyword the user types in the Keyword Research tool. |

**Uzaktan kod (Remote code):** "No, I am not using remote code"

**Veri kullanımı (Data usage):** Geliştirici hiçbir kullanıcı verisi toplamadığı için hiçbir veri türü kutusunu işaretleme. Aşağıdaki üç beyanı onayla:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Gizlilik politikası URL'si:** `store/privacy-policy.html` dosyasını yayınladığın adres.

## 4. Dağıtım

- Görünürlük: **Public**
- Ödeme: **Free** (ücretsiz)
- Bölgeler: Tümü

## 5. İnceleme sonrası

İnceleme genellikle birkaç gün sürer; host izinleri olduğu için biraz uzayabilir. Reddedilirse e-postadaki gerekçe ile bu dosyadaki ilgili alanı güncelleyip tekrar gönder.

Yeni sürüm yayınlarken: `manifest.json` ve `package.json` içindeki `version` değerini artır, `npm run zip` çalıştır ve Dashboard → Package → Upload new package.
