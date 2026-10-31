//
//  AVPDef.h
//  AVPSDK
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef AVPDef_h
#define AVPDef_h

#import <Foundation/Foundation.h>

#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#define AVPView NSView
#define AVPImage NSImage
#elif TARGET_OS_IPHONE
#import <UIKit/UIKit.h>
#define AVPView UIView
#define AVPImage UIImage
#endif // TARGET_OS_OSX

#import "AVPErrorCode.h"

/**
 * @brief 播放URL转换回调函数
 *
 *
 * @param srcURL [in] 输入的原始URL字符串，不能为NULL。
 * @param srcFormat [in] 输入URL的格式，通常为"m3u8"、"mp4"或其他格式标识，格式未知时为空字符串。
 * @param destURL [out] 输出的转换后URL字符串。函数需负责分配内存，调用者需在使用后释放该内存。
 * @return true表示URL转换成功，false表示转换失败。转换失败时，播放器将使用原始URL继续播放。
 *
 * @see AliPlayer::setPlayUrlConvertCallback
 */
/****
 * @brief Playback URL conversion callback function.
 *
 *
 * @param srcURL [in] Input original URL string, must not be NULL.
 * @param srcFormat [in] Format of the input URL, typically "m3u8", "mp4", or other format identifiers.
 *                       Empty string if format is unknown.
 * @param destURL [out] Output converted URL string. The function is responsible for memory allocation,
 *                      and the caller must release this memory after use.
 * @return true indicates successful URL conversion; false indicates conversion failure.
 *         On failure, the player will continue with the original URL.
 *
 * @see AliPlayer::setPlayUrlConvertCallback
 */
typedef bool (*PlayURLConverCallback)(const char* srcURL, const char* srcFormat, char** destURL);

/**
 * @brief 播放器状态枚举
 */
/****
 * @brief Player status enumeration
 */
typedef enum AVPStatus: NSUInteger {
    /** @brief 空转，闲时，静态 */
    /**** @brief Idle */
    AVPStatusIdle = 0,
    /** @brief 初始化完成 */
    /**** @brief Initialized */
    AVPStatusInitialzed,
    /** @brief 准备完成 */
    /**** @brief Prepared */
    AVPStatusPrepared,
    /** @brief 正在播放 */
    /**** @brief Playing */
    AVPStatusStarted,
    /** @brief 播放暂停 */
    /**** @brief Paused */
    AVPStatusPaused,
    /** @brief 播放停止 */
    /**** @brief Stopped */
    AVPStatusStopped,
    /** @brief 播放完成 */
    /**** @brief Completed */
    AVPStatusCompletion,
    /** @brief 播放错误 */
    /**** @brief Error */
    AVPStatusError,
    /** @brief 播放器正在释放/销毁中 */
    /**** @brief Player is releasing/destroying. */
    AVPStatusReleasing
} AVPStatus;

/**
 * @brief 跳转模式枚举。控制seek操作时是否精确定位。
 *
 * 精准seek会准确地跳转到指定的时间位置，但速度相对较慢。
 * 不精准seek会跳转到指定时间位置之前的最近一个关键帧开始播放，速度较快，
 * 但可能与指定位置存在偏差。
 *
 * @see AliPlayer::seekToTime
 */
/****
 * @brief Seek mode enumeration. Controls whether to seek to the exact specified position.
 *
 * Accurate seeking will seek to the exact specified time position but is relatively slower.
 * Inaccurate seeking will seek to the nearest keyframe before the specified position and start playback,
 * which is faster but may have a deviation from the specified position.
 *
 * @see AliPlayer::seekToTime
 */
typedef enum AVPSeekMode: NSUInteger {
    /**
     * @brief 精确跳转模式。准确定位到指定的时间点。
     */
    /****
     * @brief Accurate seeking mode. Seeks to the exact specified time position.
     */
    AVP_SEEKMODE_ACCURATE = 0x01,
    
    /**
     * @brief 非精确跳转模式。快速跳转到指定时间之前的关键帧。
     */
    /****
     * @brief Inaccurate seeking mode. Quickly seeks to a keyframe before the specified time.
     */
    AVP_SEEKMODE_INACCURATE = 0x10,
} AVPSeekMode;

/**
 * @brief 自适应降级切换URL的应用场景枚举。用于标识URL切换发生在播放器还是预加载器中。
 *
 * 当播放器或预加载器因编码格式不支持（如H.265不支持）需要切换到备用URL时，
 * 此枚举用于区分切换发生的具体场景。
 *
 * @see AliPlayerGlobalSettings::AdaptiveDecoderGetBackupURLCallback
 */
/****
 * @brief Scenario enumeration for adaptive downgrade URL switching.
 * Identifies whether URL switching occurs in the player or preloader.
 *
 * When the player or preloader needs to switch to a backup URL due to unsupported codec format
 * (e.g., H.265 not supported), this enumeration distinguishes the specific scenario.
 *
 * @see AliPlayerGlobalSettings::AdaptiveDecoderGetBackupURLCallback
 */
typedef enum BizScene : NSUInteger {
    /**
     * @brief 播放器场景。URL切换发生在播放器中。
     */
    /****
     * @brief Player scenario. URL switching occurs in the player.
     */
    AVP_Player = 0,
    
    /**
     * @brief 预加载器场景。URL切换发生在预加载器中。
     */
    /****
     * @brief Preloader scenario. URL switching occurs in the preloader.
     */
    AVP_Loader = 1
} AVPBizScene;

/**
 * @brief 自适应降级时的原始URL编码格式枚举。
 *
 * 用于表示在自适应降级场景下，原始URL所对应的编码格式。
 * 当编码格式不被支持时，播放器可基于此信息切换到备用URL。
 *
 * @see AliPlayerGlobalSettings::AdaptiveDecoderGetBackupURLCallback
 */
/****
 * @brief Enumeration of the original URL codec format during adaptive degradation.
 *
 * Used to represent the codec format of the original URL in adaptive degradation scenarios.
 * When the codec format is not supported, the player can switch to a backup URL based on this information.
 *
 * @see AliPlayerGlobalSettings::AdaptiveDecoderGetBackupURLCallback
 */
typedef enum CodecType : NSUInteger {
    /**
     * @brief H.265编码格式（HEVC）。
     */
    /****
     * @brief H.265 codec format (HEVC).
     */
    AVP_H265 = 0
} AVPCodecType;

/**
 * @brief 缩放模式枚举。用于控制视频画面的缩放和填充方式。
 *
 * 定义了视频在显示区域内如何进行缩放、裁剪或拉伸的几种模式。
 */
/****
 * @brief Scaling mode enumeration.
 * Used to control video frame scaling and filling mode.
 */
typedef enum AVPScalingMode: NSUInteger {
    /**
     * @brief 不保持纵横比平铺（拉伸填充）。视频画面被拉伸以填满整个显示区域，可能导致画面变形。
     */
    /****
     * @brief Auto stretch to fit. The video is stretched to fill the entire display area without preserving aspect ratio, which may cause distortion.
     */
    AVP_SCALINGMODE_SCALETOFILL,
    
    /**
     * @brief 保持纵横比，显示黑边（适应填充）。视频保持原始纵横比显示，空余区域用黑色填充。
     */
    /****
     * @brief Keep aspect ratio and add black borders. The video maintains its original aspect ratio;
     *        empty areas are filled with black.
     */
    AVP_SCALINGMODE_SCALEASPECTFIT,
    
    /**
     * @brief 保持纵横比填充，可能需要裁剪（裁剪填充）。视频保持纵横比，填满显示区域，超出部分被裁剪。
     */
    /****
     * @brief Keep aspect ratio and crop. The video maintains its aspect ratio and fills the display area;
     *        any parts exceeding the display area are cropped.
     */
    AVP_SCALINGMODE_SCALEASPECTFILL,
} AVPScalingMode;

/**
 * @brief 旋转模式枚举。用于控制视频画面的旋转角度。
 *
 * 所有旋转均为顺时针旋转。
 */
/****
 * @brief Rotate mode enumeration.
 * Used to control video frame rotation angle (clockwise).
 */
typedef enum AVPRotateMode: NSUInteger {
    /**
     * @brief 不旋转，0度。
     */
    /****
     * @brief No rotation, 0 degrees.
     */
    AVP_ROTATE_0 = 0,
    
    /**
     * @brief 顺时针旋转90度。
     */
    /****
     * @brief Rotate 90 degrees clockwise.
     */
    AVP_ROTATE_90 = 90,
    
    /**
     * @brief 顺时针旋转180度。
     */
    /****
     * @brief Rotate 180 degrees clockwise.
     */
    AVP_ROTATE_180 = 180,
    
    /**
     * @brief 顺时针旋转270度。
     */
    /****
     * @brief Rotate 270 degrees clockwise.
     */
    AVP_ROTATE_270 = 270
} AVPRotateMode;

/**
 * @brief 镜像模式枚举。用于控制视频画面的镜像翻转效果。
 *
 * 支持水平镜像（左右翻转）和垂直镜像（上下翻转）两种效果。
 */
/****
 * @brief Mirroring mode enumeration.
 * Used to control video frame mirroring (flip) effect.
 */
typedef enum AVPMirrorMode: NSUInteger {
    /**
     * @brief 无镜像。画面保持原始方向，不进行任何翻转。
     */
    /****
     * @brief No mirroring. The video is displayed in its original orientation.
     */
    AVP_MIRRORMODE_NONE,
    
    /**
     * @brief 水平镜像（左右翻转）。画面沿垂直轴翻转，左右互换。
     */
    /****
     * @brief Horizontal mirroring (left-right flip). The video is flipped along the vertical axis.
     */
    AVP_MIRRORMODE_HORIZONTAL,
    
    /**
     * @brief 垂直镜像（上下翻转）。画面沿水平轴翻转，上下颠倒。
     */
    /****
     * @brief Vertical mirroring (top-bottom flip). The video is flipped along the horizontal axis.
     */
    AVP_MIRRORMODE_VERTICAL,
} AVPMirrorMode;
/**
 * @brief Alpha渲染模式
 * 用于处理包含Alpha通道（透明度）的视频帧。视频帧被划分为图像区域和Alpha通道区域，
 * 播放器将根据指定的布局方式，从帧中分离出RGB图像和Alpha数据，并进行透明合成渲染。
 * 常用于直播礼物、动态贴纸等需要透明叠加的场景。
 * 可以参考 <a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features-1#0f5bcbe637non">视频帧处理</a>
 * 
 */
/****
 * @brief Alpha rendering mode
 * Used for rendering video frames that contain an alpha channel (transparency).
 * The video frame is split into an RGB image region and an alpha channel region.
 * The player extracts both parts based on the specified layout and performs alpha blending.
 * Commonly used for live-stream gifts, animated overlays, and other transparent effects.
 * Please refer to <a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features-1#0f5bcbe637non">Video frame processing</a>
 */
typedef enum AVPAlphaRenderMode: NSUInteger {
    /**
     * @brief 无Alpha渲染。视频帧为普通RGB图像，不包含透明通道。
     */
    /****
     * @brief No alpha rendering. The video frame is a standard RGB image without transparency.
     */
    AVP_RENDERMODE_ALPHA_NONE = 0,
    
    /**
     * @brief Alpha通道位于帧的右侧。视频帧的左半部分为RGB图像，右半部分为Alpha通道（灰度图）。
     * 渲染时根据右侧Alpha值对左侧图像进行透明合成。
     */
    /****
     * @brief Alpha channel is on the right side of the frame.
     * The left half contains the RGB image, and the right half contains the alpha channel (grayscale).
     * The player uses the right-side alpha values to blend the left-side image with transparency.
     */
    AVP_RENDERMODE_ALPHA_AT_RIGHT = 1,
    
    /**
     * @brief Alpha通道位于帧的左侧。视频帧的右半部分为RGB图像，左半部分为Alpha通道（灰度图）。
     * 渲染时根据左侧Alpha值对右侧图像进行透明合成。
     */
    /****
     * @brief Alpha channel is on the left side of the frame.
     * The right half contains the RGB image, and the left half contains the alpha channel (grayscale).
     * The player uses the left-side alpha values to blend the right-side image with transparency.
     */
    AVP_RENDERMODE_ALPHA_AT_LEFT = 2,
    
    /**
     * @brief Alpha通道位于帧的上侧。视频帧的下半部分为RGB图像，上半部分为Alpha通道（灰度图）。
     * 渲染时根据上侧Alpha值对下侧图像进行透明合成。
     */
    /****
     * @brief Alpha channel is on the top of the frame.
     * The bottom half contains the RGB image, and the top half contains the alpha channel (grayscale).
     * The player uses the top-side alpha values to blend the bottom-side image with transparency.
     */
    AVP_RENDERMODE_ALPHA_AT_TOP = 3,
    
    /**
     * @brief Alpha通道位于帧的下侧。视频帧的上半部分为RGB图像，下半部分为Alpha通道（灰度图）。
     * 渲染时根据下侧Alpha值对上侧图像进行透明合成。
     */
    /****
     * @brief Alpha channel is on the bottom of the frame.
     * The top half contains the RGB image, and the bottom half contains the alpha channel (grayscale).
     * The player uses the bottom-side alpha values to blend the top-side image with transparency.
     */
    AVP_RENDERMODE_ALPHA_AT_BOTTOM = 4,
} AVPAlphaRenderMode;

/**
 * @brief 音频输出声道枚举。用于指定音频输出时选择的声道。
 *
 * 当输入音源为双声道（立体声）时，可通过此枚举选择仅输出左声道或右声道；
 * 若输入为单声道，则此设置无效，音频将正常播放。
 */
/****
 * @brief Output audio channel enumeration.
 * Used to specify which audio channel to output.
 *
 * When the input audio source is stereo, you can select to output only the left or right channel.
 * If the input is mono, this setting has no effect and audio plays normally.
 */
typedef enum AVPOutputAudioChannel:NSUInteger {
    /**@brief 不指定声道，默认值*/
    /****@brief Not specified, default value*/
    AVP_AUDIO_CHANNEL_NONE = 0,
    /**@brief 左声道*/
    /****@brief Left audio channel*/
    AVP_AUDIO_CHANNEL_LEFT = 1,
    /**@brief 右声道*/
    /****@brief Right audio channel*/
    AVP_AUDIO_CHANNEL_RIGHT = 2
} AVPOutputAudioChannel;

/**@brief 播放器事件类型*/
/****@brief Player event type*/
typedef enum AVPEventType: NSUInteger {
    /**@brief 准备完成事件*/
    /****@brief Preparation completion event*/
    AVPEventPrepareDone,
    /**@brief 自动启播事件*/
    /****@brief Autoplay start event*/
    AVPEventAutoPlayStart,
    /**@brief 首帧显示事件*/
    /****@brief First frame display event*/
    AVPEventFirstRenderedStart,
    /**@brief 播放完成事件*/
    /****@brief Playback completion event*/
    AVPEventCompletion,
    /**@brief 缓冲开始事件*/
    /****@brief Buffer start event*/
    AVPEventLoadingStart,
    /**@brief 缓冲完成事件*/
    /****@brief Buffer completion event*/
    AVPEventLoadingEnd,
    /**@brief 跳转完成事件*/
    /****@brief Seeking completion event*/
    AVPEventSeekEnd,
    /**@brief 循环播放开始事件*/
    /****@brief Loop playback start event*/
    AVPEventLoopingStart,
    /**@brief 清屏完成事件*/
    /****@brief clear screen done event*/
    AVPEventClearScreenDone,
} AVPEventType;

/**
 * @brief 获取播放器信息的关键字枚举。用于查询播放器的特定属性或统计信息。
 *
 * 通过这些关键字可获取HTTP响应信息、连接信息等调试和性能相关的数据。
 * @see AliPlayer::getPropertyString
 */
/****
 * @brief Property key enumeration for querying player information.
 * Used to retrieve specific player properties or statistical information.
 *
 * These keys allow you to obtain HTTP response information, connection information,
 * and other debugging and performance-related data.
 * @see AliPlayer::getPropertyString
 */
typedef enum AVPPropertyKey: NSUInteger {
    /**@brief Http的response信息
     * 返回的字符串是JSON数组，每个对象带response和type字段。type字段可以是url/video/audio/subtitle，根据流是否有相应Track返回。
     * 例如：[{"response":"response string","type":"url"},{"response":"","type":"video"}]
     */
    /****@brief Http response info
     * Return with JSON array，each object item include 'response'/'type' filed。'type' could be  url/video/audio/subtitle, depend on the stream whether have the tracks。
     * For example: [{"response":"response string","type":"url"},{"response":"","type":"video"}]
     */
    AVP_KEY_RESPONSE_INFO = 0,

    /**@brief 主URL的连接信息
     * 返回的字符串是JSON对象，带url/ip/eagleID/cdnVia/cdncip/cdnsip等字段（如果解析不到则不添加）
     * 例如：{"url":"http://xxx","openCost":23,"ip":"11.111.111.11","cdnVia":"xxx","cdncip":"22.222.222.22","cdnsip":"xxx"}
     */
    /****@brief Major URL connect information
     * Return with JSON object，include sub fileds such as url/ip/eagleID/cdnVia/cdncip/cdnsip.
     * For example: {"url":"http://xxx","openCost":23,"ip":"11.111.111.11","cdnVia":"xxx","cdncip":"22.222.222.22","cdnsip":"xxx"}
     */
    AVP_KEY_CONNECT_INFO  = 1,
} AVPPropertyKey;

/**
 * @brief IP地址解析类型枚举。用于指定网络连接时使用的IP地址类型。
 *
 * 在DNS解析时，可指定优先使用IPv4或IPv6，或支持两者自动选择。
 * @see AliPlayer::setIPResolveType
 */
/****
 * @brief IP resolve type enumeration.
 * Used to specify the type of IP address to use during network connections.
 *
 * During DNS resolution, you can specify to prioritize IPv4 or IPv6, or allow automatic selection of both.
 * @see AliPlayer::setIPResolveType
 */
typedef enum AVPIpResolveType: NSUInteger {
    AVPIpResolveWhatEver,
    AVPIpResolveV4,
    AVPIpResolveV6,
} AVPIpResolveType;

/**
 * @brief 播放器可获取的选项枚举。用于实时查询播放器的性能指标。
 *
 * 通过这些选项可获取当前的渲染帧率、网络码率、视频码率等动态信息。
 * @see AliPlayer getOption
 */
/****
 * @brief Player option enumeration.
 * Used to query player performance metrics in real-time.
 * @see AliPlayer getOption
 *
 * These options allow you to retrieve current rendering frame rate, network bitrate, video bitrate, and other dynamic information.
 */
typedef enum AVPOption : NSUInteger {
    /**
     * @brief 渲染的帧率（FPS）。返回值类型为Float，单位：帧/秒。
     */
    /****
     * @brief Rendering frame rate (FPS). Return value type is Float, unit: frames per second.
     */
    AVP_OPTION_RENDER_FPS = 0,

    /**
     * @brief 当前的网络下行码率。返回值类型为Float，单位：bps（比特/秒）。
     */
    /****
     * @brief Current network download bitrate. Return value type is Float, unit: bps (bits per second).
     */
    AVP_OPTION_DOWNLOAD_BITRATE = 1,

    /**
     * @brief 当前播放的视频码率。返回值类型为Float，单位：bps（比特/秒）。
     */
    /****
     * @brief Current video playback bitrate. Return value type is Float, unit: bps (bits per second).
     */
    AVP_OPTION_VIDEO_BITRATE = 2,

    /**
     * @brief 当前播放的音频码率。返回值类型为Float，单位：bps（比特/秒）。
     */
    /****
     * @brief Current audio playback bitrate. Return value type is Float, unit: bps (bits per second).
     */
    AVP_OPTION_AUDIO_BITRATE = 3,

    /**
     * @brief 自适应比特率（ABR）切换状态指示。返回值类型为Int。
     *
     * 在多码率HLS流且启用自动码率切换模式下，此选项用于判断当前是否处于ABR切换的状态。
     * 返回"1"表示正在进行ABR切换，返回"0"表示未处于切换状态。
     */
    /****
     * @brief Adaptive Bitrate (ABR) switching state indicator. Return value type is Int.
     *
     * For multi-bitrate HLS streams with automatic bitrate switching enabled,
     * this option determines whether the player is currently undergoing ABR switching.
     * Returns "1" if ABR switching is in progress; returns "0" if not switching.
     */
    AVP_OPTION_IS_ABRSWITCHING = 4,
} AVPOption;

/**
 * 策略类型
 */
/****
 * strategy type
 */
typedef enum AVPStrategyType : NSUInteger {
    /**
     * 动态预加载时长策略
     */
    /****
     * dynamic preload duration strategy.
     */
    AVP_STRATEGY_DYNAMIC_PRELOAD = 1,
} AVPStrategyType;

/**
 * 多码率预加载类型，只对多码率HLS流生效
 * @see AliListPlayer SetMultiBitratesMode
 */
/****
 * multiBitrates preload mode, effect only on multiBitrates hls stream.
 * @see AliListPlayer SetMultiBitratesMode
 */
typedef enum AVPMultiBitratesMode : NSUInteger {
    /**
     * 默认配置，播放和预加载默认码率
     */
    /****
     * default mode, play and preload default bitrate of a stream
     */
    AVPMultiBitratesMode_Default = 0,
    /**
     * 首帧优先配置，起播视频默认播放已完成预加载的码率
     */
    /****
     * First frame cost (FC) priority, decrease first frame cost. only play bitrate of the hls stream which has been preloaded.
     */
    AVPMultiBitratesMode_FCPrio = 1,
    /**
     * 兼顾首帧和播放平滑，切换前后（moveToNext）的视频码率一致，且兼顾首帧性能
     */
    /****
     * First frame and play smooth, play the same bitrate before and after moveToNext
     */
    AVPMultiBitratesMode_FC_AND_SMOOTH = 2,
    /**
     * 播放平滑优先配置，起播视频默认播放前一个视频的码率
     */
    /****
     * Play Smooth priority, play the same bitrate before and after moveToNext.
     */
    AVPMultiBitratesMode_SmoothPrio = 3,
} AVPMultiBitratesMode;


/**
 * @brief 播放场景类型枚举。用于指定媒体的播放场景，以便播放器优化相关配置。
 *
 * 阿里云播放器为不同场景预设了最优配置，通过指定场景类型可自动应用相应的优化策略，
 * 无需手动调整各个配置参数。
 * @see AliListPlayer::setScene
 */
/****
 * @brief Scene type enumeration.
 * Used to specify the playback scenario, allowing the player to optimize relevant configurations.
 *
 * The Alibaba Cloud player has preset optimal configurations for different scenarios.
 * By specifying the scene type, corresponding optimization strategies are automatically applied
 * without manual adjustment of individual configuration parameters.
 * @see AliListPlayer::setScene
 */
typedef enum AVPSceneType : NSInteger {
    /**
     * 场景：无
     */
    /****
     * scene none
     */
    AVP_SCENE_NONE = -1,
    /**
     * 超短视频场景：适用于30s以下
     */
    /****
     * very short scene: apply to less 30s
     */
    AVP_VERY_SHOR_VIDEO = 0,
    /**
     * 短视频场景：适用于30s-5min
     */
    /****
     * short scene: apply to 30-5min
     */
    AVP_SHORT_VIDEO = 1,
    /**
     * 中视频场景：适用于5min-30min
     */
    /****
     * middle scene: apply to 5min-30min
     */
    AVP_MIDDLE_VIDEO = 2,
    /**
     * 长视频场景：适用于30min以上
     */
    /****
     * long scene: apply to more than 30min
     */
    AVP_LONG_VIDEO = 3,
} AVPSceneType;


/**
 * @brief 画中画（PIP）显示模式枚举。用于控制画中画功能的UI展示方式。
 *
 * 定义了在启用画中画模式时，控制按钮的显示或隐藏方式。
 * @see AliPlayer::setPictureinPictureShowMode
 */
/****
 * @brief Picture-in-Picture (PIP) show mode enumeration.
 * Used to control the UI display method of the picture-in-picture feature.
 *
 * Defines how control buttons are shown or hidden when picture-in-picture mode is enabled.
 * @see AliPlayer::setPictureinPictureShowMode
 */
typedef enum AVPPIPShowMode : NSUInteger {
    /**
     * @brief 默认模式。正常显示所有画中画相关按钮。
     */
    /****
     * @brief Default mode. All picture-in-picture related buttons are displayed normally.
     */
    AVP_SHOW_MODE_DEFAULT = 0,
    
    /**
     * @brief 隐藏快进快退模式。隐藏快进/快退按钮。
     */
    /****
     * @brief Hide fast forward and fast rewind mode. Hides fast forward/rewind buttons.
     */
    AVP_SHOW_MODE_HIDE_FAST_FORWARD_REWIND = 1,
} AVPPIPShowMode;

/**
 * @brief 播放错误信息模型类。用于描述和传递播放过程中发生的错误信息。
 *
 * 该类封装了错误码、错误描述、附加信息等多个字段，
 * 便于开发者诊断和处理播放错误。
 */
/****
 * @brief AVPErrorModel represents playback error descriptions.
 *
 * This class encapsulates error code, message, additional information, and other fields
 * to help developers diagnose and handle playback errors.
 */
OBJC_EXPORT
@interface AVPErrorModel : NSObject

/**
 * @brief 播放错误码。
 *
 * 表示错误的具体类型和原因。详见 @link AVPErrorCode @endlink。
 *
 * @see AVPErrorCode
 */
/****
 * @brief Playback error code.
 *
 * Represents the specific type and cause of the error. See @link AVPErrorCode @endlink.
 *
 * @see AVPErrorCode
 */
@property (nonatomic, assign) AVPErrorCode code;

/**
 * @brief 播放错误描述信息。
 *
 * 对错误的文字描述，通常为英文，便于理解错误原因。
 */
/****
 * @brief Playback error message.
 *
 * A textual description of the error, usually in English, to help understand the error cause.
 */
@property (nonatomic, copy) NSString *message;

/**
 @brief extra为播放错误信息描述的附加信息
 */
/****
 @brief extra represents an additional playback error message.
 */
@property (nonatomic, copy) NSString *extra;

/**
 @brief requestId为播放错误信息requestID
 */
/****
 @brief requestId represents the request ID of a playback error.
 */
@property (nonatomic, copy) NSString *requestId;

/**
 @brief videoId为播放错误发生的videoID
 */
/****
 @brief videoId represents the VID of the video that has a playback error.
 */
@property (nonatomic, copy) NSString *videoId;

/**
 @brief 错误描述，由播放器内置错误码知识库提供。
 */
/****
 @brief Error description provided by the player's built-in error knowledge base.
 */
@property (nonatomic, copy, readonly) NSString *errorMessage;

/**
 @brief 可能的原因列表，由播放器内置错误码知识库提供。
 */
/****
 @brief List of possible causes provided by the player's built-in error knowledge base.
 */
@property (nonatomic, copy, readonly) NSArray<NSString *> *possibleCauses;

/**
 @brief 建议的处理方式列表，由播放器内置错误码知识库提供。
 */
/****
 @brief List of suggested actions provided by the player's built-in error knowledge base.
 */
@property (nonatomic, copy, readonly) NSArray<NSString *> *suggestedActions;

/**
 @brief 相关文档链接，由播放器内置错误码知识库提供；无对应条目时为空字符串。
 */
/****
 @brief Documentation link provided by the player's built-in error knowledge base; empty string if no entry exists.
 */
@property (nonatomic, copy, readonly) NSString *docLink;

@end


/***
@brief AVPNetworkLevel 网络质量级别枚举
 */
/***
@brief AVPNetworkLevel represents network quality levels.
*/
typedef enum AVPNetworkLevel: NSInteger {
    /***
    @brief 网络状态未知。
     */
    /***
    @brief The network status is unknown.
    */
    AVPNetwork_UNKNOWN = -1,
    
    /**
     @brief 网络质量非常优秀。
     */
    /****
     @brief The network quality is excellent.
     */
    AVPNetwork_EXCELLENT = 0,
    
    /**
     @brief 网络质量良好。
     */
    /****
     @brief The network quality is good.
     */
    AVPNetwork_GOOD = 1,
    
    
    /**
     @brief 网络质量较差。
     */
    /****
     @brief The network quality is poor.
     */
    AVPNetwork_POOR = 2,
    
    /**
     @brief 网络质量很差。
     */
    /****
     @brief The network quality is bad.
     */
    AVPNetwork_BAD = 3,
    
    /**
     @brief 网络质量非常差。
     */
    /****
     @brief The network quality is very bad.
     */
    AVPNetwork_VERY_BAD = 4,
    
    /**
     @brief 网络已断开连接。
     */
    /****
     @brief The network is disconnected.
     */
    AVPNetwork_DISCONNECTED = 5,
} AVPNetworkLevel;

/**
@brief 网络统计信息类，用于收集和表示播放器应用的网络状况。
*/
/***
@brief AVPNetworkStat represents network statistics for the player.
It is used to collect and describe network-related metrics.
*/
OBJC_EXPORT
@interface AVPNetworkStat : NSObject

/**
@brief 视频下载速度，单位 Kbps。默认值为 0.0。
*/
/***
@brief Video download speed in kilobits per second (Kbps). Default is 0.0.
*/
@property (nonatomic, assign) double videoDownloadSpeedKbps;

/**
@brief 音频下载速度，单位 Kbps。默认值为 0.0。
*/
/***
@brief Audio download speed in kilobits per second (Kbps). Default is 0.0.
*/
@property (nonatomic, assign) double audioDownloadSpeedKbps;

/**
@brief 往返时延（RTT），单位毫秒（ms）。表示从客户端到服务器再返回所需的时间。默认值为 0。
*/
/***
@brief Round-trip time (RTT) in milliseconds (ms).
Indicates the time for a packet to travel from client to server and back.
Default is 0.
*/
@property (nonatomic, assign) int64_t rttMs;

/**
@brief 丢包率（百分比），范围 0 ~ 100%。较高的丢包率可能意味着网络质量差。默认值为 0。
*/
/***
@brief Packet loss rate as a percentage, ranging from 0 to 100%.
A higher packet loss rate may indicate poor network quality. Default is 0.
*/
@property (nonatomic, assign) int64_t packetLossRatePercentage;

/**
@brief 当前网络质量级别，使用 AVPNetworkLevel 表示。默认值为 AVPNetwork_UNKNOWN。
*/
/***
@brief The current network quality level, represented by AVPNetworkLevel.
Default is AVPNetwork_UNKNOWN.
*/
@property (nonatomic, assign) AVPNetworkLevel level;

@end


/**
 @brief AVPTimeShiftModel直播时移描述
 */
/****
 @brief AVPTimeShiftModel represents broadcasting timeshift descriptions.
 */
OBJC_EXPORT
@interface AVPTimeShiftModel : NSObject

/**
 @brief startTime直播时移开始时间
 */
/****
 @brief startTime represents the start of the time range for broadcasting timeshift.
 */
@property (nonatomic, assign) NSTimeInterval startTime;

/**
 @brief endTime直播时移结束时间
 */
/****
 @brief endTime represents the end of the time range for broadcasting timeshift.
 */
@property (nonatomic, assign) NSTimeInterval endTime;

/**
 @brief currentTime直播时移当前时间
 */
/****
 @brief currentTime represents the time that broadcasting timeshift seeks to.
 */
@property (nonatomic, assign) NSTimeInterval currentTime;
@end

/**
 * @brief 日志级别枚举。用于控制播放器日志输出的详细程度。
 *
 * 日志级别从低到高分别为：NONE、FATAL、ERROR、WARNING、INFO、DEBUG、TRACE。
 * 数值越大，输出的日志信息越详细。
 */
/****
 * @brief Log level enumeration.
 * Used to control the verbosity of player log output.
 *
 * Log levels from lowest to highest are: NONE, FATAL, ERROR, WARNING, INFO, DEBUG, TRACE.
 * Higher values result in more detailed log output.
 */
typedef enum AVPLogLevel: NSUInteger {
    LOG_LEVEL_NONE    = 0,
    LOG_LEVEL_FATAL   = 8,
    LOG_LEVEL_ERROR   = 16,
    LOG_LEVEL_WARNING = 24,
    LOG_LEVEL_INFO    = 32,
    LOG_LEVEL_DEBUG   = 48,
    LOG_LEVEL_TRACE   = 56,
} AVPLogLevel;

/**
 * @brief 特定分辨率的像素数量参考值枚举。
 *
 * 该枚举列举了常见视频分辨率对应的像素总数（宽×高）。
 * 这些值可用于 @link AVPConfig::maxAllowedAbrVideoPixelNumber @endlink 的参考
 *
 * @note 像素数量为参考值，仅供参考，实际分辨率可能略有差异。
 */
/****
 * @brief Pixel number of specific resolution enumeration.
 *
 * This enumeration lists the number of pixels for common video resolutions.
 * These values can be used as reference values for @link AVPConfig::maxAllowedAbrVideoPixelNumber @endlink.
 *
 * @note Pixel numbers are reference values for informational purposes only.
 *       Actual resolutions may vary slightly.
 */
typedef enum AVPPixelNumber: NSUInteger {
    Resolution_360P = 172800, //480 * 360
    Resolution_480P = 345600, //720 * 480
    Resolution_540P = 518400, //960 * 540
    Resolution_720P = 921600, //1280 * 720
    Resolution_1080P = 2073600,//1920 * 1080
    Resolution_2K = 3686400, //2560 * 1440
    Resolution_4K = 8847360, //4096 * 2160
    Resolution_NoLimit = INT_MAX,
} AVPPixelNumber;

/**
 * @brief 日志选项枚举。用于控制日志输出的特定功能。
 *
 * 通过这些选项可启用或禁用日志系统的特定功能。
 */
/****
 * @brief Log option enumeration.
 * Used to control specific features of log output.
 *
 * These options enable or disable specific features of the logging system.
 */
typedef enum AVPLogOption: NSUInteger {
    /**
     * @brief 启用帧级日志记录。当启用时，播放器将输出每一帧的详细日志信息。
     */
    /****
     * @brief Frame-level logging enabled. When enabled, the player outputs detailed log information for each frame.
     */
    FRAME_LEVEL_LOGGING_ENABLED = 1,
} AVPLogOption;

/**
 * @brief STS（临时安全令牌）状态枚举。用于表示STS令牌的有效状态。
 */
/****
 * @brief STS (Security Token Service) status enumeration.
 * Used to represent the validity status of STS tokens.
 */
typedef enum _AVPStsStatus {
    /**
     * @brief 有效。STS令牌已获取且仍在有效期内。
     */
    /****
     * @brief Valid. The STS token has been obtained and is still within its validity period.
     */
    Valid,
    
    /**
     * @brief 无效。STS令牌已过期或无法使用。
     */
    /****
     * @brief Invalid. The STS token has expired or cannot be used.
     */
    Invalid,
    
    /**
     * @brief 待定。STS令牌正在获取中，暂时不可用。
     */
    /****
     * @brief Pending. The STS token is being obtained and is temporarily unavailable.
     */
    Pending
} AVPStsStatus;

/**
 * @brief STS信息结构体。用于存储临时安全令牌相关的凭证信息。
 *
 * 包含访问ID、访问密钥、安全令牌、地域和格式等信息，
 * 用于身份验证和授权访问阿里云资源。
 */
/****
 * @brief STS information structure.
 * Used to store credentials related to temporary security tokens.
 *
 * Contains information such as access ID, access key, security token, region, and format,
 * used for authentication and authorization to access Alibaba Cloud resources.
 */
typedef struct _AVPStsInfo {
    /**
     * @brief 访问ID。用于身份认证的访问密钥ID。
     */
    /****
     * @brief Access ID. The access key ID for authentication.
     */
    NSString *accId;
    
    /**
     * @brief 访问密钥。用于签名请求的密钥。
     */
    /****
     * @brief Access secret. The secret key for signing requests.
     */
    NSString *accSecret;
    
    /**
     * @brief 安全令牌。临时安全令牌，有有效期限制。
     */
    /****
     * @brief Security token. Temporary security token with validity period restrictions.
     */
    NSString *token;
    
    /**
     * @brief 地域。指定资源所在的地域。
     */
    /****
     * @brief Region. Specifies the region where the resource is located.
     */
    NSString *region;
    
    /**
     * @brief 格式。指定媒体格式，如"mp4"、"m3u8"等。
     */
    /****
     * @brief Formats. Specifies the media format, such as "mp4", "m3u8", etc.
     */
    NSString *formats;
} AVPStsInfo;

/**
 * @brief 功能支持类型枚举。用于查询播放器是否支持特定的硬件或软件功能。
 *
 * 通过这些类型可检查设备是否支持特定的高级音视频功能。
 */
/****
 * @brief Feature type enumeration.
 * Used to query whether the player supports specific hardware or software features.
 *
 * These types allow you to check if the device supports specific advanced audio and video features.
 */
typedef enum _SupportFeatureType : NSUInteger {
    /**
     * @brief 杜比音频（Dolby Audio）支持。检查硬件是否支持杜比音频解码和输出。
     */
    /****
     * @brief Dolby Audio support. Checks whether the hardware supports Dolby Audio decoding and output.
     */
    FeatureDolbyAudio
} SupportFeatureType;

/**
<<<<<<< Updated upstream
 * @brief GlobalSettings的特定功能选项。全局设置选项枚举。用于配置播放器全局行为的选项。
 * @link +setOption:value:@endlink
 * @link +setOption:valueInt:@endlink
 */
/****
 * @brief specified option on GlobalSettings. Used to configure options for player global behavior.
 * @link +setOption:value:@endlink
 * @link +setOption:valueInt:@endlink
*/
typedef enum _GlobalOption: NSUInteger {
    /**
     * @brief 预连接域名选项
     * @link +setOption:value:@endlink
     *
     * <p>设置预连接的域名，用于优化首次连接速度。
     */
    /****
     * @brief Pre-connect domain option
     * @link +setOption:value:@endlink
     *
     * <p>Sets the domain for pre-connection to optimize initial connection speed.
     */
    SET_PRE_CONNECT_DOMAIN = 0,
    
    /**
     * @brief DNS 本地优先解析选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>启用后，DNS 解析将优先使用本地 DNS 而非远程 DNS。
     */
    /****
     * @brief DNS local-first resolution option
     * @link +setOption:valueInt:@endlink
     *
     * <p>When enabled, DNS resolution prioritizes local DNS over remote DNS.
     */
    SET_DNS_PRIORITY_LOCAL_FIRST = 1,
    
    /**
     * @brief 启用 HTTP/2 多路复用选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>启用 HTTP/2 协议的多路复用功能，提高网络传输效率。
     */
    /****
     * @brief Enable HTTP/2 multiplexing option
     *
     * <p>Enables HTTP/2 protocol multiplexing to improve network transmission efficiency.
     * @link +setOption:valueInt:@endlink
     */
    ENABLE_H2_MULTIPLEX = 2,
    
    /**
     * @brief 设置额外数据选项
     * @link +setOption:value:@endlink
     *
     * <p>用于传递自定义的额外数据到播放器内部。
     */
    /****
     * @brief Set extra data option
     * @link +setOption:value:@endlink
     *
     * <p>Used to pass custom extra data to the player internals.
     */
    SET_EXTRA_DATA = 3,
    
    /**
     * @brief 启用 Android 解码器复用选项（仅 Android 平台）
     * @link +setOption:valueInt:@endlink
     *
     * <p>Android 平台专用占位符选项，用于启用解码器复用功能。
     */
    /****
     * @brief Enable Android decoder reuse option (Android only)
     * @link +setOption:valueInt:@endlink
     *
     * <p>Android-specific placeholder option for enabling decoder reuse functionality.
     */
    ENABLE_ANDROID_DECODE_REUSE = 4, //android only, placeholder
    
    /**
     * @brief 准备时不暂停选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>启用后，在准备过程中不会暂停播放。
     */
    /****
     * @brief Do not pause when preparing option
     * @link +setOption:valueInt:@endlink
     *
     * <p>When enabled, playback will not pause during preparation.
     */
    NOT_PAUSE_WHEN_PREPARING = 5, // do not pause when preparing
    
    /**
     * @brief 允许 RTS 降级选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>允许超低延迟直播(RTS)在必要时降级到普通直播模式。
     */
    /****
     * @brief Allow RTS degradation option
     * @link +setOption:valueInt:@endlink
     *
     * <p>Allows Real-time Streaming (RTS) to degrade to normal live streaming mode when necessary.
     */
    ALLOW_RTS_DEGRADE = 6,
    
    /**
     * @brief 启用解码器快速首帧选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>优化解码器初始化流程，加快首帧显示速度。
     */
    /****
     * @brief Enable decoder fast first frame option
     * @link +setOption:valueInt:@endlink
     *
     * <p>Optimizes decoder initialization to accelerate first frame display.
     */
    ENABLE_DECODER_FAST_FIRST_FRAME = 7,
    
    /**
     * @brief 禁用截图缩放选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>禁用截图时的自动缩放功能。
     */
    /****
     * @brief Disable capture scaling option
     * @link +setOption:valueInt:@endlink
     *
     * <p>Disables automatic scaling during screenshot capture.
     */
    DISABLE_CAPTURE_SCALE = 8,
    
    /**
     * @brief 允许边界变化动画选项（仅 iOS 平台）
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS 平台专用选项，允许视图边界变化时显示动画效果。
     */
    /****
     * @brief Allow bounds change animation option (iOS only)
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS-specific option that allows animation effects when view bounds change.
     */
    ALLOW_BOUNDS_CHANGE_ANIMATION = 10, // iOS only
    
    /**
     * @brief AV3A 解码模型路径选项
     * @link +setOption:value:@endlink
     *
     * <p>指定 AV3A 解码模型的文件路径。
     */
    /****
     * @brief AV3A decode model path option
     * @link +setOption:value:@endlink
     *
     * <p>Specifies the file path for the AV3A decoding model.
     */
    AV3A_DECODE_MODEL_PATH = 11,
    
    /**
     * @brief 忽略 DAR 缩放选项（仅 iOS 平台）
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS 平台专用选项，忽略显示宽高比(DAR)的缩放处理。
     */
    /****
     * @brief Ignore DAR scaling option (iOS only)
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS-specific option that ignores Display Aspect Ratio (DAR) scaling processing.
     */
    RENDER_IGNORE_DAR_SCALE = 14, //iOS only
    
    /**
     * @brief 硬件解码最大错误帧数选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>设置硬件解码器允许的最大连续错误帧数，超过此值将触发降级。
     */
    /****
     * @brief Maximum error frames for hardware decoding option
     * @link +setOption:valueInt:@endlink
     *
     * <p>Sets the maximum number of consecutive error frames allowed for hardware decoder before triggering fallback.
     */
    MAX_ERROR_FRAMES_HARDWARE_DECODE = 15,
    
    /**
     * @brief 允许 AudioUnit 选项（仅 iOS 平台）
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS 平台专用选项，允许使用 AudioUnit 进行音频处理。
     */
    /****
     * @brief Allow AudioUnit option (iOS only)
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS-specific option that allows using AudioUnit for audio processing.
     */
    ALLOW_AUDIOUNIT = 16, //iOS only
    
    /**
     * @brief 禁用低延迟音频队列追赶选项（仅 iOS 平台）
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS 平台专用选项，禁用低延迟音频队列中的追赶机制。
     */
    /****
     * @brief Disable catch-up in low-latency audio queue option (iOS only)
     * @link +setOption:valueInt:@endlink
     *
     * <p>iOS-specific option that disables catch-up mechanism in low-latency audio queue.
     */
    DISABLE_CATCHUP_IN_LOWLATENCY_AUDIOQUEUE = 17, //iOS only
    
    /**
     * @brief 启用 403 禁止错误时的 URL 刷新选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>当收到 HTTP 403 Forbidden 错误时，自动触发 URL 刷新机制。
     */
    /****
     * @brief Enable URL refresh on Forbidden error option
     * @link +setOption:valueInt:@endlink
     *
     * <p>Automatically triggers URL refresh mechanism when receiving HTTP 403 Forbidden error.
     */
    ENABLE_URL_REFRESH_ON_FORBIDDEN = 18,

    /**
     * @brief 预连接开关选项
     * @link +setOption:value:@endlink
     *
     * <p>控制 vid 播放的预建联功能，传 "true" 开启，"false" 关闭（默认关闭）。
     */
    /****
     * @brief Pre-connect enable option
     * @link +setOption:value:@endlink
     *
     * <p>Controls the pre-connect feature for vid playback. Pass "true" to enable, "false" to disable (disabled by default).
     */
    SET_PRE_CONNECT_ENABLE = 19,

    /**
     * @brief 启用 VTT 对话提示的 JSON 解析选项
     * @link +setOption:valueInt:@endlink
     *
     * <p>启用后，VTT 字幕中的对话提示将通过 JSON 格式进行解析。
     */
    /****
     * @brief Enable VTT dialogue cue parsing by JSON option
     * @link +setOption:valueInt:@endlink
     *
     * <p>When enabled, dialogue cues in VTT subtitles will be parsed in JSON format.
     */
    ENABLE_PARSE_VTT_DIALOGUE_CUE_BY_JSON =  100,
} GlobalOption;

/**
 * @brief 播放器特定功能选项枚举。用于配置单个播放器实例的行为选项。
 *
 * 这些选项可在创建播放器后进行设置，每个播放器实例可单独配置。
 * @see AliPlayer::setOption
 */
/****
 * @brief Player-specific option enumeration.
 * Used to configure behavior options for individual player instances.
 *
 * These options can be set after creating the player, and each player instance can be configured independently.
 * @see AliPlayer::setOption
 */
typedef enum _PlayerOption: NSUInteger {
    SET_MEDIA_TYPE = 0,
    
    /**
     * @brief 允许后台解码。在应用进入后台时继续进行视频解码，保持播放状态。
     */
    /****
     * @brief Allow decode in background. Continue video decoding when the app enters the background, maintaining playback state.
     */
    ALLOW_DECODE_BACKGROUND = 1,
    
    /**
     * @brief 允许预渲染。启用视频帧的预先渲染，加速首帧显示。
     */
    /****
     * @brief Allow pre-render. Enables pre-rendering of video frames to accelerate first frame display.
     */
    ALLOW_PRE_RENDER = 2,
    
    /**
     * @brief 播放时长包含播放速度。计算播放时长时考虑播放倍速的影响。
     * @see AliPlayer::getPlayedDuration
     */
    /****
     * @brief Played duration includes playback speed. Playback duration calculation takes playback speed into account.
     * @see AliPlayer::getPlayedDuration
     */
    PLAYED_DURATION_INCLUDE_SPEED = 3,
    
    /**
     * @brief 预渲染最大缓冲时长。指定预渲染功能的最大缓冲时长，单位毫秒。
     * 仅在ALLOW_PRE_RENDER启用时生效。
     */
    /****
     * @brief Pre-render maximum buffer duration in milliseconds.
     * Specifies the maximum buffer duration for the pre-rendering feature.
     * Only effective when ALLOW_PRE_RENDER is enabled.
     */
    PRE_RENDER_MAX_BUFFER_MS = 5,
    
    /**
     * @brief 线路优先设置备流。为多线路场景设置备用流URL，提高播放质量和可用性。
     */
    /****
     * @brief Line fallback URL. Sets backup stream URL for multi-line scenarios to improve playback quality and availability.
     */
    LINE_FALLBACK_URL = 6,

    /**
     * @brief 场景标识。
     */
    /****
     * @brief Scenario flag.
     */
    SCENARIO_FLAG = 7,
    
    /**
     * @brief 开启针对高级Codec的优化。
     * 在高倍速或 Seek 密集场景下降低解码性能压力。
     * 值：AVPAdvancedCodecOptVVC = 开启，AVPAdvancedCodecOptNone = 关闭。
     * 默认开启。目前仅对阿里云转码的 VVC 流生效。
     */
    /****
     * @brief Enable optimizations for advanced codecs.
     * Reduces decoding pressure and stuttering under high playback speed or seek-intensive scenarios.
     * Values: AVPAdvancedCodecOptVVC = enable, AVPAdvancedCodecOptNone = disable.
     * Enabled by default. Currently only effective for Alibaba Cloud transcoded VVC streams.
     */
    ENABLE_ADVANCED_CODEC_OPT = 8,
} PlayerOption;

typedef NS_OPTIONS(NSUInteger, AVPAdvancedCodecOpt) {
    AVPAdvancedCodecOptNone = 0,
    AVPAdvancedCodecOptVVC  = 1 << 0,
};

/**
 * @brief 播放场景枚举。用于为播放器指定最适合的播放场景配置。
 *
 * 播放器会根据指定的场景自动应用优化的配置策略，
 * 无需开发者手动调整各个参数。
 * @see AliPlayer::setPlayerScene
 */
/****
 * @brief Scene enumeration.
 * Used to specify the most suitable scene configuration for the player.
 *
 * The player automatically applies optimized configuration strategies based on the specified scene,
 * without requiring manual parameter adjustment by developers.
 * @see AliPlayer::setPlayerScene
 */
typedef enum _AVPScene {
    /**
     * 场景：无
     */
    /****
     * scene none
     */
    SceneNone,
    /**
     * 长视频场景：适用于30min以上
     */
    /****
     * long scene: apply to more than 30min
     */
    SceneLong,
    /**
     * 中视频场景：适用于5min-30min
     */
    /****
     * middle scene: apply to 5min-30min
     */
    SceneMedium,
    /**
     * 短视频场景：适用于0s-5min
     */
    /****
     * short scene: apply to 0s-5min
     */
    SceneShort,
    /**
     * 直播场景
     */
    /****
     * live scene
     */
    SceneLive,
    /**
    超低延迟直播场景
      */
    /****
     * RTS live scene
     */
    SceneRTSLive
} AVPScene;

/**
 @brief URL刷新结果
 */
/****
 @brief URL refresh result.
 */
OBJC_EXPORT
@interface AVPUrlResult : NSObject
@property (nonatomic, strong) NSString *url;

- (instancetype)initWithUrl:(NSString *)url;
@end

/**
 * 缓存查询类型枚举
 */
/****
* Cache query type enumeration
*/
typedef NS_ENUM(NSInteger, AVPCacheQueryType) {
    /**
     * 根据分辨率选择码流（仅适用于多码率m3u8）
     */
    /****
     * Select stream based on resolution (only for multi-bitrate m3u8)
     */
    AVPCacheQueryTypeResolution = 0,
    /**
     * 根据码率选择码流（仅适用于多码率m3u8）
     */
    /****
     * Select stream based on bandwidth (only for multi-bitrate m3u8)
     */
    AVPCacheQueryTypeBandwidth = 1,
    /**
     * 不指定特定码流（适用于mp4等格式）
     */
    /****
     * Do not specify specific stream (for mp4 and other common formats)
     */
    AVPCacheQueryTypeNone = 2
};

/**
 * 缓存查询参数
 */
/****
* Cache query parameters
*/
@interface AVPCacheQueryParams : NSObject

@property (nonatomic, assign) AVPCacheQueryType queryType;
@property (nonatomic, assign) int intValue;

/**
 * 设置分辨率参数
 * @param resolutionProduct 分辨率乘积 (width * height)
 */
/****
* Set resolution parameter
* @param resolutionProduct Resolution product (width * height)
*/
- (void)setResolution:(int)resolutionProduct;

/**
 * 设置码率参数
 * @param bandwidth 码率 (bps)
 */
/****
* Set bandwidth parameter
* @param bandwidth Bandwidth (bps)
*/
- (void)setBandwidth:(int)bandwidth;

@end


#endif /* AVPDef_h */
