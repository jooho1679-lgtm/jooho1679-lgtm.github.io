package kr.geongik.alarm

import android.app.Activity
import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONArray

/**
 * 웹 화면(자바스크립트)에서 호출하는 창구.
 * 웹앱은 window.AndroidAlarm 이 있으면 자체 타이머 대신 이쪽으로 알람을 맡긴다.
 */
class AlarmBridge(private val activity: Activity) {

    /** 웹에서 네이티브 알람 사용 가능 여부를 판단하는 용도 */
    @JavascriptInterface
    fun isAvailable(): Boolean = true

    /**
     * 출발 시각들을 시스템 알람으로 등록한다.
     *
     * @param json  [{"departAt":밀리초, "stop":"원내동", "departText":"09:34"}, ...]
     * @param leadMinutes 몇 분 전에 울릴지
     * @param title 알람에 표시할 노선/순번 (예: "급행1번 3번차")
     */
    @JavascriptInterface
    fun scheduleAll(json: String, leadMinutes: Int, title: String): Int {
        return try {
            val arr = JSONArray(json)
            val leadMs = leadMinutes.coerceAtLeast(0) * 60_000L
            val items = ArrayList<AlarmScheduler.Item>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val departAt = o.getLong("departAt")
                items.add(
                    AlarmScheduler.Item(
                        id = 10_000 + i,
                        triggerAtMillis = departAt - leadMs,
                        departAtMillis = departAt,
                        title = title,
                        stop = o.optString("stop"),
                        departText = o.optString("departText")
                    )
                )
            }
            AlarmScheduler.scheduleAll(activity, items)
            val n = AlarmScheduler.pendingCount(activity)
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "출발 알람 ${n}건이 등록되었습니다.\n화면이 꺼져 있어도 울립니다.",
                    Toast.LENGTH_LONG
                ).show()
            }
            n
        } catch (e: Exception) {
            activity.runOnUiThread {
                Toast.makeText(activity, "알람 등록에 실패했습니다.", Toast.LENGTH_SHORT).show()
            }
            -1
        }
    }

    /**
     * 출발 한 건에 여러 번(20분 전·10분 전 등) 알릴 수 있는 방식.
     * 웹에서 울릴 시각을 직접 계산해 넘겨준다.
     *
     * @param json [{"triggerAt":밀리초,"departAt":밀리초,"lead":10,"stop":"원내동","departText":"09:34"}, ...]
     */
    @JavascriptInterface
    fun scheduleAll2(json: String, title: String): Int {
        return try {
            val arr = JSONArray(json)
            val items = ArrayList<AlarmScheduler.Item>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                items.add(
                    AlarmScheduler.Item(
                        id = 20_000 + i,
                        triggerAtMillis = o.getLong("triggerAt"),
                        departAtMillis = o.getLong("departAt"),
                        title = title,
                        stop = o.optString("stop"),
                        departText = o.optString("departText"),
                        leadMinutes = o.optInt("lead", 0)
                    )
                )
            }
            AlarmScheduler.scheduleAll(activity, items)
            val n = AlarmScheduler.pendingCount(activity)
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "출발 알람 ${n}건이 등록되었습니다.\n화면이 꺼져 있어도 울립니다.",
                    Toast.LENGTH_LONG
                ).show()
            }
            n
        } catch (e: Exception) {
            activity.runOnUiThread {
                Toast.makeText(activity, "알람 등록에 실패했습니다.", Toast.LENGTH_SHORT).show()
            }
            -1
        }
    }

    @JavascriptInterface
    fun cancelAll() {
        AlarmScheduler.cancelAll(activity)
        activity.runOnUiThread {
            Toast.makeText(activity, "출발 알람을 껐습니다.", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun pendingCount(): Int = AlarmScheduler.pendingCount(activity)
}
