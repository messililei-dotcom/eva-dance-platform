//
//  AVPConfig.h
//  AliPlayerSDK
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef AVPConfig_h
#define AVPConfig_h

#import <Foundation/Foundation.h>

/**
 @brief 播放器配置类
 
 包含播放器的各项配置参数，如缓冲时长、网络超时、HTTP头等。
 配置应在调用 @link AliPlayer::prepare @endlink 前设置。
 */
/****
 @brief Player configuration class.
 
 Contains various configuration parameters for the player, such as buffer duration,
 network timeout, HTTP headers, etc. Configuration should be set before calling @link AliPlayer::prepare @endlink.
 */
OBJC_EXPORT
@interface AVPConfig : NSObject

/**
 @brief 直播最大延迟时间
 
 用于限制直播流的最大延迟。当播放延迟超过此值时，播放器会尝试加速追赶。
 单位：毫秒，默认值：5000毫秒（5秒）。
 */
/****
 @brief Maximum broadcasting delay.
 
 Used to limit the maximum delay of live stream. When playback delay exceeds this value,
 the player attempts to speed up and catch up. Unit: milliseconds, Default: 5000 (5 seconds).
 */
@property (nonatomic, assign) int maxDelayTime;

/**
 @brief 高水位缓冲时长
 
 当播放器缓冲数据大于此值时，播放器恢复播放（从卡顿状态恢复）。
 用于避免频繁的缓冲暂停。单位：毫秒。
 */
/****
 @brief High water level buffer duration.
 
 When cached data size exceeds this value, the player resumes playback from buffering state.
 Used to avoid frequent buffering pauses. Unit: milliseconds.
 */
@property (nonatomic, assign) int highBufferDuration;

/**
 @brief 起播缓冲时长
 
 开始播放前需要缓冲的数据时长。缓冲数据达到此值后开始播放。
 较小的值可加快起播速度，但可能导致卡顿；较大的值更稳定但延迟更高。
 单位：毫秒，默认值：500毫秒。
 */
/****
 @brief Start buffer duration.
 
 Duration of data to buffer before starting playback. Playback begins when buffered data reaches this value.
 Smaller values speed up start but may cause stuttering; larger values are more stable but have higher latency.
 Unit: milliseconds, Default: 500.
 */
@property (nonatomic, assign) int startBufferDuration;

/**
 @brief 最大缓冲时长
 
 播放器允许缓冲的最大数据时长。防止缓冲占用过多内存。
 单位：毫秒，默认值：50000毫秒（50秒）。
 */
/****
 @brief Maximum buffer duration.
 
 Maximum duration of data the player allows to cache. Prevents buffer from consuming excessive memory.
 Unit: milliseconds, Default: 50000 (50 seconds).
 */
@property (nonatomic, assign) int maxBufferDuration;

/**
 @brief 网络超时时间
 
 网络请求的超时时间。超过此时间未获得响应则认为网络连接超时。
 单位：毫秒，默认值：15000毫秒（15秒）。
 */
/****
 @brief Network connection timeout.
 
 Timeout for network requests. No response within this time is considered network timeout.
 Unit: milliseconds, Default: 15000 (15 seconds).
 */
@property (nonatomic, assign) int networkTimeout;

/**
 @brief 网络重试次数
 
 网络连接失败时的重试次数。每次重试间隔由 @link networkTimeout @endlink 决定。
 设为0表示不进行自动重试，重试策略由应用决定。
 默认值：2次。
 */
/****
 @brief Network retry count.
 
 Number of retries when network connection fails. Retry interval is determined by @link networkTimeout @endlink.
 Set to 0 to disable automatic retry; retry strategy is decided by app.
 Default: 2.
 */
@property (nonatomic, assign) int networkRetryCount;

/**
 @brief 探测数据大小（已弃用）
 
 用于探测媒体信息的数据量大小。默认值-1表示不设置，由播放器自动决定。
 
 @deprecated 此属性已弃用。
 */
/****
 @brief Probe data size (Deprecated).
 
 Size of data used to probe media information. Default -1 means not set; player decides automatically.
 
 @deprecated This property is deprecated.
 */
@property (nonatomic, assign) int maxProbeSize DEPRECATED_MSG_ATTRIBUTE("This property is deprecated");


/**
 @brief HTTP请求Referer
 
 HTTP请求中的Referer字段值。用于防盗链等功能。
 */
/****
 @brief HTTP request Referer.
 
 Value of Referer field in HTTP request. Used for anti-hotlinking and other functions.
 */
@property (nonatomic, copy) NSString *referer;

/**
 @brief HTTP User-Agent
 
 HTTP请求中的User-Agent字段值。标识客户端信息。
 */
/****
 @brief HTTP User-Agent.
 
 Value of User-Agent field in HTTP request. Identifies client information.
 */
@property (nonatomic, copy) NSString *userAgent;

/**
 @brief HTTP代理
 
 用于访问网络资源的HTTP代理地址。
 */
/****
 @brief HTTP proxy.
 
 HTTP proxy address for accessing network resources.
 */
@property (nonatomic, copy) NSString *httpProxy;

/**
 @brief 停止时是否清除显示
 
 调用stop()停止播放后，是否清除最后一帧图像。
 YES表示清除（黑屏），NO表示保留最后一帧。默认值：NO。
 */
/****
 @brief Whether to clear display when stopped.
 
 After calling stop(), whether to clear the last frame image.
 YES clears it (black screen), NO keeps the last frame. Default: NO.
 */
@property (nonatomic, assign) BOOL clearShowWhenStop;

/**
 @brief 自定义HTTP头列表
 
 添加自定义的HTTP请求头。可用于传递特定的鉴权信息或其他HTTP头。
 */
/****
 @brief Custom HTTP headers.
 
 Add custom HTTP request headers. Can be used for authentication information or other HTTP headers.
 */
@property (nonatomic, strong) NSMutableArray *httpHeaders;

/**
 @brief 启用SEI数据回调
 
 是否启用SEI（Supplemental Enhancement Information）数据的回调。
 启用后可通过回调获取视频中嵌入的SEI数据。
 */
/****
 @brief Enable SEI data callback.
 
 Whether to enable callback for SEI (Supplemental Enhancement Information) data.
 When enabled, SEI data embedded in video can be retrieved through callbacks.
 */
@property (nonatomic, assign) BOOL enableSEI;

/**
 @brief 启用本地缓存
 
 当通过 @link AliPlayerGlobalSettings @endlink API启用本地缓存功能后，
 此配置用于控制当前播放器实例是否允许被缓存。默认值：YES（允许）。
 */
/****
 @brief Enable local cache.
 
 When local cache is enabled through @link AliPlayerGlobalSettings @endlink API,
 this config controls whether current player instance is allowed to cache. Default: YES.
 */
@property(nonatomic, assign) BOOL enableLocalCache;

/**
 @brief 像素缓冲区输出格式
 
 用于renderFrame回调的视频格式。仅对VTB解码器有效，值等于OSType。
 支持的格式包括：420v、420f、y420、BGRA等。
 */
/****
 @brief Pixel buffer output format.
 
 Video format for renderFrame callback. Only effective for VTB decoder, value equals OSType.
 Supported formats include: 420v, 420f, y420, BGRA, etc.
 */
@property (nonatomic, assign) int pixelBufferOutputFormat;

/**
 @brief HLS直播起播分片位置
 
 播放HLS直播流时的起播分片索引。用于控制直播的起播位置。
 */
/****
 @brief HLS live start index.
 
 Fragment index for starting HLS live stream playback. Controls the start position for live playback.
 */
@property(nonatomic, assign) int liveStartIndex;

/**
 @brief 禁用音频轨道
 
 是否禁用音频轨道。YES表示禁用，播放时不解码和输出音频。默认值：NO。
 */
/****
 @brief Disable audio track.
 
 Whether to disable audio track. YES disables audio decoding and output. Default: NO.
 */
@property (nonatomic, assign) BOOL disableAudio;

/**
 @brief 禁用视频轨道
 
 是否禁用视频轨道。YES表示禁用，播放时不解码和渲染视频。默认值：NO。
 */
/****
 @brief Disable video track.
 
 Whether to disable video track. YES disables video decoding and rendering. Default: NO.
 */
@property (nonatomic, assign) BOOL disableVideo;

/**
 @brief 进度更新频率
 
 播放进度和缓冲进度更新的频率。包括当前播放位置和缓冲位置的回调更新间隔。
 单位：毫秒。
 @see AVPDelegate::onCurrentPositionUpdate
 @see AVPDelegate::onBufferedPositionUpdate
 */
/****
 @brief Progress update frequency.
 
 Frequency of playback progress and buffer progress updates.
 Includes callback update interval for current position and buffered position. Unit: milliseconds.
 @see AVPDelegate::onCurrentPositionUpdate
 @see AVPDelegate::onBufferedPositionUpdate
 */
@property(nonatomic, assign) int positionTimerIntervalMs;

/**
 @brief 向前回溯的最大缓冲时长（单位：毫秒）
 默认为0
 */
/****
 @brief Maximum backward buffer duration in milliseconds.
 Default: 0.
 */
@property(nonatomic, assign) uint64_t mMAXBackwardDuration;


/**
 @brief 优先保证音频播放
 
 在网络带宽不足的情况下，是否优先保障音频的正常播放而降低视频清晰度。
 目前仅在DASH直播流中有效（视频已切换到最低码率）。
 */
/****
 @brief Prefer audio playback.
 
 Whether to prioritize audio playback over video quality when network bandwidth is insufficient.
 Currently effective only in DASH live streams (video already at lowest bitrate).
 */
@property (nonatomic, assign) BOOL preferAudio;

/**
 @brief 启用HTTP DNS
 
 是否启用HTTP DNS进行域名解析。取值：-1（跟随全局设置）、0（禁用）或其他值（启用）。
 */
/****
 @brief Enable HTTP DNS.
 
 Whether to enable HTTP DNS for domain resolution. Values: -1 (follow global setting), 0 (disable), others (enable).
 */
@property(nonatomic, assign) int enableHttpDns;

/**
 @brief 启用增强型HTTP DNS
 
 是否启用增强型HTTP DNS进行域名解析。取值：-1（跟随全局设置）、0（禁用）或其他值（启用）。
 */
/****
 @brief Enable enhanced HTTP DNS.
 
 Whether to enable enhanced HTTP DNS for domain resolution. Values: -1 (follow global setting), 0 (disable), others (enable).
 */
@property(nonatomic, assign) int enableEnhancedHttpDns;

/**
 @brief 启用HTTP/3协议
 
 是否使用HTTP/3协议进行请求。支持RFC 9114（HTTP/3）和RFC 9000（QUIC v1）标准。
 如果HTTP/3请求失败，自动降级至普通HTTP。默认值：NO（禁用）。
 */
/****
 @brief Enable HTTP/3 protocol.
 
 Whether to use HTTP/3 protocol for requests.
 Supports RFC 9114 (HTTP/3) and RFC 9000 (QUIC v1) standards.
 Automatically degrades to normal HTTP if HTTP/3 fails. Default: NO.
 */
@property(nonatomic, assign) BOOL enableHttp3;

/**
 @brief 启用严格FLV头检查
 
 用于纯音频或纯视频的RTMP/FLV直播流起播优化策略。当流的header声明只有音频或只有视频，
 且实际流的内容与header声明一致时，启用此选项可加快起播。默认值：NO（禁用）。
 */
/****
 @brief Enable strict FLV header.
 
 Optimization strategy for pure audio or pure video RTMP/FLV live streams.
 When stream header declares audio-only or video-only and actual content matches,
 enabling this can speed up startup. Default: NO.
 */
@property(nonatomic, assign) BOOL enableStrictFlvHeader;

/**
 @brief 启用严格URL鉴权模式
 
 针对启用了URL鉴权的HLS点播媒体，本地缓存时的鉴权模式：
 - NO（非严格模式）：鉴权结果也被缓存。若上次只缓存部分媒体，下次播放到非缓存部分时，
   会使用缓存的鉴权发起请求。若URL鉴权有效期很短，可能导致播放失败。
 - YES（严格模式）：鉴权结果不缓存，每次起播都进行鉴权。无网络时会导致起播失败。
 
 默认值：YES（版本5.5.4.0~6.21.0默认为NO，7.0.0+默认为YES）。
 */
/****
 @brief Enable strict auth mode.
 
 For HLS VOD media with URL authorization enabled, auth mode when using local cache:
 - NO (non-strict): Auth result is cached. If last play cached part of media,
   next play to non-cache part uses cached auth, which may fail if auth timeout is short.
 - YES (strict): Auth result is not cached; auth is verified every playback start.
   Offline playback fails. Default: YES (5.5.4.0~6.21.0 default NO, 7.0.0+ default YES).
 */
@property(nonatomic, assign) BOOL enableStrictAuthMode;

/**
 @brief 启用投屏功能
 
 是否允许当前播放器实例进行投屏（投射到外部设备）。
 需要集成投屏SDK来实现完整的投屏功能。默认值：NO（禁用）。
 @deprecated 已废弃
 */
/****
 @brief Enable projection.
 
 Whether to allow current player instance to project to external devices.
 Requires integrating projection SDK for complete functionality. Default: NO.
 @deprecated Deprecated
 */
@property(nonatomic, assign) BOOL enableProjection __deprecated;

/**
 @brief 音频打断处理模式
 
 在音频被打断时（如接电话）的处理方式：
 - 0：打断期间暂停播放，打断结束后恢复播放
 - 1：打断期间继续播放
 
 默认值：0。
 */
/****
 @brief Audio interrupt mode.
 
 Handling method when audio is interrupted (such as incoming call):
 - 0: Pause playback during interruption, resume after interruption ends
 - 1: Continue playback during interruption
 
 Default: 0.
 */
@property(nonatomic, assign) int audioInterruptMode;

/**
 @brief 视频渲染类型
 
 指定用于视频渲染的渲染器类型：
 - 0：默认渲染器
 - 1：混合渲染器
 - 2：Metal渲染（iOS专用）
 - 3：OpenGL渲染
 
 默认值：0。
 */
/****
 @brief Video render  Type.
 
 Specifies the renderer type for video rendering:
 - 0: Default renderer
 - 1: Mixed renderer
 - 2: Metal render (iOS only)
 - 3: OpenGL render
 
 Default: 0.
 */
@property(nonatomic, assign) int videoRenderType;

/**
 @brief 开始预加载阈值
 
 触发开始预加载的缓冲阈值。当播放缓冲数据高于此值时，开始后台预加载。
 单位：毫秒。
 */
/****
 @brief Start preload threshold.
 
 Trigger start preload buffer threshold. When playback buffer data is higher than this value, start background preload.
 Unit: milliseconds.
 */
@property(nonatomic, assign) int startBufferLimit;

/**
 @brief 停止预加载阈值
 
 触发停止预加载的缓冲阈值。当播放缓冲数据低于此值时，停止预加载。
 单位：毫秒。
 */
/****
 @brief Stop preload threshold.

 Trigger stop preload buffer threshold. When playback buffer data is lower than this value, stop preload.
 Unit: milliseconds.
 */
@property(nonatomic, assign) int stopBufferLimit;

/**
 @brief 轨道选择时的缓冲清除模式
 
 调用selectTrack()选择新轨道时，是否清除已缓冲的数据：
 - 0：不清除缓冲
 - 1：清除缓冲
 
 此模式对高清晰度和低清晰度的轨道都适用。
 */
/****
 @brief Select track buffer mode.
 
 Whether to clear buffered data when calling selectTrack() to switch track:
 - 0: Do not clear buffer
 - 1: Clear buffer
 
 This mode applies to both high-definition and low-definition tracks.
 */
@property(nonatomic, assign) int selectTrackBufferMode;


/**
 @brief 自适应码率最大像素限制
 
 当清晰度切换至AUTO（自动自适应）档位时，允许升路（提高清晰度）的最大像素数。
 例如设置为1280 * 720 = 921600，则最高升路到该清晰度，不会升路到1920 * 1080。
 
 @note 不同清晰度对应的像素数值可参考 @link AVPPixelNumber @endlink
 @note 此设置对 @link AliPlayer::setAutoBandWidth @endlink 接口同样生效
 */
/****
 @brief Maximum pixel count for ABR resolution upgrade.
 
 When resolution switches to AUTO (adaptive) mode, the maximum pixel count allowed for upgrading resolution.
 For example, setting to 1280 * 720 = 921600 limits upgrade to this resolution, not 1920 * 1080.
 
 @note Pixel values for different resolutions can refer to @link AVPPixelNumber @endlink
 @note This setting also applies to @link AliPlayer::setAutoBandWidth @endlink interface
 */
@property(nonatomic, assign) int maxAllowedAbrVideoPixelNumber;

@end

#endif /* AVPConfig_h */
