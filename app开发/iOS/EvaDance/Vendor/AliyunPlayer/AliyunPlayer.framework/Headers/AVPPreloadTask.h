#ifndef PreloadTask_h
#define PreloadTask_h

#import <Foundation/Foundation.h>
#import "AVPDef.h"
#import "AVPSource.h"

@class AVPSource;
@class AVPUrlSource;
@class AVPVidAuthSource;
@class AVPVidStsSource;
@class AVPPreloadConfig;

/**
 * @interface AVPPreloadTask
 * @brief 预加载任务类。
 *
 * 该类用于描述一个具体的预加载任务，它封装了预加载所需的数据源和相关配置。
 * 创建后的任务对象通常用于提交给 @link AliMediaLoaderV2 @endlink 执行。
 * @see @link AliMediaLoaderV2 @endlink
 */
/**
 * @interface AVPPreloadTask
 * @brief Preload task class.
 *
 * This class is used to describe a specific preload task, encapsulating the data source and related configurations required for preloading.
 * The created task object is typically submitted to @link AliMediaLoaderV2 @endlink for execution.
 * @see @link AliMediaLoaderV2 @endlink
 */
@interface AVPPreloadTask : NSObject

/**
 * @property source
 * @brief 预加载的媒体资源。
 *
 * 这是一个 @link AVPSource @endlink 对象，可以是 @link AVPVidAuthSource @endlink、@link AVPVidStsSource @endlink 或 @link AVPUrlSource @endlink 的实例。
 */
/**
 * @property source
 * @brief The media resource to be preloaded.
 *
 * This is an @link AVPSource @endlink object, which can be an instance of @link AVPVidAuthSource @endlink, @link AVPVidStsSource @endlink, or @link AVPUrlSource @endlink.
 */
@property (nonatomic, strong) AVPSource *source;

/**
 * @property preloadConfig
 * @brief 预加载配置。
 *
 * 包含了本次预加载任务的具体配置信息，如预加载时长等。
 */
/**
 * @property preloadConfig
 * @brief Preload configuration.
 *
 * Contains specific configuration information for this preload task, such as the preload duration.
 */
@property (nonatomic, strong) AVPPreloadConfig *preloadConfig;

/**
 * @brief 使用 VidAuth 类型数据源构造预加载任务。
 *
 * @param source @link AVPVidAuthSource @endlink 类型的媒体资源。
 * @param preloadConfig @link AVPPreloadConfig @endlink 类型的预加载配置。
 * @return 一个已初始化的 `AVPPreloadTask` 实例。
 */
/**
 * @brief Constructs a preload task using a VidAuth type data source.
 *
 * @param source A media resource of type @link AVPVidAuthSource @endlink.
 * @param preloadConfig A preload configuration of type @link AVPPreloadConfig @endlink.
 * @return An initialized `AVPPreloadTask` instance.
 */
- (instancetype)initWithVidAuthSource:(AVPVidAuthSource *)source
                        preloadConfig:(AVPPreloadConfig *)preloadConfig;

/**
 * @brief 使用 VidSts 类型数据源构造预加载任务。
 *
 * @param source @link AVPVidStsSource @endlink 类型的媒体资源。
 * @param preloadConfig @link AVPPreloadConfig @endlink 类型的预加载配置。
 * @return 一个已初始化的 `AVPPreloadTask` 实例。
 */
/**
 * @brief Constructs a preload task using a VidSts type data source.
 *
 * @param source A media resource of type @link AVPVidStsSource @endlink.
 * @param preloadConfig A preload configuration of type @link AVPPreloadConfig @endlink.
 * @return An initialized `AVPPreloadTask` instance.
 */
- (instancetype)initWithVidStsSource:(AVPVidStsSource *)source
                       preloadConfig:(AVPPreloadConfig *)preloadConfig;

/**
 * @brief 使用 UrlSource 类型数据源构造预加载任务。
 *
 * @param source @link AVPUrlSource @endlink 类型的媒体资源。
 * @param preloadConfig @link AVPPreloadConfig @endlink 类型的预加载配置。
 * @return 一个已初始化的 `AVPPreloadTask` 实例。
 */
/**
 * @brief Constructs a preload task using a UrlSource type data source.
 *
 * @param source A media resource of type @link AVPUrlSource @endlink.
 * @param preloadConfig A preload configuration of type @link AVPPreloadConfig @endlink.
 * @return An initialized `AVPPreloadTask` instance.
 */
- (instancetype)initWithUrlSource:(AVPUrlSource *)source
                    preloadConfig:(AVPPreloadConfig *)preloadConfig;

@end


#endif /* PreloadTask_h */
