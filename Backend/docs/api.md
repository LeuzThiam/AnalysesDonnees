# API – AnalyseDesDonnees

Base path: `/api/`

## Commun

### GET `/api/common/health`
- **200**: `{"status":"ok","service":"django"}`

### GET `/api/common/ping`
- **200**: `{"pong": true}`

### GET `/api/common/info`
- **200**: infos non sensibles d’environnement (debug, apps)

---

## Auth (Users)

Base path: `/api/auth/`

### POST `/api/auth/register/`
Créer un utilisateur.
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "StrongPassw0rd!",
  "first_name": "Alice",
  "last_name": "Doe"
}
