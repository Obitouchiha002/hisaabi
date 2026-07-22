package app.hisaabi;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * UPI / bank notifications sunta hai.
 *
 * Yahan koi parsing nahi hoti — sirf text uthake app ko de diya jata hai.
 * Parsing engine karta hai, aur wo bhi phone ke andar hi. Notification ka text
 * kabhi kisi server ya AI ko nahi jata.
 *
 * READ_SMS permission ki zaroorat nahi: bank ke SMS ka notification bhi
 * messages app se yahin mil jata hai.
 */
public class HisaabiNotificationListener extends NotificationListenerService {

    public static final String ACTION = "app.hisaabi.NOTIFICATION";

    /** Sirf yahi apps dekhi jati hain. Baaki sab chhod diya jata hai. */
    private static final Set<String> WATCHED = new HashSet<>(Arrays.asList(
            "com.phonepe.app",
            "com.google.android.apps.nbu.paisa.user",   // GPay
            "net.one97.paytm",
            "in.org.npci.upiapp",                       // BHIM
            "com.dreamplug.androidapp",                 // CRED
            "com.google.android.apps.messaging",        // bank SMS
            "com.samsung.android.messaging",
            "com.mobikwik_new",
            "com.freecharge.android"
    ));

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String pkg = sbn.getPackageName();
        if (pkg == null || !WATCHED.contains(pkg)) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (TextUtils.isEmpty(body)) {
            body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        }

        if (TextUtils.isEmpty(title) && TextUtils.isEmpty(body)) return;

        Intent intent = new Intent(ACTION);
        intent.putExtra("packageName", pkg);
        intent.putExtra("title", title);
        intent.putExtra("text", body);
        intent.putExtra("postedAt", sbn.getPostTime());
        // Android ek hi notification kabhi-kabhi do baar bhejta hai — key se dedupe hota hai
        intent.putExtra("key", sbn.getKey());

        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString();
    }
}
