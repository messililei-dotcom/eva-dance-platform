#import <Foundation/Foundation.h>
#import "AVPDef.h"
@class AVPPreloadTask;

/**
 * @protocol OnPreloadListener
 * @brief 预加载任务状态回调协议。
 *
 * 用于监听预加载任务的状态变化，包括成功、失败和取消。
 */
/**
 * @protocol OnPreloadListener
 * @brief Preload task status callback protocol.
 *
 * Used for listening to status changes of preload tasks, including success, failure, and cancellation.
 */
@protocol OnPreloadListener <NSObject>
@optional
/**
 * @brief 预加载任务出错时的回调。
 *
 * 当通过 @link -[AliMediaLoaderV2 addTask:listener:] @endlink 添加的任务在执行过程中发生错误时，此方法将被调用。
 *
 * @param taskId 发生错误的预加载任务 ID。
 * @param urlOrVid 任务对应的数据源，可以是 URL 或 VID。
 * @param errorModel 错误信息模型，包含了详细的错误码和错误描述。
 * @see @link -[AliMediaLoaderV2 addTask:listener:] @endlink
 */
/**
 * @brief Callback for when a preload task encounters an error.
 *
 * This method is called when a task added via @link -[AliMediaLoaderV2 addTask:listener:] @endlink encounters an error during execution.
 *
 * @param taskId The ID of the preload task that encountered an error.
 * @param urlOrVid The data source corresponding to the task, which can be a URL or VID.
 * @param errorModel The error information model, containing a detailed error code and description.
 * @see @link -[AliMediaLoaderV2 addTask:listener:] @endlink
 */
- (void)onError:(NSString *)taskId urlOrVid:(NSString *)urlOrVid errorModel:(AVPErrorModel *)errorModel;

/**
 * @brief 预加载任务完成时的回调。
 *
 * 当通过 @link -[AliMediaLoaderV2 addTask:listener:] @endlink 添加的任务成功完成预加载时，此方法将被调用。
 *
 * @param taskId 完成的预加载任务 ID。
 * @param urlOrVid 任务对应的数据源，可以是 URL 或 VID。
 * @see @link -[AliMediaLoaderV2 addTask:listener:] @endlink
 */
/**
 * @brief Callback for when a preload task is completed.
 *
 * This method is called when a task added via @link -[AliMediaLoaderV2 addTask:listener:] @endlink successfully completes preloading.
 *
 * @param taskId The ID of the completed preload task.
 * @param urlOrVid The data source corresponding to the task, which can be a URL or VID.
 * @see @link -[AliMediaLoaderV2 addTask:listener:] @endlink
 */
- (void)onCompleted:(NSString *)taskId urlOrVid:(NSString *)urlOrVid;

/**
 * @brief 预加载任务取消时的回调。
 *
 * 当通过 @link -[AliMediaLoaderV2 cancelTask:] @endlink 取消一个预加载任务后，此方法将被调用。
 *
 * @param taskId 被取消的预加载任务 ID。
 * @param urlOrVid 任务对应的数据源，可以是 URL 或 VID。
 * @see @link -[AliMediaLoaderV2 cancelTask:] @endlink
 */
/**
 * @brief Callback for when a preload task is canceled.
 *
 * This method is called after a preload task is canceled via @link -[AliMediaLoaderV2 cancelTask:] @endlink.
 *
 * @param taskId The ID of the canceled preload task.
 * @param urlOrVid The data source corresponding to the task, which can be a URL or VID.
 * @see @link -[AliMediaLoaderV2 cancelTask:] @endlink
 */
- (void)onCanceled:(NSString *)taskId urlOrVid:(NSString *)urlOrVid;

/**
 * @brief Generic info event during preload. Broadcast to all active listeners (no taskId).
 * @param code Event code, matching {@link AVPEventWithString}.
 * @param info JSON string with event details.
 */
- (void)onInfo:(int)code info:(NSString *)info;
@end


/**
 * @interface AliMediaLoaderV2
 * @brief 媒体预加载管理器。
 *
 * 提供预加载任务的提交、控制和状态监控能力。这是一个单例类。
 */
/**
 * @interface AliMediaLoaderV2
 * @brief Media preload manager.
 *
 * Provides capabilities for submitting, controlling, and monitoring the status of preload tasks. This is a singleton class.
 */
@interface AliMediaLoaderV2 : NSObject

+ (instancetype)new NS_UNAVAILABLE;
- (instancetype)init NS_UNAVAILABLE;

/**
 * @brief 获取 AliMediaLoaderV2 的单例实例。
 *
 * @return `AliMediaLoaderV2` 的共享单例对象。
 */
/**
 * @brief Gets the singleton instance of AliMediaLoaderV2.
 *
 * @return The shared singleton object of `AliMediaLoaderV2`.
 */
+ (instancetype)shareInstance;

/**
 * @brief 添加一个预加载任务。
 *
 * 此方法用于提交一个预加载任务，并为该任务指定一个状态回调监听器。操作是异步的。
 *
 * 每次提交任务时系统都会生成一个唯一的任务 ID（taskId），即使提交的是配置完全相同的任务，该任务的 ID 也会不同。
 *
 * 多个添加的预加载任务之间是并行执行的，无优先级之分。
 *
 * @param preloadTask @link AVPPreloadTask @endlink 预加载任务对象，包含了数据源和需要加载的时长等信息。
 * @param listener 实现了 @link OnPreloadListener @endlink 协议的监听器对象。任务状态发生变更时，会通过此监听器的方法进行通知。
 * @return 返回一个唯一分配的任务 ID (taskId)，可用于后续对该任务进行控制（如取消、暂停）和状态查询。
 */
/**
 * @brief Adds a preload task.
 *
 * This method is used to submit a preload task and specify a status callback listener for it. The operation is asynchronous.
 *
 * Each time a task is submitted, the system generates a unique task ID (taskId). Even if the same task configuration is submitted multiple times, the corresponding task IDs will still be different.
 *
 * Multiple tasks added are executed in parallel with no priority order.
 *
 * @param preloadTask The @link AVPPreloadTask @endlink object, which contains information such as the data source and loading duration.
 * @param listener A listener object that conforms to the @link OnPreloadListener @endlink protocol. When the task status changes, notifications will be sent through the methods of this listener.
 * @return Returns a uniquely assigned task ID (taskId), which can be used for subsequent control (e.g., cancel, pause) and status query of the task.
 */
- (NSString *)addTask:(AVPPreloadTask *)preloadTask listener:(id<OnPreloadListener>)listener;

/**
 * @brief 取消指定任务 ID 的加载。
 *
 * @note 此操作不会删除已经下载到本地的文件，仅取消尚未完成部分的加载。成功取消后，会触发 @link -[OnPreloadListener onCanceled:urlOrVid:] @endlink 回调。
 *
 * @param taskId 要取消加载的任务 ID，该 ID 由 @link -[AliMediaLoaderV2 addTask:listener:] @endlink 返回。
 */
/**
 * @brief Cancels the loading for the specified task ID.
 *
 * @note This operation does not delete files that have already been downloaded locally; it only cancels the loading of the unfinished parts. Upon successful cancellation, the @link -[OnPreloadListener onCanceled:urlOrVid:] @endlink callback will be triggered.
 *
 * @param taskId The ID of the task to be canceled, which is returned by @link -[AliMediaLoaderV2 addTask:listener:] @endlink.
 */
- (void)cancelTask:(NSString *)taskId;

/**
 * @brief 暂停指定任务 ID 的加载。
 *
 * @param taskId 要暂停加载的任务 ID，该 ID 由 @link -[AliMediaLoaderV2 addTask:listener:] @endlink 返回。
 */
/**
 * @brief Pauses the loading for the specified task ID.
 *
 * @param taskId The ID of the task to be paused, which is returned by @link -[AliMediaLoaderV2 addTask:listener:] @endlink.
 */
- (void)pauseTask:(NSString *)taskId;

/**
 * @brief 恢复指定任务 ID 的加载。
 *
 * 用于继续一个之前被 @link -[AliMediaLoaderV2 pauseTask:] @endlink 暂停的任务。
 *
 * @param taskId 要恢复加载的任务 ID，该 ID 由 @link -[AliMediaLoaderV2 addTask:listener:] @endlink 返回。
 * @see @link -[AliMediaLoaderV2 pauseTask:] @endlink
 */
/**
 * @brief Resumes the loading for the specified task ID.
 *
 * Used to continue a task that was previously paused by @link -[AliMediaLoaderV2 pauseTask:] @endlink.
 *
 * @param taskId The ID of the task to be resumed, which is returned by @link -[AliMediaLoaderV2 addTask:listener:] @endlink.
 * @see @link -[AliMediaLoaderV2 pauseTask:] @endlink
 */
- (void)resumeTask:(NSString *)taskId;

@end
