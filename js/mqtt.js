// ================================================
// MQTT CONNECTION & DATA HANDLING
// ================================================

let mqttClient = null;
let isConnected = false;
let historyData = [];
let latestData = null;

// MQTT Configuration
const MQTT_CONFIG = {
    broker: 'wss://we141ff2.ala.asia-southeast1.emqxsl.com:8084/mqtt',
    options: {
        clientId: 'webapp_' + Math.random().toString(16).substr(2, 8),
        username: 'USERNAME_MQTT_KAMU', // Ganti dengan username MQTT kamu
        password: 'PASSWORD_MQTT_KAMU', // Ganti dengan password MQTT kamu
        reconnectPeriod: 5000,
        clean: true
    },
    topic: 'smartfarm/monitoring'
};

// Initialize MQTT Connection
function initMQTT() {
    console.log('🔌 Menghubungkan ke MQTT...');
    updateConnectionStatus('connecting');

    try {
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, MQTT_CONFIG.options);

        mqttClient.on('connect', () => {
            console.log('✅ MQTT Terhubung!');
            isConnected = true;
            updateConnectionStatus('connected');
            
            // Subscribe to topic
            mqttClient.subscribe(MQTT_CONFIG.topic, (err) => {
                if (err) {
                    console.error('❌ Gagal subscribe:', err);
                } else {
                    console.log('📡 Subscribe ke topic:', MQTT_CONFIG.topic);
                }
            });
        });

        mqttClient.on('message', (topic, message) => {
            if (topic === MQTT_CONFIG.topic) {
                handleMQTTMessage(message.toString());
            }
        });

        mqttClient.on('error', (err) => {
            console.error('❌ MQTT Error:', err);
            updateConnectionStatus('disconnected');
        });

        mqttClient.on('close', () => {
            console.log('🔌 MQTT Terputus');
            isConnected = false;
            updateConnectionStatus('disconnected');
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 Mencoba reconnect...');
            updateConnectionStatus('connecting');
        });

    } catch (error) {
        console.error('❌ Error inisialisasi MQTT:', error);
        updateConnectionStatus('disconnected');
    }
}

// Handle incoming MQTT message
function handleMQTTMessage(message) {
    try {
        const data = JSON.parse(message);
        console.log('📨 Data diterima:', data);
        
        // Add timestamp if not present
        if (!data.timestamp) {
            data.timestamp = new Date().getTime();
        }
        
        latestData = data;
        
        // Update UI
        updateSensorCards(data);
        updateStatusBanner(data);
        updateSprayReminder(data);
        
        // Add to history
        addToHistory(data);
        
        // Update charts
        if (window.updateCharts) {
            window.updateCharts(data);
        }
        
    } catch (error) {
        console.error('❌ Error parsing MQTT message:', error);
    }
}

// Update connection status indicator
function updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    const statusIcon = statusEl.querySelector('i');
    const statusText = statusEl.querySelector('span');
    
    statusEl.classList.remove('connected', 'disconnected');
    
    switch(status) {
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

// Update sensor cards
function updateSensorCards(data) {
    // Suhu
    const suhuEl = document.getElementById('suhuValue');
    if (data.suhu !== undefined) {
        suhuEl.textContent = Number(data.suhu).toFixed(1);
    }
    
    // Kelembapan
    const kelembapanEl = document.getElementById('kelembapanValue');
    if (data.kelembapan !== undefined) {
        kelembapanEl.textContent = Number(data.kelembapan).toFixed(1);
    }
    
    // Gas
    const gasEl = document.getElementById('gasValue');
    if (data.gas !== undefined) {
        gasEl.textContent = Number(data.gas).toFixed(0);
    }
    
    // Api
    const apiEl = document.getElementById('apiValue');
    if (data.api !== undefined) {
        apiEl.textContent = Number(data.api).toFixed(0);
    }
    
    // Jarak
    const jarakEl = document.getElementById('jarakValue');
    if (data.jarak !== undefined) {
        const jarakValue = Number(data.jarak);
        jarakEl.textContent = jarakValue > 0 ? jarakValue.toFixed(1) : '--';
    }
}

// Update status banner
function updateStatusBanner(data) {
    const banner = document.getElementById('statusBanner');
    const icon = banner.querySelector('.status-icon i');
    const title = document.getElementById('statusTitle');
    const description = document.getElementById('statusDescription');
    
    banner.classList.remove('danger', 'warning');
    
    if (data.status) {
        title.textContent = data.status;
        
        // Determine status type and update styling
        const statusLower = data.status.toLowerCase();
        
        if (statusLower.includes('kebakaran') || statusLower.includes('bahaya')) {
            banner.classList.add('danger');
            icon.className = 'fas fa-exclamation-triangle';
        } else if (statusLower.includes('panas') || statusLower.includes('kering') || 
                   statusLower.includes('gas') || statusLower.includes('lembap')) {
            banner.classList.add('warning');
            icon.className = 'fas fa-exclamation-circle';
        } else {
            icon.className = 'fas fa-check-circle';
        }
    }
    
    // Update description if available
    if (data.keterangan) {
        description.textContent = data.keterangan;
    } else {
        description.textContent = 'Sistem monitoring aktif';
    }
}

// Update spray reminder
function updateSprayReminder(data) {
    const sprayEl = document.getElementById('sprayStatus');
    if (data.spray) {
        sprayEl.textContent = data.spray;
    }
}

// Add data to history
function addToHistory(data) {
    const historyEntry = {
        timestamp: data.timestamp || new Date().getTime(),
        suhu: data.suhu,
        kelembapan: data.kelembapan,
        gas: data.gas,
        api: data.api,
        jarak: data.jarak,
        status: data.status
    };
    
    historyData.unshift(historyEntry);
    
    // Keep only last 100 entries
    if (historyData.length > 100) {
        historyData = historyData.slice(0, 100);
    }
    
    // Save to localStorage
    saveHistoryToLocalStorage();
    
    // Update history table
    if (window.updateHistoryTable) {
        window.updateHistoryTable();
    }
}

// Save history to localStorage
function saveHistoryToLocalStorage() {
    try {
        localStorage.setItem('smartfarm_history', JSON.stringify(historyData));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// Load history from localStorage
function loadHistoryFromLocalStorage() {
    try {
        const saved = localStorage.getItem('smartfarm_history');
        if (saved) {
            historyData = JSON.parse(saved);
            console.log(`📚 Loaded ${historyData.length} history entries`);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        historyData = [];
    }
}

// Clear history
function clearHistory() {
    if (confirm('Apakah Anda yakin ingin menghapus semua history?')) {
        historyData = [];
        saveHistoryToLocalStorage();
        if (window.updateHistoryTable) {
            window.updateHistoryTable();
        }
        alert('History berhasil dihapus!');
    }
}

// Get latest data
function getLatestData() {
    return latestData;
}

// Get history data
function getHistoryData() {
    return historyData;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadHistoryFromLocalStorage();
    initMQTT();
});

// Export functions for use in other files
window.mqttModule = {
    getLatestData,
    getHistoryData,
    clearHistory,
    isConnected: () => isConnected,
    isDisconnected: () => !isConnected
};
