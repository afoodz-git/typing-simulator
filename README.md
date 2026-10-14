# ⚡ Typing Simulator (VS Code & Visual Studio)

Aplikasi desktop simulator mengetik kode secara realistis untuk presentasi, demo video tutorial, ngonten coding, atau gaya-gayaan ala hacker di **Visual Studio Code** (Desktop & Web), **Visual Studio**, maupun text editor lainnya.

---

## 🚀 Fitur Utama

1. **Mode Auto-Play (Sekali Klik Berjalan Penuh)**:
   - Cukup 1 kali klik tombol **`▶️ Mulai Auto-Play [F9]`**, aplikasi menghitung mundur (jeda 5 detik agar Anda sempat fokus ke VS Code), lalu otomatis mengetik terus-menerus baris demi baris sampai 100% selesai.
   - Dilengkapi **Instant Stop**: Jika tombol di-klik lagi atau ditekan `F9`, pengetikan langsung berhenti seketika (0 milidetik).

2. **Mode Hacker Typer (Live Manual Typing)**:
   - Tekan **`F8`** untuk mengaktifkan.
   - Kodingan hanya akan terketik ketika Anda menekan tombol pemicu khusus yang dipilih (seperti **Spasi**, **Tab**, **Panah Kanan**, dll), sehingga tidak akan salah ketik saat menyentuh tombol lain.

3. **Anti-Tangga / Anti Double-Indent (Reset Kolom 0)**:
   - Dilengkapi penanganan native `Shift + Tab` outdent saat Enter, menjamin kursor selalu mulai dari Kolom 0 pada setiap baris baru.
   - Hasil ketikan **100% lurus, rapi, dan identik dengan kode aslinya** tanpa menjorok berlebihan meskipun kodenya ratusan baris.

4. **Auto-Closing Bracket Cancellation**:
   - Secara cerdas membatalkan kurung tutup otomatis dari editor (`}`, `)`, `]`) saat membuka blok di akhir baris, sehingga tidak meninggalkan sisa kurung penutup merah berlebih di akhir file.

5. **Global Hotkeys**:
   - Tetap bekerja meskipun jendela simulator sedang berada di latar belakang:
     - **`F8`** : Toggle Hacker Typer Mode
     - **`F9`** : Toggle Auto-Play (Mulai / Jeda Instan)
     - **`F10`** : Reset Progress ke 0%

---

## 🛠️ Cara Menjalankan

1. **Jalankan Aplikasi**:
   - Cukup double-click file [`start.bat`](start.bat) (atau jalankan `npm start`).
2. **Gunakan di VS Code**:
   - Masukkan kode yang ingin Anda simulasikan (atau klik tombol **Muat Contoh Kode**).
   - Buka **VS Code** dan buat file baru.
   - Klik **`▶️ Mulai Auto-Play [F9]`**, lalu klik ke dalam editor VS Code dalam 5 detik.
   - Kode akan otomatis terketik rapi dan presisi hingga selesai.
