//
// Created by yiliang on 2023/6/20.
//

#ifndef AVPPRELOADCONFIG_H
#define AVPPRELOADCONFIG_H
#import <Foundation/Foundation.h>

/**
 * @enum AVPPreloadOptionType
 * @brief 多码率流预加载的选项类型。
 *
 * 用于在预加载多码率流时，指定以何种标准（如分辨率、码率、清晰度）来选择要预加载的码率档位。
 */
/****
 * @enum AVPPreloadOptionType
 * @brief Option types for preloading multi-bitrate streams.
 *
 * Used to specify the criterion (e.g., resolution, bandwidth, quality) for selecting which stream to preload in a multi-bitrate context.
 */
typedef NS_ENUM(NSInteger, AVPPreloadOptionType) {
    /**
     * @brief 无指定选项。
     */
    /****
     * @brief No option specified.
     */
    AVPPreloadOptionTypeNone = 0,
    /**
     * @brief 按分辨率选择。
     */
    /****
     * @brief Select by resolution.
     */
    AVPPreloadOptionTypeResolution,
    /**
     * @brief 按码率选择。
     */
    /****
     * @brief Select by bandwidth.
     */
    AVPPreloadOptionTypeBandWidth,
    /**
     * @brief 按清晰度描述选择。
     */
    /****
     * @brief Select by quality description.
     */
    AVPPreloadOptionTypeQuality
};

/**
 * @interface AVPPreloadConfig
 * @brief 预加载配置类。
 *
 * 该类用于配置预加载任务的具体参数，如预加载时长、网络参数以及多码率流的选择策略。
 * 通常与 @link AVPPreloadTask @endlink 一起使用。
 * @see @link AVPPreloadTask @endlink
 */
/****
 * @interface AVPPreloadConfig
 * @brief Preload configuration class.
 *
 * This class is used to configure specific parameters for a preload task, such as preload duration, network settings, and selection strategy for multi-bitrate streams.
 * It is typically used in conjunction with @link AVPPreloadTask @endlink.
 * @see @link AVPPreloadTask @endlink
 */
OBJC_EXPORT
@interface AVPPreloadConfig : NSObject

/**
 * @property preloadDuration
 * @brief 预加载时长，单位为毫秒。
 * @see -[AVPPreloadConfig setDuration:]
 * @see -[AVPPreloadConfig getDuration]
 */
/****
 * @property preloadDuration
 * @brief Preload duration, in milliseconds.
 * @see -[AVPPreloadConfig setDuration:]
 * @see -[AVPPreloadConfig getDuration]
 */
@property (nonatomic, assign) int preloadDuration;

/**
 * @property loadStartPositionMs
 * @brief 预加载的起始位置，单位为毫秒。
 * @see -[AVPPreloadConfig setLoadStartPositionMs:]
 * @see -[AVPPreloadConfig getLoadStartPositionMs]
 */
/****
 * @property loadStartPositionMs
 * @brief The starting position to preload, in milliseconds.
 * @see -[AVPPreloadConfig setLoadStartPositionMs:]
 * @see -[AVPPreloadConfig getLoadStartPositionMs]
 */
@property (nonatomic, assign) int loadStartPositionMs;

/**
 * @property networkTimeout
 * @brief 网络超时时间，单位为毫秒。
 * @see -[AVPPreloadConfig setNetworkTimeout:]
 * @see -[AVPPreloadConfig getNetworkTimeout]
 */
/****
 * @property networkTimeout
 * @brief Network timeout, in milliseconds.
 * @see -[AVPPreloadConfig setNetworkTimeout:]
 * @see -[AVPPreloadConfig getNetworkTimeout]
 */
@property (nonatomic, assign) int networkTimeout;

/**
 * @property networkRetryCount
 * @brief 网络重试次数。
 * @see -[AVPPreloadConfig setNetworkRetryCount:]
 * @see -[AVPPreloadConfig getNetworkRetryCount]
 */
/****
 * @property networkRetryCount
 * @brief Network retry count.
 * @see -[AVPPreloadConfig setNetworkRetryCount:]
 * @see -[AVPPreloadConfig getNetworkRetryCount]
 */
@property (nonatomic, assign) int networkRetryCount;

/**
 * @property referrer
 * @brief HTTP 请求的 Referrer。
 * @see -[AVPPreloadConfig setReferrer:]
 * @see -[AVPPreloadConfig getReferrer]
 */
/****
 * @property referrer
 * @brief The Referrer for HTTP requests.
 * @see -[AVPPreloadConfig setReferrer:]
 * @see -[AVPPreloadConfig getReferrer]
 */
@property (nonatomic, strong) NSString *referrer;

/**
 * @property customHeaders
 * @brief 自定义 HTTP Headers。
 * @see -[AVPPreloadConfig setCustomHeaders:]
 * @see -[AVPPreloadConfig getCustomHeaders]
 */
/****
 * @property customHeaders
 * @brief Custom HTTP Headers.
 * @see -[AVPPreloadConfig setCustomHeaders:]
 * @see -[AVPPreloadConfig getCustomHeaders]
 */
@property (nonatomic, strong) NSArray<NSString *> *customHeaders;

/**
 * @property preloadOptionType
 * @brief 多码率流预加载的选项类型。
 * @see @link AVPPreloadOptionType @endlink
 */
/****
 * @property preloadOptionType
 * @brief The option type for preloading multi-bitrate streams.
 * @see @link AVPPreloadOptionType @endlink
 */
@property (nonatomic, assign) AVPPreloadOptionType preloadOptionType;

/**
 * @property optionIntValue
 * @brief 当 `preloadOptionType` 为 @link AVPPreloadOptionTypeResolution @endlink 或 @link AVPPreloadOptionTypeBandWidth @endlink 时，此属性存储对应的整数值。
 */
/****
 * @property optionIntValue
 * @brief When `preloadOptionType` is @link AVPPreloadOptionTypeResolution @endlink or @link AVPPreloadOptionTypeBandWidth @endlink, this property stores the corresponding integer value.
 */
@property (nonatomic, assign) int optionIntValue;

/**
 * @property optionStringValue
 * @brief 当 `preloadOptionType` 为 @link AVPPreloadOptionTypeQuality @endlink 时，此属性存储对应的字符串值。
 */
/****
 * @property optionStringValue
 * @brief When `preloadOptionType` is @link AVPPreloadOptionTypeQuality @endlink, this property stores the corresponding string value.
 */
@property (nonatomic, strong) NSString *optionStringValue;

/**
 * @brief 默认构造函数。
 * @return 一个已初始化的 `AVPPreloadConfig` 实例。
 */
/****
 * @brief Default constructor.
 * @return An initialized `AVPPreloadConfig` instance.
 */
- (instancetype)init;
/**
 * @brief 使用指定时长构造预加载配置。
 * @param duration 预加载时长，单位为毫秒。
 * @return 一个已初始化的 `AVPPreloadConfig` 实例。
 */
/****
 * @brief Constructs a preload configuration with a specified duration.
 * @param duration Preload duration, in milliseconds.
 * @return An initialized `AVPPreloadConfig` instance.
 */
- (instancetype)initWithDuration:(int)duration;

/**
 * @brief 获取预加载时长。
 * @return 预加载时长，单位为毫秒。
 * @see @link AVPPreloadConfig::preloadDuration @endlink
 */
/****
 * @brief Gets the preload duration.
 * @return Preload duration, in milliseconds.
 * @see @link AVPPreloadConfig::preloadDuration @endlink
 */
- (int)getDuration;

/**
 * @brief 设置预加载时长。
 * @param duration 预加载时长，单位为毫秒。
 * @see @link AVPPreloadConfig::preloadDuration @endlink
 */
/****
 * @brief Sets the preload duration.
 * @param duration Preload duration, in milliseconds.
 * @see @link AVPPreloadConfig::preloadDuration @endlink
 */
- (void)setDuration:(int)duration;

/**
 * @brief 获取预加载的起始位置。
 * @return 预加载的起始位置，单位为毫秒。
 * @see @link AVPPreloadConfig::loadStartPositionMs @endlink
 */
/****
 * @brief Gets the starting position to preload.
 * @return The starting position to preload, in milliseconds.
 * @see @link AVPPreloadConfig::loadStartPositionMs @endlink
 */
- (int)getLoadStartPositionMs;

/**
 * @brief 设置预加载的起始位置。
 * @param startPositionMs 预加载的起始位置，单位为毫秒。
 * @see @link AVPPreloadConfig::loadStartPositionMs @endlink
 */
/****
 * @brief Sets the starting position to preload.
 * @param startPositionMs The starting position to preload, in milliseconds.
 * @see @link AVPPreloadConfig::loadStartPositionMs @endlink
 */
- (void)setLoadStartPositionMs:(int)startPositionMs;

/**
 * @brief 获取网络超时时间。
 * @return 网络超时时间，单位为毫秒。
 * @see @link AVPPreloadConfig::networkTimeout @endlink
 */
/****
 * @brief Gets the network timeout.
 * @return Network timeout, in milliseconds.
 * @see @link AVPPreloadConfig::networkTimeout @endlink
 */
- (int)getNetworkTimeout;

/**
 * @brief 设置网络超时时间。
 * @param networkTimeout 网络超时时间，单位为毫秒。
 * @see @link AVPPreloadConfig::networkTimeout @endlink
 */
/****
 * @brief Sets the network timeout.
 * @param networkTimeout Network timeout, in milliseconds.
 * @see @link AVPPreloadConfig::networkTimeout @endlink
 */
- (void)setNetworkTimeout:(int)networkTimeout;

/**
 * @brief 获取网络重试次数。
 * @return 网络重试次数。
 * @see @link AVPPreloadConfig::networkRetryCount @endlink
 */
/****
 * @brief Gets the network retry count.
 * @return Network retry count.
 * @see @link AVPPreloadConfig::networkRetryCount @endlink
 */
- (int)getNetworkRetryCount;

/**
 * @brief 设置网络重试次数。
 * @param networkRetryCount 网络重试次数。
 * @see @link AVPPreloadConfig::networkRetryCount @endlink
 */
/****
 * @brief Sets the network retry count.
 * @param networkRetryCount Network retry count.
 * @see @link AVPPreloadConfig::networkRetryCount @endlink
 */
- (void)setNetworkRetryCount:(int)networkRetryCount;

/**
 * @brief 获取 Referrer。
 * @return Referrer 字符串。
 * @see @link AVPPreloadConfig::referrer @endlink
 */
/****
 * @brief Gets the Referrer.
 * @return The Referrer string.
 * @see @link AVPPreloadConfig::referrer @endlink
 */
- (NSString *)getReferrer;

/**
 * @brief 设置 Referrer。
 * @param referrer Referrer 字符串。
 * @see @link AVPPreloadConfig::referrer @endlink
 */
/****
 * @brief Sets the Referrer.
 * @param referrer The Referrer string.
 * @see @link AVPPreloadConfig::referrer @endlink
 */
- (void)setReferrer:(NSString *)referrer;

/**
 * @brief 获取自定义 Headers。
 * @return 自定义 Headers 数组。
 * @see @link AVPPreloadConfig::customHeaders @endlink
 */
/****
 * @brief Gets the custom headers.
 * @return An array of custom headers.
 * @see @link AVPPreloadConfig::customHeaders @endlink
 */
- (NSArray<NSString *> *)getCustomHeaders;

/**
 * @brief 设置自定义 Headers。
 * @param customHeaders 自定义 Headers 数组。
 * @see @link AVPPreloadConfig::customHeaders @endlink
 */
/****
 * @brief Sets the custom headers.
 * @param customHeaders An array of custom headers.
 * @see @link AVPPreloadConfig::customHeaders @endlink
 */
- (void)setCustomHeaders:(NSArray<NSString *> *)customHeaders;

/**
 * @brief 为多码率流设置预加载的分辨率。
 * @note 调用此方法会设置预加载选项类型为 @link AVPPreloadOptionTypeResolution @endlink。
 * @param resolution 分辨率的宽和高的乘积。SDK 将选择与此值最接近的码率档位进行预加载。
 */
/****
 * @brief Sets the preload resolution for a multi-bitrate stream.
 * @note Calling this method sets the preload option type to @link AVPPreloadOptionTypeResolution @endlink.
 * @param resolution The product of the width and height of the resolution. The SDK will select the stream with the closest value for preloading.
 */
- (void)setDefaultResolution:(int)resolution;

/**
 * @brief 获取已设置的预加载分辨率。
 * @note 仅当预加载选项类型为 @link AVPPreloadOptionTypeResolution @endlink 时，返回值才有意义。
 * @return 分辨率的宽和高的乘积。
 */
/****
 * @brief Gets the configured preload resolution.
 * @note The return value is only meaningful when the preload option type is @link AVPPreloadOptionTypeResolution @endlink.
 * @return The product of the width and height of the resolution.
 */
- (int)getDefaultResolution;

/**
 * @brief 为多码率流设置预加载的码率。
 * @note 调用此方法会设置预加载选项类型为 @link AVPPreloadOptionTypeBandWidth @endlink。
 * @param bandWidth 目标码率。SDK 将选择与此值最接近的码率档位进行预加载。
 */
/****
 * @brief Sets the preload bitrate for a multi-bitrate stream.
 * @note Calling this method sets the preload option type to @link AVPPreloadOptionTypeBandWidth @endlink.
 * @param bandWidth The target bitrate. The SDK will select the stream with the closest value for preloading.
 */
- (void)setDefaultBandWidth:(int)bandWidth;

/**
 * @brief 获取已设置的预加载码率。
 * @note 仅当预加载选项类型为 @link AVPPreloadOptionTypeBandWidth @endlink 时，返回值才有意义。
 * @return 目标码率。
 */
/****
 * @brief Gets the configured preload bitrate.
 * @note The return value is only meaningful when the preload option type is @link AVPPreloadOptionTypeBandWidth @endlink.
 * @return The target bitrate.
 */
- (int)getDefaultBandWidth;

/**
 * @brief 为多码率流设置预加载的清晰度。
 * @note 调用此方法会设置预加载选项类型为 @link AVPPreloadOptionTypeQuality @endlink。
 * @param quality 目标清晰度的描述字符串。
 */
/****
 * @brief Sets the preload quality for a multi-bitrate stream.
 * @note Calling this method sets the preload option type to @link AVPPreloadOptionTypeQuality @endlink.
 * @param quality The description string of the target quality.
 */
- (void)setDefaultQuality:(NSString *)quality;

/**
 * @brief 获取已设置的预加载清晰度。
 * @note 仅当预加载选项类型为 @link AVPPreloadOptionTypeQuality @endlink 时，返回值才有意义。
 * @return 目标清晰度的描述字符串。
 */
/****
 * @brief Gets the configured preload quality.
 * @note The return value is only meaningful when the preload option type is @link AVPPreloadOptionTypeQuality @endlink.
 * @return The description string of the target quality.
 */
- (NSString *)getDefaultQuality;

/**
 * @brief 获取当前设置的默认预加载选项类型。
 * @return 当前的预加载选项类型。
 * @see @link AVPPreloadOptionType @endlink
 */
/****
 * @brief Gets the currently configured default preload option type.
 * @return The current preload option type.
 * @see @link AVPPreloadOptionType @endlink
 */
- (AVPPreloadOptionType)getDefaultType;

@end

#endif //AVPPRELOADCONFIG_H
