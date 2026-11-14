#if os(iOS)
import UIKit
import UserNotifications
#if canImport(CloudPushSDK)
import CloudPushSDK
#endif

final class AppPushDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    @MainActor private static weak var notifications: AppNotifications?
    @MainActor private static var pendingRecipientID: String?
    @MainActor static func attach(_ value: AppNotifications) {
        notifications = value
        guard let recipient = pendingRecipientID else { return }
        pendingRecipientID = nil
        Task { await value.refresh(); value.open(recipientID: recipient) }
    }
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self; return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        #if canImport(CloudPushSDK)
        CloudPushSDK.registerDevice(token) { _ in }
        #endif
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler complete: @escaping (UNNotificationPresentationOptions) -> Void) {
        Task { @MainActor in await Self.notifications?.refresh() }
        // Foreground uses the same in-app unread indicator; avoid a second system banner.
        complete([])
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler complete: @escaping () -> Void) {
        let values = response.notification.request.content.userInfo
        let recipient = values["recipientId"] as? String ?? ""
        Task { @MainActor in
            guard recipient.range(of: "^[1-9][0-9]{0,15}$", options: .regularExpression) != nil else { return }
            guard let notifications = Self.notifications else { Self.pendingRecipientID = recipient; return }
            await notifications.refresh()
            notifications.open(recipientID: recipient)
        }
        complete()
    }
}
#endif
