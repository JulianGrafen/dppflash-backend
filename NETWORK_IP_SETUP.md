# Network IP Setup für DPP-Flash

## 🌐 App auf Network IP verfügbar machen

Die App läuft jetzt automatisch auf **0.0.0.0** statt nur auf localhost. Das bedeutet, sie ist über die Network IP von überall im Netzwerk erreichbar!

---

## 🚀 Starten

```bash
# Standard: Network IP (0.0.0.0:3000)
npm run dev

# Alternativ: Nur localhost
npm run dev:localhost
```

---

## 📍 Deine Network IP finden

### macOS / Linux
```bash
# IPv4-Adresse anzeigen
ifconfig | grep "inet " | grep -v 127.0.0.1

# Oder spezifischer (z.B. Wi-Fi):
ifconfig en0 | grep "inet " | awk '{print $2}'
```

**Beispiel Output:**
```
192.168.1.100
```

### Windows (PowerShell)
```powershell
ipconfig

# Suche nach "IPv4-Adresse" unter "Wireless LAN adapter" oder "Ethernet"
```

---

## 🔧 Environment-Variable konfigurieren

### 1. `.env.local` erstellen (oder editieren)

```bash
# Kopiere die Beispiel-Datei
cp .env.example .env.local
```

### 2. Die korrekte IP eintragen

Wenn deine Network IP `192.168.1.100` ist:

```bash
# .env.local
NEXT_PUBLIC_DPP_URL=http://192.168.1.100:3000
```

### 3. Speichern & Neustart

```bash
npm run dev
```

---

## 📱 Von anderen Geräten zugreifen

Wenn die App läuft und .env konfiguriert ist:

```
Browser: http://192.168.1.100:3000
```

### Dashboard öffnen:
```
http://192.168.1.100:3000/dashboard/create
```

### QR-Codes testen:
1. Produkt erstellen
2. QR-Code generieren
3. Mit Smartphone scannen
4. QR-Code zeigt auf: `http://192.168.1.100:3000/p/{productId}` ✅

---

## 🔐 Firewall

Falls die App nicht erreichbar ist:

### macOS
```bash
# Firewall-Dialog sollte beim Start erscheinen
# → "Allow" klicken
```

### Windows
```
Settings → Privacy & Security → Firewall → Allow app through firewall
→ Node.js hinzufügen
```

### Linux (UFW)
```bash
sudo ufw allow 3000
```

---

## 🧪 Test mit curl

```bash
# Von anderem Gerät im Netzwerk:
curl -s http://192.168.1.100:3000 | head -20
```

Sollte HTML zurückgeben ✅

---

## 📝 Cheat Sheet

| Befehl | Effekt |
|--------|--------|
| `npm run dev` | Läuft auf 0.0.0.0:3000 (Netzwerk) |
| `npm run dev:localhost` | Läuft nur auf localhost:3000 |
| `npm run start` | Production auf 0.0.0.0:3000 |
| `npm run start:localhost` | Production auf localhost:3000 |

---

## 🚨 Häufige Probleme

| Problem | Lösung |
|---------|--------|
| "Webpage not available" | 1. IP in `.env.local` korrekt? 2. Firewall? 3. Gleicher Netzwerk? |
| QR-Code zeigt falsche URL | `NEXT_PUBLIC_DPP_URL` überprüfen und `npm run dev` neustarten |
| Port 3000 bereits in Benutzung | `npm run dev -- -p 3001` (anderen Port nutzen) |
| "Cannot find module" | `npm install` und `npm run dev` erneut starten |

---

## 💡 Pro-Tipp: IP automatisch detektieren

Wenn du deine IP immer wieder nachschlagen möchtest, nutze dieses Skript:

```bash
#!/bin/bash
# save as get-network-ip.sh
IP=$(ifconfig en0 | grep "inet " | awk '{print $2}')
echo "NEXT_PUBLIC_DPP_URL=http://$IP:3000"
```

Dann:
```bash
chmod +x get-network-ip.sh
./get-network-ip.sh
```

---

**Status:** ✅ Network-Ready  
**Letzte Änderung:** 2026-03-20
