# ShambaCare Kenya - Smart Farming Assistant

AI-powered crop disease diagnosis for Kenyan farmers.

## Project Structure

```
shamba-care/
ÃÄÄ frontend/           # Static HTML/CSS/JS files
ÃÄÄ backend-api/        # Node.js + Express API (deployed to Vercel)
³   ÃÄÄ api/           # Serverless functions
³   ÀÄÄ vercel.json    # Vercel configuration
ÃÄÄ python-ai/         # Python Flask/TensorFlow AI (deployed to Render)
³   ÃÄÄ app_tf.py      # Main AI application
³   ÀÄÄ requirements.txt
ÀÄÄ README.md
```

## Deployment

### Prerequisites
- GitHub repository with this code
- Vercel account
- Render account
- Neon PostgreSQL database

## Local Development

1. Start Node.js backend: `cd backend-api && npm run dev`
2. Start Python AI: `cd python-ai && python app_tf.py`
3. Open frontend: Open `frontend/index.html` in browser
