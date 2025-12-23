"""
AI Trends Dashboard - Railway Deploy Ready
"""
import os
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import requests
import json
from datetime import datetime
import time
import sys
import eventlet

# Use eventlet for better WebSocket support
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-123')

# Configure SocketIO for Railway
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='eventlet',
                   logger=True,
                   engineio_logger=False)

# In-memory storage
dashboard_data = {
    'keywords': ['GPT', 'ChatGPT', 'OpenAI', 'AI', 'Machine Learning'],
    'posts': [],
    'trends': [],
    'last_updated': None,
    'is_updating': False
}

def fetch_reddit_safe(subreddit="artificial", limit=15):
    """Safe Reddit API fetch with error handling"""
    try:
        url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}"
        headers = {'User-Agent': 'Railway-AI-Dashboard/1.0'}
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Reddit API error: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Fetch error: {e}")
        return None

def process_posts(reddit_data, keywords):
    """Process Reddit data"""
    if not reddit_data or 'data' not in reddit_data:
        return []
    
    posts = []
    
    for item in reddit_data['data']['children'][:12]:
        post = item['data']
        
        # Find matching keyword
        matched_keyword = 'AI'
        title_lower = post['title'].lower()
        
        for keyword in keywords:
            if keyword.lower() in title_lower:
                matched_keyword = keyword
                break
        
        posts.append({
            'id': post['id'],
            'title': post['title'],
            'subreddit': post.get('subreddit', 'artificial'),
            'upvotes': post.get('ups', 0),
            'comments': post.get('num_comments', 0),
            'url': f"https://reddit.com{post.get('permalink', '')}",
            'created': datetime.fromtimestamp(post.get('created_utc', time.time())).strftime('%H:%M'),
            'keyword_matched': matched_keyword,
            'engagement': post.get('ups', 0) + (post.get('num_comments', 0) * 0.3)
        })
    
    return posts

def analyze_trends(posts, keywords):
    """Analyze trends from posts"""
    if not posts:
        return []
    
    keyword_counts = {}
    for post in posts:
        keyword = post['keyword_matched']
        keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1
    
    trends = []
    for keyword, count in keyword_counts.items():
        if count > 0:
            trends.append({
                'keyword': keyword,
                'count': count,
                'trend': '🔥' if count >= 3 else ('📈' if count >= 2 else '📊')
            })
    
    trends.sort(key=lambda x: x['count'], reverse=True)
    return trends[:8]

def update_data():
    """Update dashboard data"""
    if dashboard_data['is_updating']:
        return False
    
    dashboard_data['is_updating'] = True
    
    try:
        # Fetch from Reddit
        reddit_data = fetch_reddit_safe()
        
        if reddit_data:
            # Process data
            posts = process_posts(reddit_data, dashboard_data['keywords'])
            trends = analyze_trends(posts, dashboard_data['keywords'])
            
            # Update dashboard
            dashboard_data['posts'] = posts
            dashboard_data['trends'] = trends
            dashboard_data['last_updated'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Notify WebSocket clients
            socketio.emit('data_update', {
                'keywords': trends,
                'posts': posts[:10],
                'last_updated': dashboard_data['last_updated']
            })
            
            print(f"✅ Updated: {len(posts)} posts, {len(trends)} trends")
            return True
        return False
        
    except Exception as e:
        print(f"❌ Update error: {e}")
        return False
    finally:
        dashboard_data['is_updating'] = False

# ========== ROUTES ==========

@app.route('/')
def index():
    """Main page"""
    if not dashboard_data['posts']:
        update_data()
    
    return render_template('index.html',
                         default_keywords=dashboard_data['keywords'],
                         last_updated=dashboard_data['last_updated'])

@app.route('/api/data')
def get_data():
    """API endpoint for data"""
    return jsonify({
        'success': True,
        'data': {
            'keywords': dashboard_data['trends'],
            'posts': dashboard_data['posts'][:10],
            'last_updated': dashboard_data['last_updated'],
            'stats': {
                'total_posts': len(dashboard_data['posts']),
                'total_keywords': len(dashboard_data['keywords'])
            }
        }
    })

@app.route('/api/update', methods=['GET', 'POST'])
def update_endpoint():
    """Trigger update"""
    success = update_data()
    
    return jsonify({
        'success': success,
        'message': 'Updated' if success else 'Failed',
        'last_updated': dashboard_data['last_updated']
    })

@app.route('/api/health')
def health():
    """Health check"""
    return jsonify({
        'status': 'ok',
        'service': 'AI Trends Dashboard',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

# ========== SOCKET.IO EVENTS ==========

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to AI Dashboard'})
    
    # Send current data
    if dashboard_data['last_updated']:
        emit('data_update', {
            'keywords': dashboard_data['trends'],
            'posts': dashboard_data['posts'][:10],
            'last_updated': dashboard_data['last_updated']
        })

@socketio.on('request_update')
def handle_update():
    """Handle update request"""
    if not dashboard_data['is_updating']:
        emit('update_status', {'status': 'updating', 'message': 'Fetching data...'})
        update_data()
        emit('update_status', {'status': 'complete', 'message': 'Data updated!'})

# ========== INITIALIZATION ==========

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    print("=" * 50)
    print("🤖 AI Trends Dashboard - Railway Ready")
    print("=" * 50)
    print(f"Port: {port}")
    print(f"Python: {sys.version.split()[0]}")
    
    # Initial data fetch
    print("Fetching initial data...")
    update_data()
    
    print(f"\n🚀 Server starting on port {port}")
    print("👉 Open your browser to the Railway URL")
    
    # Use socketio.run instead of app.run for WebSockets
    socketio.run(app, 
                 host='0.0.0.0', 
                 port=port,
                 debug=False,
                 allow_unsafe_werkzeug=True)
