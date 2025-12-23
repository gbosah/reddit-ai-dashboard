# simple_app.py
from flask import Flask, render_template, request, jsonify
import requests
import json
from datetime import datetime
import time

app = Flask(__name__)

DEFAULT_KEYWORDS = ["AI", "ChatGPT", "Machine Learning", "OpenAI"]

def get_reddit_data(keywords):
    """Simple Reddit data fetcher"""
    posts = []
    
    try:
        # Get from r/artificial
        url = "https://www.reddit.com/r/artificial/hot.json?limit=15"
        headers = {'User-Agent': 'AI-Dashboard/1.0'}
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            for post in data['data']['children'][:10]:
                post_data = post['data']
                posts.append({
                    'title': post_data['title'],
                    'upvotes': post_data['ups'],
                    'comments': post_data['num_comments'],
                    'url': f"https://reddit.com{post_data['permalink']}",
                    'created': datetime.fromtimestamp(post_data['created_utc']).strftime('%H:%M')
                })
    
    except Exception as e:
        print(f"Error: {e}")
    
    return posts

@app.route('/')
def index():
    posts = get_reddit_data(DEFAULT_KEYWORDS)
    return render_template('simple_index.html', posts=posts, keywords=DEFAULT_KEYWORDS)

@app.route('/api/data')
def api_data():
    posts = get_reddit_data(DEFAULT_KEYWORDS)
    return jsonify({
        'posts': posts,
        'count': len(posts),
        'updated': datetime.now().strftime('%H:%M:%S')
    })

if __name__ == '__main__':
    print("Starting simple Flask app on http://localhost:5000")
    app.run(debug=True, port=5000)