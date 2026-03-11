# Deployment Guide

This guide covers deploying BodyTrace to production environments.

## Prerequisites

- Node.js 18+ runtime environment
- PostgreSQL 14+ database
- Valid TLS/SSL certificates
- Domain name (for production)

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=bodytrace
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_POOL_MAX=20

# Server
PORT=3000
NODE_ENV=production

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
JWT_SECRET=your-jwt-secret-key

# TLS (if using HTTPS directly in Node)
TLS_CERT_PATH=/path/to/cert.pem
TLS_KEY_PATH=/path/to/key.pem
```

### Frontend Environment Variables

Create a `.env.production` file in the `frontend/` directory:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_ENV=production
```

## Database Setup

1. Create the production database:
```bash
createdb bodytrace
```

2. Run migrations:
```bash
cd backend
psql -U your-db-user -d bodytrace -f src/db/migrations/001_initial_schema.sql
```

3. Verify tables were created:
```bash
psql -U your-db-user -d bodytrace -c "\dt"
```

## Build Process

### Backend

```bash
cd backend
npm install --production
npm run build
```

This creates a `dist/` directory with compiled JavaScript.

### Frontend

```bash
cd frontend
npm install --production
npm run build
```

This creates a `dist/` directory with optimized static assets.

## Deployment Options

### Option 1: Traditional Server (VPS/Dedicated)

1. Install Node.js and PostgreSQL on server
2. Clone repository
3. Set up environment variables
4. Build applications
5. Use PM2 or systemd to run backend
6. Serve frontend with Nginx

#### Nginx Configuration

```nginx
# Frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /path/to/bodytrace/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### PM2 Configuration

```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start dist/index.js --name bodytrace-api

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### Option 2: Docker

Create `Dockerfile` for backend:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: bodytrace
      POSTGRES_USER: bodytrace
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: bodytrace
      DB_USER: bodytrace
      DB_PASSWORD: ${DB_PASSWORD}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres-data:
```

### Option 3: Cloud Platforms

#### Heroku

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create bodytrace-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set ENCRYPTION_KEY=your-key
heroku config:set JWT_SECRET=your-secret

# Deploy
git push heroku main
```

#### AWS / Azure / GCP

- Use managed PostgreSQL (RDS, Azure Database, Cloud SQL)
- Deploy backend to App Service / Elastic Beanstalk / App Engine
- Deploy frontend to S3+CloudFront / Azure Static Web Apps / Cloud Storage+CDN

## Post-Deployment

### 1. Run Database Migrations

```bash
# SSH into server
ssh user@your-server

# Run migrations
cd /path/to/bodytrace/backend
node dist/db/run-migration.js
```

### 2. Verify Deployment

```bash
# Check backend health
curl https://api.yourdomain.com/health

# Check frontend
curl https://yourdomain.com
```

### 3. Set Up Monitoring

- Application monitoring (New Relic, Datadog, etc.)
- Error tracking (Sentry, Rollbar, etc.)
- Uptime monitoring (Pingdom, UptimeRobot, etc.)
- Log aggregation (Papertrail, Loggly, etc.)

### 4. Configure Backups

```bash
# PostgreSQL backup script
pg_dump -U bodytrace -d bodytrace > backup-$(date +%Y%m%d).sql

# Set up cron job for daily backups
0 2 * * * /path/to/backup-script.sh
```

### 5. Security Hardening

- Enable firewall (only allow necessary ports)
- Set up fail2ban for SSH protection
- Configure rate limiting
- Enable CORS for specific domains only
- Regular security updates

## Scaling Considerations

### Database
- Connection pooling (already configured)
- Read replicas for read-heavy workloads
- Database indexing optimization

### Backend
- Horizontal scaling with load balancer
- Caching layer (Redis) for frequently accessed data
- CDN for static assets

### Frontend
- CDN distribution
- Asset optimization
- Code splitting

## Troubleshooting

### Backend won't start
- Check environment variables
- Verify database connection
- Check logs: `pm2 logs bodytrace-api`

### Database connection errors
- Verify PostgreSQL is running
- Check credentials
- Ensure database exists
- Check firewall rules

### Frontend can't reach backend
- Verify CORS configuration
- Check API URL in frontend env
- Verify backend is running
- Check network/firewall rules

## Rollback Procedure

1. Keep previous version tagged in git
2. If issues occur, redeploy previous version
3. Restore database backup if needed
4. Update DNS if necessary

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate credentials quarterly
- Database maintenance (VACUUM, ANALYZE)
- Review and archive old logs
- Monitor disk space and performance

### Updates
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Restart services
pm2 restart bodytrace-api
```

## Support

For deployment issues, consult:
- Application logs
- Database logs
- Web server logs (Nginx/Apache)
- System logs

For questions, open an issue on GitHub.
