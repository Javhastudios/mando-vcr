package com.vcr.mando;

import android.content.Context;
import android.hardware.ConsumerIrManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Ir")
public class IrPlugin extends Plugin {

    private ConsumerIrManager manager() {
        return (ConsumerIrManager) getContext().getSystemService(Context.CONSUMER_IR_SERVICE);
    }

    @PluginMethod
    public void hasEmitter(PluginCall call) {
        ConsumerIrManager m = manager();
        JSObject result = new JSObject();
        result.put("available", m != null && m.hasIrEmitter());
        call.resolve(result);
    }

    @PluginMethod
    public void transmit(PluginCall call) {
        ConsumerIrManager m = manager();
        if (m == null || !m.hasIrEmitter()) {
            call.reject("Este móvil no tiene emisor infrarrojo");
            return;
        }
        Integer frequency = call.getInt("frequency", 38000);
        JSArray array = call.getArray("pattern");
        if (array == null || array.length() == 0) {
            call.reject("Patrón vacío");
            return;
        }
        try {
            int[] pattern = new int[array.length()];
            for (int i = 0; i < pattern.length; i++) {
                pattern[i] = array.getInt(i);
            }
            m.transmit(frequency, pattern);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo emitir: " + e.getMessage());
        }
    }
}
