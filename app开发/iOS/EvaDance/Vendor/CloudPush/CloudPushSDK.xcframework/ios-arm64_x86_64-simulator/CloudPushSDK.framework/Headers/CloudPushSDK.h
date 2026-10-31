//
//  CloudPushSDK.h
//  CloudPushSDK
//
//  Created by junmo on 16/7/26.
//  Copyright © 2016年 aliyun.mobileService. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "MPGerneralDefinition.h"

/* SDK版本号 */
#define MPUSH_IOS_SDK_VERSION @"3.2.4"

NS_ASSUME_NONNULL_BEGIN

@interface CloudPushSDK : NSObject

/**
 * Push SDK启动入口
 */
+ (void)startWithAppkey:(NSString *)appKey
              appSecret:(NSString *)appSecret
               callback:(CallbackHandler)callback;

/**
 * Push SDK启动入口
 */
+ (void)startWithAppkey:(NSString *)appKey
              appSecret:(NSString *)appSecret
                elsHost:(nullable NSString *)elsHost
                vipHost:(nullable NSString *)vipHost
               callback:(CallbackHandler)callback;

/**
 * 打开调试日志
 *
 * @deprecated 从3.0版本开始废弃，请使用 setLogLevel: 方法代替
 * @note 如需打开调试日志，请使用 [MPLog setLogLevel:MPLogLevelDebug]
 */
+ (void)turnOnDebug __deprecated_msg("使用 setLogLevel: 方法代替");

/**
 * 设置日志输出级别
 *
 * @param level 日志级别，可选值：
 *             - MPLogLevelDebug: 调试级别，输出所有日志
 *             - MPLogLevelInfo:  信息级别，输出info及以上级别日志
 *             - MPLogLevelWarn:  警告级别，输出warn及以上级别日志
 *             - MPLogLevelError: 错误级别，仅输出error级别日志
 *             - MPLogLevelNone:  关闭所有日志输出
 *
 * @note 默认日志级别为 MPLogLevelInfo
 * @note 日志级别的优先级为: Debug < Info < Warn < Error < None
 *
 * @example
 * // 设置为Debug级别，将输出所有日志
 * [MPLog setLogLevel:MPLogLevelDebug];
 *
 * // 设置为Error级别，只输出错误日志
 * [MPLog setLogLevel:MPLogLevelError];
 */
+ (void)setLogLevel:(MPLogLevel)level;

/**
 *	获取本机的deviceId (deviceId为推送系统的设备标识)
 */
+ (nullable NSString *)getDeviceId;

/**
 *	返回SDK版本
 */
+ (NSString *)getVersion;

/**
 *	返回推送通道的状态
 */
+ (BOOL)isChannelOpened;

/**
 *	返回推送通知ACK到服务器
 *
 *	@param 	userInfo   通知相关信息
 */
+ (void)sendNotificationAck:(NSDictionary *)userInfo;

/**
 *	返回推送通知到达埋点到服务器
 *
 *	@param 	userInfo   通知相关信息
 */
+ (void)sendNotificationArrive:(NSDictionary *)userInfo;

/**
*    返回删除的推送通知ACK到服务器
*
*    @param     userInfo   通知相关信息
*/
+ (void)sendDeleteNotificationAck:(NSDictionary *)userInfo;

/**
 *	绑定账号
 */
+ (void)bindAccount:(NSString *)account
       withCallback:(CallbackHandler)callback;

/**
 *	解绑账号
 */
+ (void)unbindAccount:(CallbackHandler)callback;

/**
 *	向指定目标添加自定义标签
 *	支持向本设备/本设备绑定账号/别名添加自定义标签，目标类型由target指定
 *	@param 	target      目标类型，1：本设备  2：本设备绑定账号  3：别名
 *	@param 	tags        标签名
 *	@param 	alias       别名（仅当target = 3时生效）
 *	@param 	callback 	回调
 */
+ (void)bindTag:(int)target
       withTags:(NSArray *)tags
      withAlias:(nullable NSString *)alias
   withCallback:(CallbackHandler)callback;

/**
 *	删除指定目标的自定义标签
 *	支持从本设备/本设备绑定账号/别名删除自定义标签，目标类型由target指定
 *	@param 	target      目标类型，1：本设备  2：本设备绑定账号  3：别名
 *	@param 	tags        标签名
 *	@param 	alias       别名（仅当target = 3时生效）
 *	@param 	callback 	回调
 */
+ (void)unbindTag:(int)target
         withTags:(NSArray *)tags
        withAlias:(nullable NSString *)alias
     withCallback:(CallbackHandler)callback;

/**
 *  查询绑定标签，查询结果可从callback的data中获取
 *
 *  @param target       目标类型，1：本设备（当前仅支持查询本设备绑定标签）
 *  @param callback     回调
 */
+ (void)listTags:(int)target
    withCallback:(CallbackHandler)callback;

/**
 *	给当前设备打别名
 */
+ (void)addAlias:(NSString *)alias
    withCallback:(CallbackHandler)callback;

/**
 *	删除当前设备的指定别名
 *  当alias为nil or length = 0时，删除当前设备绑定所有别名
 */
+ (void)removeAlias:(NSString *)alias
       withCallback:(CallbackHandler)callback;

/**
 *  查询本设备绑定别名，查询结果可从callback的data中获取
 */
+ (void)listAliases:(CallbackHandler)callback;

/**
 *  向阿里云推送注册该设备的deviceToken
 *
 *  @param deviceToken 苹果APNs服务器返回的deviceToken
 */
+ (void)registerDevice:(NSData *)deviceToken
          withCallback:(CallbackHandler)callback;

/**
 *	获取APNs返回的deviceToken
 *
 *	@return deviceToken
 */
+ (nullable NSString *)getApnsDeviceToken;

/**
 * 同步设备通知角标数到推送服务器

 @param num badge数，取值范围[0,99999]
 @param callback 回调
 */
+ (void)syncBadgeNum:(NSUInteger)num
        withCallback:(CallbackHandler)callback;

/**
 *  向阿里云注册 Live Activity 启动令牌
 *
 *  @param startToken                    苹果APNs服务器返回的用于启动 Live Activity 的令牌
 *  @param activityAttributes   ActivityAttributes 名称
 *  @param callback                         用于接受结果的回调处理程序
 */
+ (void)registerLiveActivityStartToken:(NSData *)startToken
                 forActivityAttributes:(NSString *)activityAttributes
                          withCallback:(CallbackHandler)callback;

/**
 *  向阿里云注册 Live Activity 更新令牌
 *
 *  @param pushToken             苹果APNs服务器返回的用于更新 Live Activity 的令牌
 *  @param activityId           Live Activity ID
 *  @param callback               用于接受结果的回调处理程序
 */
+ (void)registerLiveActivityPushToken:(NSData *)pushToken
                        forActivityId:(NSString *)activityId
                         withCallback:(CallbackHandler)callback;

/**
 *  向阿里云同步 Live Activity 的状态
 *
 *  @param state                      Live Activity 的状态：active | ended | dismissed | stale
 *  @param activityId           Live Activity ID
 *  @param callback               用于接受结果的回调处理程序
 */
+ (void)syncLiveActivityState:(NSString *)state
                forActivityId:(NSString *)activityId
                 withCallback:(CallbackHandler)callback;

@end

NS_ASSUME_NONNULL_END
