# Rota Planlayıcı (Route Planner)

Lojistik teslimatlar için tasarlanmış, **sunucusuz** çalışan hafif bir
**Rota Optimizasyon (Gezgin Satıcı Problemi / TSP)** web uygulaması.
Adresleri girin, sistem koordinata çevirsin ve en verimli teslimat sırasını
harita üzerinde göstersin.

## Özellikler

- 📍 **Adres yönetimi:** ~50 adresi tek tek ekleme, düzenleme, silme.
- 🌍 **Otomatik geocoding:** Adresler Nominatim ile koordinata çevrilir
  (politika gereği 1 istek/sn throttle'lı sıralı kuyruk).
- 🧭 **Rota optimizasyonu:** OSRM "Trip" servisi ile TSP çözümü
  (ilk adres sabit başlangıç, açık rota).
- 🗺️ **Harita görselleştirme:** Numaralı duraklar (başlangıç yeşil, bitiş kırmızı)
  ve güzergah çizgisi (Leaflet / OpenStreetMap).
- 💾 **JSON kalıcılık:** Listeyi dışa aktar (indir) ve içe aktar (yükle).
- ⚠️ **Sağlam hata yönetimi:** Yüklenme, boş ve hata durumları.

## Teknoloji Yığını

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · react-leaflet ·
lucide-react · Nominatim (geocoding) · OSRM (optimizasyon). Harici veritabanı yok.

## Kurulum ve Çalıştırma

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # üretim derlemesi
npm run start    # üretim sunucusu
```

## Mimari

İstekler, CORS ve Nominatim User-Agent politikası nedeniyle **Next.js API Route
proxy** üzerinden gider:

- `GET  /api/geocode?q=...` → Nominatim arama proxy'si.
- `POST /api/optimize` (`{ coordinates: [{lat,lon}, ...] }`) → OSRM Trip proxy'si.

Uygulama durumu tarayıcıda (`useRoutePlanner` hook'u) tutulur. Detaylı bağlam ve
mimari kararlar için `CLAUDE.md` ve `memory-bank/` klasörüne bakın.

## Notlar / Sınırlar

- Nominatim ve OSRM **ücretsiz public** servislerdir; ağır kullanımda rate-limit
  uygulanabilir. 50 adresin geocoding'i throttle nedeniyle ~1 dakika sürer.
- Durum yalnızca bellektedir; kalıcılık için JSON dışa/içe aktarımı kullanın.
