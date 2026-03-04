// ================================================
// MAIN APPLICATION SCRIPT
// History Table, Real-time Clock, and UI Handlers
// ================================================

// Pagination settings
let currentPage = 1;
const rowsPerPage = 10;

// Initialize main app
function initMainApp() {
    initRealtimeClock();
    initHistoryTable();
    setupEventListeners();
    console.log('✅ Main app initialized');
}

// ================================================
// REAL-TIME CLOCK
// ================================================

function initRealtimeClock() {
    updateClock();
    // Update every second
    setInterval(updateClock, 1000);
}

function updateClock() {
    const clockDisplay = document.getElementById('clockDisplay');
    const now = new Date();
    
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    const dateTimeString = now.toLocaleDateString('id-ID', options);
    clockDisplay.textContent = dateTimeString;
}

// ================================================
// HISTORY TABLE
// ================================================

function initHistoryTable() {
    // Initial render
    updateHistoryTable();
}

function updateHistoryTable() {
    const historyData = window.mqttModule.getHistoryData();
    const tbody = document.getElementById('historyTableBody');
    
    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Belum ada data</td></tr>';
        updatePagination(0);
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(historyData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = historyData.slice(startIndex, endIndex);
    
    // Render table rows
    tbody.innerHTML = '';
    pageData.forEach(entry => {
        const row = document.createElement('tr');
        
        // Format timestamp
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Format values
        const suhu = entry.suhu !== undefined ? Number(entry.suhu).toFixed(1) + ' °C' : '-';
        const kelembapan = entry.kelembapan !== undefined ? Number(entry.kelembapan).toFixed(1) + ' %' : '-';
        const gas = entry.gas !== undefined ? Number(entry.gas).toFixed(0) : '-';
        const api = entry.api !== undefined ? Number(entry.api).toFixed(0) : '-';
        const jarak = entry.jarak !== undefined && entry.jarak > 0 ? Number(entry.jarak).toFixed(1) + ' cm' : '-';
        const status = entry.status || '-';
        
        row.innerHTML = `
            <td>${timeStr}</td>
            <td>${suhu}</td>
            <td>${kelembapan}</td>
            <td>${gas}</td>
            <td>${api}</td>
            <td>${jarak}</td>
            <td><span class="status-badge">${status}</span></td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update pagination controls
    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Prev
        </button>
    `;
    
    // Page info
    paginationHTML += `<span>Halaman ${currentPage} dari ${totalPages}</span>`;
    
    // Next button
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

function changePage(newPage) {
    const historyData = window.mqttModule.getHistoryData();
    const totalPages = Math.ceil(historyData.length / rowsPerPage);
    
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    updateHistoryTable();
}

// Make changePage available globally
window.changePage = changePage;

// Export update function for MQTT module
window.updateHistoryTable = () => {
    // Reset to page 1 when new data arrives
    currentPage = 1;
    updateHistoryTable();
};

// ================================================
// EVENT LISTENERS
// ================================================

function setupEventListeners() {
    // Clear history button
    const btnClear = document.getElementById('btnClearHistory');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (window.mqttModule && window.mqttModule.clearHistory) {
                window.mqttModule.clearHistory();
            }
        });
    }
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Format number with thousand separator
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Get status color
function getStatusColor(status) {
    if (!status) return '#95a5a6';
    
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('kebakaran') || statusLower.includes('bahaya')) {
        return '#e74c3c';
    } else if (statusLower.includes('panas') || statusLower.includes('kering') || 
               statusLower.includes('gas') || statusLower.includes('lembap')) {
        return '#f39c12';
    } else {
        return '#27ae60';
    }
}

// ================================================
// KEYBOARD SHORTCUTS
// ================================================

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Open chatbot
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('chatbotBtn').click();
    }
    
    // Ctrl/Cmd + H: Focus on history
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        document.querySelector('.history-section').scrollIntoView({ behavior: 'smooth' });
    }
});

// ================================================
// PAGE VISIBILITY HANDLING
// ================================================

// Pause/resume updates when tab is not visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('⏸️ Tab hidden - monitoring continues in background');
    } else {
        console.log('▶️ Tab visible - UI refreshed');
        updateHistoryTable();
    }
});

// ================================================
// ERROR HANDLING
// ================================================

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

// ================================================
// INITIALIZE ON DOM READY
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    initMainApp();
});

// ================================================
// SERVICE WORKER (Optional for PWA)
// ================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable PWA features
        // navigator.serviceWorker.register('/sw.js')
        //     .then(reg => console.log('Service Worker registered'))
        //     .catch(err => console.log('Service Worker registration failed'));
    });
}

// ================================================
// EXPORT FOR DEBUGGING
// ================================================

window.debugInfo = () => {
    console.log('=== DEBUG INFO ===');
    console.log('History Data:', window.mqttModule.getHistoryData());
    console.log('Latest Data:', window.mqttModule.getLatestData());
    console.log('Current Page:', currentPage);
    console.log('Connected:', window.mqttModule.isConnected());
};
