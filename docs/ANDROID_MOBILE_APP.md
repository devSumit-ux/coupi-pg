# Android Architecture Notice — Deprecation of Hardware Phone Observers

> [!NOTE]
> **Architectural Transition in COUPI PG V2**  
> In legacy systems (such as `YouPI-PG`), an Android Kotlin observer APK (`com.youpi.observer`) was required to capture bank SMS notifications from a physical smartphone plugged into a charger.

### Why the Android Observer APK Was Replaced in COUPI PG V2:
1. **Hardware Reliability:** Physical smartphones suffer from battery swelling, Wi-Fi disconnects, and power loss.
2. **Operating System Aggression:** Modern Android versions (Android 12, 13, 14) aggressively terminate background notification listener services to conserve battery, causing missed customer payment detections.
3. **Infrastructure Cost:** Hosting a gateway requires running a server in the cloud; having a tethered physical phone breaks cloud-native CI/CD and containerized deployment.

### Current Cloud-Native Solution:
- In COUPI PG V2, banking alerts are ingested directly in cloud containers via **RFC 2177 IMAP IDLE push sockets over TLS** (<400ms latency).
- See [OBSERVERS_SETUP.md](file:///home/sumitxdev/Desktop/coupi/docs/OBSERVERS_SETUP.md) for configuring cloud-native email banking alerts.

### Mobile Client Integration (Flutter / Android / iOS):
- If you are building an Android or iOS application for your customers to pay via UPI, refer to the [Flutter & Mobile App Integration Guide](file:///home/sumitxdev/Desktop/coupi/docs/FLUTTER_MOBILE_INTEGRATION.md).
