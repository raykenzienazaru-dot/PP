// ================================================
// SMARTFARM MONITORING - COMBINED SCRIPT (FIXED)
// MQTT + Charts + Chatbot + Main App
// ================================================

// ================================================
// MQTT CONNECTION & DATA HANDLING
// ================================================

let mqttClient = null;
let isConnected = false;
let historyData = [];
let latestData = null;

const MQTT_CONFIG = {
    broker: 'wss://we141ff2.ala.asia-southeast1.emqxsl.com:8084/mqtt',
    options: {
        clientId: 'webapp_' + Math.random().toString(16).substr(2, 8),
        username: 'PP123',
        password: '12345',
        reconnectPeriod: 5000,
        clean: true
    },
    topic: 'smartfarm/monitoring'
};

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
// JSON: {"suhu":xx,"kelembapan":xx,"gas":xx,"api":xx,"jarak":xx,"pir":0_atau_1,"status":"...","spray":"..."}
function handleMQTTMessage(rawMessage) {
    try {
        console.log('Raw message:', rawMessage);
        let message = rawMessage.trim();
        const data = JSON.parse(message);
        console.log('Data diterima:', data);

        data.timestamp = new Date().getTime();

        data.suhu       = sanitizeSensorValue(data.suhu);
        data.kelembapan = sanitizeSensorValue(data.kelembapan);
        data.gas        = sanitizeSensorValue(data.gas);
        data.api        = sanitizeSensorValue(data.api);
        data.jarak      = sanitizeSensorValue(data.jarak);
        // PIR: 0 = tidak ada gerakan, 1 = ada gerakan
        data.pir        = (data.pir !== undefined && data.pir !== null) ? Number(data.pir) : undefined;
        // Cahaya: nilai analog 0-4095 atau lux (tergantung sensor LDR/BH1750)
        data.cahaya     = sanitizeSensorValue(data.cahaya);

        latestData = data;

        updateSensorCards(data);
        updateStatusBanner(data);
        updateSprayReminder(data);
        addToHistory(data);
        updateCharts(data);   // ← langsung update chart setiap data baru

    } catch (error) {
        console.error('Error parsing MQTT message:', error);
        console.error('Raw message was:', rawMessage);
    }
}

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

function updateSensorCards(data) {
    if (data.suhu !== undefined) {
        const el = document.getElementById('suhuValue');
        if (el) el.textContent = data.suhu.toFixed(1);
    }
    if (data.kelembapan !== undefined) {
        const el = document.getElementById('kelembapanValue');
        if (el) el.textContent = data.kelembapan.toFixed(1);
    }
    if (data.gas !== undefined) {
        const el = document.getElementById('gasValue');
        if (el) el.textContent = Math.round(data.gas);
    }
    if (data.api !== undefined) {
        const el = document.getElementById('apiValue');
        if (el) el.textContent = Math.round(data.api);
    }
    if (data.jarak !== undefined) {
        const el = document.getElementById('jarakValue');
        if (el) el.textContent = data.jarak > 0 ? data.jarak.toFixed(1) : '--';
    }

    // PIR Sensor: tampilkan status gerak atau aman
    if (data.pir !== undefined) {
        const el    = document.getElementById('pirValue');
        const badge = document.getElementById('pirBadge');
        const card  = document.getElementById('pirCard');
        if (el) el.textContent = data.pir === 1 ? 'ADA' : 'AMAN';
        if (badge) {
            badge.textContent = data.pir === 1 ? '⚠ Gerakan!' : '✔ Kosong';
            badge.className = 'pir-badge ' + (data.pir === 1 ? 'pir-alert' : 'pir-safe');
        }
        if (card) {
            card.classList.toggle('pir-active', data.pir === 1);
        }
    }

    // Cahaya Sensor (LDR/BH1750)
    if (data.cahaya !== undefined) {
        const el    = document.getElementById('cahayaValue');
        const badge = document.getElementById('cahayaBadge');
        const card  = document.getElementById('cahayaCard');
        if (el) el.textContent = Math.round(data.cahaya);

        // Klasifikasi tingkat cahaya
        let level, label;
        if (data.cahaya < 200) {
            level = 'cahaya-gelap';  label = '🌑 Gelap';
        } else if (data.cahaya < 1000) {
            level = 'cahaya-normal'; label = '🌤 Normal';
        } else if (data.cahaya < 3000) {
            level = 'cahaya-terang'; label = '☀ Terang';
        } else {
            level = 'cahaya-terik';  label = '🔆 Terik!';
        }

        if (badge) {
            badge.textContent = label;
            badge.className = 'cahaya-badge ' + level;
        }
        if (card) {
            card.classList.toggle('cahaya-terik-active', level === 'cahaya-terik');
        }
    }
}

function updateStatusBanner(data) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    const icon        = banner.querySelector('.status-icon i');
    const title       = document.getElementById('statusTitle');
    const description = document.getElementById('statusDescription');

    banner.classList.remove('danger', 'warning');

    if (data.status) {
        const statusClean = data.status.replace(/[^\x00-\x7F]/g, '').trim().toUpperCase();
        title.textContent = data.status;

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

    if (description) {
        description.textContent = data.keterangan || getKeteranganFromStatus(data.status);
    }
}

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

function updateSprayReminder(data) {
    const sprayEl = document.getElementById('sprayStatus');
    if (sprayEl && data.spray) {
        sprayEl.textContent = data.spray;
    }
}

// ================================================
// HISTORY
// ================================================

function addToHistory(data) {
    const historyEntry = {
        timestamp:   data.timestamp,
        suhu:        data.suhu,
        kelembapan:  data.kelembapan,
        gas:         data.gas,
        api:         data.api,
        jarak:       data.jarak,
        pir:         data.pir,
        cahaya:      data.cahaya,
        status:      data.status
    };

    historyData.unshift(historyEntry);
    if (historyData.length > 100) historyData = historyData.slice(0, 100);

    saveHistoryToLocalStorage();
    refreshHistoryTable();   // ← tidak reset currentPage, hanya render ulang
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
        currentPage = 1;
        refreshHistoryTable();
        // Reset chart data juga
        resetChartData();
        alert('History berhasil dihapus!');
    }
}

function getLatestData()  { return latestData; }
function getHistoryData() { return historyData; }


// ================================================
// CHART.JS
// ================================================

let tempHumChart = null;
let gasFireChart = null;

const chartData = {
    labels:     [],
    suhu:       [],
    kelembapan: [],
    gas:        [],
    api:        []
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

    if (tempHumChart) { tempHumChart.destroy(); tempHumChart = null; }

    tempHumChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Suhu (°C)',
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
                    display: true, position: 'top',
                    labels: { padding: 15, font: { size: 12, family: 'Poppins', weight: '500' }, usePointStyle: true }
                },
                tooltip: {
                    enabled: true, backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12, cornerRadius: 8, displayColors: true
                }
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
                y: { display: true, beginAtZero: false, grid: { color: 'rgba(45,122,62,0.1)', borderDash: [5,5] }, ticks: { font: { size: 11 } } }
            },
            animation: { duration: 500, easing: 'easeInOutQuart' }
        }
    });
}

function initGasFireChart() {
    const ctx = document.getElementById('gasFireChart');
    if (!ctx) return;

    if (gasFireChart) { gasFireChart.destroy(); gasFireChart = null; }

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
                    display: true, position: 'top',
                    labels: { padding: 15, font: { size: 12, family: 'Poppins', weight: '500' }, usePointStyle: true }
                },
                tooltip: {
                    enabled: true, backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12, cornerRadius: 8, displayColors: true
                }
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
                y: { display: true, beginAtZero: true, max: 4095, grid: { color: 'rgba(45,122,62,0.1)', borderDash: [5,5] }, ticks: { font: { size: 11 } } }
            },
            animation: { duration: 500, easing: 'easeInOutQuart' }
        }
    });
}

// Dipanggil setiap kali data MQTT masuk — push ke chartData lalu update chart
function updateCharts(data) {
    if (!data) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    chartData.labels.push(timeLabel);
    chartData.suhu.push(data.suhu !== undefined ? data.suhu : null);
    chartData.kelembapan.push(data.kelembapan !== undefined ? data.kelembapan : null);
    chartData.gas.push(data.gas !== undefined ? data.gas : null);
    chartData.api.push(data.api !== undefined ? data.api : null);

    // Batasi titik yang ditampilkan
    if (chartData.labels.length > MAX_CHART_POINTS) {
        chartData.labels.shift();
        chartData.suhu.shift();
        chartData.kelembapan.shift();
        chartData.gas.shift();
        chartData.api.shift();
    }

    // Update chart — gunakan 'active' agar animasi tetap jalan
    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();
}

function resetChartData() {
    // Gunakan splice agar referensi array di Chart.js tidak putus
    chartData.labels.splice(0);
    chartData.suhu.splice(0);
    chartData.kelembapan.splice(0);
    chartData.gas.splice(0);
    chartData.api.splice(0);
    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();
}

// Load data history ke chart saat pertama load (agar chart tidak kosong)
function loadHistoricalDataToCharts() {
    const history = getHistoryData();

    // Kosongkan dengan splice agar referensi array di Chart.js tetap sama
    chartData.labels.splice(0);
    chartData.suhu.splice(0);
    chartData.kelembapan.splice(0);
    chartData.gas.splice(0);
    chartData.api.splice(0);

    if (!history || history.length === 0) {
        if (tempHumChart) tempHumChart.update();
        if (gasFireChart) gasFireChart.update();
        return;
    }

    const dataToLoad = history.slice(0, MAX_CHART_POINTS).reverse();

    dataToLoad.forEach(entry => {
        const date = new Date(entry.timestamp);
        const timeLabel = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        chartData.labels.push(timeLabel);
        chartData.suhu.push(entry.suhu !== undefined && entry.suhu !== null ? entry.suhu : null);
        chartData.kelembapan.push(entry.kelembapan !== undefined && entry.kelembapan !== null ? entry.kelembapan : null);
        chartData.gas.push(entry.gas !== undefined && entry.gas !== null ? entry.gas : null);
        chartData.api.push(entry.api !== undefined && entry.api !== null ? entry.api : null);
    });

    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();

    console.log('Loaded historical data to charts:', dataToLoad.length, 'points');
}


// ================================================
// CHATBOT
// ================================================

const chatbotKnowledge = {
    'spray sereh': {
        response: `<strong>Cara Membuat Spray Ekstrak Sereh:</strong><br><br>
<strong>Bahan:</strong><br>- 200g daun sereh segar (dicincang)<br>- 1 liter air<br>- 2 sdm sabun cuci piring alami<br><br>
<strong>Cara Pembuatan:</strong><br>- Rebus daun sereh 30 menit<br>- Dinginkan dan saring<br>- Tambahkan sabun piring (sebagai perekat)<br>- Masukkan ke botol spray<br><br>
<strong>Penggunaan:</strong><br>- Semprot tiap 3-5 hari<br>- Pagi atau sore hari<br>- Fokus bawah daun<br><br>
<strong>Manfaat:</strong> Mengusir kutu daun, ulat, serangga. Aman untuk tanaman & lingkungan.`
    },
    'neem': {
        response: `<strong>Manfaat Neem Oil untuk Tanaman:</strong><br><br>
Diekstrak dari biji pohon neem. Mengandung azadirachtin yang efektif melawan hama.<br><br>
<strong>Manfaat Utama:</strong><br>- Kendalikan 200+ jenis hama (aphids, whiteflies, mealybugs)<br>- Cegah penyakit jamur (powdery mildew, black spot)<br>- Tidak beracun untuk manusia & hewan<br><br>
<strong>Cara Penggunaan:</strong><br>- 2-3 sdm neem oil per liter air<br>- Tambah 1 sdt sabun cuci piring<br>- Kocok rata dan semprotkan<br>- Ulangi setiap 7-14 hari<br><br>
<strong>Tips:</strong> Aplikasikan saat suhu &lt; 30°C, hindari terik matahari.`
    },
    'cegah hama': {
        response: `<strong>Cara Mencegah Hama di Gudang:</strong><br><br>
<strong>1. Kontrol Kelembapan:</strong> Jaga 40-60%, gunakan dehumidifier jika &gt; 70%<br>
<strong>2. Kebersihan Rutin:</strong> Bersihkan gudang tiap minggu<br>
<strong>3. Penyemprotan Preventif:</strong> Spray sereh tiap 5 hari, neem oil 2 minggu sekali<br>
<strong>4. Monitoring:</strong> Cek tanaman tiap hari, isolasi tanaman terinfeksi<br>
<strong>5. Natural Repellent:</strong> Tanam lavender/mint/basil di sekitar gudang<br><br>
<strong>Hama Umum:</strong><br>- Kutu daun: Spray air sabun + sereh<br>- Ulat: Ambil manual + neem oil<br>- Tungau: Tingkatkan kelembapan + neem<br>- Lalat buah: Perangkap cuka apel`
    },
    'waktu semprot': {
        response: `<strong>Waktu Terbaik Penyemprotan:</strong><br><br>
<strong>Pagi (06:00-09:00):</strong> Suhu sejuk, stomata terbuka, penyerapan optimal<br>
<strong>Sore (16:00-18:00):</strong> Tidak terik, spray bertahan lebih lama<br><br>
<strong>HINDARI:</strong> Siang hari, saat hujan, saat angin kencang<br><br>
<strong>Frekuensi Preventif:</strong><br>- Sereh: 5-7 hari sekali<br>- Neem oil: 10-14 hari sekali<br><br>
<strong>Frekuensi Kuratif (ada hama):</strong><br>- Sereh: 3 hari sekali<br>- Neem oil: 5-7 hari sekali`
    },
    'kombinasi': {
        response: `<strong>Kombinasi Spray Sereh + Neem:</strong><br><br>
<strong>Bahan Power Spray:</strong><br>- 100g daun sereh (rebusan dingin)<br>- 2 sdm neem oil<br>- 1 sdt sabun cuci piring<br>- 1 liter air<br><br>
<strong>Keuntungan:</strong> Perlindungan ganda, efektif untuk hama membandel<br><br>
<strong>Jadwal:</strong><br>- Minggu 1 & 3: Spray kombinasi<br>- Minggu 2: Sereh murni<br>- Minggu 4: Neem murni`
    }
};

let chatbotOpen = false;

function initChatbot() {
    const chatbotBtn     = document.getElementById('chatbotBtn');
    const chatbotModal   = document.getElementById('chatbotModal');
    const chatbotClose   = document.getElementById('chatbotClose');
    const chatInput      = document.getElementById('chatInput');
    const chatSendBtn    = document.getElementById('chatSendBtn');
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
    const chatBody   = document.getElementById('chatbotBody');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message ' + sender;

    const avatar    = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

    const content   = document.createElement('div');
    content.className = 'message-content';
    if (sender === 'user') content.textContent = message;
    else content.innerHTML = message;

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
<strong>Solusi:</strong><br>1. Spray air sabun: 1 sdm sabun + 1 liter air<br>2. Ekstrak sereh: 3 hari sekali<br>3. Neem oil minggu kedua<br>4. Semprotan air kuat<br><br>
<strong>Pencegahan:</strong> Tanam marigold atau nasturtium di sekitar tanaman.`;
    }
    if (m.includes('ulat')) {
        return `<strong>Mengatasi Ulat:</strong><br><br>
<strong>Identifikasi:</strong> Daun berlubang, kotoran hitam di daun<br><br>
<strong>Solusi:</strong><br>1. Ambil ulat manual (pakai sarung tangan)<br>2. Neem oil setiap 5-7 hari<br>3. Bacillus thuringiensis (Bt)<br>4. Ekstrak cabai: 5 cabai + 1 liter air, rebus & semprot`;
    }
    if (m.includes('jamur') || m.includes('fungi')) {
        return `<strong>Mengatasi Jamur:</strong><br><br>
<strong>Gejala:</strong> Bercak putih seperti tepung, bercak hitam/coklat, daun busuk<br><br>
<strong>Solusi:</strong><br>1. Neem oil: 2x seminggu<br>2. Baking soda: 1 sdt + 1 liter air + sabun<br>3. Susu spray: susu:air = 1:9<br>4. Potong bagian terinfeksi`;
    }
    if (m.includes('cahaya') || m.includes('lux') || m.includes('ldr') || m.includes('terang') || m.includes('gelap')) {
        return `<strong>Sensor Cahaya (LDR/BH1750):</strong><br><br>
Mengukur intensitas cahaya di dalam gudang penyimpanan tanaman.<br><br>
<strong>Klasifikasi Cahaya:</strong><br>
- 🌑 <strong>&lt; 200 lux</strong>: Gelap — perlu tambahan lampu grow light<br>
- 🌤 <strong>200–999 lux</strong>: Normal — kondisi ideal untuk gudang<br>
- ☀ <strong>1000–2999 lux</strong>: Terang — pantau suhu tanaman<br>
- 🔆 <strong>≥ 3000 lux</strong>: Terik! — berisiko membakar daun & memicu api<br><br>
<strong>Tips Pencahayaan:</strong><br>
- Gunakan tirai/paranet jika cahaya terik<br>
- Saat gelap, aktifkan grow light LED<br>
- Cek sensor cahaya bersamaan dengan suhu`;
    }

    if (m.includes('pir') || m.includes('gerak') || m.includes('motion')) {
        return `<strong>Sensor PIR (Passive Infrared):</strong><br><br>
Mendeteksi gerakan manusia atau hewan di sekitar gudang berdasarkan perubahan radiasi inframerah.<br><br>
<strong>Fungsi di SmartFarm:</strong><br>- Memantau aktivitas di dalam gudang<br>- Mendeteksi hewan liar (tikus, kucing) yang masuk<br>- Keamanan gudang penyimpanan<br><br>
<strong>Status:</strong><br>- <strong>ADA</strong>: Ada gerakan terdeteksi — cek gudang segera!<br>- <strong>AMAN</strong>: Tidak ada gerakan, gudang aman<br><br>
<strong>Tips:</strong> Pantau log PIR di tabel riwayat untuk pola aktivitas mencurigakan.`;
    }

    return `Halo! Saya dapat membantu dengan:<br><br>
- <strong>Cara membuat spray sereh</strong><br>
- <strong>Manfaat neem oil</strong><br>
- <strong>Mengatasi hama (kutu daun, ulat, jamur)</strong><br>
- <strong>Pencegahan hama di gudang</strong><br>
- <strong>Waktu terbaik penyemprotan</strong><br>
- <strong>Sensor PIR & deteksi gerakan</strong><br><br>
Coba tanyakan: "Bagaimana cara membuat spray sereh?" atau "Apa itu sensor PIR?"`;
}


// ================================================
// HISTORY TABLE
// ================================================

let currentPage = 1;
const rowsPerPage = 10;

// Dipanggil dari addToHistory — TIDAK reset currentPage agar paginasi tidak lompat
function refreshHistoryTable() {
    renderHistoryTable();
}

// Reset ke halaman 1 hanya saat user klik clear atau pertama load
function initHistoryTable() {
    currentPage = 1;
    renderHistoryTable();
}

function renderHistoryTable() {
    const data  = getHistoryData();
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">Belum ada data</td></tr>';
        updatePagination(0);
        return;
    }

    const totalPages = Math.ceil(data.length / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const pageData   = data.slice(startIndex, startIndex + rowsPerPage);

    tbody.innerHTML = '';
    pageData.forEach(entry => {
        const row     = document.createElement('tr');
        const date    = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        const suhu       = (entry.suhu !== undefined && entry.suhu !== null)
                           ? entry.suhu.toFixed(1) + ' °C' : '-';
        const kelembapan = (entry.kelembapan !== undefined && entry.kelembapan !== null)
                           ? entry.kelembapan.toFixed(1) + ' %' : '-';
        const gas        = (entry.gas !== undefined && entry.gas !== null)
                           ? Math.round(entry.gas) : '-';
        const api        = (entry.api !== undefined && entry.api !== null)
                           ? Math.round(entry.api) : '-';
        const jarak      = (entry.jarak !== undefined && entry.jarak !== null && entry.jarak > 0)
                           ? entry.jarak.toFixed(1) + ' cm' : '-';
        const pirVal     = entry.pir !== undefined
                           ? (entry.pir === 1 ? '⚠ ADA' : '✔ AMAN') : '-';

        // Cahaya: klasifikasi level
        let cahayaVal = '-', cahayaLevel = 'cahaya-normal';
        if (entry.cahaya !== undefined && entry.cahaya !== null) {
            cahayaVal = Math.round(entry.cahaya);
            if (entry.cahaya < 200)       cahayaLevel = 'cahaya-gelap';
            else if (entry.cahaya < 1000) cahayaLevel = 'cahaya-normal';
            else if (entry.cahaya < 3000) cahayaLevel = 'cahaya-terang';
            else                          cahayaLevel = 'cahaya-terik';
        }

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
            '<td><span class="pir-table ' + (entry.pir === 1 ? 'pir-alert' : 'pir-safe') + '">' + pirVal + '</span></td>' +
            '<td><span class="cahaya-table ' + cahayaLevel + '">' + cahayaVal + '</span></td>' +
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
    renderHistoryTable();
}

window.changePage = changePage;


// ================================================
// MAIN APPLICATION
// ================================================

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
    clockDisplay.textContent = now.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
}

function setupEventListeners() {
    const btnClear = document.getElementById('btnClearHistory');
    if (btnClear) btnClear.addEventListener('click', () => clearHistory());
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const btn = document.getElementById('chatbotBtn');
        if (btn) btn.click();
    }
});

window.addEventListener('error', (e) => console.error('Global error:', e.error));
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled rejection:', e.reason));

window.debugInfo = function() {
    console.log('=== DEBUG INFO ===');
    console.log('History Data:', getHistoryData());
    console.log('Latest Data:', getLatestData());
    console.log('Current Page:', currentPage);
    console.log('MQTT Connected:', isConnected);
    console.log('Chart Labels:', chartData.labels);
};


// ================================================
// INITIALIZE ALL ON DOM READY
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromLocalStorage();
    initMQTT();
    initChatbot();
    initMainApp();

    setTimeout(() => {
        initCharts();
        loadHistoricalDataToCharts();
    }, 500);

    console.log('SmartFarm App Ready');
});