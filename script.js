// ================================================
// SMARTFARM MONITORING - COMBINED SCRIPT
// MQTT + Charts + Chatbot + Main App
// ================================================

// ================================================
// MQTT CONNECTION & DATA HANDLING
// ================================================

let mqttClient = null;
let isConnected = false;
let historyData = [];
let latestData = null;

// MQTT Configuration — sesuai dengan Arduino
const MQTT_CONFIG = {
    broker: 'wss://we141ff2.ala.asia-southeast1.emqxsl.com:8084/mqtt',
    options: {
        clientId: 'webapp_' + Math.random().toString(16).substr(2, 8),
        username: 'PP123',    // sesuai mqtt_user di Arduino
        password: '12345',    // sesuai mqtt_pass di Arduino
        reconnectPeriod: 5000,
        clean: true
    },
    topic: 'smartfarm/monitoring'  // sesuai topic publish Arduino
};

// Initialize MQTT Connection
function initMQTT() {
    console.log('Menghubungkan ke MQTT...');
    updateConnectionStatus('connecting');

    try {
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, MQTT_CONFIG.options);

        mqttClient.on('connect', () => {
            console.log('MQTT Terhubung!');
            isConnected = true;
            updateConnectionStatus('connected');

            mqttClient.subscribe(MQTT_CONFIG.topic, (err) => {
                if (err) {
                    console.error('Gagal subscribe:', err);
                } else {
                    console.log('Subscribe ke topic:', MQTT_CONFIG.topic);
                }
            });
        });

        mqttClient.on('message', (topic, message) => {
            if (topic === MQTT_CONFIG.topic) {
                handleMQTTMessage(message.toString());
            }
        });

        mqttClient.on('error', (err) => {
            console.error('MQTT Error:', err);
            updateConnectionStatus('disconnected');
        });

        mqttClient.on('close', () => {
            console.log('MQTT Terputus');
            isConnected = false;
            updateConnectionStatus('disconnected');
        });

        mqttClient.on('reconnect', () => {
            console.log('Mencoba reconnect...');
            updateConnectionStatus('connecting');
        });

    } catch (error) {
        console.error('Error inisialisasi MQTT:', error);
        updateConnectionStatus('disconnected');
    }
}

// Handle incoming MQTT message dari Arduino ESP32
// Arduino mengirim JSON: {"suhu":xx,"kelembapan":xx,"gas":xx,"api":xx,"jarak":xx,"status":"...","spray":"..."}
function handleMQTTMessage(rawMessage) {
    try {
        console.log('Raw message:', rawMessage);

        // Arduino menyisipkan emoji UTF-8 di dalam string JSON (di dalam value string, bukan key)
        // JSON.parse tetap bisa handle ini karena emoji ada di dalam string value yang di-quote
        // Tapi jika ada karakter rusak di luar string, kita bersihkan dulu
        let message = rawMessage.trim();

        const data = JSON.parse(message);
        console.log('Data diterima:', data);

        // Tambahkan timestamp dari browser (Arduino tidak mengirim timestamp)
        data.timestamp = new Date().getTime();

        // Sanitasi nilai sensor — DHT22 bisa kirim "nan" jika gagal baca
        data.suhu      = sanitizeSensorValue(data.suhu);
        data.kelembapan = sanitizeSensorValue(data.kelembapan);
        data.gas       = sanitizeSensorValue(data.gas);
        data.api       = sanitizeSensorValue(data.api);
        data.jarak     = sanitizeSensorValue(data.jarak);

        // Bersihkan teks status dari emoji untuk keperluan logika (simpan versi asli untuk tampilan)
        // data.status sudah berisi string lengkap dari Arduino, misal: "KEBAKARAN TERKONFIRMASI"

        latestData = data;

        updateSensorCards(data);
        updateStatusBanner(data);
        updateSprayReminder(data);
        addToHistory(data);
        updateCharts(data);

    } catch (error) {
        console.error('Error parsing MQTT message:', error);
        console.error('Raw message was:', rawMessage);
    }
}

// Sanitasi nilai sensor: ubah NaN/null/"nan" menjadi undefined
function sanitizeSensorValue(val) {
    if (val === undefined || val === null) return undefined;
    const num = Number(val);
    if (isNaN(num)) return undefined;
    return num;
}

function updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    const statusIcon = statusEl.querySelector('i');
    const statusText = statusEl.querySelector('span');

    statusEl.classList.remove('connected', 'disconnected');

    switch (status) {
        case 'connected':
            statusEl.classList.add('connected');
            statusIcon.className = 'fas fa-wifi';
            statusText.textContent = 'Terhubung';
            break;
        case 'connecting':
            statusIcon.className = 'fas fa-spinner fa-spin';
            statusText.textContent = 'Menghubungkan...';
            break;
        case 'disconnected':
            statusEl.classList.add('disconnected');
            statusIcon.className = 'fas fa-wifi';
            statusText.textContent = 'Terputus';
            break;
    }
}

// Update kartu sensor sesuai field yang dikirim Arduino
function updateSensorCards(data) {
    // Suhu dari DHT22 — tampilkan 1 desimal + satuan di kartu
    if (data.suhu !== undefined) {
        const el = document.getElementById('suhuValue');
        if (el) el.textContent = data.suhu.toFixed(1);
    }

    // Kelembapan dari DHT22 — tampilkan 1 desimal
    if (data.kelembapan !== undefined) {
        const el = document.getElementById('kelembapanValue');
        if (el) el.textContent = data.kelembapan.toFixed(1);
    }

    // Gas dari MQ135 — nilai analog 0-4095 (ESP32 12-bit ADC)
    if (data.gas !== undefined) {
        const el = document.getElementById('gasValue');
        if (el) el.textContent = Math.round(data.gas);
    }

    // Api dari fire sensor — nilai analog 0-4095
    if (data.api !== undefined) {
        const el = document.getElementById('apiValue');
        if (el) el.textContent = Math.round(data.api);
    }

    // Jarak dari HC-SR04 — 0 atau negatif berarti tidak ada objek / timeout
    if (data.jarak !== undefined) {
        const el = document.getElementById('jarakValue');
        if (el) el.textContent = data.jarak > 0 ? data.jarak.toFixed(1) : '--';
    }
}

// Update banner status — string status dikirim lengkap dari Arduino
function updateStatusBanner(data) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    const icon = banner.querySelector('.status-icon i');
    const title = document.getElementById('statusTitle');
    const description = document.getElementById('statusDescription');

    banner.classList.remove('danger', 'warning');

    if (data.status) {
        // Hapus emoji dari teks untuk keperluan logika pencocokan
        const statusClean = data.status.replace(/[^\x00-\x7F]/g, '').trim().toUpperCase();

        title.textContent = data.status; // tampilkan versi asli termasuk emoji

        if (statusClean.includes('KEBAKARAN') || statusClean.includes('BAHAYA')) {
            banner.classList.add('danger');
            if (icon) icon.className = 'fas fa-exclamation-triangle';
        } else if (
            statusClean.includes('PANAS') ||
            statusClean.includes('KERING') ||
            statusClean.includes('GAS') ||
            statusClean.includes('LEMBAP') ||
            statusClean.includes('LEMBAB') ||
            statusClean.includes('ZAT')
        ) {
            banner.classList.add('warning');
            if (icon) icon.className = 'fas fa-exclamation-circle';
        } else {
            if (icon) icon.className = 'fas fa-check-circle';
        }
    }

    // keterangan tidak dikirim Arduino, tapi bisa digenerate dari status
    if (description) {
        description.textContent = data.keterangan || getKeteranganFromStatus(data.status);
    }
}

// Generate keterangan lokal jika Arduino tidak mengirim field keterangan
function getKeteranganFromStatus(status) {
    if (!status) return 'Sistem monitoring aktif';
    const s = status.replace(/[^\x00-\x7F]/g, '').trim().toUpperCase();
    if (s.includes('KEBAKARAN')) return 'Api + Gas + Suhu tinggi terdeteksi!';
    if (s.includes('PANAS'))     return 'Cahaya terik & suhu naik, berisiko memicu api!';
    if (s.includes('GAS') || s.includes('ZAT')) return 'Kualitas udara buruk, segera buka jendela gudang';
    if (s.includes('KERING'))    return 'Tanaman bisa kering, aktifkan penyemprot air!';
    if (s.includes('LEMBAP') || s.includes('LEMBAB')) return 'Berisiko jamur & hama';
    return 'Sistem monitoring aktif';
}

// Update reminder spray — field "spray" dikirim Arduino
function updateSprayReminder(data) {
    const sprayEl = document.getElementById('sprayStatus');
    if (sprayEl && data.spray) {
        // Bersihkan emoji dari teks spray untuk tampilan bersih (opsional, hapus jika ingin tampilkan emoji)
        sprayEl.textContent = data.spray;
    }
}

// Simpan data ke history
function addToHistory(data) {
    const historyEntry = {
        timestamp:   data.timestamp,
        suhu:        data.suhu,
        kelembapan:  data.kelembapan,
        gas:         data.gas,
        api:         data.api,
        jarak:       data.jarak,
        status:      data.status
    };

    historyData.unshift(historyEntry);

    // Maksimal 100 entri
    if (historyData.length > 100) {
        historyData = historyData.slice(0, 100);
    }

    saveHistoryToLocalStorage();
    updateHistoryTable();
}

function saveHistoryToLocalStorage() {
    try {
        localStorage.setItem('smartfarm_history', JSON.stringify(historyData));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadHistoryFromLocalStorage() {
    try {
        const saved = localStorage.getItem('smartfarm_history');
        if (saved) {
            historyData = JSON.parse(saved);
            console.log('Loaded ' + historyData.length + ' history entries');
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        historyData = [];
    }
}

function clearHistory() {
    if (confirm('Apakah Anda yakin ingin menghapus semua history?')) {
        historyData = [];
        saveHistoryToLocalStorage();
        updateHistoryTable();
        alert('History berhasil dihapus!');
    }
}

function getLatestData() { return latestData; }
function getHistoryData() { return historyData; }

window.mqttModule = {
    getLatestData,
    getHistoryData,
    clearHistory,
    isConnected: () => isConnected,
    isDisconnected: () => !isConnected
};


// ================================================
// CHART.JS IMPLEMENTATION
// ================================================

let tempHumChart = null;
let gasFireChart = null;

const chartData = {
    labels: [],
    suhu: [],
    kelembapan: [],
    gas: [],
    api: []
};

const MAX_CHART_POINTS = 20;

function initCharts() {
    initTempHumChart();
    initGasFireChart();
    console.log('Charts initialized');
}

function initTempHumChart() {
    const ctx = document.getElementById('tempHumChart');
    if (!ctx) return;

    tempHumChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Suhu (C)',
                    data: chartData.suhu,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Kelembapan (%)',
                    data: chartData.kelembapan,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: { size: 12, family: 'Poppins', weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: { font: { size: 11, family: 'Poppins' }, maxRotation: 45, minRotation: 0 }
                },
                y: {
                    display: true,
                    beginAtZero: false,
                    grid: { color: 'rgba(45, 122, 62, 0.1)', borderDash: [5, 5] },
                    ticks: { font: { size: 11, family: 'Poppins' } }
                }
            },
            animation: { duration: 750, easing: 'easeInOutQuart' }
        }
    });
}

function initGasFireChart() {
    const ctx = document.getElementById('gasFireChart');
    if (!ctx) return;

    gasFireChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Gas (analog)',
                    data: chartData.gas,
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#9b59b6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Api (analog)',
                    data: chartData.api,
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#f39c12',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: { size: 12, family: 'Poppins', weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: { font: { size: 11, family: 'Poppins' }, maxRotation: 45, minRotation: 0 }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    // Skala 0-4095 sesuai ADC 12-bit ESP32
                    max: 4095,
                    grid: { color: 'rgba(45, 122, 62, 0.1)', borderDash: [5, 5] },
                    ticks: { font: { size: 11, family: 'Poppins' } }
                }
            },
            animation: { duration: 750, easing: 'easeInOutQuart' }
        }
    });
}

// Update chart dengan data baru dari sensor
function updateCharts(data) {
    if (!data) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    chartData.labels.push(timeLabel);
    chartData.suhu.push(data.suhu !== undefined ? data.suhu : null);
    chartData.kelembapan.push(data.kelembapan !== undefined ? data.kelembapan : null);
    chartData.gas.push(data.gas !== undefined ? data.gas : null);
    chartData.api.push(data.api !== undefined ? data.api : null);

    // Batasi jumlah titik yang ditampilkan
    if (chartData.labels.length > MAX_CHART_POINTS) {
        chartData.labels.shift();
        chartData.suhu.shift();
        chartData.kelembapan.shift();
        chartData.gas.shift();
        chartData.api.shift();
    }

    if (tempHumChart) tempHumChart.update('none');
    if (gasFireChart) gasFireChart.update('none');
}

// Load data history ke chart saat pertama load
function loadHistoricalDataToCharts() {
    const history = getHistoryData();
    if (!history || history.length === 0) return;

    chartData.labels = [];
    chartData.suhu = [];
    chartData.kelembapan = [];
    chartData.gas = [];
    chartData.api = [];

    // Ambil data terbaru, balik urutan agar kronologis
    const dataToLoad = history.slice(0, MAX_CHART_POINTS).reverse();

    dataToLoad.forEach(entry => {
        const date = new Date(entry.timestamp);
        const timeLabel = date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        chartData.labels.push(timeLabel);
        chartData.suhu.push(entry.suhu !== undefined ? entry.suhu : null);
        chartData.kelembapan.push(entry.kelembapan !== undefined ? entry.kelembapan : null);
        chartData.gas.push(entry.gas !== undefined ? entry.gas : null);
        chartData.api.push(entry.api !== undefined ? entry.api : null);
    });

    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();

    console.log('Loaded historical data to charts');
}

window.updateCharts = updateCharts;


// ================================================
// CHATBOT FOR PEST CONTROL & NATURAL SPRAY
// ================================================

const chatbotKnowledge = {
    'spray sereh': {
        response: `<strong>Cara Membuat Spray Ekstrak Sereh:</strong><br><br>
<strong>1. Bahan yang Dibutuhkan:</strong><br>
- 200g daun sereh segar (dicincang)<br>
- 1 liter air<br>
- 2 sendok makan sabun cuci piring alami<br><br>
<strong>2. Cara Pembuatan:</strong><br>
- Rebus daun sereh dalam 1 liter air selama 30 menit<br>
- Dinginkan dan saring<br>
- Tambahkan sabun cuci piring (sebagai perekat)<br>
- Masukkan ke botol spray<br><br>
<strong>3. Cara Penggunaan:</strong><br>
- Semprot pada tanaman setiap 3-5 hari<br>
- Aplikasikan di pagi atau sore hari<br>
- Fokus pada bagian bawah daun<br><br>
<strong>Manfaat:</strong><br>
Mengusir hama kutu daun, ulat, dan serangga. Aroma sereh tidak disukai hama. Aman untuk tanaman dan lingkungan.`
    },
    'neem': {
        response: `<strong>Manfaat Neem Oil untuk Tanaman:</strong><br><br>
Minyak yang diekstrak dari biji pohon neem (Azadirachta indica). Mengandung azadirachtin yang sangat efektif melawan hama.<br><br>
<strong>Manfaat Utama:</strong><br>
- Mengendalikan 200+ jenis hama (aphids, whiteflies, mealybugs)<br>
- Mencegah penyakit jamur (powdery mildew, black spot)<br>
- Tidak beracun untuk manusia dan hewan peliharaan<br><br>
<strong>Cara Penggunaan:</strong><br>
- Campurkan 2-3 sdm neem oil per liter air<br>
- Tambahkan 1 sdt sabun cuci piring<br>
- Kocok rata dan semprotkan<br>
- Ulangi setiap 7-14 hari<br><br>
<strong>Tips:</strong> Aplikasikan saat suhu &lt; 30C, hindari saat terik matahari.`
    },
    'cegah hama': {
        response: `<strong>Cara Mencegah Hama di Gudang:</strong><br><br>
<strong>1. Kontrol Kelembapan:</strong> Jaga 40-60%, gunakan dehumidifier jika &gt; 70%<br>
<strong>2. Kebersihan Rutin:</strong> Bersihkan gudang setiap minggu, buang sisa tanaman mati<br>
<strong>3. Penyemprotan Preventif:</strong> Spray sereh tiap 5 hari, neem oil 2 minggu sekali<br>
<strong>4. Monitoring:</strong> Periksa tanaman setiap hari, isolasi tanaman terinfeksi<br>
<strong>5. Natural Repellent:</strong> Tanam lavender/mint/basil di sekitar gudang<br><br>
<strong>Hama Umum:</strong><br>
- Kutu daun: Spray air sabun + sereh<br>
- Ulat: Ambil manual + neem oil<br>
- Tungau: Tingkatkan kelembapan + neem<br>
- Lalat buah: Perangkap cuka apel`
    },
    'waktu semprot': {
        response: `<strong>Waktu Terbaik untuk Penyemprotan:</strong><br><br>
<strong>Pagi (06:00-09:00):</strong> Suhu sejuk, stomata daun terbuka, penyerapan optimal<br>
<strong>Sore (16:00-18:00):</strong> Matahari tidak terik, spray bertahan lebih lama<br><br>
<strong>HINDARI:</strong> Siang hari (risiko terbakar), saat hujan, saat angin kencang<br><br>
<strong>Frekuensi Preventif:</strong><br>
- Sereh: 5-7 hari sekali<br>
- Neem oil: 10-14 hari sekali<br><br>
<strong>Frekuensi Kuratif (ada hama):</strong><br>
- Sereh: 3 hari sekali<br>
- Neem oil: 5-7 hari sekali`
    },
    'kombinasi': {
        response: `<strong>Kombinasi Spray Sereh + Neem:</strong><br><br>
<strong>Bahan Power Spray:</strong><br>
- 100g daun sereh (rebusan dingin)<br>
- 2 sdm neem oil<br>
- 1 sdt sabun cuci piring<br>
- 1 liter air<br><br>
<strong>Keuntungan:</strong> Perlindungan ganda, efektif untuk hama membandel, mencegah resistensi<br><br>
<strong>Jadwal:</strong><br>
- Minggu 1 & 3: Spray kombinasi<br>
- Minggu 2: Sereh murni<br>
- Minggu 4: Neem murni`
    }
};

let chatbotOpen = false;

function initChatbot() {
    const chatbotBtn   = document.getElementById('chatbotBtn');
    const chatbotModal = document.getElementById('chatbotModal');
    const chatbotClose = document.getElementById('chatbotClose');
    const chatInput    = document.getElementById('chatInput');
    const chatSendBtn  = document.getElementById('chatSendBtn');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');

    if (!chatbotBtn) return;

    chatbotBtn.addEventListener('click', () => {
        chatbotOpen = !chatbotOpen;
        chatbotModal.classList.toggle('active', chatbotOpen);
    });

    chatbotClose.addEventListener('click', () => {
        chatbotOpen = false;
        chatbotModal.classList.remove('active');
    });

    chatSendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) { sendMessage(message); chatInput.value = ''; }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message) { sendMessage(message); chatInput.value = ''; }
        }
    });

    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => sendMessage(btn.dataset.question));
    });
}

function sendMessage(message) {
    addChatMessage(message, 'user');
    setTimeout(() => addChatMessage(processMessage(message), 'bot'), 500);
}

function addChatMessage(message, sender) {
    const chatBody = document.getElementById('chatbotBody');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message ' + sender;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'bot'
        ? '<i class="fas fa-robot"></i>'
        : '<i class="fas fa-user"></i>';

    const content = document.createElement('div');
    content.className = 'message-content';
    // Jika pesan sudah berupa HTML (dari knowledge base), tampilkan langsung
    // Jika dari user, escape HTML dulu
    if (sender === 'user') {
        content.textContent = message;
    } else {
        content.innerHTML = message;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function processMessage(message) {
    const m = message.toLowerCase();

    if (m.includes('sereh') || m.includes('serai'))                          return chatbotKnowledge['spray sereh'].response;
    if (m.includes('neem'))                                                   return chatbotKnowledge['neem'].response;
    if (m.includes('cegah') || m.includes('pencegah') || m.includes('hama')) return chatbotKnowledge['cegah hama'].response;
    if (m.includes('waktu') || m.includes('kapan'))                          return chatbotKnowledge['waktu semprot'].response;
    if (m.includes('kombinasi') || m.includes('campur'))                     return chatbotKnowledge['kombinasi'].response;

    if (m.includes('kutu daun') || m.includes('aphid')) {
        return `<strong>Mengatasi Kutu Daun:</strong><br><br>
<strong>Gejala:</strong> Daun mengeriting dan menguning, lapisan lengket pada daun<br><br>
<strong>Solusi:</strong><br>
1. Spray air sabun: 1 sdm sabun + 1 liter air<br>
2. Ekstrak sereh: aplikasi 3 hari sekali<br>
3. Neem oil: minggu kedua untuk membunuh telur<br>
4. Semprotan air kuat untuk menghilangkan kutu<br><br>
<strong>Pencegahan:</strong> Tanam marigold atau nasturtium di sekitar tanaman.`;
    }

    if (m.includes('ulat')) {
        return `<strong>Mengatasi Ulat:</strong><br><br>
<strong>Identifikasi:</strong> Daun berlubang, kotoran hitam di daun<br><br>
<strong>Solusi:</strong><br>
1. Ambil ulat manual (pakai sarung tangan)<br>
2. Neem oil setiap 5-7 hari<br>
3. Bacillus thuringiensis (Bt): insektisida biologis aman<br>
4. Ekstrak cabai: 5 cabai + 1 liter air, rebus & semprot<br><br>
<strong>Pencegahan:</strong> Periksa daun rutin pagi dan sore.`;
    }

    if (m.includes('jamur') || m.includes('fungi')) {
        return `<strong>Mengatasi Jamur pada Tanaman:</strong><br><br>
<strong>Gejala:</strong> Bercak putih seperti tepung, bercak hitam/coklat, daun busuk<br><br>
<strong>Solusi:</strong><br>
1. Neem oil: 2x seminggu<br>
2. Baking soda spray: 1 sdt + 1 liter air + sabun<br>
3. Susu spray: perbandingan susu:air = 1:9<br>
4. Potong dan buang bagian terinfeksi<br><br>
<strong>Pencegahan:</strong> Jaga sirkulasi udara, hindari penyiraman berlebihan.`;
    }

    return `Halo! Saya dapat membantu dengan:<br><br>
- <strong>Cara membuat spray sereh</strong><br>
- <strong>Manfaat neem oil</strong><br>
- <strong>Mengatasi hama (kutu daun, ulat, jamur)</strong><br>
- <strong>Pencegahan hama di gudang</strong><br>
- <strong>Waktu terbaik penyemprotan</strong><br><br>
Coba tanyakan misalnya: "Bagaimana cara membuat spray sereh?" atau "Cara mengatasi kutu daun?"`;
}


// ================================================
// MAIN APPLICATION (History Table, Clock, UI)
// ================================================

let currentPage = 1;
const rowsPerPage = 10;

function initMainApp() {
    initRealtimeClock();
    initHistoryTable();
    setupEventListeners();
    console.log('Main app initialized');
}

function initRealtimeClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const clockDisplay = document.getElementById('clockDisplay');
    if (!clockDisplay) return;
    const now = new Date();
    const options = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    };
    clockDisplay.textContent = now.toLocaleDateString('id-ID', options);
}

function initHistoryTable() {
    updateHistoryTable();
}

function updateHistoryTable() {
    const data = getHistoryData();
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Belum ada data</td></tr>';
        updatePagination(0);
        return;
    }

    const totalPages = Math.ceil(data.length / rowsPerPage);

    // Pastikan currentPage tidak melebihi total halaman
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(startIndex, startIndex + rowsPerPage);

    tbody.innerHTML = '';
    pageData.forEach(entry => {
        const row = document.createElement('tr');
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Format nilai sensor — tampilkan '-' jika undefined/null
        const suhu       = (entry.suhu !== undefined && entry.suhu !== null)
                           ? entry.suhu.toFixed(1) + ' C' : '-';
        const kelembapan = (entry.kelembapan !== undefined && entry.kelembapan !== null)
                           ? entry.kelembapan.toFixed(1) + ' %' : '-';
        const gas        = (entry.gas !== undefined && entry.gas !== null)
                           ? Math.round(entry.gas) : '-';
        const api        = (entry.api !== undefined && entry.api !== null)
                           ? Math.round(entry.api) : '-';
        const jarak      = (entry.jarak !== undefined && entry.jarak !== null && entry.jarak > 0)
                           ? entry.jarak.toFixed(1) + ' cm' : '-';
        // Bersihkan emoji dari status untuk tabel agar tidak berantakan
        const status     = entry.status
                           ? entry.status.replace(/[^\x00-\x7F]/g, '').trim() || entry.status
                           : '-';

        row.innerHTML =
            '<td>' + timeStr + '</td>' +
            '<td>' + suhu + '</td>' +
            '<td>' + kelembapan + '</td>' +
            '<td>' + gas + '</td>' +
            '<td>' + api + '</td>' +
            '<td>' + jarak + '</td>' +
            '<td><span class="status-badge">' + status + '</span></td>';

        tbody.appendChild(row);
    });

    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }

    pagination.innerHTML =
        '<button onclick="changePage(' + (currentPage - 1) + ')" ' + (currentPage === 1 ? 'disabled' : '') + '>' +
        '<i class="fas fa-chevron-left"></i> Prev</button>' +
        '<span>Halaman ' + currentPage + ' dari ' + totalPages + '</span>' +
        '<button onclick="changePage(' + (currentPage + 1) + ')" ' + (currentPage === totalPages ? 'disabled' : '') + '>' +
        'Next <i class="fas fa-chevron-right"></i></button>';
}

function changePage(newPage) {
    const totalPages = Math.ceil(getHistoryData().length / rowsPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    updateHistoryTable();
}

window.changePage = changePage;

// Dipanggil dari addToHistory — reset ke halaman 1 saat data baru masuk
window.updateHistoryTable = function() {
    currentPage = 1;
    updateHistoryTable();
};

function setupEventListeners() {
    const btnClear = document.getElementById('btnClearHistory');
    if (btnClear) {
        btnClear.addEventListener('click', () => clearHistory());
    }
}

function showNotification(message, type) {
    type = type || 'info';
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    notification.innerHTML = '<i class="fas fa-' + iconName + '"></i><span>' + message + '</span>';
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function getStatusColor(status) {
    if (!status) return '#95a5a6';
    const s = status.toLowerCase();
    if (s.includes('kebakaran') || s.includes('bahaya')) return '#e74c3c';
    if (s.includes('panas') || s.includes('kering') || s.includes('gas') || s.includes('lembap')) return '#f39c12';
    return '#27ae60';
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const btn = document.getElementById('chatbotBtn');
        if (btn) btn.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        const section = document.querySelector('.history-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        updateHistoryTable();
    }
});

window.addEventListener('error', (e) => console.error('Global error:', e.error));
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled promise rejection:', e.reason));

window.debugInfo = function() {
    console.log('=== DEBUG INFO ===');
    console.log('History Data:', getHistoryData());
    console.log('Latest Data:', getLatestData());
    console.log('Current Page:', currentPage);
    console.log('MQTT Connected:', isConnected);
};


// ================================================
// INITIALIZE ALL ON DOM READY
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromLocalStorage();
    initMQTT();
    initChatbot();
    initMainApp();

    // Tunggu sebentar agar history ter-load sebelum render chart
    setTimeout(() => {
        initCharts();
        loadHistoricalDataToCharts();
    }, 500);

    console.log('SmartFarm App Ready');
});


// ================================================
// SERVICE WORKER (Opsional untuk PWA)
// ================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment untuk enable PWA:
        // navigator.serviceWorker.register('/sw.js');
    });
}