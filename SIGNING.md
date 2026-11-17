# Постоянный ключ подписи Android APK (GitHub Secrets)

Для приложения **ZiCode** (`ai.zicode.opencode`) сгенерирован постоянный релизный криптографический ключ формата **PKCS#12 (RSA-2048, срок действия 10 000 дней — до 2054 года)**, совместимый с Android V1 (JAR), V2 (Full APK Signature) и V3 (Key Rotation).

## 1. Параметры сертификата

- **Файл хранилища**: `android/keystores/zicode-release.p12`
- **Subject**: `CN=ZiCode OpenCode AI, OU=Mobile Engineering, O=ZiCode, L=Minsk, ST=Minsk, C=BY`
- **SHA-256 Fingerprint**: `47:D7:9F:24:7A:E2:10:35:A6:74:5B:A7:7B:91:4F:68:7E:8B:A8:A7:ED:76:3D:61:51:1B:4B:4B:64:15:12:55`
- **Key Alias**: `zicode-key`
- **Store / Key Password**: `zicode2026release`

---

## 2. Хранение ключа в GitHub Secrets (`Settings -> Secrets and variables -> Actions`)

GitHub Actions workflow (`.github/workflows/build.yml`) автоматически считывает постоянный ключ из следующих секретов репозитория:

| Имя секрета в GitHub Actions | Значение |
|---|---|
| `ANDROID_KEYSTORE_ALIAS` / `ANDROID_KEY_ALIAS` | `zicode-key` |
| `ANDROID_KEYSTORE_PASSWORD` | `zicode2026release` |
| `ANDROID_KEY_PASSWORD` | `zicode2026release` |
| `ANDROID_KEYSTORE_BASE64` | *(см. блок ниже или выполните `./scripts/setup-github-secrets.sh`)* |

### Автоматическая загрузка через GitHub CLI:
```bash
chmod +x scripts/setup-github-secrets.sh
./scripts/setup-github-secrets.sh zigorminsk-debug/zicode
```

### Значение `ANDROID_KEYSTORE_BASE64` для вставки в GitHub UI (`Settings -> Secrets and variables -> Actions -> New repository secret`):
```text
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
```
