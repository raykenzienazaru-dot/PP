// ============================================
//   SMART ECO FARM — script.js
//   Chatbot JS Lokal + MQTT Real Data ESP32
// ============================================

// ============================================
//   MOBILE NAVIGATION
// ============================================
const hamburgerBtn  = document.getElementById('hamburgerBtn');
const mobileMenu    = document.getElementById('mobileMenu');
const mobileOverlay = document.getElementById('mobileOverlay');
const mobileClose   = document.getElementById('mobileClose');
const mobileChatBtn = document.getElementById('mobileChatBtn');

function openMobileNav() {
  hamburgerBtn.classList.add('is-open');
  mobileMenu.classList.add('is-open');
  mobileOverlay.classList.add('is-open');
  document.body.classList.add('nav-open');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
  mobileMenu.setAttribute('aria-hidden', 'false');
}

function closeMobileNav() {
  hamburgerBtn.classList.remove('is-open');
  mobileMenu.classList.remove('is-open');
  mobileOverlay.classList.remove('is-open');
  document.body.classList.remove('nav-open');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
}

hamburgerBtn.addEventListener('click', () => {
  mobileMenu.classList.contains('is-open') ? closeMobileNav() : openMobileNav();
});

// Tutup saat klik overlay
mobileOverlay.addEventListener('click', closeMobileNav);

// Tutup saat klik close button
mobileClose.addEventListener('click', closeMobileNav);

// Tutup saat klik link navigasi (scroll ke section)
document.querySelectorAll('.mobile-nav-item').forEach(link => {
  link.addEventListener('click', () => {
    closeMobileNav();
  });
});

// Tombol chat di mobile menu
mobileChatBtn.addEventListener('click', () => {
  closeMobileNav();
  // Tunggu panel tutup dulu baru buka chat
  setTimeout(openChat, 380);
});

// Tutup dengan tombol Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
    closeMobileNav();
  }
});

// ============================================
//   CHATBOT TOGGLE
// ============================================
const chatBubble   = document.getElementById('chatBubble');
const chatWindow   = document.getElementById('chatWindow');
const closeChat    = document.getElementById('closeChat');
const openChatBtn  = document.getElementById('openChatBtn');
const openChatBtn2 = document.getElementById('openChatBtn2');

function openChat() {
  chatWindow.classList.add('open');
  chatBubble.classList.add('hidden');
  document.getElementById('chatInput').focus();
}

function closeChatFn() {
  chatWindow.classList.remove('open');
  chatBubble.classList.remove('hidden');
}

chatBubble.addEventListener('click', openChat);
openChatBtn.addEventListener('click', openChat);
openChatBtn2.addEventListener('click', openChat);
closeChat.addEventListener('click', closeChatFn);

// ============================================
//   CHAT LOGIC
// ============================================
const messagesEl = document.getElementById('chatMessages');
const inputEl    = document.getElementById('chatInput');
const sendBtn    = document.getElementById('sendBtn');

function addMessage(text, sender = 'bot') {
  const msg = document.createElement('div');
  msg.classList.add('msg', sender);
  const bubble = document.createElement('div');
  bubble.classList.add('msg-bubble');
  bubble.innerHTML = text;
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
  const typing = document.createElement('div');
  typing.classList.add('msg', 'bot');
  typing.id = 'typingIndicator';
  typing.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

// ============================================
//   DATABASE JAWABAN CHATBOT (JS LOKAL)
// ============================================
const chatDB = [
  {
    keywords: ['tikus', 'mouse', 'rat', 'rodent'],
    answer: `🐀 <strong>Mengatasi Tikus di Gudang secara Alami:</strong><br><br>
 <ul>
          <li>Tutup semua celah masuk gudang</li>
          <li>Simpan hasil panen dalam wadah tertutup rapat dalam gudang</li>
          <li>Pasang perangkap ultrasonik di sudut gudang (opsional)</li>
          <li>Tanam tanaman pengusir (minimal, lavender) di sekitar gudang</li>
        </ul>
⚠️ Hindari racun tikus karena berbahaya untuk hewan lain dan meninggalkan bau.`
  },
  {
    keywords: ['kumbang', 'serangga', 'beetle', 'insect', 'kutu', 'thrips', 'semut', 'lalat', 'nyamuk'],
    answer: `🪲 <strong>Mengatasi Kumbang & Serangga di Gudang:</strong><br><br>
 <ul>
          <li>Jaga kelembapan gudang 40–65% (tidak terlalu lembap)</li>
          <li>Gunakan lampu UV perangkap serangga malam hari (jika ingin menggunakan)</li>
          <li>Semprot serai secara rutin tiap 5 jam (mengikuti sistem otomatis)</li>
          <li>Bersihkan sisa-sisa biji/produk yang berserakan</li>
        </ul>
💡 Kombinasi serai + neem oil sangat efektif untuk kebanyakan serangga gudang.`
  },
  {
    keywords: ['jamur', 'kapang', 'mold', 'fungus', 'berjamur'],
    answer: `🍄 <strong>Mencegah & Mengatasi Jamur di Gudang:</strong><br><br>
 <ul>
          <li>Pastikan ventilasi udara cukup lancar</li>
          <li>Kelembapan dijaga di bawah 60%</li>
          <li>Gunakan silica gel (untuk gudang kecil) atau dehumidifier</li>
          <li>Periksa kondisi rutin tiap minggu</li>
        </ul>
⚠️ Jika kelembapan &gt;80%, segera aktifkan kipas atau buka ventilasi!`
  },
  {
    keywords: ['ulat', 'larva', 'worm', 'caterpillar', 'belatung'],
    answer: `🐛 <strong>Mengatasi Ulat & Larva di Gudang:</strong><br><br>
 <ul>
          <li>Gunakan jaring halus pada ventilasi</li>
          <li>Semprot neem oil (minyak mimba) tiap 3 hari</li>
          <li>Periksa kemasan produk secara berkala</li>
          <li>Hindari menumpuk produk terlalu padat</li>
        </ul>
💡 Ulat biasanya masuk lewat ventilasi atau produk yang sudah terinfeksi.`
  },
  {
    keywords: ['serai', 'sereh', 'lemongrass', 'semprot', 'spray', 'ekstrak', 'membuat', 'buat'],
    answer: `🌿 <strong>Cara Membuat Semprot Ekstrak Serai:</strong><br><br>
<strong>Bahan:</strong>
<ul>
  <li>200g batang serai segar</li>
  <li>1 liter air bersih</li>
  <li>5ml sabun cuci cair (sebagai emulsifier alami)</li>
</ul>

<strong>Langkah:</strong>
<ul>
  <li>Rebus batang serai selama <strong>15 menit</strong> hingga air berubah <strong>kuning kehijauan</strong>.</li>
  <li>Dinginkan hingga suhu ruangan lalu <strong>saring menggunakan kain kasa</strong> untuk memisahkan ampas.</li>
  <li>Campurkan <strong>500ml ekstrak serai</strong> dengan <strong>500ml air bersih</strong>.</li>
  <li>Tambahkan <strong>5ml sabun cair</strong> lalu aduk hingga merata.</li>
  <li>Masukkan larutan ke dalam <strong>botol semprot</strong>.</li>
  <li>Semprotkan pada sudut gudang atau ventilasi dengan jarak <strong>20–30 cm</strong>.</li>
</ul>

<strong>Jadwal:</strong>
<ul>
  <li>Penyemprotan setiap <strong>5 jam</strong> pada kondisi normal.</li>
  <li>Jika kelembapan <strong>>80%</strong>, percepat menjadi setiap <strong>3 jam</strong>.</li>
</ul>

<strong>Penyimpanan:</strong>
<ul>
  <li>Simpan di tempat <strong>sejuk dan gelap</strong>.</li>
  <li>Larutan bertahan maksimal <strong>3 hari</strong>.</li>
  <li>Buat ulang jika larutan <strong>berbau asam atau berubah warna</strong>.</li>
</ul>.`
  },

  {
    keywords: ['suhu', 'panas', 'temperature', 'terlalu panas', 'suhu tinggi'],
    answer: `🌡️ <strong>Mengatasi Suhu Gudang Terlalu Tinggi (&gt;32°C):</strong><br><br>
<ul>
  <li>Aktifkan <strong>kipas angin atau exhaust fan</strong> untuk sirkulasi udara</li>
  <li>Buka ventilasi di pagi/malam hari saat udara lebih dingin</li>
  <li>Pasang <strong>insulasi atap aluminium foil</strong> untuk kurangi panas</li>
  <li>Pindahkan produk rentan panas ke area yang lebih sejuk</li>
</ul>
⚠️ Suhu &gt;32°C mempercepat pertumbuhan jamur dan kerusakan hasil panen!`
  },
  {
    keywords: ['kelembapan', 'humid', 'lembap', 'basah', 'kelembaban'],
    answer: `💧 <strong>Mengatasi Kelembapan Gudang Tinggi (&gt;80%):</strong><br><br>
<ul>
  <li>Gunakan <strong>dehumidifier</strong> atau letakkan silica gel di sudut gudang</li>
  <li>Aktifkan kipas/exhaust fan untuk sirkulasi udara</li>
  <li>Periksa kebocoran atap atau dinding</li>
  <li>Percepat jadwal semprot serai ke <strong>setiap 3 jam</strong></li>
  <li>Hindari menyimpan produk basah bersama produk kering</li>
</ul>
💡 Sensor IoT akan otomatis mempersingkat interval spray reminder saat kelembapan &gt;80%.`
  },
  {
    keywords: ['gas', 'udara', 'ppm', 'mq135', 'berbahaya', 'kualitas udara', 'ventilasi'],
    answer: `💨 <strong>Mengatasi Kualitas Udara Buruk (PPM Tinggi):</strong><br><br>
<ul>
  <li>Segera <strong>buka semua jendela dan ventilasi</strong> untuk sirkulasi udara</li>
  <li>Hidupkan exhaust fan minimal 30 menit</li>
  <li>Periksa apakah ada produk membusuk atau fermentasi</li>
  <li>Jangan nyalakan api jika PPM sangat tinggi (&gt;500)</li>
  <li>Gunakan masker saat memasuki gudang dengan gas tinggi</li>
</ul>
⚠️ Ambang batas aman: <strong>&lt;400 PPM</strong>. Di atas itu segera ventilasi!`
  },
  {
    keywords: ['sensor', 'iot', 'esp32', 'dht22', 'pir', 'ultrasonik', 'mqtt', 'monitoring'],
    answer: `📊 <strong>Sensor yang Digunakan di SmartEcoFarm:</strong><br><br>
<ul>
  <li>🌡️ <strong>DHT22</strong> — Suhu & Kelembapan (update setiap 2 detik)</li>
  <li>💨 <strong>MQ135</strong> — Kualitas udara dalam PPM</li>
  <li>🔥 <strong>Sensor Api</strong> — Deteksi infrared nyala api</li>
  <li>👁️ <strong>PIR HC-SR501</strong> — Deteksi gerak/kehadiran orang</li>
  <li>📦 <strong>Ultrasonik </strong> — Kapasitas box penyimpanan</li>
</ul>
Semua data dikirim via <strong>MQTT</strong> ke broker EMQX setiap 2 detik dan tampil real-time di dashboard.`
  },
  {
    keywords: ['beras', 'padi', 'rice', 'gabah', 'gudang beras'],
    answer: `🌾 <strong>Hama Utama Gudang Beras & Cara Mengatasinya:</strong><br><br>
<ul>
  <li>🪲 <strong>Kumbang beras</strong> — Simpan dalam wadah kedap udara, semprot neem oil</li>
  <li>🐛 <strong>Ulat beras</strong> — Jaga suhu &lt;28°C, gunakan silica gel</li>
  <li>🐀 <strong>Tikus</strong> — Pasang perangkap, tutup celah, gunakan mint</li>
  <li>🍄 <strong>Aflatoksin (jamur)</strong> — Jaga kelembapan &lt;65%</li>
</ul>
💡 Campur daun <strong>salam kering atau biji merica</strong> di antara karung beras untuk mengusir kumbang secara alami.`
  },
  {
    keywords: ['kapan', 'jadwal', 'berapa jam', 'reminder', 'pengingat', 'waktunya'],
    answer: `⏰ <strong>Jadwal Penyemprotan Serai Otomatis:</strong><br><br>
<ul>
  <li>✅ <strong>Kondisi Normal</strong> (kelembapan &lt;80%): semprot setiap <strong>5 jam</strong></li>
  <li>⚠️ <strong>Kelembapan Tinggi</strong> (&gt;80%): semprot setiap <strong>3 jam</strong></li>
</ul>
Sistem IoT otomatis menyesuaikan interval berdasarkan data sensor real-time.<br>
Lihat countdown spray di <strong>Hero Dashboard</strong> halaman ini — diperbarui langsung dari ESP32!`
  },
  {
    // Default — harus selalu di paling bawah
    keywords: [],
    answer: `🤔 Maaf, saya belum punya jawaban untuk pertanyaan itu.<br><br>
Saya bisa membantu tentang:<br>
<ul>
  <li>🐀 Mengusir hama (tikus, kumbang, ulat, jamur)</li>
  <li>🌿 Membuat semprot ekstrak serai / neem oil</li>
  <li>📊 Interpretasi data sensor IoT</li>
  <li>💧 Mengatasi kelembapan atau suhu tinggi</li>
</ul>
Coba tanyakan salah satu topik di atas ya!`
  }
];

// ===== ENGINE PENCARIAN JAWABAN =====
function getLocalResponse(userInput) {
  const input = userInput.toLowerCase().replace(/[?!.,]/g, '').trim();
  for (const entry of chatDB) {
    if (entry.keywords.length === 0) continue;
    if (entry.keywords.some(kw => input.includes(kw))) return entry.answer;
  }
  return chatDB[chatDB.length - 1].answer;
}

// ===== HANDLE SEND =====
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;
  inputEl.disabled = true;
  showTyping();

  // Delay alami supaya terasa seperti "thinking"
  await new Promise(res => setTimeout(res, 800 + Math.random() * 700));

  removeTyping();
  addMessage(getLocalResponse(text), 'bot');
  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
}

sendBtn.addEventListener('click', handleSend);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

document.querySelectorAll('.suggest-btn').forEach(btn => {
  btn.addEventListener('click', () => { inputEl.value = btn.dataset.q; handleSend(); });
});

// ============================================
//   MQTT REAL-TIME DATA DARI ESP32
// ============================================

const MQTT_CONFIG = {
  host:     'we141ff2.ala.asia-southeast1.emqxsl.com',
  port:     8084,
  path:     '/mqtt',
  username: 'PP123',
  password: '13579',
  clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8),
  topic:    'smartfarm/monitoring'
};

let mqttClient = null, isConnected = false, lastDataTime = null;

function createConnectionIndicator() {
  const el = document.createElement('div');
  el.id = 'mqttStatus';
  el.style.cssText = `
    position:fixed;top:72px;right:1.5rem;z-index:199;
    display:flex;align-items:center;gap:0.5rem;
    background:rgba(13,31,22,0.92);border:1px solid rgba(82,183,136,0.2);
    border-radius:50px;padding:0.35rem 0.9rem;font-size:0.75rem;
    font-family:'DM Sans',sans-serif;backdrop-filter:blur(10px);transition:all 0.3s;
  `;
  el.innerHTML = `
    <span id="mqttDot" style="width:8px;height:8px;border-radius:50%;background:#e0a052;display:inline-block;"></span>
    <span id="mqttLabel" style="color:#c8ddc4;">Menghubungkan MQTT...</span>
  `;
  document.body.appendChild(el);
}

function setMqttStatus(status) {
  const dot = document.getElementById('mqttDot');
  const lbl = document.getElementById('mqttLabel');
  if (!dot || !lbl) return;
  const map = {
    connecting: ['#e0a052', 'blink 1s step-end infinite', 'Menghubungkan...',   '#e0a052'],
    connected:  ['#52b788', '',                            '● Live dari ESP32',  '#95d5b2'],
    live:       ['#52b788', 'blink 2s step-end infinite',  '● Data Masuk',       '#95d5b2'],
    error:      ['#e05252', '',                            '✕ Koneksi Gagal',   '#e08282'],
    offline:    ['#e05252', '',                            '⚠ ESP32 Offline',   '#e08282'],
  };
  const [bg, anim, text, color] = map[status] || map.offline;
  dot.style.background = bg;
  dot.style.animation  = anim;
  lbl.textContent      = text;
  lbl.style.color      = color;
  if (status === 'live') setTimeout(() => setMqttStatus('connected'), 1500);
}

function loadMqttLib() {
  return new Promise((res, rej) => {
    if (window.mqtt) { res(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mqtt/4.3.7/mqtt.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initMQTT() {
  createConnectionIndicator();
  setMqttStatus('connecting');
  try { await loadMqttLib(); } catch { setMqttStatus('error'); fallbackSimulation(); return; }

  const url = `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`;
  try {
    mqttClient = mqtt.connect(url, {
      clientId: MQTT_CONFIG.clientId, username: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password, clean: true,
      reconnectPeriod: 5000, connectTimeout: 10000, rejectUnauthorized: false
    });
  } catch { setMqttStatus('error'); fallbackSimulation(); return; }

  mqttClient.on('connect', () => {
    isConnected = true;
    setMqttStatus('connected');
    mqttClient.subscribe(MQTT_CONFIG.topic, { qos: 0 });
  });
  mqttClient.on('message', (topic, msg) => {
    if (topic !== MQTT_CONFIG.topic) return;
    try {
      const data = JSON.parse(msg.toString());
      lastDataTime = Date.now();
      setMqttStatus('live');
      updateUIFromESP32(data);
    } catch (e) { console.error('Parse error:', e); }
  });
  mqttClient.on('error',     () => setMqttStatus('error'));
  mqttClient.on('offline',   () => { isConnected = false; setMqttStatus('offline'); });
  mqttClient.on('reconnect', () => setMqttStatus('connecting'));

  setTimeout(() => {
    if (!lastDataTime) { setMqttStatus('offline'); fallbackSimulation(); }
  }, 15000);
}

function updateUIFromESP32(data) {
  const suhu  = data.suhu       ?? '--';
  const humid = data.kelembapan ?? '--';
  const gas   = data.gas_ppm    ?? '--';
  const fire  = data.api        ?? '--';
  const jarak = data.jarak;
  const pir   = data.pir        ?? false;
  const status = data.status    ?? 'UNKNOWN';

  document.getElementById('liveTemp').textContent   = suhu  !== '--' ? suhu.toFixed(1)  + '°C'   : '--';
  document.getElementById('liveHumid').textContent  = humid !== '--' ? humid.toFixed(1) + '%'    : '--';
  document.getElementById('liveGas').textContent    = gas   !== '--' ? gas.toFixed(1)   + ' PPM' : '--';
  document.getElementById('livePir').textContent    = pir ? 'ADA ORANG' : 'Kosong';
  document.getElementById('liveStatus').textContent = '● ' + status;
  document.getElementById('liveSpray').textContent  = data.spray ?? '-';

  document.getElementById('liveStatus').style.color =
    status === 'NORMAL' ? 'var(--green-light)' : status === 'KEBAKARAN' ? 'var(--danger)' : 'var(--warn)';
  document.getElementById('livePir').style.color = pir ? 'var(--warn)' : 'var(--text-dim)';

  updateSensorCard('sc-temp',  's-temp',  suhu  !== '--' ? suhu.toFixed(1)  + '°C'   : '--', suhu > 32 ? 'Terlalu Panas' : 'Normal',           suhu > 32 ? 'warn' : 'ok');
  updateSensorCard('sc-humid', 's-humid', humid !== '--' ? humid.toFixed(1) + '%'    : '--', humid > 80 ? 'Terlalu Lembap' : humid < 40 ? 'Terlalu Kering' : 'Normal', humid > 80 || humid < 40 ? 'warn' : 'ok');
  updateSensorCard('sc-gas',   's-gas',   gas   !== '--' ? gas.toFixed(1)   + ' PPM' : '--', gas > 400 ? 'Berbahaya!' : gas > 350 ? 'Waspada' : 'Baik',               gas > 400 ? 'danger' : gas > 350 ? 'warn' : 'ok');
  updateSensorCard('sc-fire',  's-fire',  fire  !== '--' ? parseInt(fire).toString() : '--', fire > 3000 ? 'BAHAYA API!' : fire > 2000 ? 'Waspada' : 'Aman',          fire > 3000 ? 'danger' : fire > 2000 ? 'warn' : 'ok');
  updateSensorCard('sc-pir',   's-pir',   pir ? 'ADA ORANG' : 'Kosong', pir ? 'Terdeteksi' : 'Aman', pir ? 'warn' : 'ok');

  const jErr = !jarak || jarak === 999;
  updateSensorCard('sc-box', 's-box',
    jErr ? 'Error' : jarak.toFixed(1) + ' cm',
    jErr ? 'Sensor Error' : jarak < 5 ? 'PENUH!' : 'Normal',
    jErr ? 'warn' : jarak < 5 ? 'danger' : 'ok');
}

function updateSensorCard(cardId, valueId, value, statusText, statusClass) {
  const card = document.getElementById(cardId);
  document.getElementById(valueId).textContent = value;
  card.querySelector('.sensor-status').textContent = statusText;
  card.querySelector('.sensor-status').className   = 'sensor-status ' + statusClass;
  statusClass === 'danger' ? card.classList.add('alert-state') : card.classList.remove('alert-state');
}

// ===== FALLBACK SIMULASI =====
let sprayCountdown = 284;

function fallbackSimulation() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);
    background:rgba(224,160,82,0.15);border:1px solid rgba(224,160,82,0.4);
    color:#e0c082;padding:0.5rem 1.2rem;border-radius:50px;
    font-size:0.78rem;font-family:'DM Sans',sans-serif;z-index:299;backdrop-filter:blur(8px);
  `;
  banner.textContent = '⚠️ ESP32 tidak terhubung — menampilkan data simulasi';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);

  function runSim() {
    const suhu  = parseFloat((Math.random() * 8 + 26).toFixed(1));
    const humid = parseFloat((Math.random() * 33 + 55).toFixed(1));
    const gas   = parseFloat((Math.random() * 170 + 280).toFixed(1));
    const fire  = parseInt(Math.random() * 2400 + 800);
    const jarak = parseFloat((Math.random() * 52 + 8).toFixed(1));
    const pir   = Math.random() > 0.85;
    sprayCountdown = Math.max(0, sprayCountdown - 1);
    if (!sprayCountdown) sprayCountdown = humid > 80 ? 180 : 300;
    let s = 'NORMAL';
    if (fire > 3000 && gas > 400 && suhu > 32) s = 'KEBAKARAN';
    else if (suhu > 32)  s = 'TERLALU_PANAS';
    else if (gas > 400)  s = 'GAS_BERBAHAYA';
    else if (humid < 40) s = 'KERING';
    else if (humid > 80) s = 'TERLALU_LEMBAP';
    updateUIFromESP32({ suhu, kelembapan: humid, gas_ppm: gas, api: fire, jarak, pir,
      status: s, spray: 'Spray berikutnya dalam ' + sprayCountdown + ' menit' });
  }
  runSim();
  setInterval(runSim, 3000);
}

// ===== NAV SCROLL =====
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
});

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.animation = `fadeUp 0.6s ease ${e.target.dataset.delay || 0}ms both`;
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.feature-card, .hama-card, .step, .sensor-card, .info-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  observer.observe(el);
});

// ===== MULAI =====
initMQTT();