#import "AVPDef.h"
#import <Foundation/Foundation.h>

@class AVPMediaInfo;
@class AVPVidStsSource;
@class AVPVidAuthSource;


/**
 * @protocol AliVodMediaLoaderStatusDelegate
 * @brief VOD 媒体加载器的状态回调协议。
 *
 * 该协议定义了 VOD 媒体资源在准备和加载过程中的关键事件回调。
 */
/****
 * @protocol AliVodMediaLoaderStatusDelegate
 * @brief The status callback protocol for the VOD media loader.
 *
 * This protocol defines key event callbacks during the preparation and loading process of VOD media resources.
 */
@protocol AliVodMediaLoaderStatusDelegate <NSObject>
@optional

/**
 * @brief 准备完成回调。
 *
 * 当调用 @link -[AliVodMediaLoader prepareVidStsSource:] @endlink 或 @link -[AliVodMediaLoader prepareVidAuthSource:] @endlink 后，若媒体资源准备成功，此方法将被调用。
 *
 * @param mediaInfo @link AVPMediaInfo @endlink 媒体信息对象，包含了媒体的详细信息。
 * @see @link -[AliVodMediaLoader prepareVidStsSource:] @endlink
 * @see @link -[AliVodMediaLoader prepareVidAuthSource:] @endlink
 */
/****
 * @brief Callback for when preparation is complete.
 *
 * This method is called when media resource preparation is successful after calling @link -[AliVodMediaLoader prepareVidStsSource:] @endlink or @link -[AliVodMediaLoader prepareVidAuthSource:] @endlink.
 *
 * @param mediaInfo The @link AVPMediaInfo @endlink object, which contains detailed information about the media.
 * @see @link -[AliVodMediaLoader prepareVidStsSource:] @endlink
 * @see @link -[AliVodMediaLoader prepareVidAuthSource:] @endlink
 */
- (void)onPrepared:(AVPMediaInfo *)mediaInfo;

/**
 * @brief 错误回调。
 * @param vid 发生错误的 VID。
 * @param index 发生错误的加载索引。
 * @param code 错误码。
 * @param msg 错误描述。
 * @deprecated 该方法已废弃，请使用 @link -[AliVodMediaLoaderStatusDelegate onErrorV2:index:errorModel:] @endlink 替代。
 */
/****
 * @brief Error callback.
 * @param vid The VID where the error occurred.
 * @param index The loading index where the error occurred.
 * @param code Error code.
 * @param msg Error description.
 * @deprecated This method is deprecated. Use @link -[AliVodMediaLoaderStatusDelegate onErrorV2:index:errorModel:] @endlink instead.
 */
- (void)onError:(NSString *)vid index:(int)index code:(int64_t)code msg:(NSString *)msg __attribute__((deprecated("This method is deprecated. Use `onErrorV2` instead.")));

/**
 @brief 错误回调V2。
 *
 * 当加载过程中发生错误时，此方法将被调用。
 *
 @param vid 发生错误的 VID。
 @param index 发生错误的加载索引。
 @param errorModel 播放器错误描述模型，参考 @link AVPErrorModel @endlink。
 @see @link -[AliVodMediaLoader load:index:duration:] @endlink
 */
/****
 @brief Error callback V2.
 *
 * This method is called when an error occurs during the loading process.
 *
 @param vid The VID where the error occurred.
 @param index The loading index where the error occurred.
 @param errorModel Player error description model, refer to @link AVPErrorModel @endlink.
 @see @link -[AliVodMediaLoader load:index:duration:] @endlink
*/
- (void)onErrorV2:(NSString *)vid index:(int)index errorModel:(AVPErrorModel *)errorModel;

/**
 * @brief 完成回调。
 *
 * 当指定的加载任务完成时，此方法将被调用。
 *
 * @param vid 已完成加载的 VID。
 * @param index 已完成加载的索引。
 * @see @link -[AliVodMediaLoader load:index:duration:] @endlink
 */
/****
 * @brief Completion callback.
 *
 * This method is called when the specified loading task is completed.
 *
 * @param vid The VID of the completed load.
 * @param index The index of the completed load.
 * @see @link -[AliVodMediaLoader load:index:duration:] @endlink
 */
- (void)onCompleted:(NSString *)vid index:(int)index;

/**
 * @brief 取消回调。
 *
 * 当一个加载任务被取消时，此方法将被调用。
 *
 * @param vid 被取消加载的 VID。
 * @param index 被取消加载的索引。
 * @see @link -[AliVodMediaLoader cancel:index:] @endlink
 */
/****
 * @brief Cancellation callback.
 *
 * This method is called when a loading task is canceled.
 *
 * @param vid The VID of the canceled load.
 * @param index The index of the canceled load.
 * @see @link -[AliVodMediaLoader cancel:index:] @endlink
 */
- (void)onCanceled:(NSString *)vid index:(int)index;

@end


/**
 * @interface AliVodMediaLoader
 * @brief VOD 媒体资源加载器。
 *
 * 提供对 VOD 媒体资源的准备、加载、暂停、恢复和取消等功能。这是一个单例类。
 */
/****
 * @interface AliVodMediaLoader
 * @brief VOD media resource loader.
 *
 * Provides functionalities for preparing, loading, pausing, resuming, and canceling VOD media resources. This is a singleton class.
 */
OBJC_EXPORT
@interface AliVodMediaLoader : NSObject

/**
 * @brief 获取 AliVodMediaLoader 的单例实例。
 * @return `AliVodMediaLoader` 的共享实例。
 */
/****
 * @brief Gets the singleton instance of AliVodMediaLoader.
 * @return The shared instance of `AliVodMediaLoader`.
 */
+ (instancetype)shareInstance;

/**
 * @brief 使用 VidStsSource 准备媒体资源。
 *
 * 这是一个异步操作。准备成功后，将通过 @link -[AliVodMediaLoaderStatusDelegate onPrepared:] @endlink 回调通知。
 *
 * @param stsSource @link AVPVidStsSource @endlink 对象，包含了 VID 和 STS 凭证信息。
 */
/****
 * @brief Prepares media resources using VidStsSource.
 *
 * This is an asynchronous operation. Upon successful preparation, a notification will be sent via the @link -[AliVodMediaLoaderStatusDelegate onPrepared:] @endlink callback.
 *
 * @param stsSource The @link AVPVidStsSource @endlink object, containing VID and STS credential information.
 */
- (void)prepareVidStsSource:(AVPVidStsSource *)stsSource;

/**
 * @brief 使用 VidAuthSource 准备媒体资源。
 *
 * 这是一个异步操作。准备成功后，将通过 @link -[AliVodMediaLoaderStatusDelegate onPrepared:] @endlink 回调通知。
 *
 * @param authSource @link AVPVidAuthSource @endlink 对象，包含了 VID 和播放凭证信息。
 */
/****
 * @brief Prepares media resources using VidAuthSource.
 *
 * This is an asynchronous operation. Upon successful preparation, a notification will be sent via the @link -[AliVodMediaLoaderStatusDelegate onPrepared:] @endlink callback.
 *
 * @param authSource The @link AVPVidAuthSource @endlink object, containing VID and playback credential information.
 */
- (void)prepareVidAuthSource:(AVPVidAuthSource *)authSource;

/**
 * @brief 移除已准备的 VID 资源。
 *
 * @param vid 要移除的媒体资源的 VID。
 */
/****
 * @brief Removes a prepared VID resource.
 *
 * @param vid The VID of the media resource to be removed.
 */
- (void)removeVidSource:(NSString *)vid;

/**
 * @brief 开始加载文件。
 *
 * 这是一个异步操作，可以同时加载多个任务。
 * @param vid 要加载的视频 VID。
 * @param index 要加载的索引。
 * @param duration 加载的时长，单位为毫秒。
 */
/****
 * @brief Starts loading a file.
 *
 * This is an asynchronous operation, and multiple tasks can be loaded simultaneously.
 * @param vid The video VID to be loaded.
 * @param index The index to be loaded.
 * @param duration The duration to load, in milliseconds.
 */
- (void)load:(NSString *)vid index:(int)index duration:(int64_t)duration;

/**
 * @brief 取消加载。
 * @note 此操作不会删除已经下载的文件。成功取消后会触发 @link -[AliVodMediaLoaderStatusDelegate onCanceled:index:] @endlink 回调。
 * @param vid 要取消加载的 VID。
 * @param index 要取消加载的索引。
 */
/****
 * @brief Cancels loading.
 * @note This operation will not delete already downloaded files. A successful cancellation will trigger the @link -[AliVodMediaLoaderStatusDelegate onCanceled:index:] @endlink callback.
 * @param vid The VID of the load to be canceled.
 * @param index The index of the load to be canceled.
 */
- (void)cancel:(NSString *)vid index:(int)index;

/**
 * @brief 暂停加载。
 * @param vid 要暂停加载的 VID。
 * @param index 要暂停加载的索引。
 */
/****
 * @brief Pauses loading.
 * @param vid The VID of the load to be paused.
 * @param index The index of the load to be paused.
 */
- (void)pause:(NSString *)vid index:(int)index;

/**
 * @brief 恢复加载。
 *
 * 用于恢复一个通过 @link -[AliVodMediaLoader pause:index:] @endlink 暂停的加载任务。
 * @param vid 要恢复加载的 VID。
 * @param index 要恢复加载的索引。
 */
/****
 * @brief Resumes loading.
 *
 * Used to resume a loading task that was paused by @link -[AliVodMediaLoader pause:index:] @endlink.
 * @param vid The VID of the load to be resumed.
 * @param index The index of the load to be resumed.
 */
- (void)resume:(NSString *)vid index:(int)index;

/**
 * @brief 设置状态代理。
 *
 * @param delegate 实现了 @link AliVodMediaLoaderStatusDelegate @endlink 协议的对象，用于接收加载状态的回调。
 * @see @link AliVodMediaLoaderStatusDelegate @endlink
 */
/****
 * @brief Sets the status delegate.
 *
 * @param delegate An object that conforms to the @link AliVodMediaLoaderStatusDelegate @endlink protocol, used to receive loading status callbacks.
 * @see @link AliVodMediaLoaderStatusDelegate @endlink
 */
- (void)setAliVodMediaLoaderStatusDelegate:(id<AliVodMediaLoaderStatusDelegate>)delegate;
@end
