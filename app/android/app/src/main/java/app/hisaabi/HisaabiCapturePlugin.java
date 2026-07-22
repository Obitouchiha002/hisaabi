package app.hisaabi;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS aur NotificationListenerService ke beech ka pul.
 *
 * JS side:
 *   Capacitor.Plugins.HisaabiCapture.addListener('notification', cb)
 *   await HisaabiCapture.hasPermission()
 *   await HisaabiCapture.openSettings()
 */
@CapacitorPlugin(name = "HisaabiCapture")
public class HisaabiCapturePlugin extends Plugin {

    private BroadcastReceiver receiver;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("packageName", intent.getStringExtra("packageName"));
                data.put("title", intent.getStringExtra("title"));
                data.put("text", intent.getStringExtra("text"));
                data.put("postedAt", intent.getLongExtra("postedAt", System.currentTimeMillis()));
                data.put("key", intent.getStringExtra("key"));

                notifyListeners("notification", data);
            }
        };

        LocalBroadcastManager.getInstance(getContext())
                .registerReceiver(receiver, new IntentFilter(HisaabiNotificationListener.ACTION));
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            LocalBroadcastManager.getInstance(getContext()).unregisterReceiver(receiver);
            receiver = null;
        }
    }

    /** Notification access mila ya nahi. */
    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", isEnabled());
        call.resolve(result);
    }

    /**
     * Android me notification access ek system screen se hi milta hai —
     * runtime permission dialog nahi hota. Isliye user ko wahin bhej dete hain.
     */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private boolean isEnabled() {
        Context context = getContext();
        String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        if (TextUtils.isEmpty(flat)) return false;

        ComponentName expected = new ComponentName(context, HisaabiNotificationListener.class);
        for (String name : flat.split(":")) {
            ComponentName parsed = ComponentName.unflattenFromString(name);
            if (parsed != null && parsed.equals(expected)) return true;
        }
        return false;
    }
}
