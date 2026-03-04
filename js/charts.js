// ================================================
// CHART.JS IMPLEMENTATION
// ================================================

let tempHumChart = null;
let gasFireChart = null;

// Chart data storage
const chartData = {
    labels: [],
    suhu: [],
    kelembapan: [],
    gas: [],
    api: []
};

const MAX_CHART_POINTS = 20; // Keep last 20 data points

// Initialize charts
function initCharts() {
    initTempHumChart();
    initGasFireChart();
    console.log('📊 Charts initialized');
}

// Initialize Temperature & Humidity Chart
function initTempHumChart() {
    const ctx = document.getElementById('tempHumChart');
    if (!ctx) return;

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
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: 'Poppins',
                            weight: '500'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: 'Poppins'
                        },
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    display: true,
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(45, 122, 62, 0.1)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: 'Poppins'
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Initialize Gas & Fire Chart
function initGasFireChart() {
    const ctx = document.getElementById('gasFireChart');
    if (!ctx) return;

    gasFireChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Gas (ppm)',
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
                    label: 'Api (level)',
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
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: 'Poppins',
                            weight: '500'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: 'Poppins'
                        },
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(45, 122, 62, 0.1)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: 'Poppins'
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Update charts with new data
function updateCharts(data) {
    if (!data) return;

    // Create timestamp label
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });

    // Add new data
    chartData.labels.push(timeLabel);
    chartData.suhu.push(data.suhu !== undefined ? Number(data.suhu) : null);
    chartData.kelembapan.push(data.kelembapan !== undefined ? Number(data.kelembapan) : null);
    chartData.gas.push(data.gas !== undefined ? Number(data.gas) : null);
    chartData.api.push(data.api !== undefined ? Number(data.api) : null);

    // Keep only last N points
    if (chartData.labels.length > MAX_CHART_POINTS) {
        chartData.labels.shift();
        chartData.suhu.shift();
        chartData.kelembapan.shift();
        chartData.gas.shift();
        chartData.api.shift();
    }

    // Update charts
    if (tempHumChart) {
        tempHumChart.update('none'); // Update without animation for smooth real-time
    }
    
    if (gasFireChart) {
        gasFireChart.update('none');
    }
}

// Load historical data into charts
function loadHistoricalDataToCharts() {
    const history = window.mqttModule.getHistoryData();
    
    if (!history || history.length === 0) return;

    // Clear existing data
    chartData.labels = [];
    chartData.suhu = [];
    chartData.kelembapan = [];
    chartData.gas = [];
    chartData.api = [];

    // Load last N entries (reverse order to get newest first)
    const dataToLoad = history.slice(0, MAX_CHART_POINTS).reverse();

    dataToLoad.forEach(entry => {
        const date = new Date(entry.timestamp);
        const timeLabel = date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });

        chartData.labels.push(timeLabel);
        chartData.suhu.push(entry.suhu !== undefined ? Number(entry.suhu) : null);
        chartData.kelembapan.push(entry.kelembapan !== undefined ? Number(entry.kelembapan) : null);
        chartData.gas.push(entry.gas !== undefined ? Number(entry.gas) : null);
        chartData.api.push(entry.api !== undefined ? Number(entry.api) : null);
    });

    // Update charts
    if (tempHumChart) {
        tempHumChart.update();
    }
    
    if (gasFireChart) {
        gasFireChart.update();
    }

    console.log('📊 Loaded historical data to charts');
}

// Initialize charts when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for MQTT module to load history
    setTimeout(() => {
        initCharts();
        loadHistoricalDataToCharts();
    }, 500);
});

// Export function for MQTT module
window.updateCharts = updateCharts;
