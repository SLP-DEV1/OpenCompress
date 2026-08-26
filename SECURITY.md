# Security Policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please do not publish exploit details, private images, tokens or other sensitive data in a public issue.

If the repository has GitHub private vulnerability reporting enabled, use **Security → Report a vulnerability**. Otherwise, open a minimal public issue that only says a security report needs a private contact channel; do not include exploit details until a private channel is established.

Useful information includes:

- Affected version or commit
- Operating system and Node.js version
- Exact reproduction steps
- Expected versus actual behavior
- Security impact
- A minimal proof of concept that does not contain private data

## Security model

OpenCompress is designed as a local application and binds to `127.0.0.1` by default.

Local only and Auto Best local modes do not intentionally upload images to third-party services. reSmush.it and Auto Compare are explicit external modes and send selected files to reSmush.it.

Changing `OPENCOMPRESS_HOST` to a non-loopback address can expose the local API to other devices on the network. Do not do this on untrusted networks unless you add appropriate network controls.

Temporary job files are stored under `.opencompress/` and removed after the configured job TTL.
