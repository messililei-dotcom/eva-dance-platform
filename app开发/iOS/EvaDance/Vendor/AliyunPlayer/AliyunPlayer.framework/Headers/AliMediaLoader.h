#import "AVPDef.h"
#import <Foundation/Foundation.h>

/**
 * @protocol AliMediaLoaderStatusDelegate
 * @brief 媒体文件加载状态的回调代理。
 *
 * 该协议定义了媒体文件预加载过程中的各种状态回调，包括错误、完成和取消。
 */
/****
 * @protocol AliMediaLoaderStatusDelegate
 * @brief The delegate for media file loading status callbacks.
 *
 * This protocol defines various status callbacks during the media file preloading process, including error, completion, and cancellation.
 */
@protocol AliMediaLoaderStatusDelegate <NSObject>
@optional

/**
 * @brief 错误回调。
 *
 * 当文件加载过程中发生错误时，此方法将被调用。
 *
 * @param url 发生错误的加载 URL。
 * @param code 错误码。-300 表示同一个 URL 已经加载过，-301 表示本地缓存未打开导致预加载失败。
 * @param msg 错误描述信息。
 * @deprecated 该方法已废弃，请使用 @link -[AliMediaLoaderStatusDelegate onErrorV2:errorModel:] @endlink 替代。
 */
/****
 * @brief Error callback.
 *
 * This method will be called when an error occurs during file loading.
 *
 * @param url The loading URL where the error occurred.
 * @param code Error code. -300 means the same URL has been loaded; -301 means the local cache is not enabled, causing the preload to fail.
 * @param msg Error description message.
 * @deprecated This method is deprecated. Use @link -[AliMediaLoaderStatusDelegate onErrorV2:errorModel:] @endlink instead.
 */
- (void)onError:(NSString *)url code:(int64_t)code msg:(NSString *)msg __attribute__((deprecated("This method is deprecated. Use `onErrorV2` instead.")));

/**
 * @brief 错误回调 V2。
 *
 * 当文件加载过程中发生错误时，此方法将被调用。此回调由加载操作触发。
 *
 * @param url 发生错误的加载 URL。
 * @param errorModel 播放器错误描述模型，包含更详细的错误信息。请参考 `AVPErrorModel` 的定义。
 * @see @link -[AliMediaLoader load:duration:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultBandWidth:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultResolutionProduct:] @endlink
 */
/****
 * @brief Error callback V2.
 *
 * This method will be called when an error occurs during file loading. This callback is triggered by a load operation.
 *
 * @param url The loading URL where the error occurred.
 * @param errorModel The player error description model, which contains more detailed error information. Refer to the definition of `AVPErrorModel`.
 * @see @link -[AliMediaLoader load:duration:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultBandWidth:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultResolutionProduct:] @endlink
 */
- (void)onErrorV2:(NSString *)url errorModel:(AVPErrorModel *)errorModel;

/**
 * @brief 完成回调。
 *
 * 当指定 URL 的文件加载完成时，此方法将被调用。此回调由加载操作触发。
 *
 * @param url 已完成加载的 URL。
 * @see @link -[AliMediaLoader load:duration:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultBandWidth:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultResolutionProduct:] @endlink
 */
/****
 * @brief Completed callback.
 *
 * This method will be called when the file loading for the specified URL is completed. This callback is triggered by a load operation.
 *
 * @param url The URL of the file that has finished loading.
 * @see @link -[AliMediaLoader load:duration:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultBandWidth:] @endlink
 * @see @link -[AliMediaLoader load:duration:defaultResolutionProduct:] @endlink
 */
- (void)onCompleted:(NSString *)url;

/**
 * @brief 取消回调。
 *
 * 当一个加载任务被取消时，此方法将被调用。此回调由 @link -[AliMediaLoader cancel:] @endlink 触发。
 *
 * @param url 被取消加载的 URL。
 * @see @link -[AliMediaLoader cancel:] @endlink
 */
/****
 * @brief Canceled callback.
 *
 * This method will be called when a loading task is canceled. This callback is triggered by @link -[AliMediaLoader cancel:] @endlink.
 *
 * @param url The URL of the loading task that was canceled.
 * @see @link -[AliMediaLoader cancel:] @endlink
 */
- (void)onCanceled:(NSString *)url;

@end


OBJC_EXPORT
/**
 * @interface AliMediaLoader
 * @brief 媒体文件预加载类。
 *
 * 提供对媒体文件的预加载、取消、暂停和恢复功能。这是一个单例类。
 */
/****
 * @interface AliMediaLoader
 * @brief Media file preloader class.
 *
 * Provides functionality to preload, cancel, pause, and resume media files. This is a singleton class.
 */
@interface AliMediaLoader : NSObject

/**
 * @brief 获取 AliMediaLoader 的单例实例。
 * @return `AliMediaLoader` 的共享实例。
 */
/****
 * @brief Gets the singleton instance of AliMediaLoader.
 * @return The shared instance of `AliMediaLoader`.
 */
+ (instancetype)shareInstance;

/**
 * @brief 开始加载文件。
 *
 * 这是一个异步操作，可以同时加载多个文件。对于多码率流，此方法默认加载最低码率的档位。
 *
 * @note 加载状态会通过 @link AliMediaLoaderStatusDelegate @endlink 中的回调方法通知。
 * @param url 待加载的视频文件地址。
 * @param duration 需要加载的时长，单位为毫秒。
 */
/****
 * @brief Starts loading a file.
 *
 * This is an asynchronous operation, and multiple files can be loaded simultaneously. For multi-bitrate streams, this method defaults to loading the lowest bitrate stream.
 *
 * @note Loading status will be notified through the callback methods in @link AliMediaLoaderStatusDelegate @endlink.
 * @param url The URL of the video file to be loaded.
 * @param duration The duration to load, in milliseconds.
 */
- (void)load:(NSString *)url duration:(int64_t)duration;

/**
 * @brief 开始加载文件，并指定默认码率。
 *
 * 这是一个异步操作，可以同时加载多个文件。加载多码率流时，会选择与指定码率最接近的档位进行加载。
 *
 * @note 加载状态会通过 @link AliMediaLoaderStatusDelegate @endlink 中的回调方法通知。
 * @param url 待加载的视频文件地址。
 * @param duration 需要加载的时长，单位为毫秒。
 * @param defaultBandWidth 加载多码率流时指定的默认码率，单位为 bps (bits per second)。SDK 会选择与此值最接近的码率档位。
 */
/****
 * @brief Starts loading a file, specifying the default bitrate.
 *
 * This is an asynchronous operation, and multiple files can be loaded simultaneously. When loading a multi-bitrate stream, the stream with the bitrate closest to the specified value will be selected.
 *
 * @note Loading status will be notified through the callback methods in @link AliMediaLoaderStatusDelegate @endlink.
 * @param url The URL of the video file to be loaded.
 * @param duration The duration to load, in milliseconds.
 * @param defaultBandWidth The default bitrate specified for loading a multi-bitrate stream, in bps (bits per second). The SDK will select the bitrate stream closest to this value.
 */
- (void)load:(NSString *)url duration:(int64_t)duration defaultBandWidth:(int)defaultBandWidth;


/**
 * @brief 开始加载文件，并指定默认清晰度。
 *
 * 这是一个异步操作，可以同时加载多个文件。加载多码率流时，会选择与指定清晰度最接近的档位进行加载。
 * 例如，当传入值为 1920 * 1080 = 2073600 时，会预加载宽高最接近 1920x1080 的档位。
 *
 * @note 加载状态会通过 @link AliMediaLoaderStatusDelegate @endlink 中的回调方法通知。
 * @param url 待加载的视频文件地址。
 * @param duration 需要加载的时长，单位为毫秒。
 * @param defaultResolutionProduct 清晰度的宽和高的乘积，用于选择最接近的清晰度档位。
 */
/****
 * @brief Starts loading a file, specifying the default resolution.
 *
 * This is an asynchronous operation, and multiple files can be loaded simultaneously. When loading a multi-bitrate stream, the stream with the resolution closest to the specified value will be selected.
 * For example, if the value 1920 * 1080 = 2073600 is provided, the stream with the resolution closest to 1920x1080 will be preloaded.
 *
 * @note Loading status will be notified through the callback methods in @link AliMediaLoaderStatusDelegate @endlink.
 * @param url The URL of the video file to be loaded.
 * @param duration The duration to load, in milliseconds.
 * @param defaultResolutionProduct The product of the width and height of the desired resolution, used to select the closest resolution stream.
 */
- (void)load:(NSString *)url duration:(int64_t)duration defaultResolutionProduct:(int64_t)defaultResolutionProduct;
/**
 * @brief 取消加载。
 *
 * @note 此操作不会删除已经下载到本地的文件。取消成功后会触发 @link -[AliMediaLoaderStatusDelegate onCanceled:] @endlink 回调。
 * @param url 要取消加载的视频文件地址。如果为 `nil` 或空字符串，则取消所有正在进行的加载任务。
 */
/****
 * @brief Cancels loading.
 *
 * @note This operation will not delete files that have already been downloaded locally. A successful cancellation will trigger the @link -[AliMediaLoaderStatusDelegate onCanceled:] @endlink callback.
 * @param url The URL of the video file to cancel loading. If `nil` or an empty string, all ongoing loading tasks will be canceled.
 */
- (void)cancel:(NSString *)url;

/**
 * @brief 暂停加载。
 *
 * @param url 要暂停加载的视频文件地址。如果为 `nil` 或空字符串，则暂停所有正在进行的加载任务。
 */
/****
 * @brief Pauses loading.
 *
 * @param url The URL of the video file to pause loading. If `nil` or an empty string, all ongoing loading tasks will be paused.
 */
- (void)pause:(NSString *)url;

/**
 * @brief 恢复加载。
 *
 * @param url 要恢复加载的视频文件地址。如果为 `nil` 或空字符串，则恢复所有已暂停的加载任务。
 */
/****
 * @brief Resumes loading.
 *
 * @param url The URL of the video file to resume loading. If `nil` or an empty string, all paused loading tasks will be resumed.
 */
- (void)resume:(NSString *)url;

/**
 * @brief 设置状态代理。
 *
 * 通过设置代理，可以监听加载过程中的错误、完成、取消等事件。
 *
 * @param delegate 实现了 `AliMediaLoaderStatusDelegate` 协议的对象。
 * @see AliMediaLoaderStatusDelegate
 */
/****
 * @brief Sets the status delegate.
 *
 * By setting a delegate, you can listen for events such as errors, completion, and cancellation during the loading process.
 *
 * @param delegate An object that conforms to the `AliMediaLoaderStatusDelegate` protocol.
 * @see AliMediaLoaderStatusDelegate
 */
- (void)setAliMediaLoaderStatusDelegate:(id<AliMediaLoaderStatusDelegate>)delegate;
@end
