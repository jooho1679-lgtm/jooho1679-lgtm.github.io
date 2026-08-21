package kr.geongik.alarm

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * 알람이 울릴 때 잠금화면 위에 뜨는 전체화면.
 *
 * 소리와 진동은 AlarmService 가 담당한다.
 * (이 화면이 뜨지 않는 상황에서도 알람이 울려야 하기 때문)
 * 여기서는 내용을 보여주고, 확인을 누르면 서비스를 멈춘다.
 */
class AlarmActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        setContentView(R.layout.activity_alarm)
        bind(intent)

        findViewById<Button>(R.id.alarmDismiss).setOnClickListener {
            stopAlarmService()
            finish()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) { setIntent(intent); bind(intent) }
    }

    private fun bind(i: Intent) {
        val title = i.getStringExtra("title") ?: ""
        val stop = i.getStringExtra("stop") ?: ""
        val departText = i.getStringExtra("departText") ?: ""
        val lead = i.getIntExtra("lead", 0)

        findViewById<TextView>(R.id.alarmTime).text = departText
        findViewById<TextView>(R.id.alarmStop).text = if (stop.isNotEmpty()) "$stop 출발" else "출발"
        findViewById<TextView>(R.id.alarmTitle).text =
            if (lead > 0) "$title · ${lead}분 전" else title
    }

    private fun stopAlarmService() {
        try {
            startService(Intent(this, AlarmService::class.java).setAction(AlarmService.ACTION_STOP))
        } catch (e: Exception) { /* 무시 */ }
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /** 실수로 알람이 꺼지지 않도록 뒤로가기는 무시 */
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        // 확인 버튼으로만 종료
    }
}
