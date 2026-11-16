package com.pixconnector

import android.app.Activity
import android.content.Intent
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

// "Save as…" through the system file dialog (Storage Access Framework).
class SaveFileModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), ActivityEventListener {

    private var pending: Promise? = null
    private var pendingText: String? = null

    init {
        ctx.addActivityEventListener(this)
    }

    override fun getName() = "SaveFile"

    // Resolves with the saved file's URI, or null if the user cancelled.
    @ReactMethod
    fun saveText(fileName: String, mimeType: String, text: String, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("no_activity", "App is not in the foreground")
            return
        }
        if (pending != null) {
            promise.reject("busy", "A save is already in progress")
            return
        }
        pending = promise
        pendingText = text
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType
            putExtra(Intent.EXTRA_TITLE, fileName)
        }
        try {
            activity.startActivityForResult(intent, REQUEST)
        } catch (e: Exception) {
            pending = null
            pendingText = null
            promise.reject("no_picker", e.message, e)
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST) return
        val p = pending ?: return
        val text = pendingText ?: ""
        pending = null
        pendingText = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
            p.resolve(null)
            return
        }
        try {
            val out = ctx.contentResolver.openOutputStream(uri, "wt")
                ?: throw IllegalStateException("Cannot open the chosen file")
            out.use { it.write(text.toByteArray(Charsets.UTF_8)) }
            p.resolve(uri.toString())
        } catch (e: Exception) {
            p.reject("write_failed", e.message, e)
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    companion object {
        private const val REQUEST = 4721
    }
}

class AppPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SaveFileModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
