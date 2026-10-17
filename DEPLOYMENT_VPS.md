# VPS deployment

Use the complete [PM2/Nginx deployment guide](../backend/DEPLOYMENT_VPS.md), kept with the backend's Nginx configurations.

The frontend runs on `127.0.0.1:4051` using `ecosystem.config.js`. Copy `.env.production.example` to `.env.production.local` before `npm ci` / `npm run build`. The build validates public backend URLs.

```dotenv
NEXT_PUBLIC_API_URL=https://backend.neximet.com/api
NEXT_PUBLIC_BASE_URL=https://backend.neximet.com
```

`portal.neximet.com` serves the portal on port 4051; `www.portal.neximet.com` redirects to it over HTTPS. Both backend names serve the API on port 4052 through Nginx. Keep Node ports private and use `deploy.sh` in `/var/www/neximet` for automated deployment.
