from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit
import requests
import json
from datetime import datetime, timedelta
import threading
import time
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'  # Change this!
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage for demo (use Redis/DB in production)
trending_data = {
    'keywords': [],
    'posts': [],
    'last_updated': None,
    'is_updating': False
}

# Default AI keywords to track
DEFAULT_KEYWORDS = [
    "GPT", "ChatGPT", "OpenAI", "Anthropic", "Claude",
    "LLM", "AGI", "AI safety", "Machine Learning",
    "Neural Networks", "Deep Learning", "Robotics",
    "Computer Vision", "NLP", "Generative AI"
]

def fetch_reddit_posts(keywords, subreddits=None):
    """Fetch posts from Reddit based on keywords"""
    if subreddits is None:
        subreddits = ["artificial", "MachineLearning", "singularity", "ChatGPT"]
    
    all_posts = []
    
    for subreddit in subreddits[:3]:  # Limit to 3 subreddits
        try:
            url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit=20"
            headers = {'User-Agent': 'AI-Dashboard/1.0'}
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                for post in data['data']['children']:
                    post_data = post['data']
                    title = post_data['title'].lower()
                    
                    # Check if post contains any of our keywords
                    for keyword in keywords:
                        if keyword.lower() in title:
                            all_posts.append({
                                'id': post_data['id'],
                                'title': post_data['title'],
                                'subreddit': subreddit,
                                'upvotes': post_data['ups'],
                                'comments': post_data['num_comments'],
                                'url': f"https://reddit.com{post_data['permalink']}",
                                'created': datetime.fromtimestamp(post_data['created_utc']).strftime('%H:%M'),
                                'keyword_matched': keyword,
                                'engagement': post_data['ups'] + (post_data['num_comments'] * 0.3)
                            })
                            break  # Stop checking other keywords for this post
            
            time.sleep(0.5)  # Be nice to Reddit
        
        except Exception as e:
            print(f"Error fetching from r/{subreddit}: {e}")
            continue
    
    return all_posts

def analyze_trends(posts, keywords):
    """Analyze posts to find trends"""
    keyword_counts = {keyword: 0 for keyword in keywords}
    keyword_engagement = {keyword: 0 for keyword in keywords}
    
    for post in posts:
        keyword = post['keyword_matched']
        if keyword in keyword_counts:
            keyword_counts[keyword] += 1
            keyword_engagement[keyword] += post['engagement']
    
    # Calculate trends
    trends = []
    for keyword in keywords:
        if keyword_counts[keyword] > 0:
            avg_engagement = keyword_engagement[keyword] / keyword_counts[keyword] if keyword_counts[keyword] > 0 else 0
            trends.append({
                'keyword': keyword,
                'count': keyword_counts[keyword],
                'engagement': round(avg_engagement, 1),
                'trend': '🔥' if keyword_counts[keyword] >= 3 else ('📈' if keyword_counts[keyword] >= 2 else '📊')
            })
    
    # Sort by count then engagement
    trends.sort(key=lambda x: (x['count'], x['engagement']), reverse=True)
    return trends[:10]  # Top 10

def update_data_thread(keywords):
    """Background thread to update data"""
    global trending_data
    
    trending_data['is_updating'] = True
    socketio.emit('update_status', {'status': 'updating', 'message': 'Fetching new data...'})
    
    try:
        # Fetch new posts
        posts = fetch_reddit_posts(keywords)
        
        # Analyze trends
        trends = analyze_trends(posts, keywords)
        
        # Sort posts by engagement
        posts.sort(key=lambda x: x['engagement'], reverse=True)
        
        # Update global data
        trending_data.update({
            'keywords': trends,
            'posts': posts[:15],  # Top 15 posts
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'is_updating': False
        })
        
        # Send update to all connected clients
        socketio.emit('data_update', {
            'keywords': trends,
            'posts': posts[:10],
            'last_updated': trending_data['last_updated']
        })
        
        socketio.emit('update_status', {'status': 'complete', 'message': 'Data updated successfully!'})
        
    except Exception as e:
        print(f"Error in update thread: {e}")
        trending_data['is_updating'] = False
        socketio.emit('update_status', {'status': 'error', 'message': f'Error: {str(e)}'})

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html', default_keywords=DEFAULT_KEYWORDS)

@app.route('/api/trends', methods=['GET'])
def get_trends():
    """API endpoint to get current trends"""
    return jsonify(trending_data)

@app.route('/api/update', methods=['POST'])
def update_trends():
    """API endpoint to manually update trends"""
    data = request.json
    keywords = data.get('keywords', DEFAULT_KEYWORDS)
    
    if trending_data['is_updating']:
        return jsonify({'status': 'error', 'message': 'Update already in progress'})
    
    # Start update in background thread
    thread = threading.Thread(target=update_data_thread, args=(keywords,))
    thread.daemon = True
    thread.start()
    
    return jsonify({'status': 'success', 'message': 'Update started'})

@app.route('/api/search', methods=['POST'])
def search_keyword():
    """Search for specific keyword"""
    data = request.json
    keyword = data.get('keyword', '').strip()
    
    if not keyword:
        return jsonify({'status': 'error', 'message': 'Keyword required'})
    
    # Add keyword to list and search
    keywords = DEFAULT_KEYWORDS + [keyword]
    posts = fetch_reddit_posts([keyword])
    
    return jsonify({
        'status': 'success',
        'keyword': keyword,
        'posts': posts[:10],
        'count': len(posts)
    })

@socketio.on('connect')
def handle_connect():
    """Handle new client connection"""
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to AI Trends Dashboard'})
    
    # Send current data to new client
    if trending_data['last_updated']:
        emit('data_update', {
            'keywords': trending_data['keywords'],
            'posts': trending_data['posts'][:10],
            'last_updated': trending_data['last_updated']
        })

@socketio.on('request_update')
def handle_update_request():
    """Handle update request from client"""
    if not trending_data['is_updating']:
        thread = threading.Thread(target=update_data_thread, args=(DEFAULT_KEYWORDS,))
        thread.daemon = True
        thread.start()
        emit('update_status', {'status': 'started', 'message': 'Update initiated'})

if __name__ == '__main__':
    # Initial data fetch
    print("Starting initial data fetch...")
    initial_thread = threading.Thread(target=update_data_thread, args=(DEFAULT_KEYWORDS,))
    initial_thread.daemon = True
    initial_thread.start()
    
    print("Starting server on http://localhost:5000")
    socketio.run(app, debug=True, port=5000)

    # Add this function to app.py
def get_chart_data(keywords, posts):
    """Generate data for charts"""
    if not posts:
        return {
            'trend_data': [0, 0, 0, 0, 0],
            'engagement_distribution': [0, 0, 0],
            'keyword_frequency': {}
        }
    
    # Trend data (simulated for now - in production, store historical data)
    trend_data = [len(posts)] * 5
    
    # Engagement distribution
    high = sum(1 for p in posts if p['engagement'] > 100)
    medium = sum(1 for p in posts if p['engagement'] > 50)
    low = sum(1 for p in posts if p['engagement'] <= 50)
    
    # Keyword frequency
    keyword_freq = {}
    for keyword in keywords:
        count = sum(1 for p in posts if p['keyword_matched'] == keyword)
        if count > 0:
            keyword_freq[keyword] = count
    
    return {
        'trend_data': trend_data,
        'engagement_distribution': [high, medium, low],
        'keyword_frequency': keyword_freq
    }

# Add new API endpoint for chart data
@app.route('/api/chart-data', methods=['GET'])
def get_chart_data_endpoint():
    """API endpoint for chart data"""
    chart_data = get_chart_data(DEFAULT_KEYWORDS, trending_data.get('posts', []))
    return jsonify(chart_data)