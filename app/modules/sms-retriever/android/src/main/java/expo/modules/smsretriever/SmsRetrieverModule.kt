package expo.modules.smsretriever

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsRetrieverModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("SmsRetriever")
    Events("otpReceived")

    AsyncFunction("startListening") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      stopListeningInternal(context)

      val nextReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) {
            return
          }

          val status = getStatus(intent)
          if (status?.statusCode == CommonStatusCodes.SUCCESS) {
            val message = intent.extras?.getString(SmsRetriever.EXTRA_SMS_MESSAGE).orEmpty()
            val code = Regex("\\b\\d{6}\\b").find(message)?.value

            if (code != null) {
              sendEvent("otpReceived", mapOf("code" to code))
            }
          }

          stopListeningInternal(context)
        }
      }

      receiver = nextReceiver
      val intentFilter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(
          nextReceiver,
          intentFilter,
          SmsRetriever.SEND_PERMISSION,
          null,
          Context.RECEIVER_EXPORTED,
        )
      } else {
        @Suppress("DEPRECATION")
        context.registerReceiver(
          nextReceiver,
          intentFilter,
          SmsRetriever.SEND_PERMISSION,
          null,
        )
      }

      SmsRetriever.getClient(context).startSmsRetriever()
        .addOnFailureListener {
          stopListeningInternal(context)
        }

      return@AsyncFunction null
    }

    Function("stopListening") {
      appContext.reactContext?.let(::stopListeningInternal)
    }

    OnDestroy {
      appContext.reactContext?.let(::stopListeningInternal)
    }
  }

  private fun stopListeningInternal(context: Context) {
    receiver?.let {
      runCatching { context.unregisterReceiver(it) }
    }
    receiver = null
  }

  private fun getStatus(intent: Intent): Status? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(SmsRetriever.EXTRA_STATUS, Status::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? Status
    }
  }
}
