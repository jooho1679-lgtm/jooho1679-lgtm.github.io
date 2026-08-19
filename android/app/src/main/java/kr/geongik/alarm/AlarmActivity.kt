package kr.geongik.alarm

import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * 알람이 울릴 때 잠금화면 위에 뜨는 전체화면.
 * 확인 버튼을 누를 때까지 소리와 진동이 계속된다.
 */
class AlarmActivity : AppCompatActivity() {

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        setContentView(R.layout.activity_alarm)

        val title = intent.getStringExtra("title") ?: ""
        val stop = intent.getStringExtra("stop") ?: ""
        val departText = intent.getStringExtra("departText") ?: ""

        findViewById<TextView>(R.id.alarmTime).text = departText
        findViewById<TextView>(R.id.alarmStop).text = if (stop.isNotEmpty()) "$stop 출발" else "출발"
        findViewById<TextView>(R.id.alarmTitle).text = title

        findViewById<Button>(R.id.alarmDismiss).setOnClickListener {
            stopAlerting()
            finish()
        }

        startAlerting()
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun startAlerting() {
        // 알람 채널 소리로 재생 (미디어 볼륨이 아니라 알람 볼륨을 사용)
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            player = MediaPlayer().apply {
                setDataSource(this@AlarmActivity, uri)
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
        } catch (e: Exception) {
            // 소리를 못 내더라도 진동과 화면은 동작하도록 무시
        }

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = longArrayOf(0, 1200, 400, 1200, 400, 1200, 1600)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun stopAlerting() {
        try {
            player?.stop()
            player?.release()
        } catch (e: Exception) {
            // 이미 정리된 경우 무시
        }
        player = null
        vibrator?.cancel()
        vibrator = null
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(AlarmReceiver.NOTI_ID)
    }

    override fun onDestroy() {
        stopAlerting()
        super.onDestroy()
    }

    /** 실수로 알람이 꺼지지 않도록 뒤로가기는 무시 */
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        // 확인 버튼으로만 종료
    }
}
