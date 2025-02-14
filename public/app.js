// Initialize socket connection
const socket = io();

// DOM elements
const percentageElement = document.getElementById('percentage');
const lastUpdateElement = document.getElementById('last-update');
const newsSummaryElement = document.getElementById('news-summary');
const reasoningElement = document.getElementById('reasoning');
const backgroundEffects = document.getElementById('background-effects');
const gauge = document.querySelector('.gauge');
const glowBackground = document.querySelector('.glow-background');
const severityBadge = document.querySelector('.severity-badge');
const trendArrow = document.querySelector('.trend-arrow');
const trendValue = document.querySelector('.trend-value');
const nextUpdateElement = document.getElementById('next-update');

// Chart initialization
let historyChart;
const ctx = document.getElementById('historyChart').getContext('2d');

// Function to update the gauge color based on percentage
function updateGaugeColor(percentage) {
    gauge.classList.remove('safe', 'warning', 'danger');
    document.body.classList.remove('safe', 'warning', 'danger');
    
    let colorClass;
    if (percentage <= 33) {
        colorClass = 'safe';
        severityBadge.textContent = 'MONITORING';
        severityBadge.className = 'severity-badge safe';
    } else if (percentage <= 66) {
        colorClass = 'warning';
        severityBadge.textContent = 'CAUTION';
        severityBadge.className = 'severity-badge warning';
    } else {
        colorClass = 'danger';
        severityBadge.textContent = 'CRITICAL';
        severityBadge.className = 'severity-badge danger';
    }
    
    gauge.classList.add(colorClass);
    document.body.classList.add(colorClass);
    
    // Update glow background
    glowBackground.style.background = `radial-gradient(circle at center, var(--${colorClass}-color) 0%, var(--background-color) 70%)`;
    
    return `var(--${colorClass}-color)`;
}

// Function to create background effects based on percentage
function updateBackgroundEffects(percentage) {
    const color = updateGaugeColor(percentage);
    const numSymbols = Math.floor(percentage / 10) + 5;
    
    backgroundEffects.innerHTML = '';
    const symbols = ['☢️', '⚠️', '🌍', '⚡', '🔥'];
    
    for (let i = 0; i < numSymbols; i++) {
        const symbol = document.createElement('div');
        symbol.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        symbol.style.position = 'absolute';
        symbol.style.left = `${Math.random() * 100}%`;
        symbol.style.top = `${Math.random() * 100}%`;
        symbol.style.transform = `rotate(${Math.random() * 360}deg)`;
        symbol.style.fontSize = `${Math.random() * 2 + 1}rem`;
        symbol.style.opacity = '0.2';
        symbol.style.transition = 'all 0.5s ease';
        
        // Add floating animation
        symbol.style.animation = `float ${Math.random() * 5 + 5}s ease-in-out infinite`;
        backgroundEffects.appendChild(symbol);
    }
}

// Initialize chart
function initChart() {
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'World End Probability',
                data: [],
                borderColor: 'rgba(255, 255, 255, 0.8)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            family: 'Orbitron'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            family: 'Orbitron'
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            family: 'Orbitron'
                        }
                    }
                }
            }
        }
    });
}

// Update trend indicator
function updateTrendIndicator(currentValue, previousValue) {
    const difference = currentValue - previousValue;
    trendArrow.className = 'trend-arrow';
    
    if (difference > 0) {
        trendArrow.textContent = '↑';
        trendArrow.classList.add('up');
        trendValue.textContent = `+${difference.toFixed(1)}%`;
    } else if (difference < 0) {
        trendArrow.textContent = '↓';
        trendArrow.classList.add('down');
        trendValue.textContent = `${difference.toFixed(1)}%`;
    } else {
        trendArrow.textContent = '→';
        trendValue.textContent = '0%';
    }
}

// Function to update the next update countdown
function updateNextUpdateCountdown() {
    const now = moment();
    const nextHour = moment().startOf('hour').add(1, 'hour');
    const duration = moment.duration(nextHour.diff(now));
    
    const minutes = Math.floor(duration.asMinutes());
    const seconds = Math.floor(duration.seconds());
    
    nextUpdateElement.textContent = `${minutes}m ${seconds}s`;
}

// Start the countdown timer
setInterval(updateNextUpdateCountdown, 1000);

// Update the display with new data
function updateDisplay(percentage, newsSummary, reasoning, timestamp) {
    // Animate the percentage change
    const currentValue = parseFloat(percentageElement.textContent) || 0;
    const targetValue = percentage;
    const duration = 1000; // 1 second
    const steps = 60;
    const increment = (targetValue - currentValue) / steps;
    let currentStep = 0;
    
    const animation = setInterval(() => {
        currentStep++;
        const newValue = currentValue + (increment * currentStep);
        percentageElement.textContent = Math.round(newValue);
        
        if (currentStep >= steps) {
            clearInterval(animation);
            percentageElement.textContent = targetValue;
        }
    }, duration / steps);
    
    const now = moment();
    const updateTime = moment(timestamp);
    const diffMinutes = now.diff(updateTime, 'minutes');
    
    if (diffMinutes < 1) {
        lastUpdateElement.textContent = 'just now';
    } else if (diffMinutes < 60) {
        lastUpdateElement.textContent = `${diffMinutes} minutes ago`;
    } else {
        lastUpdateElement.textContent = updateTime.fromNow();
    }
    
    newsSummaryElement.textContent = newsSummary;
    reasoningElement.textContent = reasoning;
    
    updateGaugeColor(percentage);
    updateBackgroundEffects(percentage);
}

// Update the chart with new data
function updateChart(percentage, timestamp) {
    const label = moment(timestamp).format('HH:mm');
    
    historyChart.data.labels.push(label);
    historyChart.data.datasets[0].data.push(percentage);
    
    // Keep only last 10 data points
    if (historyChart.data.labels.length > 10) {
        historyChart.data.labels.shift();
        historyChart.data.datasets[0].data.shift();
    }
    
    // Update trend indicator
    const dataPoints = historyChart.data.datasets[0].data;
    if (dataPoints.length >= 2) {
        updateTrendIndicator(
            dataPoints[dataPoints.length - 1],
            dataPoints[dataPoints.length - 2]
        );
    }
    
    historyChart.update();
}

// Add floating animation keyframes
const style = document.createElement('style');
style.textContent = `
@keyframes float {
    0% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(5px, -5px) rotate(90deg); }
    50% { transform: translate(0, -10px) rotate(180deg); }
    75% { transform: translate(-5px, -5px) rotate(270deg); }
    100% { transform: translate(0, 0) rotate(360deg); }
}
@keyframes rotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

// Socket event handlers
socket.on('update', (data) => {
    updateDisplay(data.probability, data.news_summary, data.reasoning, new Date(data.timestamp));
    updateChart(data.probability, new Date(data.timestamp));
});

// Initialize the application
async function init() {
    initChart();
    updateNextUpdateCountdown();
    
    try {
        const response = await fetch('/api/latest');
        const history = await response.json();
        
        if (history.length > 0) {
            const latest = history[0];
            updateDisplay(latest.worldend, latest.news, latest.reasoning, new Date(latest.date));
            
            // Update chart with historical data
            history.reverse().forEach(entry => {
                updateChart(entry.worldend, new Date(entry.date));
            });
            
            // Update trend with the last two entries
            if (history.length >= 2) {
                updateTrendIndicator(history[0].worldend, history[1].worldend);
            }
        }
    } catch (error) {
        console.error('Failed to fetch initial data:', error);
    }
}

// Initialize the application
init(); 