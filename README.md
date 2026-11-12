# ITHI POORAM (ഇത്തിപ്പൂരം) — Restaurant POS & Mobile Ordering System
**Zero-Cloud-Dependency, Standalone, Ultra-Fast Local Server for Kerala Restaurants**

---

## 🌟 Overview
This package is the complete, shop-ready production build of the **Ithi Pooram Restaurant Management System**. It is designed to run locally on a spare Windows laptop or PC at the counter, serving all staff phones and customer table QR stands with zero reliance on Vercel.

- **Counter Billing POS**: Instant billing, cash/UPI/split payments, SEZNIK Bluetooth 58mm thermal printing, and 58mm system print.
- **Kitchen Display System (KDS)**: Live chef order queue with audio announcements and served status tracking.
- **Customer Mobile QR Stands**: Dynamic table QR ordering for customers over 4G/5G mobile data via secure Cloudflare Tunnel.
- **100% Persistent Database**: Saved directly on the laptop's hard drive (`data/restaurant_store.json`). Data never disappears or resets across reboots.
- **Google Drive / Sheets Master Sync**: Streams settled bills and staff logs directly to your Google Workspace master sheet in real time.

---

## 🚀 Quick Start (Running on Counter Laptop)

### 1. Requirements (One-time only)
- Windows 10 or 11 laptop connected to the shop Wi-Fi and power charger.
- [Node.js (LTS version)](https://nodejs.org) installed.

### 2. Launch the Restaurant Server
Double-click:
### 👉 **`START_ITHIPOORAM_POS.bat`**

The launcher automatically:
1. Configures Windows 10 power settings so **the laptop keeps running with the screen/lid closed**.
2. Starts the production server on `http://localhost:3000` (butter-smooth, 0ms latency).
3. Connects the free Cloudflare Tunnel for customer 4G/5G QR ordering.
4. Generates a text file called **`MOBILE_LINKS_FOR_STAFF.txt`** on the desktop.

---

## 📱 Mobile Phone Access Links

### For Staff Phones on Shop Wi-Fi (Butter-Smooth 0ms Speed):
Make sure the cashier and kitchen phones are connected to the **shop Wi-Fi router**:
- **Cashier Billing Terminal**: `http://<laptop-ip>:3000/billing`
- **Kitchen Display (KDS)**: `http://<laptop-ip>:3000/kitchen`
- **Manager Dashboard**: `http://<laptop-ip>:3000/`

### For Customers on 4G/5G Mobile Data (Outside Shop Wi-Fi):
- Table QR stands automatically point to the Cloudflare Tunnel URL:
  `https://xxxx.trycloudflare.com`

---

## 📲 How to Install as an App on Any Phone (PWA)

No Play Store or App Store required:
1. **On Android (Google Chrome)**:
   - Open the Billing or Kitchen link.
   - Tap the three dots (**⋮**) in the top right corner.
   - Tap **"Install App"** or **"Add to Home screen"**.
   - An "Ithi Pooram POS" app icon will appear on your phone home screen, opening in full-screen mode!
2. **On iPhone (Safari)**:
   - Open the link in Safari.
   - Tap the **Share** button at the bottom.
   - Tap **"Add to Home Screen"**.

---

## 💾 Checking Your Database
To verify that data is safely saved on the laptop hard drive:
Double-click:
### 👉 **`CHECK_DATABASE.bat`**

It displays:
- Number of active tables
- Open running orders
- Total settled bills in the sales ledger
- Total sales revenue recorded on disk
- Database file path (`data/restaurant_store.json`) and last saved timestamp.

---

## 📤 How to Push this Clean Folder to GitHub

If you want to push this clean folder to your GitHub:
1. Open PowerShell or Terminal in this folder (`Ithipooram_shop_product`).
2. Run:
```powershell
git init
git add -A
git commit -m "feat: complete standalone shop-ready POS with zero-cloud dependency"
git branch -M main
git remote add origin https://github.com/adithiyanpv6-glitch/<your-new-repo>.git
git push -u origin main
```
