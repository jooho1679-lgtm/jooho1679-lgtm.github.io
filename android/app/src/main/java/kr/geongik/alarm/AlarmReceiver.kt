package kr.geongik.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * 알람 시각이 되면 호출된다.
 * 잠금화면 위에 뜨는 전체화면 알람 + 알림을 함께 띄운다.
 * (전체화면이 제조사 정책으로 막히더라도 알림은 남도록 이중으로 처리)
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "geongik_departure_alarm"
        const val NOTI_ID = 4321
    }

    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "출발 알림"
        val stop = intent.getStringExtra("stop") ?: ""
        val departText = intent.getStringExtra("departText") ?: ""
        val lead = intent.getIntExtra("lead", 0)

        createChannel(context)

        val fullScreenIntent = Intent(context, AlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("title", title)
            putExtra("stop", stop)
            putExtra("departText", departText)
            putExtra("lead", lead)
        }
        val fullScreenPending = PendingIntent.getActivity(
            context, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val noti = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(if (lead > 0) "${lead}분 후 출발 · $departText" else "곧 출발합니다 · $departText")
            .setContentText("$title / $stop 출발")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setOngoing(false)
            .setFullScreenIntent(fullScreenPending, true)
            .setContentIntent(fullScreenPending)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTI_ID, noti)

        // 전체화면 알람 직접 실행 (잠금화면 위에 표시)
        try {
            context.startActivity(fullScreenIntent)
        } catch (e: Exception) {
            // 백그라운드 실행이 제한된 경우에는 위 알림이 대신 뜬다
        }
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "출발 알람",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "배차된 출발 시각 알림"
            enableVibration(true)
            setBypassDnd(true)
        }
        nm.createNotificationChannel(channel)
    }
}
