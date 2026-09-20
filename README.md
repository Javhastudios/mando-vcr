# Mando VCR

App Android (Capacitor) que usa el emisor infrarrojo del móvil para controlar un vídeo VHS.
La interfaz es web (carpeta `www/`); el plugin `android-plugin/IrPlugin.java` llama a `ConsumerIrManager`.

## Compilar el APK con GitHub Actions
1. Sube todo el contenido de esta carpeta a un repositorio de GitHub (incluida la carpeta oculta `.github`).
2. Ve a la pestaña **Actions** y espera a que termine "Compilar APK" (5-10 min la primera vez).
3. Abre la ejecución, baja hasta **Artifacts** y descarga `mando-vcr-apk`.
4. Descomprime el zip e instala `app-debug.apk` en el móvil (permite instalar apps de origen desconocido).

## Probar la interfaz sin móvil
Abre `www/index.html` en el navegador: funciona en modo demo, sin emitir IR.
