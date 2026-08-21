package kr.geongik.busalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * 출발 알람을 실제로 '울리는' 곳.
 *
 * 소리를 알람 화면(AlarmActivity)에서 재생하면,
 * 다른 앱을 쓰는 중일 때는 안드로이드가 그 화면을 띄우지 않고 알림만 보여주기 때문에
 * 기사님이 알림을 눌러야만 소리가 났다.
 * 그래서 화면과 상관없이 서비스에서 바로 소리를 내도록 분리했다.
 */
class AlarmService : Service() {

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var autoStop: Runnable? = null

    companion object {
        const val CHANNEL_ID = "geongikbus_departure_alarm_v2"   // 채널 설정은 만든 뒤 못 바꾸므로 새 ID 사용
        const val NOTI_ID = 4321
        const val ACTION_START = "kr.geongik.busalarm.START"
        const val ACTION_STOP = "kr.geongik.busalarm.STOP"
        const val MAX_RING_MS = 180_000L                      // 안전장치: 3분 뒤 자동 정지
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopEverything()
            return START_NOT_STICKY
        }

        val title = intent?.getStringExtra("title") ?: "출발 알림"
        val stop = intent?.getStringExtra("stop") ?: ""
        val departText = intent?.getStringExtra("departText") ?: ""
        val lead = intent?.getIntExtra("lead", 0) ?: 0

        createChannel()
        val noti = buildNotification(title, stop, departText, lead)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this, NOTI_ID, noti, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTI_ID, noti)
        }

        startAlerting()

        autoStop?.let { handler.removeCallbacks(it) }
        autoStop = Runnable { stopEverything() }
        handler.postDelayed(autoStop!!, MAX_RING_MS)

        return START_STICKY
    }

    private fun buildNotification(title: String, stop: String, departText: String, lead: Int): Notification {
        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("title", title)
            putExtra("stop", stop)
            putExtra("departText", departText)
            putExtra("lead", lead)
        }
        val fullScreenPending = PendingIntent.getActivity(
            this, 0, fullScreenIntent, pendingFlags()
        )
        val stopPending = PendingIntent.getService(
            this, 1, Intent(this, AlarmService::class.java).setAction(ACTION_STOP), pendingFlags()
        )

        val head = if (lead > 0) "${lead}분 후 출발 · $departText" else "곧 출발합니다 · $departText"
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(head)
            .setContentText(if (stop.isNotEmpty()) "$title / $stop 출발" else title)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPending, true)
            .setContentIntent(fullScreenPending)
            .addAction(0, "알람 끄기", stopPending)
            .build()
    }

    private fun pendingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT

    private fun startAlerting() {
        // 화면이 꺼져 있어도 소리가 나도록 잠깐 깨워둔다
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "geongikbus:alarm")
            wakeLock?.acquire(MAX_RING_MS)
        } catch (e: Exception) { /* 무시 */ }

        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            player = MediaPlayer().apply {
                setDataSource(this@AlarmService, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) { /* 소리를 못 내도 진동은 되도록 */ }

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = longArrayOf(0, 1200, 400, 1200, 400, 1200, 1600)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(
                    VibrationEffect.createWaveform(pattern, 0),
                    AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) { /* 무시 */ }
    }

    private fun stopEverything() {
        autoStop?.let { handler.removeCallbacks(it) }
        try { player?.stop(); player?.release() } catch (e: Exception) { }
        player = null
        try { vibrator?.cancel() } catch (e: Exception) { }
        vibrator = null
        try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (e: Exception) { }
        wakeLock = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopEverything()
        super.onDestroy()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID, "출발 알람", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "배차된 출발 시각 알림"
            enableVibration(false)          // 진동은 서비스가 직접 처리
            setSound(null, null)            // 소리도 서비스가 직접 재생 (두 번 울리지 않도록)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(channel)
    }
}
