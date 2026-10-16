# KEPUTUSAN DEWAN AI — ZECATHON 2026 (track Shielded Payments, projek Dex)

> Diratifikasi ronde 4, Sab 17 Okt 2026 ±02.40 WIB. 7 AI (ChatGPT, Claude, DeepSeek, Gemini, GLM, Grok, Qwen). Moderator: Claude Code (sesi hub). Rincian per ronde: `CATATAN-MODERATOR.md`.

## Ide final: **BonBagi** — bagi-hasil sekali bayar
**Satu QR, satu pembayaran, uang langsung terbagi ke beberapa orang dalam satu transaksi Zcash shielded. Tanpa bendahara, tanpa kustodian.**
- Ratifikasi: **7/7 setuju** (2 YA, 5 YA bersyarat, 0 keberatan fatal).
- Nama: **BonBagi 6/7** (Payveil 1/7; Payveil gugur karena mirip koin privasi "Veil", 7/7 membenarkan).
- Skor rata-rata final: Privacy 8,0 · Usefulness 7,0 · Execution 6,7 · Originality 6,7.
- Use case hari Senin (5/7 AI sama): **kelas online 3–5 mentor** menjual satu tiket; murid bayar sekali, tiap mentor langsung terima bagiannya (mis. 50/30/20) di dompet sendiri; publik tidak bisa melihat pendapatan tiap mentor.
- Tagline kandidat: "one payment, every share, nobody's business" · "Bayar sekali, bagi otomatis, tetap private."

## Cara kerja (versi yang disepakati)
1. **Piagam**: daftar alamat shielded anggota + persentase, ditandatangani SEMUA anggota (Ed25519); format kanonis; diubah = tanda tangan batal.
2. **Halaman bayar** memverifikasi tanda tangan piagam **di browser pembeli** lalu menyusun SATU URI ZIP-321 multi-penerima. Pembeli melihat ringkasan penerima + nominal + total + fee sebelum QR muncul.
3. Pembeli bayar dari dompet → satu transaksi, N output. Tiap anggota hanya melihat bagiannya.
4. Tanpa backend pemindai (bisa halaman statis).

## Syarat wajib (gabungan ronde 3–4)
- Ambang nominal minimum per anggota (hindari "debu" yang habis kena fee ZIP-317 / tumpukan note kecil).
- Alamat penerima dirotasi per produk/periode; URI/daftar alamat tidak dipublikasikan atau dicatat di log.
- Pembulatan zatoshi deterministik (persentase ganjil seperti 33,33% × 3).
- Memo per output: ID pesanan + hash piagam (tanpa data pribadi) supaya anggota bisa saling mencocokkan.
- Threat model jujur: jumlah action terlihat publik (≈ jumlah anggota); pembeli memang tahu daftar penerima; klaim = "publik tidak melihat siapa dibayar berapa", bukan "anonim".

## Gerbang hari 1 (go / no-go)
Satu URI **3 penerima** (GLM minta 4) dibayar dari **Zingo PC** (pra-rilis 2.0.26-189) di **Ironwood mainnet** → satu transaksi, nominal benar, tiap penerima melihat bagiannya, DAN Zingo PC menampilkan semua penerima sebelum konfirmasi. Cadangan: Zkool. **Jangan pakai Zodl**: iOS menolak multi-penerima; Android punya bug #2217 (hanya menampilkan penerima pertama). Gagal → evaluasi ulang.

## Soal Hans: "define curang saat checkout" (jawaban 7/7 sama)
- **Caranya:** QR dibuat oleh web toko. Toko curang tinggal menghapus atau mengganti alamat perujuk sebelum QR tampil. Pembeli bayar normal.
- **Bisa ketahuan?** Tidak dari dompet. Perujuk yang dilewati tidak menerima apa pun, jadi dompetnya diam. "Tidak ada yang beli" dan "ada yang beli tapi aku dilewati" terlihat sama persis.
- **Pencegahan:** halaman bayar di-host perujuk sendiri (statis, misalnya GitHub Pages) dari piagam bertanda tangan. Realistis dibangun, tapi hanya melindungi pembeli yang datang lewat link perujuk.
- **Bagian perujuk di BonBagi versi awal: TIDAK, 4 lawan 3.** Masuk daftar "nanti", sebagai mode halaman milik perujuk.

## Fakta kunci yang disepakati
Ironwood (NU6.3) = pool aktif sejak 28 Jul 2026, Orchard withdraw-only · zcashd mati 18 Jul 2026 (Zebra/Zakura) · blok 75 detik selama hackathon (NU7 target 5 Nov) · ZIP-311 belum ada di dompet ritel · Portal (ZecHub 3.0) = pendahulu ide "akses tanpa akun" → ide itu gugur · batas submit 28 Okt 2026 23.59 UTC = **Kam 29 Okt 06.59 WIB**.
