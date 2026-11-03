# EB3A Control для iPhone — тестовий Capacitor-проєкт

Ця папка містить **гібридну iOS-версію** робочої панелі EB3A. Звичайна вебверсія у корені репозиторію залишається без змін.

## Вартість

Розробка та локальне встановлення через Xcode з безкоштовним Apple Account можливі без Apple Developer Program. Безкоштовне підписування зазвичай потрібно поновлювати щотижня. Публікація в App Store потребує платної програми Apple Developer.

## Що потрібно на Mac

- Xcode (актуальний, сумісний із Capacitor 8), Xcode Command Line Tools
- Node.js 22+ / npm (перевірте вимоги версій Capacitor і Vite)
- iPhone, USB-кабель (перший запуск), увімкнено Developer Mode на iPhone

## Встановлення

```bash
git clone https://github.com/XOTT69/Stats.git
cd Stats/hybrid
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

У Xcode виберіть проєкт App → Signing & Capabilities → Team (особистий Apple Account). Якщо Xcode повідомить про зайнятий Bundle Identifier, установіть власний у Xcode й у `capacitor.config.json` для подальшого пересоздання платформи. Під'єднайте iPhone, виберіть його як Run Destination і натисніть ▶ Run. Може знадобитися Developer Mode на пристрої.

### Bluetooth permission — обов'язково

В Xcode у `ios/App/App/Info.plist` додайте ключ:

`NSBluetoothAlwaysUsageDescription` → `Підключення до BLUETTI EB3A для моніторингу заряду та керування виходами.`

Можна додати ключ після `npx cap add ios` перед збиранням. Без нього iOS може заблокувати доступ до BLE.

### Перевірка

1. Натисніть «Підключити EB3A через Bluetooth» → виберіть свою станцію у нативному списку.
2. Спочатку перевірте лише читання заряду та потужності.
3. Для тесту без важливого навантаження використовуйте вмикання/вимикання ліхтарика.
4. Перевірте ECO та режими заряджання після підтвердження роботи LED.

**Стан:** код інтеграції створено, але фізичну збірку Xcode та тест iPhone/EB3A у цьому середовищі не виконано.

## Архітектура

- `index.html` — копія перевіреної вебпанелі: телеметрія, історія, сценарії, Modbus-команди.
- `src/native.js` — адаптер WebBluetooth-подібного інтерфейсу до `@capacitor-community/bluetooth-le`.
- При нативному запуску додаток звертається до CoreBluetooth через Capacitor, у браузері — до Web Bluetooth.
- Перевага гібрида: дизайн і логіку сценаріїв не потрібно переписувати на Swift.

**Обмеження:** це нативний контейнер, а не Safari PWA. Без ESP32 немає надійного 24/7 моніторингу, віджетів WidgetKit у першій версії немає. Роботу Bluetooth-шару перевіряємо на реальному пристрої.
