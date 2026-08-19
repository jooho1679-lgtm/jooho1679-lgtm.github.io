package kr.geongik.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 재부팅하거나 앱이 업데이트되면 등록해둔 알람이 사라지므로 다시 등록한다. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            AlarmScheduler.rescheduleFromStorage(context)
        }
    }
}
