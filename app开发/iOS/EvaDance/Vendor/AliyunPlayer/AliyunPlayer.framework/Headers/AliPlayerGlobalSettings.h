//
//  AliPlayerGlobalSettings.h
//  AliPlayerGlobalSettings
//
//  Created by huang_jiafa on 2020/04/09.
//  Copyright © 2020 com.alibaba.AliyunPlayer. All rights reserved.
//

#import "AVPDef.h"
#import <Foundation/Foundation.h>

OBJC_EXPORT
@interface AliPlayerGlobalSettings : NSObject

/**
 * 设置字符串类型的全局功能选项。
 *
 * <p>该方法用于配置影响所有播放器实例的底层行为参数。
 *
 * <p><strong>注意</strong>：部分选项（如 {@link MAX_ERROR_FRAMES_HARDWARE_DECODE}）
 * 在此重载中被忽略，应使用整型重载方法设置。
 *
 * @param key 选项 key，由 SDK 定义的整型常量，参考 {@link GlobalOption}
 * @param value 选项对应的字符串值
 * @see @link +setOption:valueInt: @endlink
 */
/****
 * Sets a global string-type feature option.
 *
 * <p>This method configures low-level parameters that affect all player instances.
 *
 * <p><strong>Note</strong>: Certain options (e.g., {@link MAX_ERROR_FRAMES_HARDWARE_DECODE})
 * are ignored in this overload; use the integer overload instead.
 *
 * @param key The option key, defined as an integer constant by the SDK, @see {@link GlobalOption}
 * @param value The corresponding string value for the option
 * @see @link +setOption:valueInt: @endlink
 */
+(void)setOption:(GlobalOption)key value:(NSString *)value;

/**
 * 设置整型类型的全局功能选项。
 *
 * <p>该方法用于配置影响所有播放器实例的底层行为参数。
 *
 * @param key 选项 key，由 SDK 定义的整型常量，参考 {@link GlobalOption}
 * @param valueInt 选项对应的整型值
 * @see @link +setOption:value: @endlink
 */
/****
 * Sets a global integer-type feature option.
 *
 * <p>This method configures low-level parameters that affect all player instances.
 *
 * @param key The option key, defined as an integer constant by the SDK, @see {@link GlobalOption}
 * @param valueInt The corresponding integer value for the option
 * @see @link +setOption:value: @endlink
 */
+(void)setOption:(GlobalOption)key valueInt:(int)value;

/**
 * 设置域名对应的解析 IP。
 *
 * <p>该方法用于自定义 DNS 解析，将指定域名（含端口）映射到固定 IP 地址。
 *
 * <p>设置空字符串可清除已有设定。
 *
 * @param host 域名，需指定端口（HTTP 默认端口 80，HTTPS 默认端口 443），例如：player.alicdn.com:443
 * @param ip 对应的 IP 地址；设置为空字符串可清空该域名的解析设定
 */
/****
 * Sets a DNS IP mapping for a specific host.
 *
 * <p>This method customizes DNS resolution by mapping a given host (with port) to a fixed IP address.
 *
 * <p>Setting an empty string clears the existing mapping.
 *
 * @param host The host name with port (HTTP default port is 80, HTTPS default port is 443), e.g., player.alicdn.com:443
 * @param ip The corresponding IP address; set to an empty string to clear the mapping
 */
+(void)setDNSResolve:(NSString *)host ip:(NSString *)ip;

/**
 * 设置域名解析时使用的 IP 地址类型。
 *
 * <p>控制 DNS 解析时优先使用的 IP 协议版本。
 *
 * @param type IP 地址类型，由 {@link AVPIpResolveType} 枚举定义
 */
/****
 * Sets the IP address type used during DNS resolution.
 *
 * <p>This setting affects all subsequent DNS resolution behavior.
 *
 * @param type The IP type, defined by the {@link AVPIpResolveType} enum
 */
+(void)setIpResolveType:(AVPIpResolveType)type;

/**
 * 设置是否启用 HTTP/2 协议。
 *
 * <p>自 SDK 版本 v5.5.0.0 起默认启用。
 *
 * @param use 是否启用 HTTP/2
 */
/****
 * Sets whether to use HTTP/2 protocol.
 *
 * <p>HTTP/2 is enabled by default since SDK version v5.5.0.0.
 *
 * @param use Whether to enable HTTP/2
 */
+ (void)setUseHttp2:(bool)use;

/**
 * 设置 FairPlay 用户证书 ID。
 *
 * <p>每次调用此方法更新证书 ID 时，每次设置必须在同一个线程，否则更新无效。
 *
 * @param certID 用户证书 ID 字符串
 */
/****
 * Sets the FairPlay user certificate ID.
 *
 * <p>Each update of the certificate ID must be performed on the **same thread** used for the initial setting;
 * otherwise, the update will have no effect.
 *
 * @param certID The user certificate ID string
 */
+(void)setFairPlayCertID:(NSString *)certID;

/**
 * 设置是否启用硬件提供的音频变速播放能力。
 *
 * <p>关闭后将使用软件实现音频倍速播放。
 *
 * <p>此设置会影响音频渲染回调（PCM 回调）的数据格式。
 *
 * <p>若需修改此设置，必须在**同一线程**中操作。
 *
 * <p>默认启用。
 *
 * @param enable 是否启用硬件音频变速
 */
/****
 * Enables or disables hardware-accelerated audio tempo scaling.
 *
 * <p>When disabled, software-based tempo scaling is used instead.
 *
 * <p>This setting affects the PCM data format in audio rendering callbacks.
 *
 * <p>If this setting is modified, it must be done on the **same thread**.
 *
 * <p>Enabled by default.
 *
 * @param enable Whether to enable hardware audio tempo scaling
 */
+ (void)enableHWAduioTempo:(bool)enable;

/**
 * 开启或关闭指定的解码插件。
 *
 * @param target 解码插件标识符；若为空字符串，则忽略此调用
 * @param valid true 表示开启插件，false 表示关闭插件
 */
/****
 * Enables or disables a specific codec plugin.
 *
 * @param target The codec plugin identifier; if empty, the call is ignored
 * @param valid true to enable the plugin, false to disable it
 */
+ (void)enableCodecPlugin:(NSString *)target valid:(BOOL)valid;


/**
 * 强制音频渲染器使用指定的 PCM 格式进行渲染。
 *
 * <p>若设备不支持指定格式，则设置无效，将使用默认格式。
 *
 * <p>无效参数（如超出范围的声道数或采样率）将被忽略。
 *
 * <p>此设置会影响音频渲染回调（PCM 回调）的数据格式。
 *
 * <p>若需修改此设置，必须在**同一线程**中操作。
 *
 * <p>默认关闭。
 *
 * @param force 是否启用强制格式设置
 * @param fmt PCM 格式，当前仅支持 s16（16 位有符号整数）
 * @param channels PCM 声道数，有效范围为 1～8
 * @param sample_rate PCM 采样率，有效范围为 1～48000 Hz
 */
/****
 * Forces the audio renderer to use a specified PCM format.
 *
 * <p>If the specified format is not supported by the device, the setting has no effect and the default format is used.
 *
 * <p>Out-of-range parameters (e.g., invalid channel count or sample rate) are ignored.
 *
 * <p>This setting affects the PCM data format in audio rendering callbacks.
 *
 * <p>If this setting is modified, it must be done on the **same thread**.
 *
 * <p>Disabled by default.
 *
 * @param force Whether to enable forced format setting
 * @param fmt PCM format; currently only "s16" (16-bit signed integer) is supported
 * @param channels PCM channel count; valid range is 1–8
 * @param sample_rate PCM sample rate in Hz; valid range is 1–48000
 */

+ (void)forceAudioRendingFormat:(bool)force fmt:(NSString *)fmt channels:(int)channels sample_rate:(int)sample_rate;

/**
 * 开启或关闭本地缓存功能。
 *
 * <p>开启后，媒体内容将被缓存到本地文件中。
 *
 * <p>默认关闭。
 *
 * @param enable true 表示开启本地缓存，false 表示关闭
 * @return 本地缓存的根目录路径
 */
/****
 * Enables or disables local caching.
 *
 * <p>When enabled, media content is cached to local files.
 *
 * <p>Disabled by default.
 *
 * @param enable true to enable local cache, false to disable it
 * @return The root directory path for local cache
 */
+ (NSString *) enableLocalCache:(BOOL)enable;

/**
 * 开启或关闭本地缓存功能，并指定缓存目录。
 *
 * <p>开启后，媒体内容将被缓存到指定的本地目录中。
 *
 * <p><strong>注意</strong>：参数 {@code maxBufferMemoryKB} 已弃用，设置无效。
 *
 * <p>默认关闭。
 *
 * @param enable true 表示开启本地缓存，false 表示关闭
 * @param maxBufferMemoryKB 此参数已弃用，设置无效
 * @param localCacheDir 本地缓存的绝对路径目录
 */
/****
 * Enables or disables local caching and specifies the cache directory.
 *
 * <p>When enabled, media content is cached to the specified local directory.
 *
 * <p><strong>Note</strong>: The parameter {@code maxBufferMemoryKB} is deprecated and has no effect.
 *
 * <p>Disabled by default.
 *
 * @param enable true to enable local cache, false to disable it
 * @param maxBufferMemoryKB This parameter is deprecated and has no effect
 * @param localCacheDir Absolute path to the local cache directory
 */
+ (void)enableLocalCache:(bool)enable maxBufferMemoryKB:(int)maxBufferMemoryKB localCacheDir:(NSString *)localCacheDir;

/**
 @brief 本地缓存文件自动清理相关的设置
 @param expireMin 缓存多久过期：单位分钟，默认值30天，过期的缓存不管容量如何，都会在清理时淘汰掉；
 @param maxCapacityMB 最大缓存容量：单位兆，默认值2GB，在清理时，如果缓存总大小超过此大小，会以cacheItem为粒度，按缓存的最后时间排序，一个一个淘汰掉一些缓存，直到小于等于最大缓存容量；推荐短视频业务设置最大缓存容量为500MB；
 @param freeStorageMB 磁盘最小空余容量：单位兆，默认值1GB，在清理时，同最大缓存容量，如果当前磁盘容量小于该值，也会按规则一个一个淘汰掉一些缓存，直到freeStorage大于等于该值或者所有缓存都被干掉；
 */
/****
 @brief Settings related to automatic clearing of local cache files
 @param expireMin How long the cache expires: the unit is minute. The default value is 30 days.
 @param maxCapacityMB maximum cache capacity: in megabytes. The default value is 2GB. If the total cache size exceeds this size, some caches are discarded one by one in the cacheItem granularity until they are smaller than or equal to the maximum cache capacity. Recommend 500MB if based on short video bussiness.
 @param freeStorageMB Minimum free disk capacity: in megabytes. The default value is 1GB. If the current disk capacity is less than this value, the freeStorage will be eliminated one by one until the freeStorage is greater than or equal to this value or all caches are eliminated.
*/
+ (void)setCacheFileClearConfig:(int64_t)expireMin maxCapacityMB:(int64_t)maxCapacityMB freeStorageMB:(int64_t)freeStorageMB;

/**
 * 该回调用于为每个媒体 URL 生成唯一标识符，用于缓存索引。
 *
 * <p>必须保证不同 URL 返回不同的哈希值。
 *
 * @param url 媒体资源的 URL
 * @return 该 URL 对应的唯一哈希字符串
 */
/****
 * This callback generates a unique identifier for each media URL, used for cache indexing.
 *
 * <p>Different URLs must produce different hash values.
 *
 * @param url The media resource URL
 * @return A unique hash string for the URL
 */
typedef NSString *(*CaheUrlHashCallback)(NSString *url);

/**
 * 设置加载 URL 的hash值回调。
 *
 * <p>若未设置，SDK 将使用内置的 MD5 算法生成哈希值。
 *
 * @param callback 自定义哈希生成回调；设为 nil 则恢复使用 MD5
 */
/****
 * Sets the hash callback to load the URL.
 *
 * <p>If not set, the SDK uses the built-in MD5 algorithm to generate hash values.
 *
 * @param callback Custom hash generation callback; set to nil to revert to MD5
 */
+ (void)setCacheUrlHashCallback:(CaheUrlHashCallback)callback;

/**
 @brief 媒体数据从网络下来后有机会回调出去，可对原始数据进行处理，目前只支持mp4
 @param requestUrl  数据归属的URL
 @param inData 输入数据buffer
 @param inOutSize 输入输出数据buffer大小，单位字节
 @param outData 输出数据buffer，处理后的数据可写入这里，大小必须与inOutSize一样，其内存由sdk内部申请，无需管理内存
 @return 是否处理过了。如果处理了返回YES，sdk会以outData中的数据做后续处理，否则返回NO，继续使用原始数据
 */
/****
 @brief A chance for media data downloading from network and modified by app, now only mp4 is supported
 @param requestUrl  data's source URL
 @param inData input data buffer
 @param inOutSize input/output data buffer size in byte
 @param outData output data buffer and its memory is managed by sdk, app can write it but size must not exceed to inOutSize
 @return whether processed. If processed, return YES and sdk will use outData for later process, otherwise use original data and return NO.
*/
typedef BOOL (*NetworkDataProcessCallback)(NSString *requestUrl,
                                           const uint8_t *inData,
                                           const int64_t inOutSize,
                                           uint8_t *outData);
/**
 @brief 设置网络数据回调。
 */
/****
 @brief Set the network data callback.
*/
+ (void)setNetworkDataProcessCallback:(NetworkDataProcessCallback)callback;


/**
 * 自适应解码降级时获取后备 URL 的回调函数类型。
 *
 * <p>当因解码异常触发降级时，SDK 将调用此回调获取替代播放地址。
 *
 * @param oriBizType 触发降级的业务场景，由 {@link AVPBizScene} 枚举定义
 * @param oriCodecType 触发降级的原始编解码类型，由 {@link AVPCodecType} 枚举定义
 * @param oriURL 原始播放 URL
 * @return 后备播放 URL；若返回 nil 或空字符串，则不进行 URL 切换
 */
/****
 * Callback function type for obtaining a backup URL during adaptive decoder downgrade.
 *
 * <p>When a decoder downgrade is triggered due to insufficient decoding exception, the SDK invokes this callback to obtain an alternative playback URL.
 *
 * @param oriBizType The business scenario that triggered the downgrade, defined by {@link AVPBizScene}
 * @param oriCodecType The original codec type that triggered the downgrade, defined by {@link AVPCodecType}
 * @param oriURL The original playback URL
 * @return The backup playback URL; if nil or empty string is returned, no URL switching occurs
 */
typedef NSString* (*AdaptiveDecoderGetBackupURLCallback)(AVPBizScene oriBizType,
                                                         AVPCodecType oriCodecType,
                                                       NSString* oriURL);
/**
 * 设置取BackupUrl回调。
 *
 * @param callback 获取后备 URL 的回调；
 */
/****
 * Set the callback to get backup url.
 *
 * @param callback The callback for obtaining a backup URL;
 */
+ (void)setAdaptiveDecoderGetBackupURLCallback:(AdaptiveDecoderGetBackupURLCallback)callback;

/**
 * 是否开启标准 HTTP DNS 功能。
 *
 * <p><strong>已弃用</strong>：此 API 已移除，SDK 默认启用增强型 HTTP DNS。
 *
 * <p>无需调用此方法。
 *
 * @param enable 是否启用 HTTP DNS（此参数已无实际作用）
 * @deprecated 此功能已移除，请勿使用
 */
/****
 * Enables standard HTTP DNS.
 *
 * <p><strong>Deprecated</strong>: This API has been removed. Enhanced HTTP DNS is enabled by default.
 *
 * <p>Do not call this method.
 *
 * @param enable Whether to enable HTTP DNS (this parameter has no effect)
 * @deprecated This feature has been removed; do not use
 */
+ (void)enableHttpDns:(BOOL)enable DEPRECATED_MSG_ATTRIBUTE("don't need use this API, we removed this feature and enable enhanced httpdns default instead");

/**
 * 是否开启增强型 HTTP DNS 功能。默认开启。
 *
 * <p>开启后需注意以下事项：
 * <ul>
 *   <li>该功能与标准 HTTP DNS 互斥；若同时开启，后开启者生效</li>
 *   <li>需要有效的高级 HTTP DNS License，否则功能不生效</li>
 *   <li>确保播放域名已在阿里云 CDN 平台配置并启用对应功能，确保可提供线上服务。配置方法请参考：https://www.alibabacloud.com/product/content-delivery-network</li>
 * </ul>
 *
 * @param enable 是否启用增强型 HTTP DNS
 */
/****
 * Enables enhanced HTTP DNS.
 *
 * <p>After enabling, note the following:
 * <ul>
 *   <li>This feature is mutually exclusive with standard HTTP DNS; the latter enabled takes effect</li>
 *   <li>A valid enhanced HTTP DNS license is required; otherwise, the feature is inactive</li>
 *   <li>Ensure the playback domain is configured and enabled on Alibaba Cloud CDN platform, please refer to: https://www.alibabacloud.com/product/content-delivery-network</li>
 * </ul>
 *
 * @param enable Whether to enable enhanced HTTP DNS. Default is enabled.
 */
+ (void)enableEnhancedHttpDns:(BOOL)enable;

/**
 * 是否开启内建的网络平衡策略。
 *
 * <p>启用后，播放器将在播放过程中自动控制预加载器（参考 {@link AliMediaLoader}）的运行时机，以优化网络资源使用。
 *
 * <p>默认开启。
 *
 * @param enable 是否启用网络平衡策略
 * @see AliMediaLoader
 */
/****
 * Enables the built-in network balance mechanism.
 *
 * <p>When enabled, the player automatically controls the timing of media loader (see {@link AliMediaLoader}) during playback to optimize network resource usage.
 *
 * <p>Enabled by default.
 *
 * @param enable Whether to enable the network balance mechanism
 * @see AliMediaLoader
 */
+ (void)enableNetworkBalance:(BOOL)enable;

/**
 * 是否启用内建多播放器实例间的增强版网络负载均衡策略。
 *
 * <p>启用后，播放过程中会自动在多个播放器实例间分配网络负载。默认开启。
 *
 * <p><strong>注意</strong>：
 * <ul>
 *   <li>该功能受 {@link +enableNetworkBalance:} 的影响，如果 enableNetworkBalance 被关闭，则本策略也会被关闭。</li>
 *   <li>本策略的开启或关闭，不影响 {@link +enableNetworkBalance:} 的功能状态。</li>
 * </ul>
 *
 * @param enable 是否启用增强版网络平衡策略
 * @see @link +enableNetworkBalance: @endlink
 */
/****
 * Enables the enhanced built-in network load balancing strategy among multiple player instances.
 *
 * <p>When enabled, it automatically balances the network load between different player instances during playback. Default is enabled.
 *
 * <p><strong>Note</strong>:
 * <ul>
 *   <li>This feature is affected by {@link +enableNetworkBalance:}; if enableNetworkBalance is disabled, this strategy will also be disabled.</li>
 *   <li>Enabling or disabling this strategy does not affect the status of {@link +enableNetworkBalance:} itself.</li>
 * </ul>
 *
 * @param enable Whether to enable the enhanced network balancing strategy
 * @see @link +enableNetworkBalance: @endlink
 */
+ (void)enableEnhancedNetworkBalance:(BOOL)enable;


/**
 * 是否开启缓冲区溢出到本地缓存的功能。
 *
 * <p>启用后，当 {@code maxBufferDuration} 设置大于 50 秒时，超出 50 秒的部分将被缓存到本地。
 *
 * <p>默认关闭。
 *
 * @param enable 是否启用缓冲区溢出缓存
 */
/****
 * Enables buffering overflow to local cache.
 *
 * <p>When enabled, if {@code maxBufferDuration} is set to more than 50 seconds, the portion exceeding 50 seconds is cached locally.
 *
 * <p>Disabled by default.
 *
 * @param enable Whether to enable buffer overflow caching
 */
+ (void)enableBufferToLocalCache:(BOOL)enable  DEPRECATED_MSG_ATTRIBUTE("don't need use this API");

/**
 * 清除所有本地缓存文件。
 *
 * <p>该操作会删除所有由播放器生成的缓存内容，包括媒体缓存和元数据。
 */
/****
 * Clears all local cache files.
 *
 * <p>This operation deletes all cache content generated by the player, including media and metadata.
 */
+ (void) clearCaches;

/**
 * 设置是否禁用播放器崩溃堆栈上传。
 *
 * <p>启用后，播放器在发生崩溃时将不会上传堆栈信息。
 *
 * @param disable true 表示禁用崩溃上传，false 表示启用（默认）
 */
/****
 * Sets whether to disable crash stack trace upload.
 *
 * <p>When enabled, the player will not upload stack traces upon crash.
 *
 * @param disable true to disable crash upload, false to enable it (default)
 */
+ (void) disableCrashUpload:(BOOL) disable;



/**
 * 设置是否开启自适应 IP 降级机制，默认开启。
 * <p>
 * 启用该功能后，SDK 可以根据网络状况或服务器响应，自动采用不同的 IP 策略以提升播放稳定性。
 * 请确保播放域名在alicdn平台添加并配置对应功能，确保可提供线上服务。配置方法请参考：https://www.alibabacloud.com/product/content-delivery-network
 *
 *
 * @param enable {@code true} 开启自适应 IP 降级，{@code false} 关闭此功能
 */
/****
 * Sets whether to enable adaptive IP degrade strategy. Enabled by default.
 * <p>
 * When enabled, the SDK can automatically apply different IP strategies based on
 * network conditions or server responses to improve playback stability.
 * Please ensure that the playback domain name is added and configured with corresponding functions on the alicdn platform to ensure that online services can be provided.
 * For configuration methods, please refer to: https://www.alibabacloud.com/product/content-delivery-network
 *
 * @param enable {@code true} to enable adaptive IP degrade, {@code false} to disable this feature
 */
+ (void)enableAdaptiveIpDegrade:(BOOL)enable;

/**
 * 根据 URL 和查询参数判断是否存在缓存
 *
 * @param url 视频 URL
 * @param params 缓存查询参数
 * @return YES 表示存在缓存，NO 表示不存在缓存
 */
/****
* Check if cache exists based on URL and query parameters
*
* @param url Video URL
* @param params Cache query parameters
* @return YES if cache exists, NO if cache does not exist
*/
+ (BOOL)isCacheExist:(NSString *)url params:(AVPCacheQueryParams *)params;

/**
 * 设置是否关闭画中画场景下的全局缩放适配。
 *
 * <p>在多播放器实例同时使用的场景下，开启此选项可避免画中画窗口出现
 * 画面尺寸异常的问题。
 *
 * <p>默认关闭。
 *
 * @param disable YES 表示关闭全局缩放适配，NO 表示保持默认行为
 */
/****
 * Sets whether to disable global scale adaptation in Picture-in-Picture mode.
 *
 * <p>In scenarios where multiple player instances are used simultaneously,
 * enabling this option can prevent abnormal frame sizing in the PiP window.
 *
 * <p>Disabled by default.
 *
 * @param disable YES to disable global scale adaptation, NO to keep default behavior
 */
+ (void)disablePipGlobalScale:(BOOL)disable;

@end
