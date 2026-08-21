package kr.geongik.busalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * 알람 시각이 되면 호출된다.
 *
 * 예전에는 여기서 알람 화면을 직접 띄우려 했는데,
 * 다른 앱을 쓰는 중에는 안드로이드가 화면 띄우기를 막아서 소리가 나지 않았다.
 * 그래서 화면 대신 '소리를 내는 서비스'를 시작하도록 바꿨다.
 * 화면은 서비스가 올리는 알림(전체화면 인텐트)이 담당한다.
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        // 예전 코드에서 참조하던 값들을 서비스 쪽으로 옮김
        const val NOTI_ID = AlarmService.NOTI_ID
    }

    override fun onReceive(context: Context, intent: Intent) {
        val svc = Intent(context, AlarmService::class.java).apply {
            action = AlarmService.ACTION_START
            putExtra("title", intent.getStringExtra("title"))
            putExtra("stop", intent.getStringExtra("stop"))
            putExtra("departText", intent.getStringExtra("departText"))
            putExtra("departAt", intent.getLongExtra("departAt", 0L))
            putExtra("lead", intent.getIntExtra("lead", 0))
        }
        // 정확한 알람으로 깨어난 직후에는 백그라운드에서도 서비스 시작이 허용된다
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc)
        } else {
            context.startService(svc)
        }
    }
}
