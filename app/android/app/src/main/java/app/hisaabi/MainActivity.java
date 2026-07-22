package app.hisaabi;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Notification capture wala plugin — bridge banne se pehle register hona chahiye
        registerPlugin(HisaabiCapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
