// ============================================
//   SMART ECO FARM — script.js
//   Chatbot + MQTT Real Data dari ESP32
// ============================================

// ===== CHATBOT TOGGLE =====
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

function closeChat2() {
  chatWindow.classList.remove('open');
  chatBubble.classList.remove('hidden');
}

chatBubble.addEventListener('click', openChat);
openChatBtn.addEventListener('click', openChat);
openChatBtn2.addEventListener('click', openChat);
closeChat.addEventListener('click', closeChat2);

// ===== CHAT LOGIC =====
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
  typing.innerHTML = `
    <div class="typing-indicator">
      <span></span><span></span><span></span>
    </div>`;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

// ===== AI RESPONSE via Anthropic API =====
async function getAIResponse(userMessage) {
  const systemPrompt = `Kamu adalah EcoBot, asisten pertanian cerdas yang HANYA merespons dalam Bahasa Indonesia.
Kamu ahli dalam:
1. Pengendalian hama gudang pertanian secara organik dan alami (tikus, kumbang, ulat, jamur, serangga)
2. Cara membuat dan menggunakan semprot ekstrak sereh/serai (Cymbopogon citratus) untuk gudang
3. Penggunaan neem oil (minyak mimba) sebagai pestisida organik
4. Interpretasi data sensor IoT pertanian (suhu, kelembapan, gas PPM, PIR, ultrasonik)
5. Tips menjaga kualitas udara dan kondisi penyimpanan hasil pertanian

Format jawaban: Gunakan HTML sederhana. Gunakan <strong> untuk penekanan, <br> untuk baris baru, dan <ul><li> untuk daftar.
Jawablah secara ramah, informatif, dan praktis. Maksimal 3-4 paragraf atau poin.
JANGAN membahas topik di luar pertanian, hama, dan sensor IoT pertanian.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) throw new Error("API error: " + response.status);
  const data = await response.json();
  return data.content[0].text;
}

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;
  inputEl.disabled = true;

  showTyping();

  try {
    const reply = await getAIResponse(text);
    removeTyping();
    addMessage(reply, 'bot');
  } catch (err) {
    removeTyping();
    addMessage(
      '⚠️ Maaf, koneksi ke AI sedang bermasalah. Pastikan API key sudah dikonfigurasi dengan benar.',
      'bot'
    );
    console.error('EcoBot error:', err);
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

sendBtn.addEventListener('click', handleSend);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// ===== SUGGESTION BUTTONS =====
document.querySelectorAll('.suggest-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    inputEl.value = btn.dataset.q;
    handleSend();
  });
});

// ============================================
//   MQTT REAL-TIME DATA DARI ESP32
// ============================================

// Konfigurasi MQTT (sama dengan ESP32)
const MQTT_CONFIG = {
  host:     'we141ff2.ala.asia-southeast1.emqxsl.com',
  port:     8084,           // WebSocket Secure (WSS) — port standar EMQX
  path:     '/mqtt',
  username: 'PP123',
  password: '13579',
  clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8),
  topic:    'smartfarm/monitoring'
};

// Status indikator koneksi di navbar / header sensor
let mqttClient = null;
let isConnected = false;
let lastDataTime = null;

// Buat elemen indikator koneksi
function createConnectionIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'mqttStatus';
  indicator.style.cssText = `
    position: fixed;
    top: 72px;
    right: 1.5rem;
    z-index: 199;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(13,31,22,0.92);
    border: 1px solid rgba(82,183,136,0.2);
    border-radius: 50px;
    padding: 0.35rem 0.9rem;
    font-size: 0.75rem;
    font-family: 'DM Sans', sans-serif;
    backdrop-filter: blur(10px);
    transition: all 0.3s;
  `;
  indicator.innerHTML = `
    <span id="mqttDot" style="width:8px;height:8px;border-radius:50%;background:#e0a052;display:inline-block;"></span>
    <span id="mqttLabel" style="color:#c8ddc4;">Menghubungkan MQTT...</span>
  `;
  document.body.appendChild(indicator);
}

function setMqttStatus(status) {
  const dot   = document.getElementById('mqttDot');
  const label = document.getElementById('mqttLabel');
  if (!dot || !label) return;

  if (status === 'connecting') {
    dot.style.background = '#e0a052';
    dot.style.animation  = 'blink 1s step-end infinite';
    label.textContent    = 'Menghubungkan...';
    label.style.color    = '#e0a052';
  } else if (status === 'connected') {
    dot.style.background = '#52b788';
    dot.style.animation  = '';
    label.textContent    = '● Live dari ESP32';
    label.style.color    = '#95d5b2';
  } else if (status === 'live') {
    dot.style.background = '#52b788';
    dot.style.animation  = 'blink 2s step-end infinite';
    label.textContent    = '● Data Masuk';
    label.style.color    = '#95d5b2';
    setTimeout(() => setMqttStatus('connected'), 1500);
  } else if (status === 'error') {
    dot.style.background = '#e05252';
    dot.style.animation  = '';
    label.textContent    = '✕ Koneksi Gagal';
    label.style.color    = '#e08282';
  } else if (status === 'offline') {
    dot.style.background = '#e05252';
    dot.style.animation  = '';
    label.textContent    = '⚠ ESP32 Offline';
    label.style.color    = '#e08282';
  }
}

// ===== INISIALISASI MQTT.JS VIA CDN =====
function loadMqttLib() {
  return new Promise((resolve, reject) => {
    if (window.mqtt) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mqtt/4.3.7/mqtt.min.js';
    script.onload  = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initMQTT() {
  createConnectionIndicator();
  setMqttStatus('connecting');

  try {
    await loadMqttLib();
  } catch (e) {
    console.error('Gagal memuat MQTT library:', e);
    setMqttStatus('error');
    fallbackSimulation();
    return;
  }

  const url = `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`;

  const options = {
    clientId:  MQTT_CONFIG.clientId,
    username:  MQTT_CONFIG.username,
    password:  MQTT_CONFIG.password,
    clean:     true,
    reconnectPeriod: 5000,
    connectTimeout:  10000,
    rejectUnauthorized: false   // karena pakai setInsecure di ESP32
  };

  try {
    mqttClient = mqtt.connect(url, options);
  } catch (e) {
    console.error('Gagal connect MQTT:', e);
    setMqttStatus('error');
    fallbackSimulation();
    return;
  }

  mqttClient.on('connect', () => {
    console.log('✅ MQTT terhubung ke broker');
    isConnected = true;
    setMqttStatus('connected');

    mqttClient.subscribe(MQTT_CONFIG.topic, { qos: 0 }, (err) => {
      if (err) {
        console.error('Gagal subscribe:', err);
      } else {
        console.log('✅ Subscribe ke:', MQTT_CONFIG.topic);
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    if (topic !== MQTT_CONFIG.topic) return;

    try {
      const data = JSON.parse(message.toString());
      lastDataTime = Date.now();
      setMqttStatus('live');
      updateUIFromESP32(data);
    } catch (e) {
      console.error('Gagal parse JSON dari ESP32:', e, message.toString());
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err);
    setMqttStatus('error');
  });

  mqttClient.on('offline', () => {
    console.warn('MQTT offline');
    isConnected = false;
    setMqttStatus('offline');
  });

  mqttClient.on('reconnect', () => {
    console.log('MQTT mencoba reconnect...');
    setMqttStatus('connecting');
  });

  // Cek timeout — jika 15 detik belum ada data, pakai simulasi
  setTimeout(() => {
    if (!lastDataTime) {
      console.warn('Tidak ada data dari ESP32 dalam 15 detik, pakai simulasi...');
      setMqttStatus('offline');
      fallbackSimulation();
    }
  }, 15000);
}

// ===== UPDATE UI DARI DATA ESP32 =====
function updateUIFromESP32(data) {
  /*
    Format JSON dari ESP32:
    {
      "suhu": 28.4,
      "kelembapan": 67.2,
      "gas_ppm": 312.0,
      "api": 1240,
      "jarak": 42.3,        // atau null jika sensor error
      "pir": false,
      "status": "NORMAL",
      "keterangan": "Kondisi stabil",
      "spray": "Spray berikutnya dalam 284 menit"
    }
  */

  const suhu      = data.suhu       ?? '--';
  const humid     = data.kelembapan ?? '--';
  const gas       = data.gas_ppm    ?? '--';
  const fire      = data.api        ?? '--';
  const jarak     = data.jarak;
  const pir       = data.pir        ?? false;
  const status    = data.status     ?? 'UNKNOWN';
  const spray     = data.spray      ?? '-';

  // === HERO DEVICE CARD ===
  document.getElementById('liveTemp').textContent   = suhu !== '--' ? suhu.toFixed(1) + '°C' : '--';
  document.getElementById('liveHumid').textContent  = humid !== '--' ? humid.toFixed(1) + '%' : '--';
  document.getElementById('liveGas').textContent    = gas !== '--' ? gas.toFixed(1) + ' PPM' : '--';
  document.getElementById('livePir').textContent    = pir ? 'ADA ORANG' : 'Kosong';
  document.getElementById('liveStatus').textContent = '● ' + status;
  document.getElementById('liveSpray').textContent  = spray;

  const statusEl = document.getElementById('liveStatus');
  statusEl.style.color =
    status === 'NORMAL'      ? 'var(--green-light)' :
    status === 'KEBAKARAN'   ? 'var(--danger)' :
                               'var(--warn)';

  const pirEl = document.getElementById('livePir');
  pirEl.style.color = pir ? 'var(--warn)' : 'var(--text-dim)';

  // === SENSOR DASHBOARD ===
  // Suhu
  updateSensorCard('sc-temp', 's-temp',
    suhu !== '--' ? suhu.toFixed(1) + '°C' : '--',
    suhu > 32 ? 'Terlalu Panas' : 'Normal',
    suhu > 32 ? 'warn' : 'ok'
  );

  // Kelembapan
  updateSensorCard('sc-humid', 's-humid',
    humid !== '--' ? humid.toFixed(1) + '%' : '--',
    humid > 80 ? 'Terlalu Lembap' : humid < 40 ? 'Terlalu Kering' : 'Normal',
    humid > 80 || humid < 40 ? 'warn' : 'ok'
  );

  // Gas
  updateSensorCard('sc-gas', 's-gas',
    gas !== '--' ? gas.toFixed(1) + ' PPM' : '--',
    gas > 400 ? 'Berbahaya!' : gas > 350 ? 'Waspada' : 'Baik',
    gas > 400 ? 'danger' : gas > 350 ? 'warn' : 'ok'
  );

  // Api / Fire
  updateSensorCard('sc-fire', 's-fire',
    fire !== '--' ? parseInt(fire).toString() : '--',
    fire > 3000 ? 'BAHAYA API!' : fire > 2000 ? 'Waspada' : 'Aman',
    fire > 3000 ? 'danger' : fire > 2000 ? 'warn' : 'ok'
  );

  // PIR
  updateSensorCard('sc-pir', 's-pir',
    pir ? 'ADA ORANG' : 'Kosong',
    pir ? 'Terdeteksi' : 'Aman',
    pir ? 'warn' : 'ok'
  );

  // Ultrasonik / Box
  const jarakDisplay = (jarak === null || jarak === undefined || jarak === 999)
    ? 'Error' : jarak.toFixed(1) + ' cm';
  const jarakStatus  = (jarak === null || jarak === 999) ? 'Sensor Error' :
                       jarak < 5 ? 'PENUH!' : 'Normal';
  const jarakClass   = (jarak === null || jarak === 999) ? 'warn' :
                       jarak < 5 ? 'danger' : 'ok';

  updateSensorCard('sc-box', 's-box', jarakDisplay, jarakStatus, jarakClass);
}

function updateSensorCard(cardId, valueId, value, statusText, statusClass) {
  const card   = document.getElementById(cardId);
  const valEl  = document.getElementById(valueId);
  const statEl = card.querySelector('.sensor-status');

  valEl.textContent  = value;
  statEl.textContent = statusText;
  statEl.className   = 'sensor-status ' + statusClass;

  if (statusClass === 'danger') {
    card.classList.add('alert-state');
  } else {
    card.classList.remove('alert-state');
  }
}

// ===== FALLBACK SIMULASI (jika ESP32 offline) =====
let sprayCountdown = 284;

function fallbackSimulation() {
  // Tampilkan banner simulasi
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; bottom: 5.5rem; left: 50%; transform: translateX(-50%);
    background: rgba(224,160,82,0.15); border: 1px solid rgba(224,160,82,0.4);
    color: #e0c082; padding: 0.5rem 1.2rem; border-radius: 50px;
    font-size: 0.78rem; font-family: 'DM Sans', sans-serif;
    z-index: 299; backdrop-filter: blur(8px);
  `;
  banner.textContent = '⚠️ ESP32 tidak terhubung — menampilkan data simulasi';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);

  function runSimulation() {
    const suhu  = parseFloat((Math.random() * (34 - 26) + 26).toFixed(1));
    const humid = parseFloat((Math.random() * (88 - 55) + 55).toFixed(1));
    const gas   = parseFloat((Math.random() * (450 - 280) + 280).toFixed(1));
    const fire  = parseInt(Math.random() * (3200 - 800) + 800);
    const jarak = parseFloat((Math.random() * (60 - 8) + 8).toFixed(1));
    const pir   = Math.random() > 0.85;

    sprayCountdown = Math.max(0, sprayCountdown - 1);
    if (sprayCountdown === 0) sprayCountdown = humid > 80 ? 180 : 300;

    let statusCode = 'NORMAL';
    if (fire > 3000 && gas > 400 && suhu > 32) statusCode = 'KEBAKARAN';
    else if (suhu > 32) statusCode = 'TERLALU_PANAS';
    else if (gas > 400)  statusCode = 'GAS_BERBAHAYA';
    else if (humid < 40) statusCode = 'KERING';
    else if (humid > 80) statusCode = 'TERLALU_LEMBAP';

    updateUIFromESP32({
      suhu, kelembapan: humid, gas_ppm: gas,
      api: fire, jarak, pir,
      status: statusCode,
      keterangan: 'Simulasi data',
      spray: 'Spray berikutnya dalam ' + sprayCountdown + ' menit'
    });
  }

  runSimulation();
  setInterval(runSimulation, 3000);
}

// ===== NAV SCROLL EFFECT =====
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      entry.target.style.animationDelay = delay + 'ms';
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      entry.target.style.animation = `fadeUp 0.6s ease ${delay}ms both`;
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.feature-card, .hama-card, .step, .sensor-card, .info-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  observer.observe(el);
});

// ===== MULAI MQTT =====
initMQTT();