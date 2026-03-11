# TLS Configuration

## Overview

The BodyTrace backend supports TLS 1.2+ for secure data transmission, as required by **Requirement 9.2**.

## Configuration

### Environment Variables

- `USE_TLS`: Set to `"true"` to enable TLS/HTTPS mode
- `TLS_KEY_PATH`: Path to the private key file (default: `./certs/key.pem`)
- `TLS_CERT_PATH`: Path to the certificate file (default: `./certs/cert.pem`)
- `PORT`: Server port (default: `3001`)

### Development Setup

For local development with TLS:

1. Generate self-signed certificates:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes
```

2. Start the server with TLS enabled:

```bash
USE_TLS=true npm run dev
```

### Production Setup

In production:

1. Obtain valid TLS certificates from a Certificate Authority (e.g., Let's Encrypt)
2. Store certificates securely (e.g., AWS Secrets Manager, HashiCorp Vault)
3. Set environment variables to point to certificate locations:

```bash
export USE_TLS=true
export TLS_KEY_PATH=/path/to/private/key.pem
export TLS_CERT_PATH=/path/to/certificate.pem
export PORT=443
```

4. Start the server:

```bash
npm start
```

## TLS Version

The server is configured to use **TLS 1.2 or higher** as the minimum version, ensuring:

- Strong encryption for data in transit
- Protection against known vulnerabilities in older TLS versions
- Compliance with modern security standards

## Testing TLS

To verify TLS configuration:

```bash
# Check TLS version support
openssl s_client -connect localhost:3001 -tls1_2

# Verify certificate
openssl s_client -connect localhost:3001 -showcerts
```

## Fallback Behavior

If `USE_TLS=true` but certificates are not found:
- The server logs a warning
- Falls back to HTTP mode
- This prevents startup failures in development environments

In production, ensure certificates are always available before enabling TLS.

## Security Notes

1. **Never commit certificates to version control**
2. Use strong key sizes (minimum 2048-bit RSA, preferably 4096-bit)
3. Regularly rotate certificates before expiration
4. Monitor certificate expiration dates
5. Use certificate pinning for mobile clients if applicable
6. Consider using a reverse proxy (nginx, HAProxy) for TLS termination in production

## Related Requirements

- **Requirement 9.2**: Encrypt all data in transit using TLS 1.2 or higher
- **Requirement 9.3**: Require user authentication before granting access to any Body Map or Pain Session data
