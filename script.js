// ================================================
// SMARTFARM MONITORING - COMBINED SCRIPT (FIXED)
// MQTT + Charts + Chatbot + Main App
// Disesuaikan dengan firmware Arduino ESP32
// ================================================

let mqttClient  = null;
let isConnected = false;
let historyData = [];
let latestData  = null;
let brokerIndex = 0;

const MQTT_HOST  = 'we141ff2.ala.asia-southeast1.emqxsl.com';
const MQTT_TOPIC = 'smartfarm/monitoring';

// Coba WSS 8084 dulu, fallback ke WS 8083
const BROKER_CANDIDATES = [
    'wss://we141ff2.ala.asia-southeast1.emqxsl.com:8084/mqtt',
];

// ================================================
// THRESHOLD — HARUS SINKRON DENGAN ARDUINO
// ================================================
// #define SUHU_PANAS        32.0
// #define KELEMBAPAN_KERING 40.0
// #define FIRE_THRESHOLD    3000
// #define GAS_PPM_THRESHOLD 400.0
// #define DISTANCE_FULL     5

const THRESHOLD = {
    SUHU_PANAS:        32.0,
    KELEMBAPAN_KERING: 40.0,
    KELEMBAPAN_LEMBAP: 80.0,
    FIRE_THRESHOLD:    3000,
    GAS_PPM_THRESHOLD: 400.0,
    DISTANCE_FULL:     5
};

// ================================================
// STATUS CODES — HARUS SINKRON DENGAN ARDUINO
// Arduino mengirim: NORMAL | KEBAKARAN | TERLALU_PANAS |
//                   GAS_BERBAHAYA | KERING | TERLALU_LEMBAP
// ================================================
const STATUS_LEVEL = {
    'KEBAKARAN':     'danger',
    'TERLALU_PANAS': 'warning',
    'GAS_BERBAHAYA': 'warning',
    'KERING':        'warning',
    'TERLALU_LEMBAP':'warning',
    'NORMAL':        'normal'
};

const STATUS_ICON = {
    'KEBAKARAN':     'fas fa-fire',
    'TERLALU_PANAS': 'fas fa-thermometer-full',
    'GAS_BERBAHAYA': 'fas fa-smog',
    'KERING':        'fas fa-tint-slash',
    'TERLALU_LEMBAP':'fas fa-water',
    'NORMAL':        'fas fa-check-circle'
};

// ================================================
// MQTT CONNECTION WITH AUTO-FALLBACK
// ================================================

function initMQTT() { tryConnect(0); }

function tryConnect(idx) {
    if (idx >= BROKER_CANDIDATES.length) {
        console.error('Semua broker gagal. Cek port EMQX di dashboard.');
        updateConnectionStatus('disconnected');
        return;
    }

    const broker = BROKER_CANDIDATES[idx];
    console.log('Mencoba koneksi ke:', broker);
    updateConnectionStatus('connecting');

    const options = {
        clientId: 'webapp_' + Math.random().toString(16).substr(2, 8),
        username: 'PP123',
        password: '13579',
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: 8000
    };

    try {
        if (mqttClient) { mqttClient.end(true); mqttClient = null; }
        mqttClient = mqtt.connect(broker, options);

        const timeoutId = setTimeout(() => {
            if (!isConnected) {
                console.warn('Timeout di ' + broker + ', coba berikutnya...');
                mqttClient.end(true);
                tryConnect(idx + 1);
            }
        }, 10000);

        mqttClient.on('connect', () => {
            clearTimeout(timeoutId);
            console.log('MQTT Terhubung via:', broker);
            isConnected = true;
            brokerIndex = idx;
            updateConnectionStatus('connected');
            mqttClient.subscribe(MQTT_TOPIC, (err) => {
                if (err) console.error('Gagal subscribe:', err);
                else     console.log('Subscribe ke topic:', MQTT_TOPIC);
            });
        });

        mqttClient.on('message', (topic, message) => {
            if (topic === MQTT_TOPIC) handleMQTTMessage(message.toString());
        });

        mqttClient.on('error', (err) => {
            clearTimeout(timeoutId);
            console.warn('Error di ' + broker + ':', err.message || err);
            updateConnectionStatus('disconnected');
            setTimeout(() => tryConnect(idx + 1), 1000);
        });

        mqttClient.on('close', () => {
            if (isConnected) {
                console.log('MQTT Terputus, reconnect 5 detik...');
                isConnected = false;
                updateConnectionStatus('disconnected');
                setTimeout(() => tryConnect(brokerIndex), 5000);
            }
        });

        mqttClient.on('reconnect', () => updateConnectionStatus('connecting'));

    } catch (error) {
        console.error('Error inisialisasi MQTT:', error);
        setTimeout(() => tryConnect(idx + 1), 1000);
    }
}

// ================================================
// MQTT MESSAGE HANDLER
// Arduino payload format:
// {
//   "suhu": float,
//   "kelembapan": float,
//   "gas_ppm": float,   <-- BUKAN "gas", ini PPM hasil konversi MQ135
//   "api": int,         <-- nilai analog raw 0-4095 dari fire sensor
//   "jarak": float|null,
//   "pir": bool,
//   "status": string,   <-- kode status (NORMAL/KEBAKARAN/dll)
//   "keterangan": string,
//   "spray": string
// }
// ================================================

function handleMQTTMessage(rawMessage) {
    try {
        console.log('Raw message:', rawMessage);
        const data = JSON.parse(rawMessage.trim());
        console.log('Data diterima:', data);

        data.timestamp  = new Date().getTime();
        data.suhu       = sanitizeSensorValue(data.suhu);
        data.kelembapan = sanitizeSensorValue(data.kelembapan);

        // Arduino kirim "gas_ppm" (float PPM), simpan ke data.gas_ppm
        // Juga pertahankan data.gas untuk backward-compat jika ada payload lama
        data.gas_ppm    = sanitizeSensorValue(data.gas_ppm);
        data.gas        = sanitizeSensorValue(data.gas);        // legacy / raw analog (opsional)

        data.api        = sanitizeSensorValue(data.api);        // raw analog 0-4095
        data.jarak      = sanitizeSensorValue(data.jarak);

        // PIR: Arduino kirim boolean true/false -> konversi ke 0/1
        if (data.pir !== undefined && data.pir !== null) {
            if (typeof data.pir === 'boolean')     data.pir = data.pir ? 1 : 0;
            else if (typeof data.pir === 'string') data.pir = (data.pir === 'true' || data.pir === '1') ? 1 : 0;
            else                                   data.pir = Number(data.pir) ? 1 : 0;
        } else {
            data.pir = 0;
        }

        latestData = data;
        updateSensorCards(data);
        updateStatusBanner(data);
        updateSprayReminder(data);
        addToHistory(data);
        updateCharts(data);

    } catch (error) {
        console.error('Error parsing MQTT message:', error, rawMessage);
    }
}

function sanitizeSensorValue(val) {
    if (val === undefined || val === null) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
}

// ================================================
// UI UPDATES
// ================================================

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
            statusText.textContent = 'Terhubung'; break;
        case 'connecting':
            statusIcon.className = 'fas fa-spinner fa-spin';
            statusText.textContent = 'Menghubungkan...'; break;
        case 'disconnected':
            statusEl.classList.add('disconnected');
            statusIcon.className = 'fas fa-wifi';
            statusText.textContent = 'Terputus'; break;
    }
}

function updateSensorCards(data) {
    // Suhu & Kelembapan
    if (data.suhu !== undefined) {
        const el = document.getElementById('suhuValue');
        if (el) el.textContent = data.suhu.toFixed(1);
    }
    if (data.kelembapan !== undefined) {
        const el = document.getElementById('kelembapanValue');
        if (el) el.textContent = data.kelembapan.toFixed(1);
    }

    // Gas: tampilkan gas_ppm (PPM) jika ada, fallback ke gas (raw analog)
    const gasDisplay = data.gas_ppm !== undefined ? data.gas_ppm : data.gas;
    if (gasDisplay !== undefined) {
        const el = document.getElementById('gasValue');
        if (el) {
            // Tampilkan 1 desimal jika PPM, integer jika raw analog
            el.textContent = data.gas_ppm !== undefined
                ? data.gas_ppm.toFixed(1)
                : Math.round(gasDisplay);
        }
        // Ubah label satuan jika ada elemennya
        const unitEl = document.getElementById('gasUnit');
        if (unitEl) unitEl.textContent = data.gas_ppm !== undefined ? 'PPM' : 'analog';
    }

    // Api (raw analog 0–4095)
    if (data.api !== undefined) {
        const el = document.getElementById('apiValue');
        if (el) el.textContent = Math.round(data.api);
    }

    // Jarak (cm) — null jika sensor error (distance = 999 dari Arduino)
    if (data.jarak !== undefined) {
        const el = document.getElementById('jarakValue');
        if (el) {
            // Arduino kirim 999 saat sensor error
            el.textContent = (data.jarak > 0 && data.jarak < 999) ? data.jarak.toFixed(1) : '--';
        }
        // Indikator status box penyimpanan
        const boxStatusEl = document.getElementById('boxStatus');
        if (boxStatusEl) {
            if (data.jarak === 999 || data.jarak <= 0) {
                boxStatusEl.textContent = 'Sensor error';
                boxStatusEl.className = 'box-status warning';
            } else if (data.jarak < THRESHOLD.DISTANCE_FULL) {
                boxStatusEl.textContent = 'PENUH - Segera kosongkan!';
                boxStatusEl.className = 'box-status danger';
            } else {
                boxStatusEl.textContent = 'Normal';
                boxStatusEl.className = 'box-status normal';
            }
        }
    }

    // PIR
    const pirEl    = document.getElementById('pirValue');
    const pirBadge = document.getElementById('pirBadge');
    const pirCard  = document.getElementById('pirCard');
    if (pirEl)    pirEl.textContent = data.pir === 1 ? 'ADA' : 'AMAN';
    if (pirBadge) {
        pirBadge.textContent = data.pir === 1 ? 'Gerakan!' : 'Kosong';
        pirBadge.className = 'pir-badge ' + (data.pir === 1 ? 'pir-alert' : 'pir-safe');
    }
    if (pirCard) pirCard.classList.toggle('pir-active', data.pir === 1);
}

function updateStatusBanner(data) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    const icon  = banner.querySelector('.status-icon i');
    const title = document.getElementById('statusTitle');
    const desc  = document.getElementById('statusDescription');

    // Reset class
    banner.classList.remove('danger', 'warning');

    if (data.status) {
        const statusCode = data.status.trim().toUpperCase();

        // Set level (danger/warning/normal) berdasarkan kode status Arduino
        const level = STATUS_LEVEL[statusCode] || 'normal';
        if (level === 'danger')  banner.classList.add('danger');
        if (level === 'warning') banner.classList.add('warning');

        // Set icon
        if (icon) icon.className = STATUS_ICON[statusCode] || 'fas fa-info-circle';

        // Set judul — gunakan label manusia-friendly
        if (title) title.textContent = getStatusLabel(statusCode);

        // Set deskripsi — pakai keterangan dari Arduino jika ada, fallback ke lokal
        if (desc) desc.textContent = data.keterangan || getKeteranganFromStatus(statusCode);
    }
}

// Label tampilan untuk setiap kode status Arduino
function getStatusLabel(statusCode) {
    const labels = {
        'NORMAL':        'Kondisi Normal',
        'KEBAKARAN':     'BAHAYA KEBAKARAN!',
        'TERLALU_PANAS': 'Suhu Terlalu Panas',
        'GAS_BERBAHAYA': 'Gas Berbahaya Terdeteksi',
        'KERING':        'Kelembapan Terlalu Kering',
        'TERLALU_LEMBAP':'Kelembapan Terlalu Lembap'
    };
    return labels[statusCode] || statusCode;
}

// Keterangan fallback jika Arduino tidak mengirim field "keterangan"
function getKeteranganFromStatus(statusCode) {
    const ket = {
        'NORMAL':        'Sistem monitoring aktif, semua kondisi aman.',
        'KEBAKARAN':     'Api, gas, dan suhu tinggi terdeteksi bersamaan!',
        'TERLALU_PANAS': 'Suhu > ' + THRESHOLD.SUHU_PANAS + '°C, berisiko memicu api!',
        'GAS_BERBAHAYA': 'Gas > ' + THRESHOLD.GAS_PPM_THRESHOLD + ' PPM, segera buka jendela gudang!',
        'KERING':        'Kelembapan < ' + THRESHOLD.KELEMBAPAN_KERING + '%, tanaman bisa kering, aktifkan penyemprot!',
        'TERLALU_LEMBAP':'Kelembapan > ' + THRESHOLD.KELEMBAPAN_LEMBAP + '%, berisiko jamur dan hama!'
    };
    return ket[statusCode] || 'Sistem monitoring aktif.';
}

function updateSprayReminder(data) {
    const el = document.getElementById('sprayStatus');
    if (el && data.spray) el.textContent = data.spray;
}

// ================================================
// HISTORY
// ================================================

function addToHistory(data) {
    historyData.unshift({
        timestamp:  data.timestamp,
        suhu:       data.suhu,
        kelembapan: data.kelembapan,
        gas_ppm:    data.gas_ppm,   // PPM dari MQ135
        gas:        data.gas,       // raw analog (legacy)
        api:        data.api,
        jarak:      data.jarak,
        pir:        data.pir,
        status:     data.status
    });
    if (historyData.length > 100) historyData = historyData.slice(0, 100);
    saveHistoryToLocalStorage();
    refreshHistoryTable();
}

function saveHistoryToLocalStorage() {
    try { localStorage.setItem('smartfarm_history', JSON.stringify(historyData)); }
    catch (e) { console.error('Error saving localStorage:', e); }
}

function loadHistoryFromLocalStorage() {
    try {
        const saved = localStorage.getItem('smartfarm_history');
        if (saved) {
            historyData = JSON.parse(saved).map(entry => {
                if (typeof entry.pir === 'boolean') entry.pir = entry.pir ? 1 : 0;
                // Migrasi entri lama: jika ada gas (raw) tapi tidak ada gas_ppm, pertahankan
                return entry;
            });
            console.log('Loaded ' + historyData.length + ' history entries');
        }
    } catch (e) { console.error('Error loading localStorage:', e); historyData = []; }
}

function clearHistory() {
    if (confirm('Apakah Anda yakin ingin menghapus semua history?')) {
        historyData = []; saveHistoryToLocalStorage(); currentPage = 1; refreshHistoryTable(); resetChartData();
        alert('History berhasil dihapus!');
    }
}

function getLatestData()  { return latestData; }
function getHistoryData() { return historyData; }

// ================================================
// CHART.JS
// Chart 1: Suhu & Kelembapan
// Chart 2: Gas PPM & Api (raw analog)
// ================================================

let tempHumChart = null;
let gasFireChart = null;
const chartData = { labels: [], suhu: [], kelembapan: [], gas_ppm: [], api: [] };
const MAX_CHART_POINTS = 20;

function initCharts() { initTempHumChart(); initGasFireChart(); console.log('Charts initialized'); }

function initTempHumChart() {
    const ctx = document.getElementById('tempHumChart');
    if (!ctx) return;
    if (tempHumChart) { tempHumChart.destroy(); tempHumChart = null; }
    tempHumChart = new Chart(ctx, {
        type: 'line',
        data: { labels: chartData.labels, datasets: [
            { label: 'Suhu (°C)', data: chartData.suhu, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#e74c3c', pointBorderColor: '#fff', pointBorderWidth: 2 },
            { label: 'Kelembapan (%)', data: chartData.kelembapan, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#3498db', pointBorderColor: '#fff', pointBorderWidth: 2 }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { padding: 15, font: { size: 12, family: 'Poppins', weight: '500' }, usePointStyle: true } },
                tooltip: { enabled: true, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 },
                // Garis threshold suhu panas
                annotation: {
                    annotations: {
                        suhuPanas: { type: 'line', yMin: THRESHOLD.SUHU_PANAS, yMax: THRESHOLD.SUHU_PANAS, borderColor: 'rgba(231,76,60,0.5)', borderWidth: 1, borderDash: [6,3], label: { display: true, content: 'Batas Panas (' + THRESHOLD.SUHU_PANAS + '°C)', position: 'end', font: { size: 10 } } },
                        kelKering: { type: 'line', yMin: THRESHOLD.KELEMBAPAN_KERING, yMax: THRESHOLD.KELEMBAPAN_KERING, borderColor: 'rgba(52,152,219,0.5)', borderWidth: 1, borderDash: [6,3], label: { display: true, content: 'Batas Kering (' + THRESHOLD.KELEMBAPAN_KERING + '%)', position: 'end', font: { size: 10 } } },
                        kelLembap: { type: 'line', yMin: THRESHOLD.KELEMBAPAN_LEMBAP, yMax: THRESHOLD.KELEMBAPAN_LEMBAP, borderColor: 'rgba(52,100,219,0.5)', borderWidth: 1, borderDash: [6,3], label: { display: true, content: 'Batas Lembap (' + THRESHOLD.KELEMBAPAN_LEMBAP + '%)', position: 'end', font: { size: 10 } } }
                    }
                }
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
                y: { display: true, min: 0, max: 100, grid: { color: 'rgba(45,122,62,0.1)', borderDash: [5,5] }, ticks: { font: { size: 11 } } }
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
        data: { labels: chartData.labels, datasets: [
            // gas_ppm — sumbu Y kiri (PPM)
            { label: 'Gas MQ135 (PPM)', data: chartData.gas_ppm, borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#9b59b6', pointBorderColor: '#fff', pointBorderWidth: 2, yAxisID: 'yPPM' },
            // api raw analog — sumbu Y kanan (0-4095)
            { label: 'Api / Fire Sensor (analog)', data: chartData.api, borderColor: '#f39c12', backgroundColor: 'rgba(243,156,18,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#f39c12', pointBorderColor: '#fff', pointBorderWidth: 2, yAxisID: 'yFire' }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top', labels: { padding: 15, font: { size: 12, family: 'Poppins', weight: '500' }, usePointStyle: true } },
                tooltip: { enabled: true, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 }
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
                // Sumbu Y kiri: Gas PPM
                yPPM: {
                    type: 'linear', position: 'left', beginAtZero: true,
                    grid: { color: 'rgba(155,89,182,0.1)', borderDash: [5,5] },
                    ticks: { font: { size: 11 }, color: '#9b59b6' },
                    title: { display: true, text: 'Gas (PPM)', color: '#9b59b6', font: { size: 11 } }
                },
                // Sumbu Y kanan: Fire sensor analog 0-4095
                yFire: {
                    type: 'linear', position: 'right', beginAtZero: true, max: 4095,
                    grid: { drawOnChartArea: false },
                    ticks: { font: { size: 11 }, color: '#f39c12' },
                    title: { display: true, text: 'Api (0-4095)', color: '#f39c12', font: { size: 11 } }
                }
            },
            animation: { duration: 500, easing: 'easeInOutQuart' }
        }
    });
}

function updateCharts(data) {
    if (!data) return;
    const timeLabel = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chartData.labels.push(timeLabel);
    chartData.suhu.push(data.suhu        != null ? data.suhu        : null);
    chartData.kelembapan.push(data.kelembapan != null ? data.kelembapan : null);
    chartData.gas_ppm.push(data.gas_ppm  != null ? data.gas_ppm    : null);  // PPM
    chartData.api.push(data.api          != null ? data.api         : null);  // raw analog

    if (chartData.labels.length > MAX_CHART_POINTS) {
        chartData.labels.shift(); chartData.suhu.shift(); chartData.kelembapan.shift();
        chartData.gas_ppm.shift(); chartData.api.shift();
    }
    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();
}

function resetChartData() {
    chartData.labels.splice(0); chartData.suhu.splice(0); chartData.kelembapan.splice(0);
    chartData.gas_ppm.splice(0); chartData.api.splice(0);
    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();
}

function loadHistoricalDataToCharts() {
    const history = getHistoryData();
    chartData.labels.splice(0); chartData.suhu.splice(0); chartData.kelembapan.splice(0);
    chartData.gas_ppm.splice(0); chartData.api.splice(0);
    if (!history || history.length === 0) {
        if (tempHumChart) tempHumChart.update();
        if (gasFireChart) gasFireChart.update();
        return;
    }
    history.slice(0, MAX_CHART_POINTS).reverse().forEach(entry => {
        chartData.labels.push(new Date(entry.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        chartData.suhu.push(entry.suhu         ?? null);
        chartData.kelembapan.push(entry.kelembapan ?? null);
        chartData.gas_ppm.push(entry.gas_ppm   ?? null);  // gunakan gas_ppm, fallback null
        chartData.api.push(entry.api           ?? null);
    });
    if (tempHumChart) tempHumChart.update();
    if (gasFireChart) gasFireChart.update();
    console.log('Loaded historical data to charts');
}

// ================================================
// CHATBOT
// Disesuaikan dengan sensor & status Arduino
// ================================================

const chatbotKnowledge = {
    'spray sereh': { response: `<strong>Cara Membuat Spray Ekstrak Sereh:</strong><br><br><strong>Bahan:</strong><br>- 200g daun sereh segar (dicincang)<br>- 1 liter air<br>- 2 sdm sabun cuci piring alami<br><br><strong>Cara Pembuatan:</strong><br>- Rebus daun sereh 30 menit<br>- Dinginkan dan saring<br>- Tambahkan sabun piring<br>- Masukkan ke botol spray<br><br><strong>Penggunaan:</strong><br>- Semprot tiap 3-5 hari, pagi atau sore, fokus bawah daun.` },
    'neem': { response: `<strong>Manfaat Neem Oil:</strong><br><br>- Kendalikan 200+ jenis hama<br>- Cegah penyakit jamur<br>- Tidak beracun untuk manusia<br><br><strong>Cara:</strong> 2-3 sdm neem oil + 1 liter air + 1 sdt sabun, semprotkan tiap 7-14 hari.` },
    'cegah hama': { response: `<strong>Mencegah Hama di Gudang:</strong><br><br>1. Jaga kelembapan 40-60%<br>2. Kebersihan rutin tiap minggu<br>3. Spray sereh tiap 5 hari<br>4. Neem oil 2 minggu sekali<br>5. Tanam lavender/mint di sekitar gudang` },
    'waktu semprot': { response: `<strong>Waktu Terbaik:</strong><br><br>Pagi 06:00-09:00 atau Sore 16:00-18:00<br><br>HINDARI: Siang hari, saat hujan, angin kencang<br><br>Preventif: Sereh 5-7 hari, Neem 10-14 hari<br>Kuratif: Sereh 3 hari, Neem 5-7 hari` },
    'kombinasi': { response: `<strong>Power Spray Sereh + Neem:</strong><br><br>100g sereh rebusan + 2 sdm neem oil + 1 sdt sabun + 1 liter air<br><br>Jadwal: Minggu 1&3 kombinasi, Minggu 2 sereh murni, Minggu 4 neem murni` },

    // ---- INFO SENSOR & STATUS SESUAI ARDUINO ----
    'status normal': { response: `<strong>Status NORMAL:</strong><br>Semua kondisi gudang aman:<br>- Suhu ≤ ${THRESHOLD.SUHU_PANAS}°C<br>- Kelembapan ${THRESHOLD.KELEMBAPAN_KERING}–${THRESHOLD.KELEMBAPAN_LEMBAP}%<br>- Gas &lt; ${THRESHOLD.GAS_PPM_THRESHOLD} PPM<br>- Tidak ada api terdeteksi` },
    'kebakaran': { response: `<strong>Status KEBAKARAN:</strong><br>Kondisi DARURAT! Arduino mendeteksi:<br>- Fire sensor &gt; ${THRESHOLD.FIRE_THRESHOLD} (analog)<br>- Gas &gt; ${THRESHOLD.GAS_PPM_THRESHOLD} PPM<br>- Suhu &gt; ${THRESHOLD.SUHU_PANAS}°C<br><br><strong>Tindakan:</strong> Evakuasi segera, hubungi damkar!` },
    'terlalu panas': { response: `<strong>Status TERLALU_PANAS:</strong><br>Suhu gudang &gt; ${THRESHOLD.SUHU_PANAS}°C.<br><br>Tindakan:<br>- Buka ventilasi/jendela<br>- Nyalakan kipas/pendingin<br>- Kurangi sumber panas di sekitar gudang` },
    'gas berbahaya': { response: `<strong>Status GAS_BERBAHAYA:</strong><br>Sensor MQ135 mendeteksi gas &gt; ${THRESHOLD.GAS_PPM_THRESHOLD} PPM.<br><br>Tindakan:<br>- Buka jendela/ventilasi segera<br>- Jauhkan dari sumber api<br>- Cek sumber kebocoran gas` },
    'kering': { response: `<strong>Status KERING:</strong><br>Kelembapan &lt; ${THRESHOLD.KELEMBAPAN_KERING}%.<br><br>Tindakan:<br>- Aktifkan penyemprot air (spray)<br>- Siram tanaman<br>- Tambah humidifier jika tersedia` },
    'terlalu lembap': { response: `<strong>Status TERLALU_LEMBAP:</strong><br>Kelembapan &gt; ${THRESHOLD.KELEMBAPAN_LEMBAP}%.<br><br>Tindakan:<br>- Buka ventilasi, nyalakan dehumidifier<br>- Periksa tanda jamur pada tanaman<br>- Semprot neem oil untuk pencegahan hama` },
    'gas ppm': { response: `<strong>Sensor Gas MQ135:</strong><br><br>Arduino mengkonversi nilai analog ke PPM menggunakan rumus dari datasheet MQ135.<br><br>Ambang batas: <strong>${THRESHOLD.GAS_PPM_THRESHOLD} PPM</strong><br><br>Di bawah batas = udara aman.<br>Di atas batas = status GAS_BERBAHAYA aktif.` },
    'fire sensor': { response: `<strong>Sensor Api (Fire Sensor):</strong><br><br>Membaca nilai analog 0–4095.<br>Semakin KECIL nilai = cahaya/api makin terang.<br><br>Ambang batas: <strong>${THRESHOLD.FIRE_THRESHOLD}</strong><br><br>Nilai &gt; threshold = potensi api terdeteksi (dikombinasi dengan gas & suhu untuk status KEBAKARAN).` },
    'box penyimpanan': { response: `<strong>Status Box Penyimpanan (Ultrasonik):</strong><br><br>Sensor ultrasonik mengukur jarak ke isi gudang.<br><br>Jarak &lt; ${THRESHOLD.DISTANCE_FULL} cm = PENUH<br>Jarak = 999 = Sensor error<br><br>Jika penuh, segera kosongkan gudang penyimpanan!` }
};

let chatbotOpen = false;

function initChatbot() {
    const chatbotBtn   = document.getElementById('chatbotBtn');
    const chatbotModal = document.getElementById('chatbotModal');
    const chatbotClose = document.getElementById('chatbotClose');
    const chatInput    = document.getElementById('chatInput');
    const chatSendBtn  = document.getElementById('chatSendBtn');
    if (!chatbotBtn) return;
    chatbotBtn.addEventListener('click', () => { chatbotOpen = !chatbotOpen; chatbotModal.classList.toggle('active', chatbotOpen); });
    chatbotClose.addEventListener('click', () => { chatbotOpen = false; chatbotModal.classList.remove('active'); });
    chatSendBtn.addEventListener('click', () => { const m = chatInput.value.trim(); if (m) { sendMessage(m); chatInput.value = ''; } });
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { const m = chatInput.value.trim(); if (m) { sendMessage(m); chatInput.value = ''; } } });
    document.querySelectorAll('.suggestion-btn').forEach(btn => btn.addEventListener('click', () => sendMessage(btn.dataset.question)));
}

function sendMessage(message) {
    addChatMessage(message, 'user');
    setTimeout(() => addChatMessage(processMessage(message), 'bot'), 500);
}

function addChatMessage(message, sender) {
    const chatBody = document.getElementById('chatbotBody');
    const div = document.createElement('div');
    div.className = 'chat-message ' + sender;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    const content = document.createElement('div');
    content.className = 'message-content';
    if (sender === 'user') content.textContent = message;
    else content.innerHTML = message;
    div.appendChild(avatar); div.appendChild(content);
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function processMessage(message) {
    const m = message.toLowerCase();

    // Pertanyaan tentang sensor
    if (m.includes('sereh') || m.includes('serai'))                              return chatbotKnowledge['spray sereh'].response;
    if (m.includes('neem'))                                                       return chatbotKnowledge['neem'].response;
    if (m.includes('cegah') || m.includes('pencegah') || m.includes('hama'))     return chatbotKnowledge['cegah hama'].response;
    if (m.includes('waktu') || m.includes('kapan'))                              return chatbotKnowledge['waktu semprot'].response;
    if (m.includes('kombinasi') || m.includes('campur'))                         return chatbotKnowledge['kombinasi'].response;

    // Status Arduino
    if (m.includes('kebakaran'))                                                  return chatbotKnowledge['kebakaran'].response;
    if (m.includes('terlalu panas') || m.includes('terlalu_panas'))               return chatbotKnowledge['terlalu panas'].response;
    if (m.includes('gas berbahaya') || m.includes('gas_berbahaya'))               return chatbotKnowledge['gas berbahaya'].response;
    if (m.includes('kering') && !m.includes('lembap'))                           return chatbotKnowledge['kering'].response;
    if (m.includes('lembap') || m.includes('lembab'))                            return chatbotKnowledge['terlalu lembap'].response;
    if (m.includes('normal'))                                                     return chatbotKnowledge['status normal'].response;

    // Sensor spesifik
    if (m.includes('ppm') || (m.includes('gas') && !m.includes('berbahaya')))    return chatbotKnowledge['gas ppm'].response;
    if (m.includes('api') || m.includes('fire'))                                  return chatbotKnowledge['fire sensor'].response;
    if (m.includes('box') || m.includes('simpan') || m.includes('ultrasonik') || m.includes('jarak')) return chatbotKnowledge['box penyimpanan'].response;
    if (m.includes('pir') || m.includes('gerak') || m.includes('motion'))
        return `<strong>Sensor PIR:</strong><br>Mendeteksi gerakan di gudang.<br>- <strong>ADA</strong>: ada gerakan, cek gudang!<br>- <strong>AMAN</strong>: tidak ada gerakan.<br><br>Arduino mengirim <code>true/false</code>, di-convert ke 1/0 di dashboard.`;

    // Hama spesifik
    if (m.includes('kutu') || m.includes('aphid'))    return `<strong>Kutu Daun:</strong><br>Spray air sabun + sereh tiap 3 hari. Neem oil minggu berikutnya.`;
    if (m.includes('ulat'))                           return `<strong>Ulat:</strong><br>Ambil manual + neem oil tiap 5-7 hari + ekstrak cabai.`;
    if (m.includes('jamur'))                          return `<strong>Jamur:</strong><br>Neem oil 2x seminggu + baking soda (1 sdt/liter) + potong bagian terinfeksi.`;

    // Kondisi real-time
    if (m.includes('kondisi') || m.includes('sekarang') || m.includes('status')) {
        const d = getLatestData();
        if (!d) return 'Belum ada data dari sensor. Pastikan ESP32 terhubung ke MQTT.';
        return `<strong>Kondisi Terkini:</strong><br>` +
               `Suhu: ${d.suhu != null ? d.suhu.toFixed(1) + '°C' : '-'}<br>` +
               `Kelembapan: ${d.kelembapan != null ? d.kelembapan.toFixed(1) + '%' : '-'}<br>` +
               `Gas: ${d.gas_ppm != null ? d.gas_ppm.toFixed(1) + ' PPM' : '-'}<br>` +
               `Api: ${d.api != null ? Math.round(d.api) + ' (analog)' : '-'}<br>` +
               `PIR: ${d.pir === 1 ? 'ADA GERAKAN' : 'AMAN'}<br>` +
               `Status: <strong>${getStatusLabel(d.status)}</strong>`;
    }

    return `Halo! Saya bisa bantu:<br>
- Spray sereh &amp; neem oil<br>
- Mengatasi hama (kutu, ulat, jamur)<br>
- Waktu penyemprotan<br>
- Status sensor: <em>normal, kebakaran, terlalu panas, gas berbahaya, kering, terlalu lembap</em><br>
- Info sensor: PIR, gas PPM, fire sensor, box penyimpanan<br>
- Ketik <strong>"kondisi sekarang"</strong> untuk data real-time<br><br>
Coba: "cara buat spray sereh", "gas berbahaya", atau "kondisi sekarang"`;
}

// ================================================
// HISTORY TABLE
// Kolom gas sekarang menampilkan gas_ppm (PPM)
// ================================================

let currentPage = 1;
const rowsPerPage = 10;

function refreshHistoryTable() { renderHistoryTable(); }
function initHistoryTable()    { currentPage = 1; renderHistoryTable(); }

function renderHistoryTable() {
    const data  = getHistoryData();
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Belum ada data</td></tr>';
        updatePagination(0); return;
    }

    const totalPages = Math.ceil(data.length / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    tbody.innerHTML = '';

    data.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).forEach(entry => {
        const row     = document.createElement('tr');
        const timeStr = new Date(entry.timestamp).toLocaleString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
        const pirNorm = (entry.pir === true || entry.pir === 1) ? 1 : 0;
        const statusCode = entry.status ? entry.status.trim() : 'NORMAL';
        const statusLabel = getStatusLabel(statusCode);
        const statusLevel = STATUS_LEVEL[statusCode] || 'normal';

        // Gas: tampilkan gas_ppm jika ada, fallback ke gas (raw), fallback '-'
        const gasDisplay = entry.gas_ppm != null
            ? entry.gas_ppm.toFixed(1) + ' PPM'
            : (entry.gas != null ? Math.round(entry.gas) + ' raw' : '-');

        // Jarak: tampilkan '--' jika 999 (sensor error) atau 0
        const jarakDisplay = (entry.jarak != null && entry.jarak > 0 && entry.jarak < 999)
            ? entry.jarak.toFixed(1) + ' cm'
            : (entry.jarak === 999 ? 'Error' : '-');

        row.innerHTML =
            '<td>' + timeStr + '</td>' +
            '<td>' + (entry.suhu       != null ? entry.suhu.toFixed(1) + ' °C' : '-') + '</td>' +
            '<td>' + (entry.kelembapan != null ? entry.kelembapan.toFixed(1) + ' %' : '-') + '</td>' +
            '<td>' + gasDisplay + '</td>' +
            '<td>' + (entry.api        != null ? Math.round(entry.api) : '-') + '</td>' +
            '<td>' + jarakDisplay + '</td>' +
            '<td><span class="pir-table ' + (pirNorm === 1 ? 'pir-alert' : 'pir-safe') + '">' + (pirNorm === 1 ? 'ADA' : 'AMAN') + '</span></td>' +
            '<td><span class="status-badge status-' + statusLevel + '">' + statusLabel + '</span></td>';
        tbody.appendChild(row);
    });
    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    pagination.innerHTML =
        '<button onclick="changePage(' + (currentPage-1) + ')" ' + (currentPage===1?'disabled':'') + '><i class="fas fa-chevron-left"></i> Prev</button>' +
        '<span>Halaman ' + currentPage + ' dari ' + totalPages + '</span>' +
        '<button onclick="changePage(' + (currentPage+1) + ')" ' + (currentPage===totalPages?'disabled':'') + '>Next <i class="fas fa-chevron-right"></i></button>';
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

function initMainApp() { initRealtimeClock(); initHistoryTable(); setupEventListeners(); console.log('Main app initialized'); }

function initRealtimeClock() { updateClock(); setInterval(updateClock, 1000); }

function updateClock() {
    const el = document.getElementById('clockDisplay');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
}

function setupEventListeners() {
    const btnClear = document.getElementById('btnClearHistory');
    if (btnClear) btnClear.addEventListener('click', () => clearHistory());
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); const btn = document.getElementById('chatbotBtn'); if (btn) btn.click(); }
});

window.addEventListener('error', (e) => console.error('Global error:', e.error));
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled rejection:', e.reason));

window.debugInfo = function() {
    console.log('History:', getHistoryData());
    console.log('Latest:', getLatestData());
    console.log('Connected:', isConnected, '| Broker:', BROKER_CANDIDATES[brokerIndex]);
    console.log('Thresholds:', THRESHOLD);
};

// ================================================
// INITIALIZE ALL ON DOM READY
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromLocalStorage();

    // Chart HARUS diinit sebelum MQTT connect
    initCharts();
    loadHistoricalDataToCharts();

    initMQTT();
    initChatbot();
    initMainApp();

    console.log('SmartFarm App Ready (synced with Arduino firmware)');
});