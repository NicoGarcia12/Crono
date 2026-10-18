package expo.modules.cronocontactaccounts

import android.provider.ContactsContract.RawContacts
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * expo-contacts no permite filtrar por cuenta en Android: lista los contactos de
 * TODAS las cuentas (Google, teléfono, SIM, WhatsApp...). Este módulo devuelve
 * los ids de los contactos que tienen un contacto "crudo" en una cuenta de
 * Google. Esos ids son los mismos `_ID` de ContactsContract.Contacts que usa
 * expo-contacts, así que se pueden cruzar directo.
 */
class CronoContactAccountsModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CronoContactAccounts")

    AsyncFunction("getGoogleContactIds") {
      val ids = LinkedHashSet<String>()
      context.contentResolver.query(
        RawContacts.CONTENT_URI,
        arrayOf(RawContacts.CONTACT_ID),
        "${RawContacts.ACCOUNT_TYPE} = ? AND ${RawContacts.DELETED} = 0",
        arrayOf(GOOGLE_ACCOUNT_TYPE),
        null
      )?.use { cursor ->
        val contactIdColumn = cursor.getColumnIndexOrThrow(RawContacts.CONTACT_ID)
        while (cursor.moveToNext()) {
          ids.add(cursor.getLong(contactIdColumn).toString())
        }
      }
      ids.toList()
    }
  }

  private companion object {
    const val GOOGLE_ACCOUNT_TYPE = "com.google"
  }
}
