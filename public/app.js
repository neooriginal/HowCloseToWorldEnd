const socket = io();

class GlobalThreatTracker {
    constructor() {
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.worldData = null;
        this.countriesData = {};
        this.conflictsData = [];
        this.globalAnalysis = null;
        this.selectedCountry = null;
        this.timerInterval = null;
        this.lastAnalysisTime = null;
        this.analysisInterval = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        this.threatChart = null;
        this.currentChartPeriod = '24h';
        
        this.init();
        this.setupSocketListeners();
        this.loadInitialData();
        this.startTimer();
        this.initializeChart();
        this.loadNews();
    }

    init() {
        this.setupMap();
        this.setupEventListeners();
        this.setupModal();
        this.setupChartControls();
    }

    setupModal() {
        const reasoningBtn = document.getElementById('reasoningBtn');
        const modal = document.getElementById('reasoningModal');
        const closeBtn = document.getElementById('closeReasoningModal');

        reasoningBtn.addEventListener('click', () => {
            this.showReasoningModal();
        });

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    showReasoningModal() {
        const modal = document.getElementById('reasoningModal');
        
        if (this.globalAnalysis) {
            document.getElementById('modalReasoning').textContent = 
                this.globalAnalysis.ai_reasoning || 'No reasoning data available';
            
            document.getElementById('modalTrendText').textContent = 
                this.globalAnalysis.trend_direction || 'Unknown';
            
            const trendArrow = document.getElementById('modalTrendArrow');
            this.updateTrendArrow(trendArrow, this.globalAnalysis.trend_direction);
            
            const keyEventsList = document.getElementById('modalKeyEvents');
            if (this.globalAnalysis.key_events && this.globalAnalysis.key_events.length > 0) {
                keyEventsList.innerHTML = this.globalAnalysis.key_events
                    .map(event => `<li>${event}</li>`)
                    .join('');
            } else {
                keyEventsList.innerHTML = '<li>No critical events identified</li>';
            }
        }
        
        modal.style.display = 'flex';
    }

    updateTrendArrow(element, trend) {
        switch(trend) {
            case 'increasing':
                element.textContent = '↗';
                element.style.color = 'var(--doomsday-red)';
                break;
            case 'decreasing':
                element.textContent = '↘';
                element.style.color = 'var(--safe-color)';
                break;
            default:
                element.textContent = '→';
                element.style.color = 'var(--accent-orange)';
        }
    }

    setupMap() {
        const container = document.getElementById('worldMap');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.svg = d3.select('#worldMap')
            .attr('width', width)
            .attr('height', height);

        this.projection = d3.geoNaturalEarth1()
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);

        this.path = d3.geoPath().projection(this.projection);

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                this.svg.selectAll('path')
                    .attr('transform', event.transform);
            });

        this.svg.call(zoom);

        this.loadWorldMap();
    }

    async loadWorldMap() {
        try {
            const world = await d3.json('/countries-110m.json');
            this.worldData = topojson.feature(world, world.objects.countries);

            this.svg.selectAll('.country')
                .data(this.worldData.features)
                .enter()
                .append('path')
                .attr('class', 'country')
                .attr('d', this.path)
                .attr('data-name', d => d.properties.NAME)
                .attr('data-id', d => d.id)
                .on('click', (event, d) => this.selectCountry(d))
                .on('mouseover', (event, d) => this.showTooltip(event, d))
                .on('mouseout', () => this.hideTooltip());

            // Try to color the map if data is already loaded
            if (this.countriesData && Object.keys(this.countriesData).length > 0) {
                this.updateMapColors();
            }

        } catch (error) {
            console.error('Error loading world map:', error);
        }
    }

    selectCountry(countryData) {
        this.svg.selectAll('.country').classed('selected', false);
        
        const countryElement = this.svg.selectAll('.country')
            .filter(d => d.id === countryData.id);
        
        countryElement.classed('selected', true);
        
        this.selectedCountry = countryData;
        this.updateCountryPanel(countryData);
    }

    showTooltip(event, countryData) {
        const tooltip = document.getElementById('tooltip');
        const countryName = countryData.properties.NAME || countryData.properties.name;
        const countryInfo = this.getCountryInfo(countryName);
        
        tooltip.innerHTML = `
            <div class="tooltip-title">${countryName}</div>
            <div class="tooltip-risk">Threat Level: ${countryInfo.current_risk_level || 0}%</div>
        `;
        
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
        tooltip.classList.add('visible');
    }

    hideTooltip() {
        document.getElementById('tooltip').classList.remove('visible');
    }

    getCountryInfo(countryName) {
        // Map TopoJSON names to database names
        const nameMapping = {
            'United States of America': 'United States',
            'Russian Federation': 'Russia',
            'Iran (Islamic Republic of)': 'Iran',
            'Korea, Republic of': 'South Korea',
            'Korea, Democratic People\'s Republic of': 'North Korea',
            'Venezuela (Bolivarian Republic of)': 'Venezuela',
            'Syrian Arab Republic': 'Syria',
            'Egypt': 'Egypt',
            'South Africa': 'South Africa',
            'Nigeria': 'Nigeria',
            'Ethiopia': 'Ethiopia',
            'W. Sahara': 'Western Sahara',
            'Dem. Rep. Congo': 'Democratic Republic of Congo',
            'Central African Rep.': 'Central African Republic',
            'S. Sudan': 'South Sudan',
            'Bosnia and Herz.': 'Bosnia and Herzegovina',
            'Czech Rep.': 'Czech Republic',
            'Dominican Rep.': 'Dominican Republic',
            'Eq. Guinea': 'Equatorial Guinea',
            'North Macedonia': 'Macedonia',
            'Solomon Is.': 'Solomon Islands',
            'Trinidad and Tobago': 'Trinidad and Tobago',
            'United Kingdom': 'United Kingdom',
            'China': 'China',
            'India': 'India',
            'France': 'France',
            'Germany': 'Germany',
            'Japan': 'Japan',
            'Brazil': 'Brazil',
            'Canada': 'Canada',
            'Australia': 'Australia',
            'Italy': 'Italy',
            'Spain': 'Spain',
            'Mexico': 'Mexico',
            'Turkey': 'Turkey',
            'Saudi Arabia': 'Saudi Arabia',
            'Israel': 'Israel',
            'Pakistan': 'Pakistan',
            'Afghanistan': 'Afghanistan',
            'Ukraine': 'Ukraine',
            'Iraq': 'Iraq',
            'Syria': 'Syria'
        };

        const dbCountryName = nameMapping[countryName] || countryName;
        return this.countriesData[dbCountryName] || { current_risk_level: 0, conflicts: [] };
    }

    updateCountryPanel(countryData) {
        const panel = document.getElementById('countryPanel');
        const countryName = countryData.properties.NAME || countryData.properties.name;
        const countryInfo = this.getCountryInfo(countryName);
        
        document.getElementById('countryName').textContent = countryName;
        
        const riskElement = document.getElementById('countryRisk');
        riskElement.textContent = `Threat: ${countryInfo.current_risk_level || 0}%`;
        riskElement.className = `country-risk ${this.getRiskClass(countryInfo.current_risk_level || 0)}`;
        
        this.updateConflictsList(countryInfo.conflicts || []);
        panel.style.display = 'block';
    }

    updateConflictsList(conflicts) {
        const conflictsList = document.getElementById('conflictsList');
        
        if (conflicts.length === 0) {
            conflictsList.innerHTML = '<p class="no-data">No active threats detected in this region</p>';
            return;
        }

        conflictsList.innerHTML = conflicts.map(conflict => `
            <div class="conflict-item">
                <div class="conflict-title">${conflict.title}</div>
                <div class="conflict-meta">
                    <span class="conflict-type">${conflict.conflict_type}</span>
                    <span class="conflict-severity severity-${conflict.severity}">
                        Severity ${conflict.severity}/10
                    </span>
                </div>
                <div class="conflict-description">${conflict.description}</div>
            </div>
        `).join('');
    }

    getRiskClass(risk) {
        if (risk <= 33) return 'safe';
        if (risk <= 66) return 'moderate';
        if (risk <= 85) return 'high';
        return 'critical';
    }

    updateMapColors() {
        if (!this.svg || !this.countriesData) return;
        
        this.svg.selectAll('.country')
            .each(function(d) {
                const countryName = d.properties.NAME || d.properties.name;
                const countryInfo = window.app.getCountryInfo(countryName);
                const riskClass = window.app.getRiskClass(countryInfo.current_risk_level || 0);
                
                d3.select(this)
                    .attr('class', `country ${riskClass}`);
            });
    }

    setupEventListeners() {
        document.getElementById('resetZoom').addEventListener('click', () => {
            this.svg.transition()
                .duration(750)
                .call(
                d3.zoom().transform,
                d3.zoomIdentity
            );
        });

        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const container = document.getElementById('worldMap');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.svg.attr('width', width).attr('height', height);
        
        this.projection
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);

        this.svg.selectAll('path').attr('d', this.path);
    }

    setupSocketListeners() {
        socket.on('connect', () => {
            this.updateStatus('Connected - Monitoring Active', 'connected');
        });

        socket.on('disconnect', () => {
            this.updateStatus('Disconnected - Reconnecting...', 'disconnected');
        });

        socket.on('analysisUpdate', (data) => {
            this.updateGlobalStats(data);
            this.loadInitialData();
            // Reset timer when new analysis comes in
            this.lastAnalysisTime = Date.now();
        });
    }

    updateStatus(text, type) {
        document.getElementById('statusText').textContent = text;
        const statusDot = document.getElementById('statusDot');
        statusDot.className = `status-dot ${type}`;
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadCountries(),
                this.loadConflicts(),
                this.loadGlobalAnalysis()
            ]);
            
            // Ensure map colors are updated after all data is loaded
            setTimeout(() => {
            this.updateMapColors();
            }, 100);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadCountries() {
        try {
            const response = await fetch('/api/countries');
            const countries = await response.json();
            
            this.countriesData = {};
            countries.forEach(country => {
                this.countriesData[country.name] = country;
            });
            
            // Update map colors after loading countries
            this.updateMapColors();
            
        } catch (error) {
            console.error('Error loading countries:', error);
        }
    }

    async loadConflicts() {
        try {
            const response = await fetch('/api/conflicts');
            const conflicts = await response.json();
            
            // Group conflicts by country
            this.conflictsData = conflicts;
            Object.keys(this.countriesData).forEach(countryName => {
                this.countriesData[countryName].conflicts = conflicts.filter(
                    conflict => conflict.country_name === countryName
                );
            });
            
        } catch (error) {
            console.error('Error loading conflicts:', error);
        }
    }

    async loadGlobalAnalysis() {
        try {
            const response = await fetch('/api/global-analysis');
            this.globalAnalysis = await response.json();
            this.updateGlobalStats();
            this.updateAnalysisPanel();
        } catch (error) {
            console.error('Error loading global analysis:', error);
        }
    }

    updateGlobalStats(data = null) {
        const analysis = data || this.globalAnalysis;
        if (!analysis) return;
        
        // Update threat level with dramatic formatting
        const globalRisk = document.getElementById('globalRisk');
        const riskValue = analysis.overall_risk_level || 0;
        globalRisk.textContent = `${riskValue}%`;
        
        // Add pulsing effect for high threat levels
        if (riskValue > 70) {
            globalRisk.style.animation = 'pulse-red 2s ease-in-out infinite alternate';
        } else {
            globalRisk.style.animation = 'none';
        }

        document.getElementById('activeConflicts').textContent = analysis.active_conflicts_count || 0;
        document.getElementById('highRiskCountries').textContent = analysis.high_risk_countries_count || 0;
        
        // Update last analysis time for countdown
        if (analysis.created_at) {
            this.lastAnalysisTime = new Date(analysis.created_at).getTime();
            document.getElementById('lastUpdate').textContent = new Date(analysis.created_at).toLocaleString();
        } else {
            document.getElementById('lastUpdate').textContent = 'Never';
        }
    }

    updateAnalysisPanel() {
        if (!this.globalAnalysis) return;
        
        // Update trend indicator
        const trendIndicator = document.getElementById('trendIndicator');
        const trendArrow = trendIndicator.querySelector('.trend-arrow');
        const trendText = trendIndicator.querySelector('.trend-text');
        
        this.updateTrendArrow(trendArrow, this.globalAnalysis.trend_direction);
        trendText.textContent = this.globalAnalysis.trend_direction || 'Unknown';

        // Update key events
        const keyEventsList = document.getElementById('keyEvents');
        if (this.globalAnalysis.key_events && this.globalAnalysis.key_events.length > 0) {
            keyEventsList.innerHTML = this.globalAnalysis.key_events
                .map(event => `<li>${event}</li>`)
                .join('');
        } else {
            keyEventsList.innerHTML = '<li>No critical events detected</li>';
        }
        
        // Update news summary
        document.getElementById('newsSummary').textContent = 
            this.globalAnalysis.news_summary || 'No current threat summary available';

        this.updateRecentConflicts();
    }

    updateRecentConflicts() {
        const recentConflicts = document.getElementById('recentConflicts');
        
        if (!this.conflictsData || this.conflictsData.length === 0) {
            recentConflicts.innerHTML = '<p class="loading">No active threats detected</p>';
            return;
        }
        
        // Sort by severity and show top 5
        const topConflicts = this.conflictsData
            .sort((a, b) => b.severity - a.severity)
            .slice(0, 5);
        
        recentConflicts.innerHTML = topConflicts.map(conflict => `
            <div class="conflict-item" onclick="window.app.highlightCountryByName('${conflict.country_name}')">
                <div class="conflict-title">${conflict.title}</div>
                <div class="conflict-meta">
                    <span class="conflict-type">${conflict.conflict_type}</span>
                    <span class="conflict-severity severity-${conflict.severity}">
                        Level ${conflict.severity}
                    </span>
                </div>
                <div class="conflict-description">${conflict.description}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
                    📍 ${conflict.country_name}
                </div>
            </div>
        `).join('');
    }

    highlightCountryByName(countryName) {
        if (!this.worldData) return;

        const nameMapping = {
            'United States': 'United States of America',
            'Russia': 'Russian Federation',
            'Iran': 'Iran (Islamic Republic of)',
            'South Korea': 'Korea, Republic of',
            'North Korea': 'Korea, Democratic People\'s Republic of',
            'Venezuela': 'Venezuela (Bolivarian Republic of)',
            'Syria': 'Syrian Arab Republic'
        };

        const mapCountryName = nameMapping[countryName] || countryName;
        
        const countryFeature = this.worldData.features.find(
            feature => feature.properties.NAME === mapCountryName
        );
        
        if (countryFeature) {
            this.selectCountry(countryFeature);
        }
    }

    startTimer() {
        // Start the countdown timer
        this.timerInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
        
        // Initial countdown update
        this.updateCountdown();
    }

    updateCountdown() {
        if (!this.lastAnalysisTime) {
            document.getElementById('nextScanTimer').textContent = '--:--:--';
            return;
        }

        const now = Date.now();
        const timeSinceLastAnalysis = now - this.lastAnalysisTime;
        const timeUntilNext = this.analysisInterval - timeSinceLastAnalysis;

        if (timeUntilNext <= 0) {
            document.getElementById('nextScanTimer').textContent = 'Scanning...';
            return;
        }

        const hours = Math.floor(timeUntilNext / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilNext % (1000 * 60)) / 1000);

        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('nextScanTimer').textContent = formattedTime;

        // Add urgency styling for last 30 minutes
        const timerElement = document.getElementById('nextScanTimer');
        if (timeUntilNext < 30 * 60 * 1000) {
            timerElement.style.color = 'var(--doomsday-red)';
            timerElement.style.animation = 'pulse-red 2s ease-in-out infinite alternate';
        } else {
            timerElement.style.color = 'var(--accent-orange)';
            timerElement.style.animation = 'none';
        }
    }

    // Cleanup method
    destroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    setupChartControls() {
        const chartButtons = document.querySelectorAll('.chart-btn');
        chartButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                chartButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                this.currentChartPeriod = e.target.dataset.period;
                this.updateChart();
            });
        });
    }

    async initializeChart() {
        const ctx = document.getElementById('threatHistoryChart');
        if (!ctx) return;

        // Import Chart.js if it's available
        if (typeof Chart === 'undefined') {
            console.log('Chart.js not available, loading from CDN...');
            await this.loadChartJS();
        }

        const chartOptions = {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Global Threat Level',
                    data: [],
                    borderColor: 'rgb(220, 38, 38)',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(255, 107, 53)',
                    pointBorderColor: 'rgb(220, 38, 38)',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                family: 'Orbitron',
                                size: 14
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b0b0b0',
                            font: {
                                family: 'JetBrains Mono'
                            }
                        },
                        grid: {
                            color: 'rgba(220, 38, 38, 0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: '#b0b0b0',
                            font: {
                                family: 'JetBrains Mono'
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(220, 38, 38, 0.1)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        this.threatChart = new Chart(ctx, chartOptions);
        this.updateChart();
    }

    async loadChartJS() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    async updateChart() {
        if (!this.threatChart) return;

        try {
            const response = await fetch(`/api/historical-analysis?period=${this.currentChartPeriod}`);
            const historicalData = await response.json();
            
            if (historicalData && historicalData.length > 0) {
                const labels = historicalData.map(entry => {
                    const date = new Date(entry.created_at);
                    return this.formatDateForPeriod(date, this.currentChartPeriod);
                });
                
                const values = historicalData.map(entry => entry.overall_risk_level);
                
                this.threatChart.data.labels = labels;
                this.threatChart.data.datasets[0].data = values;
                this.threatChart.update();
            } else {
                // If no historical data, show current point only
                const currentResponse = await fetch('/api/global-analysis');
                const currentAnalysis = await currentResponse.json();
                
                if (currentAnalysis) {
                    this.threatChart.data.labels = ['Current'];
                    this.threatChart.data.datasets[0].data = [currentAnalysis.overall_risk_level || 0];
                    this.threatChart.update();
                }
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
        }
    }

    formatDateForPeriod(date, period) {
        switch(period) {
            case '24h':
                return date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
            case '7d':
                return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
            case '30d':
                return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
            case '1y':
                return date.toLocaleDateString('en-US', {month: 'short', year: '2-digit'});
            default:
                return date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
        }
    }

    generateHistoricalData(period) {
        // Removed - no fake historical data
        return { labels: [], values: [] };
    }

    async loadNews() {
        // News loading removed - all news should come from backend analysis
        // Frontend will only display conflicts from the API
        console.log('News display handled through conflicts API');
    }

    async loadNewsForCategory(category) {
        // Removed - using real data only
    }

    generateSampleNews(keywords) {
        // Removed - no hardcoded news
        return [];
    }

    getRandomTime() {
        // Removed - no sample news
        return '';
    }

    showNewsError() {
        // Removed - better to show nothing than fake news
    }
}

// Initialize the app
window.app = new GlobalThreatTracker(); 