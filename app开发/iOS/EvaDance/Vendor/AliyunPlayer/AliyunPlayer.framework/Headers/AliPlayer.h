//
//  AliPlayer.h
//  AliPlayer
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#import "AVPCacheConfig.h"
#import "AVPConfig.h"
#import "AVPDef.h"
#import "AVPDelegate.h"
#import "AVPFilterConfig.h"
#import "AVPMediaInfo.h"
#import "AVPSource.h"
#import "AliVttSubtitleViewProtocol.h"
#import <Foundation/Foundation.h>

@protocol AVPDrmDelegate;
@protocol CicadaAudioSessionDelegate;
@protocol CicadaRenderDelegate;
@protocol CicadaRenderingDelegate;
@protocol AliPlayerPictureInPictureDelegate;

@class AVPFilterConfig;
@class AVPFilterOptions;


OBJC_EXPORT
@interface AliPlayer : NSObject

/**
 @brief 初始化播放器
 
 创建一个播放器实例。播放器需要通过此方法进行初始化，
 初始化后方可进行后续的播放操作。
 */
/****
 @brief Initialize the player.
 
 Creates a player instance. The player must be initialized through this method
 before any subsequent playback operations.
 */
- (instancetype)init;

/**
 @brief 初始化播放器并设置traceID
 @param traceID 便于跟踪日志，设为"DisableAnalytics"可关闭日志分析系统（不推荐）。
 推荐使用播放器单点追查功能，当使用阿里云播放器SDK播放视频发生异常时，可借助单点追查功能针对具体某个用户或某次播放会话的异常播放行为进行全链路追踪。
 traceID值由您自行定义，需为您的用户或用户设备的唯一标识符，例如传入您业务的userid或者IMEI、IDFA等您业务用户的设备ID。
 */
/****
 @brief Initialize the player with a trace ID.
 @param traceID A trace ID for debugging. Set as "DisableAnalytics" to disable report analytics data to server(not recommended).
 We recommend using the Player Single Point Trace function to trace the playback behavior of a specific user or playback session.
 The traceId value is defined by you, which must be a unique identifier for your user or device. For example, you can pass in your user's userid or IMEI, IDFA, etc.
 */
- (instancetype)init:(NSString*)traceID;

- (void *)getPlayer;

/**
 @brief 使用url方式来播放视频
 设置播放源为URL地址。支持HTTP、HTTPS等协议的直播和点播流。
 @param source AVPUrlSource的输入类型
 @see AVPUrlSource
 */
/****
 @brief Play by URL.
 Sets the playback source as a URL address. Supports live and VOD streams with HTTP, HTTPS protocols.
 @param source AVPUrlSource type.
 @see AVPUrlSource
 */
- (void)setUrlSource:(AVPUrlSource*)source;

/**
 @brief 使用bitstream方式来播放视频
 @param source AVPBitStreamSource的输入类型
 @see AVPBitStreamSource
 */
/****
 @brief Play by bit stream.
 @param source AVPBitStreamSource type.
 @see AVPBitStreamSource
 */
- (void)setBitStreamSource:(AVPBitStreamSource *)source;

/**
 @brief 用vid和sts来播放视频，sts可参考：https://help.aliyun.com/document_detail/28756.html
 通过阿里云视频ID和临时安全令牌进行身份验证和授权后播放。
 适用于需要权限控制的视频播放场景。
 @param source AVPVidStsSource的输入类型
 @see AVPVidStsSource
 */
/****
 @brief Play by VID and STS. For STS, see https://help.aliyun.com/document_detail/28756.html
 Plays video after authentication and authorization through Alibaba Cloud Video ID and temporary security token.
 Suitable for scenarios requiring access control.
 @param source AVPVidStsSource type.
 @see AVPVidStsSource
 */
- (void)setStsSource:(AVPVidStsSource*)source;

/**
 @brief 用vid和MPS信息来播放视频。可参考：https://help.aliyun.com/document_detail/53522.html
 @param source AVPVidMpsSource的输入类型
 @see AVPVidMpsSource
 @deprecated Please use {@link setAuthSource} instead.
 */
/****
 @brief Play by VID and MPS.
 @param source AVPVidMpsSource type.
 @see AVPVidMpsSource
 @deprecated Please use {@link setAuthSource} instead.
 */
- (void)setMpsSource:(AVPVidMpsSource*)source
__attribute__((deprecated("This method is deprecated, please use setAuthSource instead")));

/**
 @brief 使用vid+playauth方式播放。可参考：https://help.aliyun.com/document_detail/57294.html
 通过阿里云视频ID和播放鉴权令牌进行身份验证后播放。
 这是阿里云推荐的认证方式，可应用于大多数场景。
 @param source AVPVidAuthSource的输入类型
 @see AVPVidAuthSource
 */
/****
 @brief Play by VID and playauth. See https://help.aliyun.com/document_detail/57294.html
 Plays video after authentication through Alibaba Cloud Video ID and playback authorization token.
 This is the recommended authentication method by Alibaba Cloud for most scenarios.
 @param source AVPVidAuthSource type.
 @see AVPVidAuthSource
 */
- (void)setAuthSource:(AVPVidAuthSource*)source;

/**
 @brief 使用VodAsset方式播放
 @param source AVPVodAsset的输入类型
 @see AVPVodAsset
 */
 /****
 @brief Play by VodAsset.
 @param source AVPVodAsset type.
 @see AVPVodAsset
 */
- (void)setVodAssetSource:(AVPVodAsset*)source;

/**
 @brief 使用LiveSts 方式播放直播流
 通过临时安全令牌进行身份验证后播放加密直播流。
 适用于需要权限控制和加密的直播场景。
 @param source  AVPLiveStsSource的输入类型
 */
/****
@brief Play by LiveSts.
 Plays encrypted live stream after authentication through temporary security token.
 Suitable for live streaming scenarios requiring access control and encryption.
@param source AVPLiveStsSource type.
*/
- (void)setLiveStsSource:(AVPLiveStsSource*)source;

/**
 @brief 更新LiveStsInfo
 @param accId 鉴权id
 @param accKey 鉴权秘钥
 @param token 安全token
 @param region 地域
 */
/****
 @brief Update LiveStsInfo.
 @param accId the AccessKey ID for authentication.
 @param accKey the AccessKey Secret for authentication.
 @param token securityToken The specified token.
 @param region The specified regions.
*/
- (void)updateLiveStsInfo:(NSString*)accId accKey:(NSString*)accKey token:(NSString*)token region:(NSString*)region;

/**
 @brief 播放准备，异步
 初始化媒体资源，建立网络连接，加载媒体信息。准备完成后通过 @link AVPEventType::AVPEventPrepareDone @endlink
 事件通知，或通过 @link AVPDelegate::onPlayerStatusChanged @endlink 回调获取准备完成状态。
 准备到准备完成的时间与{@link AVPConfig::startBufferDuration}有关
 @see AVPEventType::AVPEventPrepareDone
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPConfig::startBufferDuration
 */
/****
 @brief Prepare for playback. Asynchronous callback.
 Initializes media resources, establishes network connections, and loads media information.
 Completion is notified via @link AVPEventType::AVPEventPrepareDone @endlink event
 or @link AVPDelegate::onPlayerStatusChanged @endlink callback.
 The time to prepare to prepare complete is related to {@link AVPConfig::startBufferDuration}.
 @see AVPEventType::AVPEventPrepareDone
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPConfig::startBufferDuration
 */
-(void)prepare;

/**
 @brief 开始播放
 在调用此方法前，必须先调用 @link prepare @endlink 方法准备。
 状态变化通过 @link AVPDelegate::onPlayerStatusChanged @endlink 回调通知。
 若播放器已处于播放状态，则此调用无效。
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPStatus
 */
/****
 @brief Start playing.
 You must call @link prepare @endlink before calling this method.
 Status changes are notified via @link AVPDelegate::onPlayerStatusChanged @endlink.
 If the player is already playing, this call has no effect.
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPStatus
 */
-(void)start;

/**
 @brief 暂停播放
 暂停当前的播放。状态变化通过 @link AVPDelegate::onPlayerStatusChanged @endlink 回调通知。
 若播放器已处于暂停或停止状态，则此调用无效。
 要恢复播放，请调用 @link start @endlink 方法。
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPStatus
 */
/****
 @brief Pause playback.
 
 Pauses the current playback. Status changes are notified via @link AVPDelegate::onPlayerStatusChanged @endlink.
 If the player is already paused or stopped, this call has no effect.
 To resume playback, call @link start @endlink.
 
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPStatus
 */
-(void)pause;

/**
 @brief 刷新view，例如view size变化时。
 @deprecated 废弃
 */
/****
 @brief Refresh the view in certain situations, for example, when the size of the view changes.
 @deprecated Deprecated
 */
- (void)redraw DEPRECATED_MSG_ATTRIBUTE("will not take effect");

/**
 @brief 清空画面。
 */
/****
 @brief Clear screen.
 */
- (void)clearScreen;

/**
 @brief 同步清空画面，建议使用clearScreen。
 */
/****
 @brief Clear screen sync, suggest using clearScreen.
 */
- (void)clearScreenSync;

/**
 @brief 重置播放
 @deprecated 废弃
 */
/****
 @brief Reset.
 @deprecated Deprecated
 */
-(void)reset DEPRECATED_ATTRIBUTE;

/**
 @brief 停止播放
 
 停止当前的播放。状态变化通过 @link AVPDelegate::onPlayerStatusChanged @endlink 回调通知。
 停止后播放器资源不会自动释放，需要调用 @link destroy @endlink 或 @link destroyAsync @endlink 方法。
 
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPStatus
 @see destroy
 @see destroyAsync
 */
/****
 @brief Stop playback.
 
 Stops the current playback. Status changes are notified via @link AVPDelegate::onPlayerStatusChanged @endlink.
 After stopping, player resources are not automatically released. Call @link destroy @endlink or @link destroyAsync @endlink.
 
 @see AVPDelegate::onPlayerStatusChanged
 @see AVPStatus
 @see destroy
 @see destroyAsync
 */
-(void)stop;

/**
 @brief 销毁播放器（同步）
 
 同步释放播放器占用的所有资源。调用此方法后，该播放器实例不再可用。
 建议在不再需要播放时调用此方法。
 */
/****
 @brief Destroy the player (synchronous).
 
 Synchronously releases all resources occupied by the player.
 After calling this method, the player instance is no longer usable.
 Recommended to call when playback is no longer needed.
 */
-(void)destroy;

/**
 @brief 异步销毁播放器。当实例不再需要时，省去stop的调用并使用destroyAsync进行异步释放，可以加快页面响应速度，提高体验，释放后不要再调用prepare进行新的起播，否则调用效果不可预知。
 */
/****
 @brief Async delete the player. When instance is not needed, skip calling stop api and call this destroyAsync api can speed up view response. Once called, don't call prepare to start new play.
 */
-(void)destroyAsync;

/**
 @brief 设置起播位置
 
 指定播放开始时的位置。此方法仅在每次 @link prepare @endlink 前调用有效，每次准备仅生效一次。
 用于替代传统的起播前seek方案。
 
 @param time 起播位置，单位毫秒
 @param seekMode Seek模式，指定精确或快速定位方式
 @see AVPSeekMode
 */
/****
 @brief Set the initial playback position.
 
 Specifies the position where playback begins. This method is only effective when called before @link prepare @endlink,
 and takes effect only once per preparation. Replaces the traditional pre-playback seek approach.
 
 @param time Initial playback position in milliseconds
 @param seekMode Seek mode specifying accurate or fast positioning
 @see AVPSeekMode
 */
-(void)setStartTime:(int64_t)time seekMode:(AVPSeekMode)seekMode;

/**
 @brief 跳转到指定的播放位置
 @param time 新的播放位置，单位毫秒
 @param seekMode seek模式
 @see AVPSeekMode
 */
/****
 @brief Seek to a specified position.
 @param time The specified position that the player will seek to, Unit: millisecond.
 @param seekMode Seek mode.
 @see AVPSeekMode
 */
-(void)seekToTime:(int64_t)time seekMode:(AVPSeekMode)seekMode;

/**
 @brief 设置精确Seek的最大间隔
 
 当精确Seek位置距离前面的关键帧距离超过此间隔时，播放器不再支持精确Seek，
 转而采用快速Seek模式。这样可以避免极远距离精确Seek导致的长时间处理。
 
 @param delta 间隔时长，单位毫秒。超过此距离的精确Seek将降级为快速Seek
 */
/****
 @brief Set the maximum interval for accurate seeking.
 
 When the distance between the accurate seek position and the previous keyframe exceeds this interval,
 the player no longer supports accurate seeking and switches to fast seek mode.
 This avoids long processing times for seeking far distances.
 
 @param delta Interval duration in milliseconds. Accurate seeks exceeding this distance will degrade to fast seek.
 */
-(void)setMaxAccurateSeekDelta:(int)delta;

/**
 @brief 截取当前画面
 
 异步捕获当前播放帧的图像。截图结果通过 @link AVPDelegate::onCaptureScreen @endlink 回调返回。
 
 @see AVPDelegate::onCaptureScreen
 */
/****
 @brief Capture the current frame.
 
 Asynchronously captures the image of the current playback frame.
 The screenshot result is returned via @link AVPDelegate::onCaptureScreen @endlink callback.
 
 @see AVPDelegate::onCaptureScreen
 */
-(void) snapShot;

/**
 @brief 根据url进行多清晰度切换，选择成功与否的结果通过AVPDelegate onStreamSwitchedSuccess/onStreamSwitchedFail回调。
 * 注意：
 * 1. 必须是阿里云的直播地址。
 * 2. 必须是直播流的不同清晰度。
 * 3. 切换到无关流地址可能会失败。
 @param url 新流的url地址
 */
/****
 @brief Multi definition stream switch by url. You can get result from AVPDelegate onStreamSwitchedSuccess/onStreamSwitchedFail.
 @param url new url address
 * Note:
 * 1. Must be aliyun's live stream address.
 * 2. Must be different definition of the same stream.
 * 3. If switch to an unrelated address, switch may failed.
 */
-(void)switchStream:(NSString *)URL;

/**
 @brief 根据轨道索引切换视频清晰度。支持手动指定清晰度或开启自适应码率模式。
 @param trackIndex 目标清晰度的轨道索引。使用SELECT_AVPTRACK_TYPE_VIDEO_AUTO表示开启自适应码率
 */
/****
 @brief Switch video quality according to the specified track index. Supports manual quality selection or adaptive bitrate mode.
 @param trackIndex Target quality track index. Use SELECT_AVPTRACK_TYPE_VIDEO_AUTO for adaptive bitrate adjustment
 */
-(void)selectTrack:(int)trackIndex;

/**
 @brief 根据轨道索引切换视频清晰度，支持精准跳转选项。
 @param trackIndex 目标清晰度的轨道索引。使用SELECT_AVPTRACK_TYPE_VIDEO_AUTO表示开启自适应码率
 @param accurate 是否使用精准跳转模式进行切换。YES表示精准跳转，NO表示快速跳转
 */
/****
 @brief Switch video quality according to the specified track index with accurate seeking option.
 @param trackIndex Target quality track index. Use SELECT_AVPTRACK_TYPE_VIDEO_AUTO for adaptive bitrate adjustment
 @param accurate Whether to use accurate seeking mode for switching. YES for accurate seeking, NO for fast seeking
 */
-(void)selectTrack:(int)trackIndex accurate:(BOOL)accurate;

/**
 @brief 获取媒体信息
 
 获取当前播放媒体的详细信息，包括视频、音频、字幕等所有轨道（Track）的信息。
 此方法仅在收到 @link AVPEventType::AVPEventPrepareDone @endlink 事件后调用才能正确获取。
 
 @return AVPMediaInfo实例，包含完整的媒体信息；如果媒体信息尚未加载，则返回nil
 @see AVPMediaInfo
 @see AVPTrackInfo
 @see AVPEventType::AVPEventPrepareDone
 */
/****
 @brief Query media information.
 
 Retrieves detailed information about the current playback media, including all track information
 for video, audio, subtitles, etc. This method should only be called after receiving
 @link AVPEventType::AVPEventPrepareDone @endlink event.
 
 @return AVPMediaInfo instance containing complete media information; returns nil if not yet loaded
 @see AVPMediaInfo
 @see AVPTrackInfo
 @see AVPEventType::AVPEventPrepareDone
 */
-(AVPMediaInfo*)getMediaInfo;

/**
 @brief 获取子流媒体信息
 
 获取多码率HLS流中子流（子m3u8）的媒体信息。
 此方法适用于打包了多个清晰度的HLS直播或点播流。
 
 @return AVPMediaInfo实例，包含当前子流的媒体信息
 @see AVPMediaInfo
 @see AVPTrackInfo
 @see AVPEventType::AVPEventPrepareDone
 */
/****
 @brief Query sub-stream media information.
 
 Retrieves media information of sub-streams (sub-m3u8) in multi-bitrate HLS streams.
 
 @return AVPMediaInfo instance containing current sub-stream media information
 @see AVPMediaInfo
 @see AVPTrackInfo
 @see AVPEventType::AVPEventPrepareDone
 */
-(AVPMediaInfo*)getSubMediaInfo;

/**
 @brief 获取当前播放track
 @param type track类型
 @see AVPTrackType
 */
/****
 @brief Query the track that is being played.
 @param type Track type.
 @see AVPTrackType
 */
-(AVPTrackInfo*) getCurrentTrack:(AVPTrackType)type;

/**
 @brief 设置缩略图URL
 
 指定缩略图图片的URL地址。在调用 @link getThumbnail @endlink 前必须先设置缩略图URL。
 缩略图可以由阿里云控制台配置生成。
 
 @param URL 缩略图服务的URL地址
 @see getThumbnail
 */
/****
 @brief Specify a thumbnail image URL.
 
 Sets the URL address of the thumbnail image. Must be called before @link getThumbnail @endlink.
 Thumbnails can be generated through Alibaba Cloud console configuration.
 
 @param URL URL address of the thumbnail service
 @see getThumbnail
 */
-(void) setThumbnailUrl:(NSString *)URL;

/**
 @brief 获取指定位置的缩略图
 
 异步获取指定播放位置的缩略图。获取结果通过 @link AVPDelegate::onGetThumbnailSuc @endlink
 和 @link AVPDelegate::onGetThumbnailFailed @endlink 回调返回。
 
 在调用此方法前，必须先调用 @link setThumbnailUrl @endlink 设置缩略图URL。
 
 @param positionMs 指定位置，单位毫秒
 @see AVPDelegate::onGetThumbnailSuc
 @see AVPDelegate::onGetThumbnailFailed
 @see setThumbnailUrl
 */
/****
 @brief Retrieve the thumbnail image at the specified position.
 
 Asynchronously retrieves the thumbnail image at the specified playback position.
 The result is returned via @link AVPDelegate::onGetThumbnailSuc @endlink
 and @link AVPDelegate::onGetThumbnailFailed @endlink callbacks.
 
 @link setThumbnailUrl @endlink must be called before invoking this method.
 
 @param positionMs Specified position in milliseconds
 @see AVPDelegate::onGetThumbnailSuc
 @see AVPDelegate::onGetThumbnailFailed
 @see setThumbnailUrl
 */
-(void)getThumbnail:(int64_t)positionMs;

/**
 @brief 设置追踪ID
 
 为播放器实例设置用于日志追踪和问题诊断的唯一标识符。
 推荐使用播放器单点追查功能进行问题诊断和性能分析。
 traceID应为用户或设备的唯一标识，例如userid、IMEI或IDFA等。
 
 @param traceID 用于日志追踪的唯一标识符
 */
/****
 @brief Set a trace ID for debugging.
 
 Sets a unique identifier for log tracing and diagnostics for the player instance.
 Recommended to use Player Single Point Trace for diagnostics and performance analysis.
 The traceID should be a unique identifier for user or device, such as userid, IMEI, or IDFA.
 
 @param traceID Unique identifier for log tracing
 */
- (void) setTraceID:(NSString*)traceID;


/**
 @brief 设置转换播放的url的回调函数，一般用于p2p中的url地址转换
 @param callback 回调函数指针
 */
/****
 @brief Set a URL conversion callback. URL conversion is typically used in P2P broadcasting.
 @param callback The function pointer of the callback.
 */
- (void) setPlayUrlConvertCallback:(PlayURLConverCallback)callback;

/**
 @brief 设置播放器配置
 
 修改播放器的各项配置参数，如缓冲时长、自动播放、循环播放等。
 建议在调用 @link prepare @endlink 前进行配置。
 
 @param config AVPConfig实例，包含所有可配置的播放器参数
 @see AVPConfig
 @see getConfig
 */
/****
 @brief Modify player configuration.
 
 Modifies various player configuration parameters such as buffer duration, autoplay, loop playback, etc.
 Recommended to configure before calling @link prepare @endlink.
 
 @param config AVPConfig instance containing all configurable player parameters
 @see AVPConfig
 @see getConfig
 */
-(void) setConfig:(AVPConfig*)config;

/**
 @brief 设置播放场景
 
 为播放器指定特定的播放场景（长视频、短视频、直播等），播放器将根据场景自动应用最优配置。
 无需手动调整各个配置参数，提高开发效率。
 
 @param scene 播放场景类型
 @see AVPScene
 */
/****
 @brief Set player scene.
 
 Specifies a playback scenario (long video, short video, live streaming, etc.) for the player.
 The player automatically applies optimal configurations for the scenario without manual parameter adjustment.
 
 @param scene Player scene type
 @see AVPScene
 */
-(void) setPlayerScene:(AVPScene)scene;

/**
 @brief 播放器降级设置, 适用于RTS自定义降级url设置，详细可以参考<a href="https://help.aliyun.com/zh/live/developer-reference/rts-playback-for-ios#p-gjl-uk6-p4z">RTS自定义降级url设置</a>
 @param source 降级url
 @param config 降级配置
 */
/****
 @brief Set player downgrade configuration, applicable to RTS custom downgrade url settings, for details please refer to <a href="https://help.aliyun.com/zh/live/developer-reference/rts-playback-for-ios#p-gjl-uk6-p4z">RTS自定义降级url设置</a>
 @param source downgrade url
 @param config downgrade config.
 @see AVPConfig
 */
-(void) enableDowngrade:(AVPUrlSource*)source config:(AVPConfig*)config;

/**
 @brief 获取播放器配置
 
 获取当前播放器的所有配置参数。可用于在修改配置前先获取当前值，然后进行选择性修改。
 
 @return AVPConfig实例，包含当前的所有配置参数
 @see AVPConfig
 @see setConfig
 */
/****
 @brief Query player configuration.
 
 Retrieves all current configuration parameters of the player.
 Can be used to get current values before selectively modifying them.
 
 @return AVPConfig instance containing all current configuration parameters
 @see AVPConfig
 @see setConfig
 */
-(AVPConfig*) getConfig;

/**
 @brief 设置缓存配置
 @param AVPCacheConfig 缓存配置。{@link AVPCacheConfig}。
 @return 设置成功返回YES
 @deprecated 从7.0.0版本开始，该接口已废弃。请使用 `AliPlayerGlobalSettings::enableLocalCache:` 替代。
 */
/****
 @brief Modify cache configuration.
 @param AVPCacheConfig Cache configuration. {@link AVPCacheConfig}.
 @return If the cache configuration is modified, YES is returned.
 @deprecated From version 7.0.0, this interface is deprecated. Please use `AliPlayerGlobalSettings::enableLocalCache:` instead.
 */
-(BOOL) setCacheConfig:(AVPCacheConfig *)cacheConfig
__attribute__((deprecated("Use +[AliPlayerGlobalSettings enableLocalCache:] instead")));

/**
 @brief 设置滤镜配置
 
 为播放器配置视频滤镜效果。滤镜配置在调用 @link prepare @endlink 前设置。
 如需动态更新滤镜，使用 @link updateFilterConfig @endlink 方法。
 滤镜仅在启用时生效，可通过 @link setFilterInvalid @endlink 临时禁用。
 
 @param filterConfig 滤镜配置对象
 @see AVPFilterConfig
 @see updateFilterConfig
 @see setFilterInvalid
 */
/****
 @brief Set filter configuration.
 
 Configures video filter effects for the player. Filter configuration should be set before calling @link prepare @endlink.
 To dynamically update filters, use @link updateFilterConfig @endlink.
 Filters are effective only when enabled; they can be temporarily disabled via @link setFilterInvalid @endlink.
 
 @param filterConfig Filter configuration object
 @see AVPFilterConfig
 @see updateFilterConfig
 @see setFilterInvalid
 */
- (void)setFilterConfig:(AVPFilterConfig *)filterConfig;

/**
 @brief 更新滤镜配置
 
 动态更新已配置的滤镜的参数。此方法可在播放过程中调用，无需重新准备。
 
 @param target 滤镜目标，指定要更新的滤镜名称
 @param options 滤镜选项参数，包含新的滤镜配置值
 @see AVPFilterOptions
 @see setFilterConfig
 */
/****
 @brief Update filter configuration.
 
 Dynamically updates parameters of configured filters. This method can be called during playback without re-preparing.
 
 @param target Filter target specifying the name of the filter to update
 @param options Filter option parameters containing new filter configuration values
 @see AVPFilterOptions
 @see setFilterConfig
 */
- (void)updateFilterConfig:(NSString *)target options:(AVPFilterOptions *)options;

/**
 @brief 启用或禁用滤镜
 
 全局控制指定滤镜的启用/禁用状态。禁用滤镜后，其参数仍被保留，重新启用时将恢复之前的配置。
 
 @param target 滤镜目标名称。如果为空字符串或nil，则操作作用于所有已配置的滤镜
 @param invalid YES表示禁用滤镜（滤镜无效），NO表示启用滤镜（滤镜有效）
 
 @note 参数名为invalid，语义为"是否使滤镜无效"，需要注意逻辑反向
 @see setFilterConfig
 @see updateFilterConfig
 */
/****
 @brief Enable or disable filter.
 
 Controls the enable/disable state of a specified filter. After disabling, parameters are retained
 and the previous configuration is restored when re-enabled.
 
 @param target Filter target name. If empty string or nil, the operation affects all configured filters
 @param invalid YES to disable the filter (invalid state), NO to enable the filter (valid state)
 
 @note Parameter name is "invalid" meaning "whether to make filter invalid"; note the inverted logic
 @see setFilterConfig
 @see updateFilterConfig
 */
- (void)setFilterInvalid:(NSString *)target invalid:(BOOL)invalid;

/**
 @brief 启用或禁用滤镜
 
 全局控制指定滤镜的启用/禁用状态。禁用滤镜后，其参数仍被保留，重新启用时将恢复之前的配置。
 
 @param target 滤镜目标名称。如果为空字符串或nil，则操作作用于所有已配置的滤镜
 @param valid YES表示启用滤镜（滤镜有效），NO表示禁用滤镜（滤镜无效）
 
 @note 参数名为valid，语义为"是否使滤镜有效"，与setFilterInvalid接口的逻辑相反
 @see setFilterInvalid
 @see setFilterConfig
 @see updateFilterConfig
 */
/****
 @brief Enable or disable filter.
 
 Controls the enable/disable state of a specified filter. After disabling, parameters are retained
 and the previous configuration is restored when re-enabled.
 
 @param target Filter target name. If empty string or nil, the operation affects all configured filters
 @param valid YES to enable the filter (valid state), NO to disable the filter (invalid state)
 
 @note Parameter name is "valid" meaning "whether the filter is valid"; logic is opposite to setFilterInvalid
 @see setFilterInvalid
 @see setFilterConfig
 @see updateFilterConfig
 */
- (void)setFilterValid:(NSString *)target valid:(BOOL)valid;


/**
 @brief 根据url获取缓存的文件名。如果有自定义的规则，请实现delegate {@link onGetCacheNameByURL}。
 @brief 如果没有实现delegate，将会采用默认逻辑生成文件名。
 @param URL URL
 @return 最终缓存的文件名（不包括后缀。缓存文件的后缀名统一为.alv）。
 @deprecated 从7.0.0版本开始，该方法已废弃。
 */
/****
 @brief Query the name of the cached file with the specified URL. If a custom rule is set, delegate {@link onGetCacheNameByURL}.
 @brief If the delegation failed, the default logic is used to generate the file name.
 @param URL The URL of the cached file.
 @return The name of the cached file. The file extension is not included. All files use the .alv extension.
 @deprecated From version 7.0.0, This method is deprecated.
 */
-(NSString *) getCacheFilePath:(NSString *)URL
__attribute__((deprecated("This method is deprecated")));

/**
 @brief 根据url获取缓存的文件名。如果有自定义的规则，请实现delegate {@link onCacheNameByVidCallback}。
 @brief 如果没有实现delegate，将会采用默认逻辑生成文件名。
 @param vid        视频id
 @param format     视频格式
 @param definition 视频清晰度
 @return 最终缓存的文件名（不包括后缀。缓存文件的后缀名统一为.alv）。
 @deprecated 从7.0.0版本开始，该方法已废弃。
 */
/****
 @brief Query the name of the cached file with the specified URL. If a custom rule is set, delegate {@link onCacheNameByVidCallback}.
 @brief If the delegation failed, the default logic is used to generate the file name.
 @param vid        The VID of the video.
 @param format     The format of the video.
 @param definition The definition of the video.
 @return The name of the cached file. The file extension is not included. All files use the .alv extension.
 @deprecated From version 7.0.0, This method is deprecated.
 */
-(NSString *) getCacheFilePath:(NSString *)vid format:(NSString *)format definition:(NSString *)definition
__attribute__((deprecated("This method is deprecated")));

/**
 @brief 根据url获取缓存的文件名。如果有自定义的规则，请实现delegate {@link onCacheNameByVidCallback}。
 @brief 如果没有实现delegate，将会采用默认逻辑生成文件名。
 @param vid        视频id
 @param format     视频格式
 @param definition 视频清晰度
 @param previewTime 试看时长
 @return 最终缓存的文件名（不包括后缀。缓存文件的后缀名统一为.alv）。
 */
/****
 @brief Query the name of the cached file with the specified URL. If a custom rule is set, delegate {@link onCacheNameByVidCallback}.
 @brief If the delegation failed, the default logic is used to generate the file name.
 @param vid        The VID of the video.
 @param format     The format of the video.
 @param definition The definition of the video.
 @param previewTime The preview duration of the video.
 @return The name of the cached file. The file extension is not included. All files use the .alv extension.
 */
-(NSString *) getCacheFilePath:(NSString *)vid format:(NSString *)format definition:(NSString *)definition previewTime:(int)previewTime;
__attribute__((deprecated("This method is deprecated")));

/**
 @brief 添加外挂字幕文件
 
 添加外部字幕文件供播放器使用。支持SRT、ASS、VTT等多种字幕格式。
 添加后可通过 @link selectExtSubtitle @endlink 选择显示。
 用法参考<a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features#2f8e9afa8fplp">外挂字幕</a>
 
 @param URL 字幕文件的URL地址，支持本地文件路径（file://）或网络地址（http://、https://）
 @see selectExtSubtitle
 @see AVPDelegate::onSubtitleExtAdded
 */
/****
 @brief Add external subtitle file.
 
 Adds an external subtitle file for the player to use. Supports various subtitle formats including SRT, ASS, VTT, etc.
 After adding, you can select and display it via @link selectExtSubtitle @endlink.
 For external subtitle usage, refer to <a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features#2f8e9afa8fplp">External Subtitles</a>
 
 @param URL Subtitle file URL address supporting local file path (file://) or network address (http://, https://)
 @see selectExtSubtitle
 @see AVPDelegate::onSubtitleExtAdded
 */
-(void) addExtSubtitle:(NSString *)URL;

/**
 @brief 选择或关闭外挂字幕轨道
 
 选择特定的外挂字幕轨道进行显示，或关闭字幕显示。
 轨道索引通过 @link AVPMediaInfo @endlink 获取。
 
 @param trackIndex 字幕轨道索引。通过 @link getMediaInfo @endlink 获取可用的字幕轨道列表和索引
 @param enable YES表示选择并显示该字幕轨道，NO表示关闭字幕显示
 @see selectExtSubtitle:enable:
 @see AVPMediaInfo
 @see AVPTrackInfo
 */
/****
 @brief Select or disable external subtitle track.
 
 Selects a specific external subtitle track for display, or disables subtitle display.
 Track index is obtained via @link AVPMediaInfo @endlink.
 
 @param trackIndex Subtitle track index obtained via @link getMediaInfo @endlink for available subtitle tracks
 @param enable YES to select and display the subtitle track, NO to disable subtitle display
 @see selectExtSubtitle:enable:
 @see AVPMediaInfo
 @see AVPTrackInfo
 */
-(void) selectExtSubtitle:(int)trackIndex enable:(BOOL)enable;



/**
 @brief 是否关闭字幕渲染
 @param enable true：开启，false：关闭
 */
/****
 @brief Enable or disable subtitle rendering
 @param enable true: enable, false: disable
 */
- (void)setEnableSubtitleRender:(BOOL)enable;


/**
 @brief 查询字幕渲染是否启用
 
 @return YES表示字幕渲染已启用，NO表示已禁用
 @see setEnableSubtitleRender
 */
/****
 @brief Query whether subtitle rendering is enabled.
 
 @return YES if subtitle rendering is enabled, NO if disabled
 @see setEnableSubtitleRender
 */
- (BOOL)isEnableSubtitleRender;

/**
 * @brief 设置某路流相对于主时钟的延时时间，默认是0, 目前只支持外挂字幕
 * @param index 流的索引
 * @param time  延时，单位毫秒
 * @deprecated
 */
/****
 * @brief set the delay time of the stream, default is 0
 * only support external subtitles
 * @param index steam index
 * @param time  ms
 * @deprecated
 */

- (void)setStreamDelayTime:(int)index time:(int)time
__attribute__((deprecated("This method is deprecated")));


/**
 @brief 重新加载。比如网络超时时，可以重新加载。
 */
/****
 @brief Reload resources. You can reload resources when the network connection times out.
 */
-(void) reload;

/**
 @brief 获取播放器属性信息
 
 根据指定的属性关键字获取播放器的相关属性信息，如HTTP响应信息、连接信息等。
 这些属性通常用于调试、性能分析和问题诊断。
 
 @param key 属性关键字，指定要查询的属性类型
 @return 属性信息字符串；如果属性不存在或未加载，返回空字符串
 @see AVPPropertyKey
 */
/****
 @brief Get player property information.
 
 Retrieves player property information based on the specified property key,
 such as HTTP response information, connection information, etc.
 These properties are typically used for debugging, performance analysis, and diagnostics.
 
 @param key Property key specifying the type of property to query
 @return Property information string; returns empty string if property does not exist or is not loaded
 @see AVPPropertyKey
 */
-(NSString *) getPropertyString:(AVPPropertyKey)key;

/**
 @brief 获取当前视频播放器会话ID（VPS）
 
 播放会话在调用prepare后开始，在调用stop或者完播后结束。
 
 @return 当前VPS字符串；如果播放器不可用，返回nil
 */
/****
 @brief Get the current Video Playback Session ID (VPS).
 
 The playback session starts after calling prepare and ends when stop is called or when playback completes.
 
 @return The current VPS string; returns nil if player is not available.
 */
-(NSString *)getCurrentVps;

/**
 @brief 设置多码率播放时的默认起播码率
 
 在多码率流播放时，播放器将选择与指定码率最接近的流进行起播。
 如果设置了自适应码率模式，此设置可能被忽略。
 
 @param bandWidth 默认起播码率，单位bps（比特每秒）
 @see setDefaultResolution
 @see setAutoBandWidth
 */
/****
 @brief Set the default initial playback bitrate for multi-bitrate playback.
 
 For multi-bitrate stream playback, the player selects the stream closest to the specified bitrate.
 If adaptive bitrate mode is enabled, this setting may be ignored.
 
 @param bandWidth Default initial playback bitrate in bps (bits per second)
 @see setDefaultResolution
 @see setAutoBandWidth
 */
-(void) setDefaultBandWidth:(int)bandWidth;

/**
 @brief 设置多音轨播放时的默认音频语言

 在多音轨流播放时，播放器将选择与指定语言完全匹配的音频流进行播放。
 可通过轨道信息中的audioLanguage字段获取可用的音频语言。

 @param language 音频语言字符串
 @see AVPTrackInfo::audioLanguage
 */
/****
 @brief Set the default audio language for multi-track playback

 For multi-track stream playback, the player will select the audio stream that exactly matches the specified language for playback.
 Available audio languages can be obtained through the audioLang field in track information.

 @param language The audio language string
 @see AVPTrackInfo::audioLanguage
 */
-(void) setDefaultAudioLanguage:(NSString *)language;

/**
 @brief 设置多字幕播放时的默认字幕语言

 在多字幕流播放时，播放器将选择与指定语言完全匹配的字幕流进行播放。
 可通过轨道信息中的subtitleLanguage字段获取可用的字幕语言。

 @param language 字幕语言字符串
 @see AVPTrackInfo::subtitleLanguage
 */
/****
 @brief Set the default subtitle language for multi-track playback

 For multi-track stream playback, the player will select the subtitle stream that exactly matches the specified language for playback.
 Available subtitle languages can be obtained through the subtitleLang field in track information.

 @param language The subtitle language string
 @see AVPTrackInfo::subtitleLanguage
 */
-(void) setDefaultSubtitleLanguage:(NSString *)language;

/**
 @brief 设置多码率播放时的默认起播清晰度
 
 通过分辨率像素数的乘积值指定默认起播清晰度。播放器将选择与此值最接近的清晰度进行起播。
 例如1920×1080的分辨率，乘积为2,073,600。
 
 @param resolutionProduct 目标分辨率的宽度和高度的乘积值。播放器选择最接近此值的清晰度
 @see setDefaultBandWidth
 @see setAutoBandWidth
 @see AVPPixelNumber
 */
/****
 @brief Set the default initial playback resolution for multi-bitrate playback.
 
 Specifies the default initial resolution through the product of resolution width and height.
 The player selects the resolution closest to this value. For example, 1920×1080 resolution has a product of 2,073,600.
 
 @param resolutionProduct Product of target resolution width and height. Player selects closest resolution
 @see setDefaultBandWidth
 @see setAutoBandWidth
 @see AVPPixelNumber
 */
-(void) setDefaultResolution:(int)resolutionProduct;


/**
 @brief 设置多码率自适应选择起播清晰度
 
 启用或禁用自适应码率（ABR）模式下的自动起播清晰度选择功能。
 启用此功能后，播放器将根据网络状况自动选择合适的清晰度进行起播，无需手动指定。
 
 @note 此功能仅影响起播时的清晰度选择，起播后不会动态调整清晰度
 @note 可通过 @link AVPConfig::maxAllowedAbrVideoPixelNumber @endlink 限制自适应选择的最大清晰度
 
 @param enable YES表示启用自适应起播清晰度选择，NO表示禁用（使用默认清晰度）
 @see isAutoBandWidth
 @see setDefaultResolution
 @see AVPConfig::maxAllowedAbrVideoPixelNumber
 */
/****
 @brief Enable or disable adaptive initial playback quality selection for multi-bitrate playback.
 
 Enables or disables automatic initial resolution selection in adaptive bitrate (ABR) mode.
 When enabled, the player automatically selects an appropriate resolution based on network conditions without manual specification.
 
 @note This feature only affects resolution selection at startup and does not dynamically adjust after playback starts
 @note Maximum resolution for adaptive selection can be limited via @link AVPConfig::maxAllowedAbrVideoPixelNumber @endlink
 
 @param enable YES to enable adaptive initial quality selection, NO to disable (use default quality)
 @see isAutoBandWidth
 @see setDefaultResolution
 @see AVPConfig::maxAllowedAbrVideoPixelNumber
 */
-(void) setAutoBandWidth:(BOOL)enable;

/**
 @brief 查询多码率自适应选择起播清晰度功能状态
 
 @return YES表示自适应起播清晰度选择已启用，NO表示已禁用
 @see setAutoBandWidth
 */
/****
 @brief Query the status of adaptive initial quality selection for multi-bitrate playback.
 
 @return YES if adaptive initial quality selection is enabled, NO if disabled
 @see setAutoBandWidth
 */
-(BOOL) isAutoBandWidth;


#if TARGET_OS_IPHONE
/**
 @brief 设置视频的背景色
 @param color  ARGB，默认值0xFF000000
 */
/****
 @brief Set video background color
 @param color  ARGB, default value 0xFF000000
 */
-(void) setVideoBackgroundColor:(UIColor *)color;

/**
 @brief 设置创建解码器的时机，为true时，在收到{@link AVPEventType::AVPEventPrepareDone}时，就已经创建好了，这样{@link start}调用就很快能起播；为false时，在调用{@link start}时才会创建，但可以加速{@link AVPEventType::AVPEventPrepareDone}事件的回调，若是自动播放，总体首帧无区别。
 @param enable  true：开启，false：关闭；默认值是true
 */
/****
 @brief Set the timing of decoder creation. When set to true, the decoder is created by the time {@link AVPEventType::AVPEventPrepareDone}is called, allowing {@link start} to begin playback quickly. When set to false, the decoder is created when {@link start} is called, which can fast {@link AVPEventType::AVPEventPrepareDone} callback. For autoplay scenarios, there is no difference in overall first-frame performance.
 @param enable  true：enable，false: disable. Default is true
 */
-(void) setFastStart:(BOOL)enable;

/**
 * @brief 设置网络IPv4/IPv6解析类型
 * @param type 见 {@link IPResolveType}，默认值都支持，谁响应快速，就优先使用
 */
/****
 * @brief set IPv4/IPv6 resolve type
 * @param type See {@link IPResolveType}， default value all support, who responds quickly, will use it first
 */
-(void) setIPResolveType:(AVPIpResolveType)type;
#endif

/**
 @brief 设置事件上报代理
 
 设置事件上报参数的代理对象，用于接收播放器的埋点事件数据。
 通过此代理可将业务事件统一走播放器的埋点回调，方便业务流程集成。
 
 @param delegate 事件上报参数代理对象
 @see AVPEventReportParamsDelegate
 */
/****
 @brief Set event report delegate.
 
 Sets the delegate object for event reporting parameters to receive player analytics data.
 This allows unified business event tracking through the player's callback.
 
 @param delegate Event report parameter delegate object
 @see AVPEventReportParamsDelegate
 */
-(void) setEventReportParamsDelegate:(id<AVPEventReportParamsDelegate>)delegate;


/**
 @brief 为画中画功能设置代理
 
 设置画中画（Picture-in-Picture，PIP）功能的代理对象，用于处理PIP相关的事件和状态变化。
 
 @param delegate 画中画功能的代理对象
 */
/****
 @brief Set delegate for picture-in-picture functionality.
 
 Sets the delegate object for Picture-in-Picture (PIP) functionality to handle PIP-related events and state changes.
 
 @param delegate Delegate object for picture-in-picture functionality
 */
-(void) setPictureinPictureDelegate:(id<AliPlayerPictureInPictureDelegate>)delegate;


/**
 @brief 为画中画功能设置显示模式
 
 指定画中画模式下控制UI的显示方式。可选择显示所有按钮或隐藏特定按钮。
 
 @param pipShowMode 画中画显示模式。默认为 @link AVP_SHOW_MODE_DEFAULT @endlink
 @see AVPPIPShowMode
 */
/****
 @brief Set display mode for picture-in-picture functionality.
 
 Specifies how control UI is displayed in picture-in-picture mode. Can choose to show all buttons or hide specific ones.
 
 @param pipShowMode Picture-in-picture display mode. Default is @link AVP_SHOW_MODE_DEFAULT @endlink
 @see AVPPIPShowMode
 */
- (void)setPictureInPictureShowMode:(AVPPIPShowMode)pipShowMode;

/**
 @brief 获取播放器选项参数
 
 查询播放器的实时性能指标，如当前渲染帧率、网络码率、视频码率等。
 
 @param key 选项参数的关键字，指定要查询的参数类型
 @return 参数值的字符串表示，具体含义取决于参数类型（通常为数值）
 @see AVPOption
 */
/****
 @brief Get player option parameter.
 
 Queries real-time performance metrics of the player, such as current rendering frame rate, network bitrate, video bitrate, etc.
 
 @param key Option key specifying the type of parameter to query
 @return String representation of parameter value; specific meaning depends on parameter type (usually numeric)
 @see AVPOption
 */
-(NSString *) getOption:(AVPOption)key;


/**
 @brief 向播放器的组件发送命令。
 @param content 命令内容。
 @return 命令执行结果， < 0 失败。
 */
/****
 @brief Send command to component
 @param content command content
 @return < 0 on Error
 @deprecated
 */

- (int)invokeComponent:(NSString *)content
__attribute__((deprecated("This method is deprecated")));
/**
 @brief 获取SDK版本号信息
 @return 播放器SDK的版本号字符串
 */
/****
 @brief Query the SDK version.
 @return SDK version string
 */
+ (NSString *)getSDKVersion;

/**
 @brief 获取设备UUID
 
 获取当前设备的唯一标识符。可用于设备追踪和日志分析。
 
 @return 设备UUID字符串
 */
/****
 @brief Query device UUID.
 
 Gets the unique identifier of the current device. Can be used for device tracking and log analysis.
 
 @return Device UUID string
 */
+ (NSString *)getDeviceUUID;

/**
 @brief 查询功能支持情况
 
 检查当前设备是否支持指定的功能，如杜比音频等。
 
 @param type 功能类型
 @return YES表示支持该功能，NO表示不支持
 @see SupportFeatureType
 */
/****
 @brief Query feature support.
 
 Checks whether the current device supports the specified feature, such as Dolby Audio.
 
 @param type Feature type
 @return YES if feature is supported, NO if not
 @see SupportFeatureType
 */
+ (BOOL)isFeatureSupport:(SupportFeatureType)type;

/**
 @brief 初始化播放器组件
 
 初始化可选的播放器组件。这些组件是可裁剪的，App可删除相应动态库并移除此初始化代码来实现功能裁剪。
 
 @param functionName 组件功能名称
 @param function 组件初始化函数指针
 */
/****
 @brief Initialize player component.
 
 Initializes optional player components. These components are optional; you can remove
 dynamic libraries and initialization code to trim unused functionality.
 
 @param functionName Component feature name
 @param function Component initialization function pointer
 */+ (void)initPlayerComponent:(NSString *)functionName function:(void *)function;

/**
 @brief 设置是否静音，支持KVO
 */
/****
 @brief Mute or unmute the player. KVO is supported.
 */
@property(nonatomic, getter=isMuted) BOOL muted;

/**
 @brief 播放速率，1为正常播放，支持KVO
 */
/****
 @brief Set the playback speed. Value 1 indicates normal speed. KVO is supported.
 */
@property(nonatomic) float rate;

/**
 @brief 硬件解码启用状态
 
 启用或禁用硬件视频解码。硬件解码可提高解码效率，但在某些情况下可能不支持特定编码格式。
 若硬件解码失败，播放器会自动降级到软件解码。设置了自适应降级回调
 (@link AliPlayerGlobalSettings::setAdaptiveDecoderGetBackupURLCallback @endlink) 后，
 可进一步降级到不同编码的视频流（如H.265降级到H.264）。
 
 @note 默认启用硬件解码
 */
/****
 @brief Hardware decoding enabled state.
 
 Enables or disables hardware video decoding. Hardware decoding improves decoding efficiency but may not support
 certain codec formats. If hardware decoding fails, the player automatically falls back to software decoding.
 With adaptive fallback callback configured (@link AliPlayerGlobalSettings::setAdaptiveDecoderGetBackupURLCallback @endlink),
 can further degrade to different codec streams (e.g., H.265 to H.264).
 
 @note Hardware decoding is enabled by default
 */
@property(nonatomic) BOOL enableHardwareDecoder;

/**
 @brief 设置是否循环播放，支持KVO
 */
/****
 @brief Enable or disable loop playback. KVO is supported.
 */
@property(nonatomic, getter=isLoop) BOOL loop;

/**
 @brief 设置是否自动播放，启用后，准备完成会自动开始播放，支持KVO
 */
/****
 @brief Enable or disable autoplay. When enabled, playback starts automatically after preparation completes. KVO is supported.
 */
@property(nonatomic, getter=isAutoPlay) BOOL autoPlay;

/**
 @brief 渲染镜像模式，支持KVO
 @see AVPMirrorMode
 */
/****
 @brief Set a mirroring mode. KVO is supported.
 @see AVPMirrorMode
 */
@property(nonatomic) AVPMirrorMode mirrorMode;

/**
 @brief
 * 设置透明渲染模式，支持如直播礼物播放等场景。详细用法参考：<a href="https://help.aliyun.com/vod/developer-reference/advanced-features#7a4b2891e3oca">doc</a>
 @see AVPAlphaRenderMode 默认值{@link AVPAlphaRenderMode.AVP_RENDERMODE_ALPHA_NONE}
 */
/****
 @brief Set alpha render mode, can be used on gift play on live stream, etc. Detail usage: <a href="https://help.aliyun.com/vod/developer-reference/advanced-features#7a4b2891e3oca">doc</a>
 @see AVPAlphaRenderMode 默认值{@link AVPAlphaRenderMode.AVP_RENDERMODE_ALPHA_NONE}
 */
@property(nonatomic) AVPAlphaRenderMode alphaRenderMode;

/**
 @brief 渲染旋转模式，支持KVO
 @see AVPRotateMode
 */
/****
 @brief Set a rotate mode. KVO is supported.
 @see AVPRotateMode
 */
@property(nonatomic) AVPRotateMode rotateMode;

/**
 @brief 渲染填充模式，支持KVO
 @see AVPScalingMode
 */
/****
 @brief Set a zoom mode. KVO is supported.
 @see AVPScalingMode
 */
@property(nonatomic) AVPScalingMode scalingMode;


/**
 @brief 设置输出声道，若输入源是双声道，则支持切换为左声道、右声道；若输入源是单声道，则设置无效。该设置会同时影响音频渲染及PCM数据回调
 @see AVPOutputAudioChannel
 */
/****
 @brief Set the output audio channel, if input source is stereo, support select to left or right channel and if intput source is mono, this api can't take effect. This api can take effect on both audio render and audio pcm data callback.
 
 @see AVPOutputAudioChannel
 */
@property(nonatomic) AVPOutputAudioChannel outputAudioChannel;

/**
 @brief 设置播放器的视图playerView
 * AVPView: mac下为NSOpenGLView，iOS下为UIView
 */
/****
 @brief Set a player view (playerView).
 * AVPView: Mac platform: NSOpenGLView. iOS platform: UIView.
 */
@property(nonatomic, strong) AVPView* playerView;

/**
 @brief 获取视频的宽度，支持KVO
 */
/****
 @brief Query the width of the video. KVO is supported.
 */
@property (nonatomic, readonly) int width;

/**
 @brief 获取视频的高度，支持KVO
 */
/****
 @brief Query the height of the video. KVO is supported.
 */
@property (nonatomic, readonly) int height;

/**
 @brief 获取视频的旋转角度，从metadata中获取出来，支持KVO
 */
/****
 @brief Query the rotate angle of the video, which is retrieved from the video metadata. KVO is supported.
 */
@property (nonatomic, readonly) int rotation;

/**
 @brief 获取/设置播放器的音量（非系统音量），支持KVO，范围0.0~2.0，当音量大于1.0时，可能出现噪音，不推荐使用。
 */
/****
 @brief Query or set the volume of the player(Not system volume). KVO is supported. The range is 0.0~2.0，it maybe lead to noise if set volume more then 1.0, not recommended.
 */
@property (nonatomic, assign) float volume;

/**
 @brief 播放时长
 
 只读属性，获取当前播放媒体的总时长（单位：毫秒）。支持KVO观察变化。
 媒体信息加载完成后此值才有效。
 */
/****
 @brief Playback duration.
 
 Read-only property querying the total duration of the current media in milliseconds.
 Supports KVO observing. Valid only after media information is loaded.
 */
@property (nonatomic, readonly) int64_t duration;

/**
 @brief 当前播放位置
 
 只读属性，获取当前播放位置（单位：毫秒）。支持KVO观察变化。
 位置会在播放过程中实时更新，也可以由 @link AVPDelegate::onCurrentPositionUpdate @endlink 获取
 
 @see AVPDelegate::onCurrentPositionUpdate
 */
/****
 @brief Current playback position.
 
 Read-only property querying the current playback position in milliseconds.
 Supports KVO observing. Position updates in real-time during playback,
 can be also collected by @link AVPDelegate::onCurrentPositionUpdate @endlink callback.
 
 @see AVPDelegate::onCurrentPositionUpdate
 */
@property (nonatomic, readonly) int64_t currentPosition;


/**
@brief 获取当前播放位置的utc时间，支持KVO
*/
/****
@brief Query the current playback utc time. KVO is supported.
*/
@property(nonatomic, readonly) int64_t currentUtcTime;


/**
 @brief 本地缓存命中大小
 
 只读属性，获取起播时命中的本地缓存文件大小（单位：字节）。
 值大于0表示命中了本地缓存，使用缓存文件进行播放。支持KVO观察变化。
 
 @see AVPDelegate::onLocalCacheLoaded
 */
/****
 @brief Local cache hit size.
 
 Read-only property querying the size of local cached file used at playback start in bytes.
 Value greater than 0 indicates cache hit and playback uses cached file. Supports KVO observing.
 
 @see AVPDelegate::onLocalCacheLoaded
 */
@property(nonatomic, readonly) int64_t localCacheLoadedSize;

/**
 @brief 当前网络下载速度
 
 只读属性，获取当前的网络下载速度（单位：比特每秒，bps）。支持KVO观察变化。
 下载速度会在播放过程中实时更新，可用于显示网络速度信息。
 
 @see AVPDelegate::onCurrentDownloadSpeed
 */
/****
 @brief Current network download speed.
 
 Read-only property querying current download speed in bits per second (bps).
 Supports KVO observing. Speed updates in real-time during playback for network speed display.
 
 @see AVPDelegate::onCurrentDownloadSpeed
 */
@property(nonatomic, readonly) int64_t currentDownloadSpeed;

/**
 @brief 已缓冲位置
 
 只读属性，获取当前已缓冲到的播放位置（单位：毫秒）。支持KVO观察变化。
 缓冲位置用于显示缓冲进度条，总是大于等于当前播放位置。
 
 @see AVPDelegate::onBufferedPositionUpdate
 */
/****
 @brief Buffered position.
 
 Read-only property querying the currently buffered playback position in milliseconds.
 Supports KVO observing. Used for displaying buffer progress bar; always greater than or equal to current position.
 
 @see AVPDelegate::onBufferedPositionUpdate
 */
@property (nonatomic, readonly) int64_t bufferedPosition;

/**
 @brief 播放器状态
 
 只读属性，获取播放器的当前状态。支持KVO观察变化。
 状态变化通过 @link AVPDelegate::onPlayerStatusChanged @endlink 回调通知。
 
 @see AVPStatus
 @see AVPDelegate::onPlayerStatusChanged
 */
/****
 @brief Player status.
 
 Read-only property querying the current player status. Supports KVO observing.
 Status changes are notified via @link AVPDelegate::onPlayerStatusChanged @endlink.
 
 @see AVPStatus
 @see AVPDelegate::onPlayerStatusChanged
 */
@property (nonatomic, readonly) AVPStatus playerStatus;

/**
 @brief 播放器代理
 
 设置或查询播放器的代理对象。代理用于接收播放器的各类事件回调，如准备完成、错误、轨道信息等。
 使用弱引用（weak），避免循环引用。
 
 @see AVPDelegate
 */
/****
 @brief Player delegate.
 
 Sets or queries the player's delegate object. Delegate receives various event callbacks from the player
 such as preparation completion, errors, track information, etc. Uses weak reference to avoid circular references.
 
 @see AVPDelegate
 */
@property (nonatomic, weak) id<AVPDelegate> delegate;

/**
 @brief 设置渲染回调。废弃，使用renderingDelegate。
 @deprecated
 */
/****
 @brief Set the render callback. Deprecated, use the renderingDelegate.
 @deprecated
*/
@property(nonatomic, weak) id<CicadaRenderDelegate> renderDelegate __deprecated;

/**
 @brief 视频渲染代理（新）
 
 设置或查询视频渲染的代理对象。用于处理视频帧渲染的相关事件。
 使用弱引用（weak）避免循环引用。
 
 @see CicadaRenderingDelegate
 */
/****
 @brief Video rendering delegate (new).
 
 Sets or queries the delegate for video rendering events.
 Uses weak reference to avoid circular references.
 
 @see CicadaRenderingDelegate
 */
@property(nonatomic, weak) id<CicadaRenderingDelegate> renderingDelegate;

/**
 @brief DRM代理
 
 设置或查询DRM（数字版权管理）相关请求的代理对象。
 此代理仅在通过URL播放时触发，VidAuth和VidSts方式不会触发。
 目前仅支持Fairplay DRM。使用弱引用（weak）避免循环引用。
 
 @see AVPDrmDelegate
 */
/****
 @brief DRM delegate.
 
 Sets or queries the delegate for DRM (Digital Rights Management) related requests.
 This delegate is only triggered when playing via URL; VidAuth and VidSts methods do not trigger it.
 Currently supports Fairplay DRM only. Uses weak reference to avoid circular references.
 
 @see AVPDrmDelegate
 */
@property(nonatomic, weak) id<AVPDrmDelegate> drmDelegate;

/**
 @brief 设置埋点事件回调。
 @see AVPEventReportParamsDelegate
 */
/****
 @brief Set the event report callback.
 @see AVPEventReportParamsDelegate
*/
@property (nonatomic, weak) id <AVPEventReportParamsDelegate> eventReportParamsDelegate;



/**
 @brief 绑定外挂字幕渲染实例
 */
/****
 @brief Binding the externalSubtitleView.
*/
/**
 * 外部字幕渲染视图
 * 使用 weak 引用，生命周期由外部管理
 * 当外部字幕视图被释放时，此属性自动变为 nil
 */
@property (nonatomic, weak, nullable) id<AliVttSubtitleViewProtocol> externalSubtitleView;

/**
 @brief 设置AudioSession委托
 
 为iOS的AVAudioSession设置自定义委托，用于处理音频会话的相关事件和配置。
 
 @param delegate AudioSession委托对象
 */
/****
 @brief Set AudioSession delegate.
 
 Sets a custom delegate for iOS AVAudioSession to handle audio session events and configuration.
 
 @param delegate AudioSession delegate object
 */
+ (void)setAudioSessionDelegate:(id<CicadaAudioSessionDelegate>)delegate;

/**
 @brief 启用或禁用日志输出
 
 全局控制播放器是否输出调试日志。启用后日志信息可通过回调或系统日志获取。
 
 @param enableLog YES表示启用日志输出，NO表示禁用日志输出
 @see setLogCallbackInfo
 */
/****
 @brief Enable or disable logging.
 
 Globally controls whether the player outputs debug logs. When enabled, log information can be obtained via callbacks or system logs.
 
 @param enableLog YES to enable logging, NO to disable logging
 @see setLogCallbackInfo
 */
+(void)setEnableLog:(BOOL)enableLog;

/**
 @brief 设置日志打印回调block，异步
 @param logLevel log输出级别
 @param callbackBlock log回调block，可以为nil
 @see AVPLogLevel
 */
/****
 @brief Set a log output callback block. Asynchronous.
 @param logLevel The level of the log.
 @param callbackBlock Log output callback block, which can be nil.
 @see AVPLogLevel
 */
+(void) setLogCallbackInfo:(AVPLogLevel)logLevel callbackBlock:(void (^)(AVPLogLevel logLevel,NSString* strLog))block;

/**
 @brief 设置日志选项
 
 配置日志系统的特定功能选项，如启用帧级日志记录等。
 
 @param logOption 日志选项类型
 @param value 选项值。0表示关闭该选项，1表示打开该选项
 @see AVPLogOption
 */
/****
 @brief Set log option.
 
 Configures specific features of the logging system, such as enabling frame-level logging.
 
 @param logOption Log option type
 @param value Option value. 0 to disable, 1 to enable
 @see AVPLogOption
 */
 + (void)setLogOption:(AVPLogOption)logOption value:(int)value;

/**
 @brief 设置直播STS有效性监听回调
 
 在加密直播播放过程中，当加密密钥需要更新时，播放器会通过此回调验证当前STS凭证是否有效。
 开发者需要监听此回调并返回STS状态。如果STS无效，需要通过 @link updateLiveStsInfo @endlink
 更新最新的STS凭证。
 
 @param callback STS有效性检查回调。回调参数为当前STS信息，返回值为STS状态
 @see updateLiveStsInfo
 @see AVPStsInfo
 @see AVPStsStatus
 */
/****
 @brief Set STS validity verification callback for encrypted live streaming.
 
 During encrypted live streaming playback, when encryption key needs to be updated, the player verifies
 whether the current STS credentials are valid through this callback. Developers must listen to this callback
 and return the STS status. If STS is invalid, update with latest credentials via @link updateLiveStsInfo @endlink.
 
 @param callback STS validity check callback. Callback parameter is current STS information, return value is STS status
 @see updateLiveStsInfo
 @see AVPStsInfo
 @see AVPStsStatus
 */
-(void) setVerifyStsCallback:(AVPStsStatus (^)(AVPStsInfo info)) callback;

/**
 @brief 设置 URL 源过期通知的回调。

 当播放器检测到当前的 URL 源已失效时触发回调。
 您可以在回调中通过刷新 URL 源并调用 `callback` 返回新的 URL 源，确保视频播放不中断。

 @note 关于 URL 鉴权机制的配置，请参考阿里云官方文档：
 https://help.aliyun.com/zh/vod/user-guide/configure-url-signing?spm=a2c4g.11186623.0.0.560c4140fGh8MW
 
 @param callback URL 源过期时触发的回调块。
 您可以通过该回调返回有效的 `URLSource` 对象以更新播放器。
 */
 /****
 @brief Set the callback for URL source expiration notification.

 This method is triggered when the player detects that the current URL source has expired.
 You can refresh the URL source within the callback and use the `callback` to return the updated URL source,
 ensuring uninterrupted video playback.

 @param callback The callback block triggered when the URL source expires.
 Use this callback to provide a valid `URLSource` object to update the player.
 */
-(void)setOnURLSourceExpiredCallback:(void (^)(id expiredSource, id<AVPSourceRefreshCallback> callback))callback;

/**
 @brief 设置 VidAuth 源过期通知的回调。

 当播放器检测到当前 VidAuth 源已过期时触发回调。VidAuth 源过期包含PlayAuth过期与播放地址过期。
 您可以在回调中刷新 VidAuth 源，并通过 `callback` 提交新的 VidAuth 源对象，确保视频播放稳定流畅。

 @param callback VidAuth 源过期时触发的回调块。
 您可以通过该回调返回有效的 `VidAuth` 对象以更新播放器。
 */
 /****
 @brief Set the callback for VidAuth source expiration notification.

 This method is triggered when the player detects that the current VidAuth source has expired.
 You can refresh the VidAuth source within the callback and use the `callback` to return the updated VidAuth source,
 ensuring uninterrupted and smooth video playback.

 @param callback The callback block triggered when the VidAuth source expires.
 Use this callback to provide a valid `VidAuth` object to update the player.
 */
-(void)setOnVidAuthExpiredCallback:(void (^)(id expiredSource, id<AVPSourceRefreshCallback> callback))callback;

/**
 @brief 设置首选播放器内核
 
 指定播放器使用的内核类型，可选择自研内核或系统内核。此设置需在调用 @link prepare @endlink
 前进行，以使设置生效。
 
 @param name 播放器内核名称。默认为空字符串（使用自研内核）。
            "AppleAVPlayer"表示使用iOS系统播放器
 @see prepare
 */
/****
 @brief Set preferred player kernel.
 
 Specifies the player kernel type, can choose between self-developed kernel or system kernel.
 This setting must be made before calling @link prepare @endlink to take effect.
 
 @param name Player kernel name. Default is empty string (use self-developed kernel).
            "AppleAVPlayer" to use iOS system player
 @see prepare
 */
- (void)setPreferPlayerName:(NSString *)name;

/**
 @brief 获取播放时使用的播放器名字
 */
/****
 @brief Get used player name
 */
- (NSString *)getPlayerName;

/**
 @brief 设置视频标签。值范围[0,99]。
 @deprecated
 */
/****
 @brief Set the video tags. Values range from [0,99].
 @deprecated
 */
- (void)setVideoTag:(int *)tags size:(int)size
__attribute__((deprecated("This method is deprecated")));

/**
 @brief 发送自定义埋点事件
 
 向播放器的埋点系统发送自定义事件，该事件将通过 @link AVPEventReportParamsDelegate @endlink
 回调传递给应用。用于将业务事件统一走播放器的埋点回调，便于业务数据统一收集和处理。
 
 自定义事件编号为5001，args参数为事件的自定义数据，将被透传给回调。
 
 @param args 自定义事件的参数数据，可为任意字符串
 @see AVPEventReportParamsDelegate
 */
/****
 @brief Send custom analytics event.
 
 Sends a custom event to the player's analytics system, which will be passed to the application
 via @link AVPEventReportParamsDelegate @endlink callback. Used to unify business events through the player's
 analytics callback for centralized data collection and processing.
 
 Custom event code is 5001; args parameter contains custom event data passed through transparently.
 
 @param args Custom event parameter data; can be any string
 @see AVPEventReportParamsDelegate
 */
- (void)sendCustomEvent:(NSString *)args;

/**
 @brief 设置播放器实例的用户数据
 
 为该播放器实例绑定自定义用户数据。在多实例场景下，可用于区分不同的播放器实例。
 用户数据可通过 @link getUserData @endlink 方法获取。
 
 @param userData 用户自定义数据字符串。可为任意业务相关数据，如用户ID、视频ID等
 @see getUserData
 */
/****
 @brief Set user data for the player instance.
 
 Binds custom user data to this player instance. In multi-instance scenarios, can be used to differentiate
 different player instances. User data can be retrieved via @link getUserData @endlink.
 
 @param userData Custom user data string; can be any business-related data such as user ID, video ID, etc.
 @see getUserData
 */
- (void)setUserData:(NSString *)userData;

/**
 @brief 设置播放器特定功能选项（字符串值）
 
 为播放器设置特定功能的选项参数。某些选项接受字符串类型的值。
 
 @param key 选项关键字，指定要设置的选项类型
 @param value 选项值的字符串表示
 @see PlayerOption
 */
/****
 @brief Set player specific option (string value).
 
 Sets option parameters for specific player features. Some options accept string-type values.
 
 @param key Option key specifying the type of option to set
 @param value String representation of the option value
 @see PlayerOption
 */
- (void)setOption:(PlayerOption)key value:(NSString *)value;

/**
 @brief 设置播放器特定功能选项（整数值）
 
 为播放器设置特定功能的选项参数。某些选项接受整数类型的值。
 
 @param key 选项关键字，指定要设置的选项类型
 @param value 选项值的整数表示
 @see PlayerOption
 */
/****
 @brief Set player specific option (integer value).
 
 Sets option parameters for specific player features. Some options accept integer-type values.
 
 @param key Option key specifying the type of option to set
 @param value Integer representation of the option value
 @see PlayerOption
 */
- (void)setOption:(PlayerOption)key valueInt:(int)value;

/**
 @brief 获取播放器实例的用户数据
 
 获取之前通过 @link setUserData @endlink 设置的用户数据。每个播放器实例可绑定一个用户数据。
 
 @return 用户数据字符串；如未设置，返回nil或空字符串
 @see setUserData
 */
/****
 @brief Get user data of the player instance.
 
 Retrieves user data previously set via @link setUserData @endlink.
 Each player instance can bind one user data.
 
 @return User data string; returns nil or empty string if not set
 @see setUserData
 */
- (NSString *)getUserData;

/**
 @brief 重连所有网络连接，网络路由发生变化后，调用此接口，可以让播放器所有的连接切换到新的路由上去。
 @deprecated
 */
/****
 @brief reconnect all connections, call this when netWork router changed, and the player will use new router.
 */
+ (void)netWorkReConnect DEPRECATED_MSG_ATTRIBUTE("don't need use this API, reconnect internally when network state changed");

/**
 @brief 启用或禁用画中画功能
 
 全局控制是否启用iOS系统的画中画功能。此功能需要iOS 15及以上系统支持。
 对于低于iOS 15的系统，可通过 @link CicadaRenderingDelegate @endlink
 获取像素缓冲数据自定义实现。
 
 @param enable YES表示启用画中画功能，NO表示禁用
 @see setPictureinPictureDelegate
 @see CicadaRenderingDelegate
 */
/****
 @brief Enable or disable picture-in-picture functionality.
 
 Globally controls whether iOS system picture-in-picture functionality is enabled.
 This feature requires iOS 15 or later. For systems below iOS 15, you can implement
 custom picture-in-picture by obtaining pixel buffer data via @link CicadaRenderingDelegate @endlink.
 
 @param enable YES to enable picture-in-picture, NO to disable
 @see setPictureinPictureDelegate
 @see CicadaRenderingDelegate
 */
- (void)setPictureInPictureEnable:(BOOL)enable;

/**
 @brief 获取已播放时长
 
 获取实际的播放时长，不受Seek操作影响。该时长不包括暂停、缓冲等非播放状态的时间。
 
 可通过 @link setOption:valueInt: @endlink 设置 @link PLAYED_DURATION_INCLUDE_SPEED @endlink
 选项控制播放时长是否考虑播放倍速的影响。
 
 @return 已播放时长，单位微秒
 @see setOption:valueInt:
 @see PLAYED_DURATION_INCLUDE_SPEED
 */
/****
 @brief Get the actual played duration.
 
 Retrieves the actual playback duration, not affected by seek operations.
 This duration does not include non-playback time such as pauses and buffering.
 
 Use @link setOption:valueInt: @endlink with @link PLAYED_DURATION_INCLUDE_SPEED @endlink option
 to control whether playback duration considers playback speed effects.
 
 @return Played duration. Unit: microseconds.
 @see setOption:valueInt:
 @see PLAYED_DURATION_INCLUDE_SPEED
 */
- (int64_t) getPlayedDuration;

/**
 @brief 设置允许强制渲染回调
 @param enable YES表示允许
 */
/****
 @brief set force enable render callback
 @param enable allow
 */
- (void) setForceEnableRenderingCb:(BOOL) enable;

@end
