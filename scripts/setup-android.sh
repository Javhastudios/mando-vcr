#!/usr/bin/env bash
# Añade el plugin de infrarrojos y el permiso TRANSMIT_IR al proyecto Android generado por Capacitor.
set -euo pipefail

PKG_DIR="android/app/src/main/java/com/vcr/mando"
MANIFEST="android/app/src/main/AndroidManifest.xml"

mkdir -p "$PKG_DIR"
cp android-plugin/IrPlugin.java "$PKG_DIR/IrPlugin.java"

cat > "$PKG_DIR/MainActivity.java" <<'JAVA'
package com.vcr.mando;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IrPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
JAVA

if ! grep -q "TRANSMIT_IR" "$MANIFEST"; then
  sed -i 's|<application|<uses-permission android:name="android.permission.TRANSMIT_IR" />\n    <uses-feature android:name="android.hardware.consumerir" android:required="false" />\n    <application|' "$MANIFEST"
fi

echo "Plugin IR instalado. Manifest:"
grep -n "TRANSMIT_IR\|consumerir" "$MANIFEST"
