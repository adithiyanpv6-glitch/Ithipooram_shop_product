# 🖨️ ITHI POORAM POS: SEZNIK Bluetooth Wireless Printer Guide

## 100% Wireless Architecture (No USB Cables Required)
Your **SEZNIK 58mm Portable Thermal Printer** connects directly to the **Laptop via Bluetooth**.
- The laptop maintains the permanent Bluetooth connection.
- When any cashier or waiter on any phone settles a bill or taps print, the bill prints wirelessly on the SEZNIK printer in under 0.2 seconds!

---

## ⚡ 1-Time Bluetooth Pairing (Takes 15 Seconds)
Only needs to be done once on the laptop:

1. **Turn ON your SEZNIK Printer:**
   - Press and hold the **LEFT button (POWER)** for 3 seconds until it beeps and the **STATUS LED** turns on.
2. **Double-click on Desktop:**
   ```cmd
   CONNECT_SEZNIK_BLUETOOTH.bat
   ```
3. In the Windows Bluetooth window that opens:
   - Click **Add device** $\rightarrow$ **Bluetooth**.
   - Select **SEZNIK** (or **POS-58** / **MPT-II**).
   - Enter PIN: **`0000`** (or **`1234`**) and click **Connect**.
4. The tool will automatically detect the connection and **roll out a wireless test bill**!

---

## ☀️ Everyday Shopkeeper Morning Routine (Single 1-Click Launch!)
Every morning when opening the restaurant:
1. **Turn ON Laptop** and **Turn ON SEZNIK Printer** (hold Left Power button 3 seconds).
   - Windows Bluetooth auto-connects wirelessly in the background!
2. **Double-click `START_ITHIPOORAM_POS.bat` on Desktop**:
   - Everything runs automatically:
     - Laptop Bluetooth radio activates.
     - Staff Wi-Fi Hotspot starts (`IthiPooram-POS`).
     - Production POS server boots on port 3000.
     - 4G/5G mobile QR tunnel connects.
     - **Billing Screen automatically opens ready with SEZNIK Bluetooth print enabled!**

---

## 🧾 Cashier Phone Billing Workflow
1. Cashier opens Billing on their phone (`http://192.168.137.1:3000/billing`).
2. Taps occupied table $\rightarrow$ **Authorize & Settle Bill**.
3. Enters Cashier PIN and confirms.
4. **The bill immediately rolls out of the SEZNIK printer wirelessly!**
5. A green banner appears on the phone: **`✓ Printed on SEZNIK Bluetooth Printer`**.
6. Zero PDF prompts on the phone!

---

## 🔍 Verification / Test Print
- On your phone or laptop billing screen, tap the green **`SEZNIK Bluetooth`** pill in the top header anytime.
- A test slip will print wirelessly to verify communication.
