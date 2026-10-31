//
//  AVPDelegate.h
//  AliPlayerSDK
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef AVPDelegate_h
#define AVPDelegate_h

@class AliPlayer;
@class AVPTrackInfo;

#import <Foundation/Foundation.h>
#import "AVPDef.h"


@protocol AVPUrlRefreshCallback <NSObject>
/**
 @brief 刷新成功
 @param newUrl 新的URL
 */
/****
 @brief Refresh success
 @param newUrl New URL
 */
- (void)onSuccess:(NSString *)newUrl;

/**
 @brief 刷新失败
 @param errorMsg 错误信息
 */
/****
 @brief Refresh failed
 @param errorMsg Error message
 */
- (void)onError: (NSString *)errorMsg;
@end

/**
 @protocol AVPSourceRefreshCallback
 @brief 播放源刷新回调协议，开发者需实现以处理播放源的刷新结果。

 此回调用于在播放器请求刷新播放源时通知开发。
 播放器会调用协议中的方法以向开发者提供刷新结果，包括成功或失败。

 @note 此协议适用于 URL 源、VidAuth 源等需要刷新逻辑的场景。
 */
 /****
 @brief A protocol for handling playback source refresh results, which developers need to implement.

 This protocol notifies developers when the player requests playback source refresh, such as when a resource
 has expired or needs updating. The methods in this protocol are called to provide the refresh results to the developer,
 including success or failure.

 @note This protocol applies to URL source, VidAuth source, and similar scenarios requiring refresh logic.
 */
@protocol AVPSourceRefreshCallback <NSObject>

/**
 @brief 当刷新操作成功时由播放器调用
 @param newSource 包含更新信息的新播放源对象。
 
 此方法表示刷新操作已成功完成。开发者需要将更新后的 `newSource` 返回给播放器，
 以使播放器能够加载新的资源。
 */
 /****
 @brief Called by the player when the refresh operation succeeds.
 
 @param newSource The new playback source object containing the updated information.

 This method indicates that the refresh operation has been successfully completed. Developers need to pass
 the updated `newSource` back to the player so that it can load the latest resource.
 */
- (void)onSuccess:(id)newSource;

/**
 @brief 当刷新操作失败时由播放器调用
 @param errorMsg 描述失败原因的错误信息。
 
 此方法表示刷新操作失败。开发者可通过 `errorMsg` 捕获失败信息并进行后续处理。
 */
 /****
 @brief Called by the player when the refresh operation fails.
 
 @param errorMsg A string describing the reason for the failure.

 This method indicates that the refresh operation has failed. Developers can use `errorMsg` to capture failure
 details and handle subsequent processing accordingly.
 */
- (void)onError:(NSString *)errorMsg;

@end

@protocol AVPDelegate <NSObject>
@optional

/**
 @brief 播放器事件回调
 @param player 播放器player指针
 @param eventType 播放器事件类型
 @see AVPEventType
 */
/****
 @brief Player event callback.
 @param player Player pointer.
 @param eventType Player event type.
 @see AVPEventType
 */
-(void)onPlayerEvent:(AliPlayer*)player eventType:(AVPEventType)eventType;

/**
 @brief 播放器事件回调（带字符串描述）
 @param player 播放器player指针
 @param eventWithString 播放器事件类型字符串
 @param description 播放器事件详细说明
 @see AVPEventType
 */
/****
 @brief Player event callback with string description.
 @param player Player pointer.
 @param eventWithString Player event type string.
 @param description Player event detailed description.
 @see AVPEventType
 */
-(void)onPlayerEvent:(AliPlayer*)player eventWithString:(AVPEventWithString)eventWithString description:(NSString *)description;

/**
 @brief 错误代理回调
 @param player 播放器player指针
 @param errorModel 播放器错误描述，参考AVPErrorModel
 触发时机：播放过程中发生错误时回调，包括网络错误、解码错误、文件错误等
 @see AVPErrorModel
 */
/****
 @brief Proxy error callback.
 @param player Player pointer.
 @param errorModel Player error description. See AVPErrorModel.
 Triggered when errors occur during playback, including network errors, decoding errors, file errors, etc.
 @see AVPErrorModel
 */
- (void)onError:(AliPlayer*)player errorModel:(AVPErrorModel *)errorModel;

/**
 @brief 视频大小变化回调
 @param player 播放器player指针
 @param width 视频宽度
 @param height 视频高度
 @param rotation 视频旋转角度
 触发时机：视频元数据加载完成或视频分辨率发生变化时回调
 */
/****
 @brief Video size change callback.
 @param player Player pointer.
 @param width Video width.
 @param height Video height.
 @param rotation Video rotate angle.
 Triggered when video metadata is loaded or video resolution changes.
 */
- (void)onVideoSizeChanged:(AliPlayer*)player width:(int)width height:(int)height rotation:(int)rotation;

/**
 @brief 视频当前播放位置回调
 @param player 播放器player指针
 @param position 视频当前播放位置，单位毫秒
 触发频率：通过AVPConfig::positionTimerIntervalMs调整
 @see AliPlayer::currentPosition
 */
/****
 @brief Current playback position callback.
 @param player Player pointer.
 @param position Current playback position in milliseconds.
 Callback frequency: Default once per second, can be adjusted via configuration.
 @see AliPlayer::currentPosition
 */
- (void)onCurrentPositionUpdate:(AliPlayer*)player position:(int64_t)position;

/**
 @brief 视频当前播放内容对应的utc时间回调
 @param player 播放器player指针
 @param time utc时间，单位毫秒
 适用于直播场景，获取当前播放内容对应的UTC时间戳
 @see AliPlayer::currentUtcTime
 */
/****
 @brief Current playback utc time callback.
 @param player Player pointer.
 @param time Current UTC time in milliseconds.
 Applicable to live streaming scenarios to get the UTC timestamp corresponding to the current playback content.
 @see AliPlayer::currentUtcTime
 */
- (void)onCurrentUtcTimeUpdate:(AliPlayer *)player time:(int64_t)time;

/**
 @brief 视频起播缓存命中回调
 @param player 播放器player指针
 @param size 文件大小,单位为字节。大于0代表命中缓存，此时值代表命中缓存的字节数。
 触发时机：播放器开始播放时，如果使用了本地缓存文件，则会回调此方法
 @see AliPlayer::localCacheLoadedSize
 */
/****
 @brief Video playback cache hit callback.
 @param player Player pointer.
 @param size File size, measured in bytes; a value greater than 0 indicates a cache hit, and the value represents the number of bytes hit the cache.
 Triggered when the player starts playback and uses a local cache file.
 @see AliPlayer::localCacheLoadedSize
 */
- (void)onLocalCacheLoaded:(AliPlayer *)player size:(int64_t)size;

/**
 @brief 视频缓冲位置回调
 @param player 播放器player指针
 @param position 视频当前缓冲位置，单位毫秒
 表示当前已缓冲到的位置，可用于显示缓冲进度条，触发频率可通过AVPConfig::positionTimerIntervalMs调整
 @see AliPlayer::bufferedPosition
 */
/****
 @brief Current cache position callback.
 @param player Player pointer.
 @param position Current cache position in milliseconds.
 Indicates the current buffered position, can be used to display buffer progress bar. The callback frequency can be adjusted via AVPConfig::positionTimerIntervalMs.
 @see AliPlayer::bufferedPosition
 */
- (void)onBufferedPositionUpdate:(AliPlayer*)player position:(int64_t)position;

/**
 @brief 视频缓冲进度回调，用于显示Loading进度
 @param player 播放器player指针
 @param progress 缓存进度0-100，表示缓冲完成的百分比
 */
/****
 @brief Buffer progress callback, used to display Loading progress
 @param player Player pointer.
 @param progress Buffer progress: from 0 to 100, representing the percentage of buffer completion.
 */
- (void)onLoadingProgress:(AliPlayer*)player progress:(float)progress;


/**
 @brief 当前下载速度回调
 @param player 播放器player指针
 @param speed 当前下载速度，单位bits per second
 @see AliPlayer::currentDownloadSpeed
 直播场景下，会持续有数据；而点播场景下，可能因使用的缓存而无下载速度，是正常情况。
 */
/****
 @brief current download speed callback.
 @param player Player pointer.
 @param speed Current download speed in bits per second.
 @see AliPlayer::currentDownloadSpeed
 In live streaming, there will be data continuously; while in on-demand streaming, there may be no download speed because of the cache used, which is a normal situation.
 */
- (void)onCurrentDownloadSpeed:(AliPlayer *)player speed:(int64_t)speed;

/**
 @brief 获取track信息回调
 @param player 播放器player指针
 @param info track流信息数组，包含视频、音频、字幕等轨道信息
 触发时机：prepare完成后，获取到媒体信息时回调
 @see AVPTrackInfo
 @see AliPlayer::getMediaInfo
 @see AliPlayer::prepare
 */
/****
 @brief Track information callback.
 @param player Player pointer.
 @param info An array of track information, including video, audio, subtitle tracks, etc.
 Triggered after prepare is completed and media information is obtained.
 @see AVPTrackInfo
 @see AliPlayer::getMediaInfo
 @see AliPlayer::prepare
 */
- (void)onTrackReady:(AliPlayer*)player info:(NSArray<AVPTrackInfo*>*)info;

/**
 @brief 获取子流track信息回调
 @param player 播放器player指针
 @param info 子流track信息数组
 适用于HLS打包多清晰度流。
 @see AVPTrackInfo
 @see AliPlayer::getSubMediaInfo
 */
/****
 @brief Sub-stream track information callback.
 @param player Player pointer.
 @param info An array of sub-stream track information.
 Applicable to HLS packaged multi-bitrate streams.
 @see AVPTrackInfo
 @see AliPlayer::getSubMediaInfo
 */
- (void)onSubTrackReady:(AliPlayer*)player info:(NSArray<AVPTrackInfo*>*)info;


/**
 @brief 获取网络质量信息回调, 当前该监听器仅对超低延时直播（RTS）拉流场景生效。
 @param player 播放器player指针
 @param stat 网络质量信息，包含丢包率、延迟等指标
 @see AVPNetworkStat
 */
/****
 @brief Network stat information callback. Currently only effective for Real-time Streaming(RTS)
 @param player Player pointer.
 @param stat Network quality information, including packet loss rate, latency, etc.
 @see AVPNetworkStat
 */
- (void)onNetworkStat: (AliPlayer*)player stat:(AVPNetworkStat*) stat;

/**
 @brief 选择希望播放的流
 @param player 播放器player指针
 @param info track流信息数组
 @return 返回要播放的流索引
 @see AVPTrackInfo
 @see AliPlayer::selectTrack
 */
 /****
 @brief Select the stream to play.
 @param player Player pointer.
 @param info An array of track information, including video, audio, subtitle tracks, etc.
 @return The index of the stream to play.
 @see AVPTrackInfo
 @see AliPlayer::selectTrack
 */
- (int)onChooseTrackIndex:(AliPlayer *)player info:(NSArray<AVPTrackInfo *> *)info;

/**
 @brief track切换完成回调
 @param player 播放器player指针
 @param info 切换后的信息 参考AVPTrackInfo
 触发时机：调用{@link AliPlayer::selectTrack}后切换完成时回调
 @see AVPTrackInfo
 @see AliPlayer::selectTrack
 */
/****
 @brief Track switchover completion callback.
 @param player Player pointer.
 @param info Track switchover completion information. See AVPTrackInfo.
 Triggered after calling {@link AliPlayer::selectTrack} and the switch is completed.
 @see AVPTrackInfo
 @see AliPlayer::selectTrack
 */
- (void)onTrackChanged:(AliPlayer*)player info:(AVPTrackInfo*)info;

/**
 @brief 根据url切换清晰度流成功通知
 @param player 播放器player指针
 @param url 切换后的url
 触发时机：调用{@link AliPlayer::switchStream}成功后回调
 注意：仅适用于阿里云直播地址的多清晰度切换
 @see AliPlayer::switchStream
 */
/****
 @brief Stream switch by url success callback.
 @param player Player pointer.
 @param url Switched url.
 Triggered after successfully calling {@link AliPlayer::switchStream}.
 Note: Only applicable to Aliyun live streaming addresses for multi-definition switching.
 @see AliPlayer::switchStream
 */
- (void)onStreamSwitchedSuccess:(AliPlayer*)player URL:(NSString*)URL;

/**
 @brief 根据url切换清晰度流失败通知
 @param player 播放器player指针
 @param URL 切换的url
 @param errorModel 播放器错误描述，参考AVPErrorModel
 触发时机：调用{@link AliPlayer::switchStream}失败后回调
 @see AliPlayer::switchStream
 */
/****
 @brief Stream switch by url fail callback.
 @param player Player pointer.
 @param URL Switched url.
 @param errorModel Player error description. See AVPErrorModel.
 Triggered after calling {@link AliPlayer::switchStream} fails.
 @see AliPlayer::switchStream
 */
- (void)onStreamSwitchedFail:(AliPlayer*)player URL:(NSString*)URL errorModel:(AVPErrorModel *)errorModel;

/**
 @brief 外挂字幕被添加
 @param player 播放器player指针
 @param trackIndex 字幕轨道索引
 @param URL 字幕url
 触发时机：调用{@link AliPlayer::addExtSubtitle}成功后回调
 @see AliPlayer::addExtSubtitle
 */
/****
 @brief External subtitles have been added
 @param player Player pointer.
 @param trackIndex Subtitle track index.
 @param URL subtitle url
 Triggered after successfully calling {@link AliPlayer::addExtSubtitle}.
 @see AliPlayer::addExtSubtitle
 */
- (void)onSubtitleExtAdded:(AliPlayer*)player trackIndex:(int)trackIndex URL:(NSString *)URL;

/**
 @brief 外挂字幕添加失败
 @param player 播放器player指针
 @param errorCode 添加失败错误码
 @param errorMsg 添加失败错误原因
 触发时机：调用{@link AliPlayer::addExtSubtitle}失败后回调
 @see AliPlayer::addExtSubtitle
 */
/****
 @brief External subtitles  added failed
 @param player Player pointer.
 @param errorCode Subtitle track added failed error code.
 @param errorMsg subtitle url added failed error message.
 Triggered after  calling {@link AliPlayer::addExtSubtitle} failed.
 @see AliPlayer::addExtSubtitle
 */
- (void)onSubtitleExtAddedError:(AliPlayer*) player errorCode:(int)errorCode errorMsg:(NSString *)errorMsg;

/**
 @brief 字幕头信息回调。用于ASS或VTT字幕等需要头信息的格式。如果实现此回调，播放器将不会自动渲染字幕，需要调用者自行完成字幕渲染。
 @param player 播放器实例指针
 @param trackIndex 字幕轨道索引
 @param header 字幕头信息内容
 外挂字幕用法参考<a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features-1#fe50ee8e82fax">外挂字幕</a>
 */
/****
 @brief Subtitle header information callback. Used for formats like ASS subtitles that require header information. If this callback is implemented, the player will not automatically render subtitles, and the caller needs to handle subtitle rendering.
 @param player Player instance pointer
 @param trackIndex Subtitle track index
 @param header Subtitle header information content
 For external subtitle usage, refer to <a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features-1#fe50ee8e82fax">External Subtitles</a>
 */
- (void)onSubtitleHeader:(AliPlayer *)player trackIndex:(int)trackIndex Header:(NSString *)header;

/**
 @brief 字幕显示回调
 @param player 播放器player指针
 @param trackIndex 字幕流索引.
 @param subtitleID  字幕ID.
 @param subtitle 字幕显示的字符串
 触发时机：字幕需要显示时回调
 @see AliPlayer::selectExtSubtitle
 */
/****
 @brief Show subtitle callback.
 @param player Player pointer.
 @param trackIndex Subtitle stream index.
 @param subtitleID Subtitle ID.
 @param subtitle Subtitle string.
 Triggered when subtitles need to be displayed.
 @see AliPlayer::selectExtSubtitle
 */
- (void)onSubtitleShow:(AliPlayer*)player trackIndex:(int)trackIndex subtitleID:(long)subtitleID subtitle:(NSString *)subtitle;

/**
 @brief 字幕隐藏回调
 @param player 播放器player指针
 @param trackIndex 字幕流索引.
 @param subtitleID  字幕ID.
 触发时机：字幕需要隐藏时回调
 @see AliPlayer::selectExtSubtitle
 */
/****
 @brief Hide subtitle callback.
 @param player Player pointer.
 @param trackIndex Subtitle stream index.
 @param subtitleID Subtitle ID.
 Triggered when subtitles need to be hidden.
 @see AliPlayer::selectExtSubtitle
 */
- (void)onSubtitleHide:(AliPlayer*)player trackIndex:(int)trackIndex subtitleID:(long)subtitleID;

/**
 @brief 获取缩略图成功回调
 @param positionMs 指定的缩略图位置
 @param fromPos 此缩略图的开始位置
 @param toPos 此缩略图的结束位置
 @param image 缩图略图像指针,对于mac是NSImage，iOS平台是UIImage指针
 触发时机：调用{@link AliPlayer::getThumbnail}成功后回调
 @see AliPlayer::getThumbnail
 */
/****
 @brief Thumbnail image retrieval success callback.
 @param positionMs The specified thumbnail image position.
 @param fromPos The initial position of the thumbnail image.
 @param toPos The end position of the thumbnail image.
 @param image Thumbnail image pointer. Mac: NSImage. iOS: UIImage.
 Triggered after successfully calling {@link AliPlayer::getThumbnail}.
 @see AliPlayer::getThumbnail
 */
- (void)onGetThumbnailSuc:(int64_t)positionMs fromPos:(int64_t)fromPos toPos:(int64_t)toPos image:(id)image;

/**
 @brief 获取缩略图失败回调
 @param positionMs 指定的缩略图位置
 触发时机：调用{@link AliPlayer::getThumbnail}失败后回调
 @see AliPlayer::getThumbnail
 */
/****
 @brief Thumbnail image retrieval failure callback.
 @param positionMs The specified thumbnail image position.
 Triggered after calling {@link AliPlayer::getThumbnail} fails.
 @see AliPlayer::getThumbnail
 */
- (void)onGetThumbnailFailed:(int64_t)positionMs;

/**
 @brief 播放器状态改变回调
 @param player 播放器player指针
 @param oldStatus 老的播放器状态 参考AVPStatus
 @param newStatus 新的播放器状态 参考AVPStatus
 触发时机：播放器状态发生变化时回调，包括idle、prepared、started、paused、stopped、completed、error等状态
 @see AVPStatus
 @see AliPlayer::playerStatus
 */
/****
 @brief Player status update callback.
 @param player Player pointer.
 @param oldStatus The previous status. See AVPStatus.
 @param newStatus The updated status. See AVPStatus.
 Triggered when player status changes, including idle, prepared, started, paused, stopped, completed, error, etc.
 @see AVPStatus
 @see AliPlayer::playerStatus
 */
- (void)onPlayerStatusChanged:(AliPlayer*)player oldStatus:(AVPStatus)oldStatus newStatus:(AVPStatus)newStatus;

/**
 @brief 获取截图回调，触发自{@link Aliplayer::snapShot}
 @param player 播放器player指针
 @param image 图像，iOS平台返回UIImage，而mac平台返回NSImage
 @see AliPlayer::snapShot
 */
/****
 @brief Snapshot retrieval callback. Triggered by {@link Aliplayer::snapShot}
 @param player Player pointer.
 @param image Snapshot. For Mac platform, AVPImage is UIImage for iOS platform while it's NSImage for Mac platform.
 @see AliPlayer::snapShot
 */
- (void)onCaptureScreen:(AliPlayer*)player image:(AVPImage*)image;

/**
 @brief SEI回调
 @param player 播放器player指针
 @param type 类型
 @param uuid 数据（当type=5时,uuid值有效，播放器sdk 6.11.0及之后的版本新增）
 @param data 数据（不包含uuid部分，跟6.10.0及之前的版本语义保持一致）
 触发时机：解码器解析到SEI数据时回调
 */
/****
 @brief SEI callback.
 @param player Player pointer.
 @param type Type.
 @param uuid Data.(valid only when type=5, added in player sdk 6.11.0 and later)
 @param data Data.(not included uuid part, the same semantic with player sdk 6.10.0 and before)
 Triggered when the decoder parses SEI data.
 */
- (void)onSEIData:(AliPlayer*)player type:(int)type uuid:(NSData *)uuid data:(NSData *)data;

/**
 @brief 播放器渲染信息回调
 @param player 播放器player指针
 @param timeMs 渲染时的系统时间，单位毫秒
 @param pts  视频帧pts
 触发时机：每帧视频渲染完成时回调，可用于帧级监控和性能分析
 @see AliPlayer::setOnVideoRenderedListener
 */
/****
 @brief Player render info callback.
 @param player Player pointer.
 @param timeMs system time when render in milliseconds.
 @param pts  video frame pts
 Triggered when each video frame rendering is completed, can be used for frame-level monitoring and performance analysis.
 @see AliPlayer::setOnVideoRenderedListener
 */
-(void)onVideoRendered:(AliPlayer*)player timeMs:(int64_t)timeMs pts:(int64_t)pts;

/**
 @brief URL过期回调
 @param player 播放器player指针
 @param expiredUrl 过期的URL
 @param callback URL刷新回调
 触发时机：播放器检测到URL过期时回调，可用于实现URL自动刷新功能
 */
/****
 @brief URL expired callback.
 @param player Player pointer.
 @param expiredUrl Expired URL.
 @param callback URL refresh callback.
 Triggered when the player detects that the URL has expired, can be used to implement automatic URL refresh functionality.
 */
- (void)onUrlExpired:(AliPlayer*)player expiredUrl:(NSString*)expiredUrl callback:(id<AVPUrlRefreshCallback>)callback;

/**
 @brief URL源过期回调
 @param player 播放器player指针
 @param expiredSource 过期的URL源对象
 @param callback 源刷新回调
 */
/****
 @brief URL source expired callback.
 @param player Player pointer.
 @param expiredSource Expired URL source object.
 @param callback Source refresh callback.
 */
- (void)onURLSourceExpired:(AliPlayer*)player expiredSource:(id)expiredSource callback:(id<AVPSourceRefreshCallback>)callback;

/**
 @brief VidAuth源过期回调
 @param player 播放器player指针
 @param expiredSource 过期的VidAuth源对象
 @param callback 源刷新回调
 */
/****
 @brief VidAuth source expired callback.
 @param player Player pointer.
 @param expiredSource Expired VidAuth source object.
 @param callback Source refresh callback.
 */
- (void)onVidAuthExpired:(AliPlayer*)player expiredSource:(id)expiredSource callback:(id<AVPSourceRefreshCallback>)callback;

@end

/**
 @brief 埋点事件参数回调
 */
/****
 @brief Event report params
*/
@protocol AVPEventReportParamsDelegate <NSObject>
/**
 @brief 回调
 @param params  埋点事件参数，包含事件类型、时间戳、播放器状态等信息
 可用于业务埋点统一走播放器的埋点回调，方便业务统一流程
 @see AliPlayer::sendCustomEvent
 */
/****
 @brief call back
 @param params  event params, including event type, timestamp, player status, etc.
 Can be used to unify business events/metrics through the player's reporting callback for consistent business flow.
 @see AliPlayer::sendCustomEvent
*/
-(void)onEventReportParams:(NSDictionary<NSString *, NSString *>*)params;
@end
#endif /* AVPDelegate_h */
