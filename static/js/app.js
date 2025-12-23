// Connect to Socket.io server
const socket = io();

// DOM Elements
const keywordInput = document.getElementById('keyword-input');
const addKeywordBtn = document.getElementById('add-keyword-btn');
const keywordsContainer = document.getElementById('keywords-container');
const keywordCount = document.getElementById('keyword-count');
const refreshBtn = document.getElementById('refresh-btn');
const postsContainer = document.getElementById('posts-container');
const trendingList = document.getElementById('trending-list');
const statusBar = document.getElementById('status-bar');
const statusMessage = document.getElementById('status-message');
const statusDetail = document.getElementById('status-detail');
const dismissStatus = document.getElementById('dismiss-status');
const lastUpdated = document.getElementById('last-updated');
const connectionStatus = document.getElementById('connection-status');
const totalPosts = document.getElementById('total-posts');
const activeKeywords = document.getElementById('active-keywords');
const avgEngagement = document.getElementById('avg-engagement');
const autoRefreshToggle = document.getElementById('auto-refresh');
const sortBySelect = document.getElementById('sort-by');
const updateSpeed = document.getElementById('update-speed');

// State
let activeKeywordsList = new Set(['GPT', 'ChatGPT', 'OpenAI', 'AI', 'Machine Learning']);
let posts = [];
let trends = [];
let autoRefreshInterval = null;

// Chart Variables
let trendChart = null;
let engagementChart = null;
let chartDataHistory = [];

// Initialize Charts
function initializeCharts() {
    console.log("📊 Initializing charts...");
    
    // Destroy existing charts if they exist
    if (trendChart) trendChart.destroy();
    if (engagementChart) engagementChart.destroy();
    
    // Trend Chart (Line Chart)
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        trendChart = new Chart(trendCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['5m ago', '4m ago', '3m ago', '2m ago', '1m ago'],
                datasets: [{
                    label: 'AI Posts Trend',
                    data: [0, 0, 0, 0, 0],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // Engagement Chart (Doughnut)
    const engagementCtx = document.getElementById('engagementChart');
    if (engagementCtx) {
        engagementChart = new Chart(engagementCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['High (>100)', 'Medium (50-100)', 'Low (<50)'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(249, 115, 22, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgb(34, 197, 94)',
                        'rgb(249, 115, 22)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }
    
    // Set up chart control buttons
    setupChartControls();
}

// Set up chart control buttons
function setupChartControls() {
    // Trend time period buttons
    const trend1h = document.getElementById('trend-1h');
    const trend24h = document.getElementById('trend-24h');
    const trend7d = document.getElementById('trend-7d');
    
    if (trend1h) {
        trend1h.addEventListener('click', function() {
            updateChartTimePeriod('1h');
            setActiveChartButton(this);
        });
    }
    
    if (trend24h) {
        trend24h.addEventListener('click', function() {
            updateChartTimePeriod('24h');
            setActiveChartButton(this);
        });
    }
    
    if (trend7d) {
        trend7d.addEventListener('click', function() {
            updateChartTimePeriod('7d');
            setActiveChartButton(this);
        });
    }
}

function setActiveChartButton(button) {
    // Remove active class from all buttons
    document.querySelectorAll('#trend-1h, #trend-24h, #trend-7d').forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-blue-100', 'text-blue-700');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
    
    // Add active class to clicked button
    if (button) {
        button.classList.remove('bg-gray-100', 'text-gray-700');
        button.classList.add('bg-blue-100', 'text-blue-700');
    }
}

function updateChartTimePeriod(period) {
    showStatus(`Showing trends for ${period}`, 'info', 2000);
    // Note: In a full app, you would fetch historical data here
    console.log(`Chart period changed to: ${period}`);
}

// Update Charts with Real Data
function updateCharts(data) {
    console.log("📈 Updating charts with data...", data);
    
    if (!data || !data.keywords || !data.posts) {
        console.warn("No data to update charts");
        return;
    }
    
    // Update trend chart with post counts over time
    chartDataHistory.push({
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        count: data.posts.length
    });
    
    // Keep only last 5 data points
    if (chartDataHistory.length > 5) {
        chartDataHistory.shift();
    }
    
    if (trendChart) {
        trendChart.data.labels = chartDataHistory.map(d => d.timestamp);
        trendChart.data.datasets[0].data = chartDataHistory.map(d => d.count);
        trendChart.update('none'); // 'none' for performance
    }
    
    // Update engagement chart
    if (engagementChart && data.posts.length > 0) {
        let high = 0, medium = 0, low = 0;
        
        data.posts.forEach(post => {
            const engagement = post.engagement || 0;
            if (engagement > 100) high++;
            else if (engagement > 50) medium++;
            else low++;
        });
        
        // Ensure we have some data
        if (high + medium + low > 0) {
            engagementChart.data.datasets[0].data = [high, medium, low];
            engagementChart.update('none');
        }
    }
    
    // Update keyword cloud
    updateKeywordCloud(data.keywords);
    
    // Update chart timestamp
    const chartUpdated = document.getElementById('chart-updated');
    if (chartUpdated) {
        chartUpdated.textContent = 'Updated: ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

// Create Keyword Cloud
function updateKeywordCloud(keywords) {
    const wordCloud = document.getElementById('wordCloud');
    if (!wordCloud) {
        console.warn("Word cloud element not found");
        return;
    }
    
    wordCloud.innerHTML = '';
    
    if (!keywords || keywords.length === 0) {
        wordCloud.innerHTML = `
            <div class="text-center py-4 w-full">
                <i class="fas fa-search text-gray-400 text-xl"></i>
                <p class="text-gray-500 mt-2">No keywords yet</p>
            </div>
        `;
        return;
    }
    
    // Sort by count and get top 12
    const topKeywords = keywords
        .filter(k => k.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
    
    if (topKeywords.length === 0) {
        wordCloud.innerHTML = `
            <div class="text-center py-4 w-full">
                <i class="fas fa-cloud text-gray-400 text-xl"></i>
                <p class="text-gray-500 mt-2">Add keywords to see cloud</p>
            </div>
        `;
        return;
    }
    
    // Calculate size ranges
    const counts = topKeywords.map(k => k.count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    
    // Color palette
    const colors = [
        {bg: 'bg-blue-100', text: 'text-blue-800'},
        {bg: 'bg-green-100', text: 'text-green-800'},
        {bg: 'bg-purple-100', text: 'text-purple-800'},
        {bg: 'bg-pink-100', text: 'text-pink-800'},
        {bg: 'bg-yellow-100', text: 'text-yellow-800'},
        {bg: 'bg-indigo-100', text: 'text-indigo-800'}
    ];
    
    topKeywords.forEach(keyword => {
        // Calculate size based on frequency (16px to 36px)
        const size = 16 + ((keyword.count - minCount) / (maxCount - minCount || 1)) * 20;
        
        // Pick random color
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const keywordElement = document.createElement('div');
        keywordElement.className = `inline-flex items-center ${color.bg} ${color.text} rounded-full px-4 py-2 m-1 font-medium transition-all duration-300 hover:scale-105 hover:shadow-md cursor-pointer`;
        keywordElement.style.fontSize = `${size}px`;
        keywordElement.title = `${keyword.count} posts with "${keyword.keyword}"`;
        keywordElement.innerHTML = `
            <span class="font-semibold">${keyword.keyword}</span>
            <span class="text-xs ml-2 opacity-75 bg-white bg-opacity-30 rounded-full px-2 py-1">
                ${keyword.count}
            </span>
        `;
        
        keywordElement.addEventListener('click', () => {
            searchKeyword(keyword.keyword);
            showStatus(`Searching for "${keyword.keyword}"`, 'info', 2000);
        });
        
        wordCloud.appendChild(keywordElement);
    });
    
    // Update keyword count
    const keywordCountChart = document.getElementById('keyword-count-chart');
    if (keywordCountChart) {
        keywordCountChart.textContent = keywords.filter(k => k.count > 0).length;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 AI Dashboard initializing...");
    
    updateKeywordsDisplay();
    setupEventListeners();
    initializeCharts();
    startAutoRefresh();
    
    // Request initial data
    socket.emit('request_update');
});

// Socket.io Events
socket.on('connect', () => {
    updateConnectionStatus(true);
    showStatus('Connected to server', 'success');
});

socket.on('disconnect', () => {
    updateConnectionStatus(false);
    showStatus('Disconnected from server', 'error');
});

socket.on('connected', (data) => {
    console.log('Server message:', data.message);
});

socket.on('data_update', (data) => {
    console.log('📥 Received data update:', data);
    
    trends = data.keywords || [];
    posts = data.posts || [];
    
    updateLastUpdated(data.last_updated);
    updateTrendingList();
    updatePostsList();
    updateStats();
    updateCharts(data); // Update charts with new data
    
    // Calculate update speed
    const now = new Date();
    const updatedTime = new Date(data.last_updated);
    const speed = Math.round((now - updatedTime) / 1000);
    if (updateSpeed) {
        updateSpeed.textContent = speed + 's ago';
    }
});

socket.on('update_status', (data) => {
    console.log('Update status:', data);
    
    if (data.status === 'updating') {
        showStatus(data.message, 'info');
    } else if (data.status === 'complete') {
        showStatus(data.message, 'success', 3000);
    } else if (data.status === 'error') {
        showStatus(data.message, 'error', 5000);
    }
});

// Event Listeners
function setupEventListeners() {
    // Add keyword
    addKeywordBtn.addEventListener('click', addKeyword);
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addKeyword();
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt refresh-spin mr-2"></i>Refreshing...';
        refreshBtn.disabled = true;
        
        socket.emit('request_update');
        
        setTimeout(() => {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh Now';
            refreshBtn.disabled = false;
        }, 3000);
    });
    
    // Dismiss status
    dismissStatus.addEventListener('click', () => {
        statusBar.classList.add('hidden');
    });
    
    // Auto-refresh toggle
    autoRefreshToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoRefresh();
            showStatus('Auto-refresh enabled (every 5 minutes)', 'success', 2000);
        } else {
            stopAutoRefresh();
            showStatus('Auto-refresh disabled', 'info', 2000);
        }
    });
    
    // Sort posts
    sortBySelect.addEventListener('change', updatePostsList);
}

// Keyword Management
function addKeyword() {
    const keyword = keywordInput.value.trim();
    
    if (keyword && !activeKeywordsList.has(keyword)) {
        activeKeywordsList.add(keyword);
        updateKeywordsDisplay();
        
        // Search for this keyword
        searchKeyword(keyword);
        
        keywordInput.value = '';
        showStatus(`Added keyword: ${keyword}`, 'success', 2000);
    }
}

function removeKeyword(keyword) {
    activeKeywordsList.delete(keyword);
    updateKeywordsDisplay();
    showStatus(`Removed keyword: ${keyword}`, 'info', 2000);
}

function updateKeywordsDisplay() {
    keywordsContainer.innerHTML = '';
    
    activeKeywordsList.forEach(keyword => {
        const keywordElement = document.createElement('div');
        keywordElement.className = 'flex items-center bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm';
        keywordElement.innerHTML = `
            ${keyword}
            <button onclick="removeKeyword('${keyword}')" class="ml-2 text-purple-600 hover:text-purple-800">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
        keywordsContainer.appendChild(keywordElement);
    });
    
    keywordCount.textContent = activeKeywordsList.size;
    if (activeKeywords) {
        activeKeywords.textContent = activeKeywordsList.size;
    }
}

// Search for specific keyword
function searchKeyword(keyword) {
    fetch('/api/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword: keyword })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Add new posts to existing ones (avoid duplicates)
            const newPosts = data.posts.filter(newPost => 
                !posts.some(existingPost => existingPost.id === newPost.id)
            );
            
            posts = [...posts, ...newPosts];
            updatePostsList();
            updateStats();
            
            showStatus(`Found ${data.count} posts for "${keyword}"`, 'success', 3000);
        }
    })
    .catch(error => {
        console.error('Search error:', error);
        showStatus('Search failed', 'error');
    });
}

// Update UI Functions
function updateTrendingList() {
    if (!trendingList) return;
    
    if (trends.length === 0) {
        trendingList.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-search text-gray-400 text-xl"></i>
                <p class="text-gray-500 mt-2">No trends yet</p>
            </div>
        `;
        return;
    }
    
    trendingList.innerHTML = trends.map((trend, index) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div class="flex items-center">
                <span class="text-lg mr-3">${trend.trend || '📊'}</span>
                <div>
                    <h4 class="font-semibold text-gray-800">${trend.keyword}</h4>
                    <p class="text-xs text-gray-500">${trend.count} posts • ${trend.engagement || 0} engagement</p>
                </div>
            </div>
            <span class="bg-${index < 3 ? 'red' : 'purple'}-100 text-${index < 3 ? 'red' : 'purple'}-800 text-xs font-bold px-2 py-1 rounded">
                #${index + 1}
            </span>
        </div>
    `).join('');
}

function updatePostsList() {
    if (!postsContainer) return;
    
    if (posts.length === 0) {
        postsContainer.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-newspaper text-gray-400 text-3xl"></i>
                <p class="text-gray-600 mt-4">No posts found. Try adding more keywords.</p>
            </div>
        `;
        return;
    }
    
    // Sort posts
    let sortedPosts = [...posts];
    const sortBy = sortBySelect ? sortBySelect.value : 'engagement';
    
    if (sortBy === 'engagement') {
        sortedPosts.sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
    } else if (sortBy === 'recent') {
        sortedPosts.sort((a, b) => new Date(b.created) - new Date(a.created));
    } else if (sortBy === 'upvotes') {
        sortedPosts.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    }
    
    postsContainer.innerHTML = sortedPosts.map(post => `
        <div class="bg-white rounded-xl shadow-lg p-6 card-hover transition">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <div class="flex items-center space-x-2 mb-2">
                        <span class="bg-${getKeywordColor(post.keyword_matched)}-100 text-${getKeywordColor(post.keyword_matched)}-800 text-xs font-semibold px-2 py-1 rounded">
                            ${post.keyword_matched || 'AI'}
                        </span>
                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                            r/${post.subreddit || 'artificial'}
                        </span>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-800">${post.title || 'No title'}</h3>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-gray-800">${(post.engagement || 0).toFixed(0)}</div>
                    <div class="text-xs text-gray-500">engagement</div>
                </div>
            </div>
            
            <div class="flex justify-between items-center mt-6">
                <div class="flex items-center space-x-4 text-sm text-gray-600">
                    <span class="flex items-center">
                        <i class="fas fa-thumbs-up mr-1 text-green-500"></i>
                        ${post.upvotes || 0} upvotes
                    </span>
                    <span class="flex items-center">
                        <i class="fas fa-comment mr-1 text-blue-500"></i>
                        ${post.comments || 0} comments
                    </span>
                    <span class="flex items-center">
                        <i class="fas fa-clock mr-1 text-purple-500"></i>
                        ${post.created || 'Recent'}
                    </span>
                </div>
                <a href="${post.url || '#'}" target="_blank" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center">
                    <i class="fab fa-reddit-alien mr-2"></i>
                    View on Reddit
                </a>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    if (totalPosts) totalPosts.textContent = posts.length;
    if (activeKeywords) activeKeywords.textContent = activeKeywordsList.size;
    
    if (posts.length > 0 && avgEngagement) {
        const totalEngagement = posts.reduce((sum, post) => sum + (post.engagement || 0), 0);
        const averageEngagement = totalEngagement / posts.length;
        avgEngagement.textContent = averageEngagement.toFixed(1);
    } else if (avgEngagement) {
        avgEngagement.textContent = '0';
    }
}

function updateLastUpdated(timestamp) {
    if (lastUpdated) {
        lastUpdated.textContent = timestamp ? `Updated: ${timestamp}` : 'Never updated';
    }
}

function updateConnectionStatus(connected) {
    if (!connectionStatus) return;
    
    const dot = connectionStatus.querySelector('.w-3.h-3');
    const text = connectionStatus.querySelector('span');
    
    if (connected) {
        dot.className = 'w-3 h-3 bg-green-500 rounded-full';
        if (text) text.textContent = 'Connected';
    } else {
        dot.className = 'w-3 h-3 bg-red-500 rounded-full';
        if (text) text.textContent = 'Disconnected';
    }
}

// Status Messages
function showStatus(message, type = 'info', timeout = null) {
    if (!statusMessage || !statusDetail || !statusBar) return;
    
    statusMessage.textContent = message;
    statusDetail.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Update colors based on type
    statusBar.className = 'mt-8 p-4 rounded-lg';
    if (type === 'success') {
        statusBar.classList.add('bg-green-50', 'border-green-200');
        statusMessage.classList.add('text-green-800');
    } else if (type === 'error') {
        statusBar.classList.add('bg-red-50', 'border-red-200');
        statusMessage.classList.add('text-red-800');
    } else {
        statusBar.classList.add('bg-blue-50', 'border-blue-200');
        statusMessage.classList.add('text-blue-800');
    }
    
    statusBar.classList.remove('hidden');
    
    if (timeout) {
        setTimeout(() => {
            statusBar.classList.add('hidden');
        }, timeout);
    }
}

// Auto-refresh
function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing interval
    autoRefreshInterval = setInterval(() => {
        socket.emit('request_update');
        showStatus('Auto-refresh: Fetching new data...', 'info', 2000);
    }, 5 * 60 * 1000); // 5 minutes
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Helper function for keyword colors
function getKeywordColor(keyword) {
    if (!keyword) return 'gray';
    
    const colors = ['purple', 'blue', 'green', 'yellow', 'red', 'indigo', 'pink'];
    const index = keyword.charCodeAt(0) % colors.length;
    return colors[index];
}

// Manual refresh via API
function manualRefresh() {
    fetch('/api/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords: Array.from(activeKeywordsList) })
    })
    .then(response => response.json())
    .then(data => {
        showStatus(data.message, data.status === 'success' ? 'success' : 'error');
    });
}