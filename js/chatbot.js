// ================================================
// CHATBOT FOR PEST CONTROL & NATURAL SPRAY
// ================================================

// Knowledge base for chatbot
const chatbotKnowledge = {
    // Ekstrak Sereh
    'spray sereh': {
        response: `🌿 **Cara Membuat Spray Ekstrak Sereh:**

1. **Bahan yang Dibutuhkan:**
   - 200g daun sereh segar (dicincang)
   - 1 liter air
   - 2 sendok makan sabun cuci piring alami

2. **Cara Pembuatan:**
   - Rebus daun sereh dalam 1 liter air selama 30 menit
   - Dinginkan dan saring
   - Tambahkan sabun cuci piring (sebagai perekat)
   - Masukkan ke botol spray

3. **Cara Penggunaan:**
   - Semprot pada tanaman setiap 3-5 hari
   - Aplikasikan di pagi atau sore hari
   - Fokus pada bagian bawah daun

4. **Manfaat:**
   ✅ Mengusir hama kutu daun, ulat, dan serangga
   ✅ Aroma sereh tidak disukai hama
   ✅ Aman untuk tanaman & lingkungan
   ✅ Antibakteri alami`
    },
    
    // Neem Oil
    'neem': {
        response: `🍃 **Manfaat Neem Oil untuk Tanaman:**

**Apa itu Neem Oil?**
Minyak yang diekstrak dari biji pohon neem (Azadirachta indica). Mengandung azadirachtin yang sangat efektif melawan hama.

**Manfaat Utama:**
✅ Mengendalikan 200+ jenis hama (aphids, whiteflies, mealybugs)
✅ Mencegah penyakit jamur (powdery mildew, black spot)
✅ Mengganggu siklus hidup serangga
✅ Tidak beracun untuk manusia dan hewan peliharaan

**Cara Penggunaan:**
- Campurkan 2-3 sendok makan neem oil per liter air
- Tambahkan 1 sendok teh sabun cuci piring
- Kocok rata dan semprotkan
- Ulangi setiap 7-14 hari

**Tips Penting:**
⚠️ Aplikasikan saat suhu < 30°C
⚠️ Hindari saat terik matahari
⚠️ Simpan di tempat sejuk & gelap`
    },
    
    // Pencegahan Hama Gudang
    'cegah hama': {
        response: `🐜 **Cara Mencegah Hama di Gudang Penyimpanan:**

**1. Kontrol Kelembapan:**
   - Jaga kelembapan 40-60%
   - Gunakan dehumidifier jika > 70%
   - Pastikan ventilasi baik

**2. Kebersihan Rutin:**
   - Bersihkan gudang setiap minggu
   - Buang sisa tanaman mati
   - Hindari genangan air

**3. Penyemprotan Preventif:**
   - Spray ekstrak sereh setiap 5 hari
   - Neem oil 2 minggu sekali
   - Kombinasi keduanya untuk hasil maksimal

**4. Monitoring:**
   - Periksa tanaman setiap hari
   - Deteksi dini tanda hama (daun rusak, bercak)
   - Isolasi tanaman terinfeksi

**5. Natural Repellent:**
   🌿 Tanam lavender, mint, basil di sekitar
   🧄 Letakkan bawang putih di sudut gudang
   🍊 Gunakan kulit jeruk kering

**Hama Umum & Cara Atasi:**
- **Kutu Daun:** Spray air sabun + sereh
- **Ulat:** Ambil manual + neem oil
- **Tungau:** Tingkatkan kelembapan + neem
- **Lalat Buah:** Perangkap cuka apel`
    },
    
    // Waktu Penyemprotan
    'waktu semprot': {
        response: `⏰ **Waktu Terbaik untuk Penyemprotan:**

**Waktu Ideal:**
🌅 **Pagi Hari (06:00 - 09:00)**
   - Suhu masih sejuk
   - Stomata daun terbuka
   - Penyerapan optimal
   - Mengurangi risiko terbakar

🌆 **Sore Hari (16:00 - 18:00)**
   - Matahari tidak terlalu terik
   - Tanaman sedang menyerap nutrisi
   - Spray bertahan lebih lama

**HINDARI Penyemprotan:**
❌ Siang hari (10:00-15:00) - Risiko terbakar
❌ Saat hujan atau akan hujan - Spray terbuang
❌ Saat angin kencang - Tidak merata

**Frekuensi Penyemprotan:**
📅 **Preventif (Tanaman Sehat):**
   - Ekstrak sereh: 5-7 hari sekali
   - Neem oil: 10-14 hari sekali

📅 **Kuratif (Ada Hama):**
   - Ekstrak sereh: 3 hari sekali
   - Neem oil: 5-7 hari sekali

**Tips Penting:**
✅ Semprot hingga daun basah (tidak tetesan)
✅ Fokus pada bagian bawah daun
✅ Ganti jenis spray secara bergantian
✅ Cek cuaca sebelum semprot`
    },
    
    // Kombinasi Sereh + Neem
    'kombinasi': {
        response: `🌿🍃 **Kombinasi Spray Sereh + Neem:**

**Formula Power Spray:**

**Bahan:**
- 100g daun sereh (rebusan dingin)
- 2 sendok makan neem oil
- 1 sendok teh sabun cuci piring
- 1 liter air

**Cara Membuat:**
1. Rebus sereh, dinginkan & saring
2. Campurkan dengan air
3. Tambahkan neem oil
4. Tambahkan sabun, kocok rata

**Keuntungan Kombinasi:**
✅ Perlindungan ganda (repellent + insektisida)
✅ Efektif untuk hama membandel
✅ Mencegah resistensi hama
✅ Melindungi dari bakteri & jamur

**Jadwal Aplikasi:**
- Minggu 1 & 3: Spray kombinasi
- Minggu 2: Sereh murni
- Minggu 4: Neem murni

**Efektif Untuk:**
🐛 Kutu daun, ulat, thrips
🦟 Lalat putih, tungau
🍄 Jamur daun, embun tepung
🦠 Bakteri patogen`
    }
};

// Initialize chatbot
let chatbotOpen = false;
let chatHistory = [];

function initChatbot() {
    const chatbotBtn = document.getElementById('chatbotBtn');
    const chatbotModal = document.getElementById('chatbotModal');
    const chatbotClose = document.getElementById('chatbotClose');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');

    // Toggle chatbot
    chatbotBtn.addEventListener('click', () => {
        chatbotOpen = !chatbotOpen;
        if (chatbotOpen) {
            chatbotModal.classList.add('active');
        } else {
            chatbotModal.classList.remove('active');
        }
    });

    // Close chatbot
    chatbotClose.addEventListener('click', () => {
        chatbotOpen = false;
        chatbotModal.classList.remove('active');
    });

    // Send message
    chatSendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            sendMessage(message);
            chatInput.value = '';
        }
    });

    // Send on Enter
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message) {
                sendMessage(message);
                chatInput.value = '';
            }
        }
    });

    // Suggestion buttons
    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.dataset.question;
            sendMessage(question);
        });
    });
}

// Send message to chatbot
function sendMessage(message) {
    // Add user message
    addChatMessage(message, 'user');

    // Process and respond
    setTimeout(() => {
        const response = processMessage(message);
        addChatMessage(response, 'bot');
    }, 500);
}

// Add chat message to UI
function addChatMessage(message, sender) {
    const chatBody = document.getElementById('chatbotBody');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Convert markdown-style text to HTML
    const formattedMessage = formatMessage(message);
    content.innerHTML = formattedMessage;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    chatBody.appendChild(messageDiv);
    
    // Scroll to bottom
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Format message with basic markdown
function formatMessage(text) {
    // Bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    
    // Check marks and emoji
    text = text.replace(/✅/g, '<span style="color: #27ae60;">✅</span>');
    text = text.replace(/❌/g, '<span style="color: #e74c3c;">❌</span>');
    text = text.replace(/⚠️/g, '<span style="color: #f39c12;">⚠️</span>');
    
    return text;
}

// Process user message and generate response
function processMessage(message) {
    const messageLower = message.toLowerCase();
    
    // Check for keywords in knowledge base
    if (messageLower.includes('sereh') || messageLower.includes('serai')) {
        return chatbotKnowledge['spray sereh'].response;
    }
    
    if (messageLower.includes('neem')) {
        return chatbotKnowledge['neem'].response;
    }
    
    if (messageLower.includes('cegah') || messageLower.includes('pencegah') || messageLower.includes('hama gudang')) {
        return chatbotKnowledge['cegah hama'].response;
    }
    
    if (messageLower.includes('waktu') || messageLower.includes('kapan')) {
        return chatbotKnowledge['waktu semprot'].response;
    }
    
    if (messageLower.includes('kombinasi') || messageLower.includes('campur')) {
        return chatbotKnowledge['kombinasi'].response;
    }
    
    // Specific pest questions
    if (messageLower.includes('kutu daun') || messageLower.includes('aphid')) {
        return `🐛 **Mengatasi Kutu Daun:**

**Gejala:**
- Daun mengeriting & menguning
- Lapisan lengket pada daun
- Pertumbuhan terhambat

**Solusi:**
1. **Spray Air Sabun:** 1 sdm sabun cuci piring + 1 liter air
2. **Ekstrak Sereh:** Aplikasi 3 hari sekali
3. **Neem Oil:** Minggu kedua untuk membunuh telur
4. **Semprotan Air Kuat:** Siram kutu dari daun

**Pencegahan:**
✅ Tanam companion plants (marigold, nasturtium)
✅ Jaga kebersihan area tanaman
✅ Spray preventif ekstrak sereh rutin`;
    }
    
    if (messageLower.includes('ulat')) {
        return `🐛 **Mengatasi Ulat:**

**Identifikasi:**
- Daun berlubang-lubang
- Kotoran hitam pada daun
- Ulat terlihat di pagi/sore hari

**Solusi:**
1. **Manual:** Ambil ulat dengan tangan (pakai sarung tangan)
2. **Neem Oil:** Spray setiap 5-7 hari
3. **Bacillus thuringiensis (Bt):** Insektisida biologis aman
4. **Ekstrak Cabai:** 5 cabai + 1 liter air, rebus & semprot

**Pencegahan:**
✅ Periksa daun rutin (pagi & sore)
✅ Tanam tanaman aromatik (basil, oregano)
✅ Jaring pelindung untuk tanaman muda`;
    }
    
    if (messageLower.includes('jamur') || messageLower.includes('fungi')) {
        return `🍄 **Mengatasi Jamur pada Tanaman:**

**Gejala Jamur:**
- Bercak putih seperti tepung (powdery mildew)
- Bercak hitam/coklat pada daun
- Daun busuk & rontok

**Solusi:**
1. **Neem Oil:** Aplikasi 2x seminggu
2. **Baking Soda Spray:** 1 sdt baking soda + 1 liter air + sabun
3. **Susu Spray:** Susu:air = 1:9 (menghambat spora)
4. **Potong Bagian Terinfeksi:** Buang & bakar

**Pencegahan:**
✅ Jaga sirkulasi udara baik
✅ Hindari penyiraman berlebihan
✅ Jangan siram daun, fokus ke akar
✅ Spray preventif neem oil rutin`;
    }
    
    // Generic response
    return `Terima kasih atas pertanyaan Anda! 🌱

Saya dapat membantu dengan:
🌿 **Membuat spray ekstrak sereh**
🍃 **Informasi tentang neem oil**
🐛 **Cara mengatasi hama (kutu daun, ulat, jamur)**
🐜 **Pencegahan hama di gudang**
⏰ **Waktu terbaik penyemprotan**

Coba tanyakan lebih spesifik, misalnya:
- "Bagaimana cara membuat spray sereh?"
- "Apa manfaat neem oil?"
- "Bagaimana mengatasi kutu daun?"`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initChatbot();
    console.log('💬 Chatbot initialized');
});
