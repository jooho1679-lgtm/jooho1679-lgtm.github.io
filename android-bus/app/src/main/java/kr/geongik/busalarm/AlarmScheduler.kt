package kr.geongik.busalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * 출발 알람을 안드로이드 시스템 알람으로 등록한다.
 *
 * setAlarmClock() 을 쓰는 이유:
 * 시스템이 이 알람의 전달 시각을 절대 미루지 않고, 절전(Doze) 상태에서도
 * 기기를 깨워서 울려준다. 알람시계 앱들이 쓰는 방식이라 가장 확실하다.
 */
object AlarmScheduler {

    private const val PREFS = "geongikbus_alarms"
    private const val KEY_ITEMS = "items"

    /** 예약된 알람 한 건 */
    data class Item(
        val id: Int,
        val triggerAtMillis: Long,
        val departAtMillis: Long,
        val title: String,
        val stop: String,
        val departText: String,
        val leadMinutes: Int = 0     // 출발 몇 분 전 알람인지
    )

    fun scheduleAll(context: Context, items: List<Item>) {
        cancelAll(context)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()
        val kept = ArrayList<Item>()

        for (item in items) {
            if (item.triggerAtMillis <= now) continue   // 이미 지난 알람은 건너뜀
            val showIntent = PendingIntent.getActivity(
                context, item.id,
                Intent(context, MainActivity::class.java),
                pendingFlags()
            )
            val fireIntent = PendingIntent.getBroadcast(
                context, item.id,
                Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("title", item.title)
                    putExtra("stop", item.stop)
                    putExtra("departText", item.departText)
                    putExtra("departAt", item.departAtMillis)
                    putExtra("lead", item.leadMinutes)
                },
                pendingFlags()
            )
            am.setAlarmClock(
                AlarmManager.AlarmClockInfo(item.triggerAtMillis, showIntent),
                fireIntent
            )
            kept.add(item)
        }
        save(context, kept)
    }

    fun cancelAll(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (item in load(context)) {
            val fireIntent = PendingIntent.getBroadcast(
                context, item.id,
                Intent(context, AlarmReceiver::class.java),
                pendingFlags()
            )
            am.cancel(fireIntent)
            fireIntent.cancel()
        }
        save(context, emptyList())
    }

    /** 재부팅 후 저장해둔 알람을 다시 등록 */
    fun rescheduleFromStorage(context: Context) {
        val items = load(context).filter { it.triggerAtMillis > System.currentTimeMillis() }
        if (items.isNotEmpty()) scheduleAll(context, items)
    }

    fun pendingCount(context: Context): Int =
        load(context).count { it.triggerAtMillis > System.currentTimeMillis() }

    private fun pendingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_UPDATE_CURRENT

    private fun save(context: Context, items: List<Item>) {
        val arr = JSONArray()
        for (i in items) {
            arr.put(JSONObject().apply {
                put("id", i.id)
                put("triggerAt", i.triggerAtMillis)
                put("departAt", i.departAtMillis)
                put("title", i.title)
                put("stop", i.stop)
                put("departText", i.departText)
                put("lead", i.leadMinutes)
            })
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_ITEMS, arr.toString()).apply()
    }

    private fun load(context: Context): List<Item> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_ITEMS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { idx ->
                val o = arr.getJSONObject(idx)
                Item(
                    id = o.getInt("id"),
                    triggerAtMillis = o.getLong("triggerAt"),
                    departAtMillis = o.getLong("departAt"),
                    title = o.optString("title"),
                    stop = o.optString("stop"),
                    departText = o.optString("departText"),
                    leadMinutes = o.optInt("lead", 0)
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
