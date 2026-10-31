//
//  AVPSource.h
//  AliPlayerSDK
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef AVPSource_h
#define AVPSource_h

#import <Foundation/Foundation.h>

typedef int (^BitStreamReadCallbackBlock)(uint8_t *buffer, int size);

typedef long (^BitStreamSeekCallbackBlock)(long offset, int whence);

static const int SEEK_SIZE = 0x10000;

/**
 @brief 媒体加密类型枚举
 
 定义支持的媒体加密方式。不同的加密类型对应不同的解密机制。
 */
/****
 @brief Media encryption type enumeration.
 
 Defines supported media encryption methods. Different encryption types correspond to different decryption mechanisms.
 */
typedef NS_ENUM(NSUInteger, ENCRYPTION_TYPE) { 
    /**
     @brief 无加密。媒体未被加密。
     */
    /****
     @brief No encryption. Media is not encrypted.
     */
    ENCRYPTION_TYPE_NONE = 0,
    /**
     @brief 阿里云点播加密。使用阿里云专有的加密方式。
     */
    /****
     @brief Alibaba Cloud VOD encryption. Uses proprietary Alibaba Cloud encryption.
     */
    ENCRYPTION_TYPE_ALIVODENCRYPTION,
    /**
     @brief Fairplay加密。使用Apple Fairplay DRM加密方式。
     */
    /****
     @brief Fairplay encryption. Uses Apple Fairplay DRM encryption.
     */
    ENCRYPTION_TYPE_FAIRPLAY };

/**
 @brief 播放源基类
 
 <p>所有播放源类的基类。定义了播放源的通用属性和配置项，包括封面、标题、清晰度等基础信息。
 具体的播放源实现（如URL、VID等）继承此类并扩展相应功能。
 
 <p><strong>通用属性说明：</strong>
 <ul>
 *   <li>{@link #coverURL}：媒体的封面或海报图片，用于UI展示</li>
 *   <li>{@link #title}：媒体的标题信息</li>
 *   <li>{@link #quality}：期望的播放清晰度，具体支持的清晰度取决于媒体本身</li>
 *   <li>{@link #forceQuality}：是否强制使用指定清晰度。若强制但不可用，则播放失败</li>
 *   <li>{@link #definitions}：可用清晰度列表，用于过滤服务器返回的流</li>
 * </ul>
 */
/****
 @brief Base class for playback sources.
 
 <p>Base class for all playback source classes. Defines common properties and configuration items for playback sources,
 including cover, title, definition, etc. Specific playback source implementations (such as URL, VID, etc.) inherit
 this class and extend corresponding functionality.
 
 <p><strong>Common property explanation:</strong>
 <ul>
 *   <li>{@link #coverURL}: Media cover or poster image for UI display</li>
 *   <li>{@link #title}: Media title information</li>
 *   <li>{@link #quality}: Expected playback definition; supported definitions depend on the media itself</li>
 *   <li>{@link #forceQuality}: Whether to force the specified definition. Playback fails if forced but unavailable</li>
 *   <li>{@link #definitions}: List of available definitions for filtering streams returned by server</li>
 * </ul>
 */
OBJC_EXPORT
@interface AVPSource : NSObject

/**
 @brief 媒体封面URL
 媒体的封面或海报图片的URL地址。
 */
/****
 @brief The URL of the album cover.
 URL address of the cover or poster image of the media.
 */
@property (nonatomic, copy) NSString* coverURL;

/**
 @brief 视频标题
 */
/****
 @brief The title of the video.
 */
@property (nonatomic, copy) NSString* title;

/**
 @brief 期望播放的清晰度
 
 指定期望播放的清晰度标识。播放器将尝试选择与此标识匹配的流进行播放。
 此属性仅对支持多清晰度的媒体源有效。
 */
/****
 @brief The preferred definition for playback.
 
 Specifies the preferred resolution identifier. The player will try to select
 the stream matching this identifier for playback. Valid only for multi-resolution sources.
 */
@property (nonatomic, copy) NSString* quality;

/**
 @brief 是否强制使用指定的清晰度
 
 当设置为YES时，如果媒体不支持指定的清晰度，播放将失败。
 当设置为NO时，播放器可能自动调整。
 */
/****
 @brief Whether to force the player to use the specified resolution.
 
 When set to YES, playback will fail if the media does not support the specified resolution.
 When set to NO, the player automatically selects the available resolution.
 */
@property (nonatomic, assign) BOOL forceQuality;

/**
 @brief 点播服务器支持的清晰度类型列表
 
 指定点播服务器可返回的清晰度类型。多个类型用逗号分隔，如"FD,LD,SD,HD,OD,2K,4K,SQ,HQ"。
 特殊值"AUTO"表示仅返回自适应码率流。此属性仅对阿里云点播源有效。
 */
/****
 @brief List of resolution types supported by VOD server.
 
 Specifies the resolution types that VOD server can return. Multiple types separated by commas,
 such as "FD,LD,SD,HD,OD,2K,4K,SQ,HQ". Special value "AUTO" means only return adaptive bitrate streams.
 Valid only for Alibaba Cloud VOD sources.
 */
@property (nonatomic, copy) NSString* definitions;

@end


/**
 @brief URL播放源类
 
 用于指定通过URL进行播放的媒体源。支持HTTP、HTTPS协议以及本地文件路径。
 */
/****
 @brief URL playback source class.
 
 Used to specify media source for URL-based playback. Supports HTTP, HTTPS protocols and local file paths.
 */
OBJC_EXPORT
@interface AVPUrlSource : AVPSource

/**
 @brief 使用URL字符串初始化播放源
 
 创建一个URL播放源实例，用于通过网络URL播放媒体。
 
 @param url 媒体的URL地址，支持HTTP、HTTPS等协议
 @return 初始化后的AVPUrlSource实例
 */
/****
 @brief Initialize playback source with URL string.
 
 Creates a URL playback source instance for playing media through network URL.
 
 @param url Media URL address supporting HTTP, HTTPS, etc.
 @return Initialized AVPUrlSource instance
 */
- (instancetype) urlWithString:(NSString*)url;

/**
 @brief 使用本地文件路径初始化播放源
 
 创建一个URL播放源实例，用于播放本地文件。
 
 @param url 本地媒体文件的完整路径
 @return 初始化后的AVPUrlSource实例
 */
/****
 @brief Initialize playback source with local file path.
 
 Creates a URL playback source instance for playing local files.
 
 @param url Full path of local media file
 @return Initialized AVPUrlSource instance
 */
- (instancetype) fileURLWithPath:(NSString*)url;

/**
 @brief 播放URL
 
 媒体的播放地址。可为网络URL或本地文件路径。
 */
/****
 @brief Play URL.
 
 The playback URL of the media. Can be network URL or local file path.
 */
@property (nonatomic, copy) NSURL* playerUrl;

/**
 @brief 本地缓存文件路径
 @deprecated 使用 AliPlayerGlobalSettings::enableLocalCache 代替
 */
/**
 @brief cache file path, app may cache the beginning of remote mp4 file to local path,
 * set it to player to improve loading speed.
 @deprecated use AliPlayerGlobalSettings::enableLocalCache instead
 */
@property (nonatomic, copy) NSString* cacheFile __deprecated;

/**
 @brief 原始文件大小
 
 媒体文件的原始大小，单位为字节。用于验证缓存的完整性。
 */
/****
 @brief Original file size.
 
 The original size of the media file in bytes. Used for verifying cache integrity.
 */
@property(nonatomic) uint64_t originSize;

@end


/**
 @brief 比特流播放源类
 
 用于从自定义数据源（如内存中的媒体数据）进行播放。通过提供读取和查询回调函数，
 使播放器能够从任意数据源读取媒体数据。
 */
/****
 @brief Bitstream playback source class.
 
 Used for playback from custom data sources (e.g., media data in memory).
 By providing read and seek callbacks, the player can read media data from any source.
 */
OBJC_EXPORT
@interface AVPBitStreamSource : AVPSource

/**
 @brief 比特流读取回调函数
 
 提供从自定义数据源读取媒体数据的回调。播放器在需要读取数据时调用此回调。
 
 @see BitStreamReadCallbackBlock
 */
/****
 @brief Bitstream read callback function.
 
 Provides callback for reading media data from custom data source.
 Player invokes this callback when data reading is needed.
 
 @see BitStreamReadCallbackBlock
 */
@property(nonatomic, copy) BitStreamReadCallbackBlock mBitStreamReadCallbackBlock;

/**
 @brief 比特流查询（Seek）回调函数
 
 提供在自定义数据源中定位到指定位置的回调。播放器在需要改变读取位置时调用此回调。
 
 @see BitStreamSeekCallbackBlock
 */
/****
 @brief Bitstream seek callback function.
 
 Provides callback for seeking to specified position in custom data source.
 Player invokes this callback when reading position needs to be changed.
 
 @see BitStreamSeekCallbackBlock
 */
@property(nonatomic, copy) BitStreamSeekCallbackBlock mBitStreamSeekCallbackBlock;

@end


/**
 @brief VID和STS播放源类
 
 使用阿里云视频ID和临时安全令牌进行身份验证和授权后播放媒体。
 适用于需要权限控制的视频播放场景。

 */
/****
 @brief VID and STS playback source class.
 
 Plays media after authentication and authorization through Alibaba Cloud Video ID
 and temporary security token. Suitable for scenarios requiring access control.
 
 */
OBJC_EXPORT
@interface AVPVidStsSource : AVPSource

/**
 @brief 使用VID和STS信息初始化播放源
 
 创建使用临时安全令牌进行身份验证的播放源。
 用vid和sts来播放视频，临时AccessKeyId、AccessKeySecret和SecurityToken：开启RAM授权，并通过STS授权系统提供的OpenAPI或SDK获取的AccessKeyId、AccessKeySecret和SecurityToken，用于播放和下载请求参数明细：https://help.aliyun.com/document_detail/28788.html?spm=5176.doc28787.6.706.2G5SLS
 
 @param vid 阿里云视频ID，唯一标识一个视频
 @param accessKeyId STS临时访问密钥ID
 @param accessKeySecret STS临时访问密钥
 @param securityToken STS安全令牌
 @param region 视频所在地域，如"cn-shanghai"等
 @return 初始化后的AVPVidStsSource实例
 */
/****
 @brief Initialize playback source with VID and STS information.
 
 Creates a playback source using temporary security token for authentication.
 @brief Play by VID and STS. Temporary AccessKey ID, AccessKey Secret, and token: Activate RAM, and use the API or SDK provided by STS to retrieve the AccessKey ID, AccessKey Secret, and token. Details about parameters in playback and download requests: https://help.aliyun.com/document_detail/28788.html?spm=5176.doc28787.6.706.2G5SLS
 
 @param vid Alibaba Cloud Video ID uniquely identifying a video
 @param accessKeyId STS temporary AccessKey ID
 @param accessKeySecret STS temporary AccessKey Secret
 @param securityToken STS security token
 @param region Region where video is located, such as "cn-shanghai"
 @return Initialized AVPVidStsSource instance
 */
- (instancetype)initWithVid:(NSString *)vid
                accessKeyId:(NSString *)accessKeyId
            accessKeySecret:(NSString *)accessKeySecret
              securityToken:(NSString *)securityToken
                     region:(NSString *)region;

/**
 @brief 使用VID、STS和播放配置初始化播放源
 
 创建使用临时安全令牌和自定义播放配置的播放源。
 
 @param vid 阿里云视频ID
 @param accessKeyId STS临时访问密钥ID
 @param accessKeySecret STS临时访问密钥
 @param securityToken STS安全令牌
 @param region 视频所在地域
 @param playConfig 自定义播放配置，JSON格式的配置字符串
 @return 初始化后的AVPVidStsSource实例
 */
/****
 @brief Initialize playback source with VID, STS and playback configuration.
 
 Creates a playback source using temporary security token and custom playback configuration.
 
 @param vid Alibaba Cloud Video ID
 @param accessKeyId STS temporary AccessKey ID
 @param accessKeySecret STS temporary AccessKey Secret
 @param securityToken STS security token
 @param region Region where video is located
 @param playConfig Custom playback configuration as JSON string
 @return Initialized AVPVidStsSource instance
 */
- (instancetype)initWithVid:(NSString *)vid
                accessKeyId:(NSString *)accessKeyId
            accessKeySecret:(NSString *)accessKeySecret
              securityToken:(NSString *)securityToken
                     region:(NSString *)region
                playConfig:(NSString *)playConfig;

/**
 @brief 使用VID、STS、格式和配置初始化播放源
 
 创建指定媒体格式和播放配置的播放源。
 
 @param vid 阿里云视频ID
 @param accessKeyId STS临时访问密钥ID
 @param accessKeySecret STS临时访问密钥
 @param securityToken STS安全令牌
 @param region 视频所在地域
 @param format 媒体格式，多个格式用逗号分隔，如"mp4,mp3,flv,m3u8"
 @param playConfig 自定义播放配置
 @return 初始化后的AVPVidStsSource实例
 */
/****
 @brief Initialize playback source with VID, STS, format and configuration.
 
 Creates a playback source specifying media format and playback configuration.
 
 @param vid Alibaba Cloud Video ID
 @param accessKeyId STS temporary AccessKey ID
 @param accessKeySecret STS temporary AccessKey Secret
 @param securityToken STS security token
 @param region Region where video is located
 @param format Media format with multiple formats separated by commas, e.g., "mp4,mp3,flv,m3u8"
 @param playConfig Custom playback configuration
 @return Initialized AVPVidStsSource instance
 */
- (instancetype)initWithVid:(NSString *)vid
                accessKeyId:(NSString *)accessKeyId
            accessKeySecret:(NSString *)accessKeySecret
              securityToken:(NSString *)securityToken
                     region:(NSString *)region
                     format:(NSString *)format
                 playConfig:(NSString *)playConfig;

/**
 @brief 视频ID
 
 阿里云视频ID，唯一标识一个视频资源。
 */
/****
 @brief Video ID.
 
 Alibaba Cloud Video ID uniquely identifying a video resource.
 */
@property (nonatomic, copy) NSString* vid;

/**
 @brief 访问密钥ID
 
 STS临时访问密钥的ID，用于身份验证。
 */
/****
 @brief AccessKey ID.
 
 ID of STS temporary AccessKey used for authentication.
 */
@property (nonatomic, copy) NSString* accessKeyId;

/**
 @brief 访问密钥
 
 STS临时访问密钥，用于签名验证。
 */
/****
 @brief AccessKey Secret.
 
 STS temporary AccessKey Secret used for signature verification.
 */
@property (nonatomic, copy) NSString* accessKeySecret;

/**
 @brief 安全令牌
 
 STS安全令牌，作为临时凭证的一部分。
 */
/****
 @brief Security Token.
 
 STS security token as part of temporary credentials.
 */
@property (nonatomic, copy) NSString* securityToken;

/**
 @brief 地域信息
 
 视频所在的阿里云地域标识，如"cn-shanghai"。
 */
/****
 @brief Region.
 
 Alibaba Cloud region identifier where video is located, such as "cn-shanghai".
 */
@property (nonatomic, copy) NSString* region;

/**
 @brief 播放配置
 
 自定义的播放配置，JSON格式。构造方式参考<a href="https://help.aliyun.com/zh/vod/developer-reference/request-parameters">
 */
/****
 @brief Play Configuration.
 
 Custom playback configuration in JSON format. Constructing reference: <a href="https://help.aliyun.com/zh/vod/developer-reference/request-parameters">
 */
@property (nonatomic, copy) NSString* playConfig;

/**
 @brief 媒体格式
 
 指定媒体的格式类型。多个格式用逗号分隔，如"mp4,mp3,flv,m3u8"。
 */
/****
 @brief Media Format.
 
 Specifies media format type. Multiple formats separated by commas, e.g., "mp4,mp3,flv,m3u8".
 */
@property (nonatomic, copy) NSString* format;

/**
 @brief 鉴权超时时间
 
 STS鉴权的超时时间，单位为毫秒。
 */
/****
 @brief Authentication Timeout.
 
 Timeout for STS authentication in milliseconds.
 */
@property (nonatomic, assign) long authTimeout;

/**
 @brief 结果类型
 Single（默认）：每种清晰度和格式只返回一路最新转码完成的流。
 Multiple：每种清晰度和格式返回所有转码完成的流。
 */
/****
 @brief Result Type.
 Single (default): Each clarity and format returns only one latest transcoded stream.
 Multiple: Each clarity and format returns all transcoded streams.
 
 Specifies the result type for retrieving media information.
 */
@property (nonatomic, copy) NSString* resultType;

/**
 @brief 二次鉴权信息
 
 CDN 二次鉴权参数，为 JSON 字符串。当开启了 URL 鉴权的 A 方式鉴权功能时，可通过该参数设置鉴权 URL 的uid和rand，请参见鉴权方式 A 说明  <a href="https://help.aliyun.com/zh/vod/user-guide/type-a-signing</a> 。
 */
/****
 @brief Re-auth Information.
 CDN re-auth parameter, in JSON string. When URL-based A-type authentication is enabled, you can set the uid and rand parameters for the re-auth URL, please refer to the A-type authentication method description <a href="https://help.aliyun.com/zh/vod/user-guide/type-a-signing">
 */
@property (nonatomic, copy) NSString* reAuthInfo;

/**
 @brief 流类型
 video/audio

 */
/****
 @brief Stream Type.
 video/audio
 
 */
@property (nonatomic, copy) NSString* streamType;

/**
 @brief 输出类型
 oss：回源地址。
 cdn（默认）：加速地址。
 */
/****
 @brief outputType
 oss: origin address.
 cdn (default): acceleration address.
 */
@property (nonatomic, copy) NSString* outputType;

/**
 @brief 用户自定义的数字水印信息
 */
/**
 @brief digitalWatermark info
 */
@property (nonatomic, copy) NSString* trace;

/**
 @brief 数字水印类型
 TraceMark：溯源水印。
 CopyrightMark：版权水印
 */
/****
 @brief Digital Watermark Type.
  TraceMark: Trace Watermark.
  CopyrightMark: Copyright Watermark
 */
@property (nonatomic, copy) NSString* digitalWatermarkType;


/**
 @brief 启用多编码格式自适应功能。
 根据设备对视频编码格式的支持能力，自动选择当前清晰度下最优的视频流。
 
 注意：
 - 需配合将 @c resultType 设为 @c Multiple 才能启用多编码流支持；
 - 仅在使用 @c VidAuth 或 @c VidSts 媒体源时生效，推荐优先使用 @c VidAuth。
 
 @see resultType
 */
/**
 @brief Enables adaptive multi-codec streaming.
 Automatically selects the optimal video stream for the current playback quality based on device codec support.
 
 Note:
 - Requires @c resultType to be set to @c Multiple to enable multi-codec stream availability;
 - Only effective when using @c VidAuth or @c VidSts media sources. @c VidAuth is recommended.
 
 @see resultType
 */
@property (nonatomic, assign) BOOL enableAdaptiveCodec;


@end

/**
 @brief VID和PlayAuth播放源类
 
 使用阿里云视频ID和播放鉴权令牌进行身份验证和授权后播放媒体。
 这是阿里云推荐的认证方式，可应用于大多数场景。
 */
/****
 @brief VID and PlayAuth playback source class.
 
 Plays media after authentication and authorization through Alibaba Cloud Video ID
 and playback authorization token. This is the recommended authentication method by Alibaba Cloud.
 */
OBJC_EXPORT
@interface AVPVidAuthSource : AVPSource

/**
 @brief 使用VID和PlayAuth初始化播放源
 
 创建使用播放鉴权令牌进行身份验证的播放源。
 
 @param vid 阿里云视频ID
 @param playAuth 播放鉴权令牌，由服务端生成
 @param region 视频所在地域
 @return 初始化后的AVPVidAuthSource实例
 */
/****
 @brief Initialize playback source with VID and PlayAuth.
 
 Creates a playback source using playback authorization token for authentication.
 
 @param vid Alibaba Cloud Video ID
 @param playAuth Playback authorization token generated by server
 @param region Region where video is located
 @return Initialized AVPVidAuthSource instance
 */
- (instancetype)initWithVid:(NSString *)vid
                   playAuth:(NSString *)playAuth
                     region:(NSString *)region;

/**
 @brief 使用VID、PlayAuth和播放配置初始化播放源
 
 @param vid 阿里云视频ID
 @param playAuth 播放鉴权令牌
 @param region 视频所在地域
 @param playConfig 自定义播放配置
 @return 初始化后的AVPVidAuthSource实例
 */
/****
 @brief Initialize playback source with VID, PlayAuth and playback configuration.
 
 @param vid Alibaba Cloud Video ID
 @param playAuth Playback authorization token
 @param region Region where video is located
 @param playConfig Custom playback configuration
 @return Initialized AVPVidAuthSource instance
 */
- (instancetype)initWithVid:(NSString *)vid
        playAuth:(NSString *)playAuth
          region:(NSString *)region
                playConfig:(NSString *)playConfig;

/**
 @brief 使用VID、PlayAuth、格式和配置初始化播放源
 
 @param vid 阿里云视频ID
 @param playAuth 播放鉴权令牌
 @param region 视频所在地域
 @param format 媒体格式
 @param playConfig 自定义播放配置
 @return 初始化后的AVPVidAuthSource实例
 */
/****
 @brief Initialize playback source with VID, PlayAuth, format and configuration.
 
 @param vid Alibaba Cloud Video ID
 @param playAuth Playback authorization token
 @param region Region where video is located
 @param format Media format
 @param playConfig Custom playback configuration
 @return Initialized AVPVidAuthSource instance
 */
- (instancetype)initWithVid:(NSString *)vid
                   playAuth:(NSString *)playAuth
                     region:(NSString *)region
                     format:(NSString *)format
                 playConfig:(NSString *)playConfig;

/**
 @brief 视频ID
 
 阿里云视频ID，唯一标识一个视频资源。
 */
/****
 @brief Video ID.
 
 Alibaba Cloud Video ID uniquely identifying a video resource.
 */
@property (nonatomic, copy) NSString* vid;

/**
 @brief 播放鉴权令牌
 
 由服务端生成的播放鉴权令牌，用于验证播放权限。
 */
/****
 @brief Playback Authorization Token.
 
 Playback authorization token generated by server for verifying playback permission.
 */
@property (nonatomic, copy) NSString* playAuth;

/**
 @brief 地域信息
 
 视频所在的阿里云地域标识。
 */
/****
 @brief Region.
 
 Alibaba Cloud region identifier where video is located.
 */
@property (nonatomic, copy) NSString* region;

/**
 @brief 播放配置
 
 自定义的播放配置，JSON格式。构造方式参考<a href="https://help.aliyun.com/zh/vod/developer-reference/request-parameters">
 */
/****
 @brief Play Configuration.
 
 Custom playback configuration in JSON format. Constructing reference: <a href="https://help.aliyun.com/zh/vod/developer-reference/request-parameters">
 */
@property (nonatomic, copy) NSString* playConfig;

/**
 @brief 媒体格式
 
 指定媒体的格式类型。多个格式用逗号分隔，如"mp4,mp3,flv,m3u8"。
 */
/****
 @brief Media Format.
 
 Specifies media format type. Multiple formats separated by commas, e.g., "mp4,mp3,flv,m3u8".
 */
@property (nonatomic, copy) NSString* format;

/**
 @brief 鉴权超时时间
 
 PlayAuth鉴权的超时时间，单位为毫秒。
 */
/****
 @brief Authentication Timeout.
 
 Timeout for PlayAuth authentication in milliseconds.
 */
@property (nonatomic, assign) long authTimeout;

/**
 @brief 结果类型
 Single（默认）：每种清晰度和格式只返回一路最新转码完成的流。
 Multiple：每种清晰度和格式返回所有转码完成的流。
 */
/****
 @brief Result Type.
 Single (default): Each clarity and format returns only one latest transcoded stream.
 Multiple: Each clarity and format returns all transcoded streams.
 
 Specifies the result type for retrieving media information.
 */
@property (nonatomic, copy) NSString* resultType;

/**
 @brief 二次鉴权信息
 
 CDN 二次鉴权参数，为 JSON 字符串。当开启了 URL 鉴权的 A 方式鉴权功能时，可通过该参数设置鉴权 URL 的uid和rand，请参见鉴权方式 A 说明  <a href="https://help.aliyun.com/zh/vod/user-guide/type-a-signing</a> 。
 */
/****
 @brief Re-auth Information.
 CDN re-auth parameter, in JSON string. When URL-based A-type authentication is enabled, you can set the uid and rand parameters for the re-auth URL, please refer to the A-type authentication method description <a href="https://help.aliyun.com/zh/vod/user-guide/type-a-signing">
 */
@property (nonatomic, copy) NSString* reAuthInfo;

/**
 @brief 流类型
 video/audio

 */
/****
 @brief Stream Type.
 video/audio
 
 */
@property (nonatomic, copy) NSString* streamType;

/**
 @brief 输出类型
 oss：回源地址。
 cdn（默认）：加速地址。
 */
/****
 @brief outputType
 oss: origin address.
 cdn (default): acceleration address.
 */
@property (nonatomic, copy) NSString* outputType;

/**
 @brief 用户自定义的数字水印信息
 */
/**
 @brief digitalWatermark info
 */
@property (nonatomic, copy) NSString* trace;

/**
 @brief 数字水印类型
 TraceMark：溯源水印。
 CopyrightMark：版权水印
 */
/****
 @brief Digital Watermark Type.
  TraceMark: Trace Watermark.
  CopyrightMark: Copyright Watermark
 */
@property (nonatomic, copy) NSString* digitalWatermarkType;

/**
 @brief 启用多编码格式自适应功能。
 根据设备对视频编码格式的支持能力，自动选择当前清晰度下最优的视频流。
 
 注意：
 - 需配合将 @c resultType 设为 @c Multiple 才能启用多编码流支持；
 - 仅在使用 @c VidAuth 或 @c VidSts 媒体源时生效，推荐优先使用 @c VidAuth。
 
 @see resultType
 */
/**
 @brief Enables adaptive multi-codec streaming.
 Automatically selects the optimal video stream for the current playback quality based on device codec support.
 
 Note:
 - Requires @c resultType to be set to @c Multiple to enable multi-codec stream availability;
 - Only effective when using @c VidAuth or @c VidSts media sources. @c VidAuth is recommended.
 
 @see resultType
 */
@property (nonatomic, assign) BOOL enableAdaptiveCodec;

@end

/**
 @brief VID和MPS播放源类
 
 使用阿里云视频ID和媒体处理服务（MPS）信息进行播放。
 此播放源主要用于视频转码服务用户。
 
 @deprecated 建议使用 @link AVPVidAuthSource @endlink 替代
 */
/****
 @brief VID and MPS playback source class.
 
 Plays media using Alibaba Cloud Video ID and Media Processing Service (MPS) information.
 This playback source is primarily for video transcoding service users.
 
 @deprecated Recommend using @link AVPVidAuthSource @endlink instead
 */
 __deprecated
OBJC_EXPORT
@interface AVPVidMpsSource : AVPSource

/**
 @brief 用vid和MPS信息来播放视频，视频转码服务用户使用播放方式。部分参数参考:https://help.aliyun.com/document_detail/53522.html?spm=5176.doc53534.2.5.mhSfOh
 @param vid 视频播放的vid标识
 @param accId 用户sts的accessKey ID
 @param accSecret 用户sts的accessKey secret
 @param stsToken 用户sts的token信息
 @param authInfo 用户authInfo信息
 @param region 用户region信息
 @param playDomain 用户playDomain信息
 @param mtsHlsUriToken 用户mtsHlsUriToken信息
 @deprecated Recommend using @link AVPVidAuthSource @endlink instead
 */
/****
 @brief Play by VID and MPS. This playback method is used by video transcoding service users. Reference for some of the parameters: https://help.aliyun.com/document_detail/53522.html?spm=5176.doc53534.2.5.mhSfOh
 @param vid The VID of the video.
 @param accId The AccessKey ID of the user.
 @param accSecret The AccessKey Secret of the user.
 @param stsToken The token information of the user.
 @param authInfo The authInfo of the user.
 @param region The region information of the user.
 @param playDomain The playDomain information of the user.
 @param mtsHlsUriToken The mtsHlsUriToken information of the user.
 @deprecated Recommend using @link AVPVidAuthSource @endlink instead
 */
- (instancetype)initWithVid:(NSString*)vid
                 accId:(NSString *)accId
             accSecret:(NSString*)accSecret
              stsToken:(NSString*)stsToken
              authInfo:(NSString*)authInfo
                region:(NSString*)region
            playDomain:(NSString*)playDomain
        mtsHlsUriToken:(NSString*)mtsHlsUriToken __deprecated;

/**
 @brief vid
 */
@property (nonatomic, copy) NSString* vid __deprecated;

/**
 @brief accId
 */
@property (nonatomic, copy) NSString* accId __deprecated;

/**
 @brief accSecret
 */
@property (nonatomic, copy) NSString* accSecret __deprecated;

/**
 @brief stsToken
 */
@property (nonatomic, copy) NSString* stsToken __deprecated;

/**
 @brief authInfo
 */
@property (nonatomic, copy) NSString* authInfo __deprecated;

/**
 @brief region
 */
@property (nonatomic, copy) NSString* region __deprecated;

/**
 @brief playDomain
 */
@property (nonatomic, copy) NSString* playDomain __deprecated;

/**
 @brief mtsHlsUriToken
 */
@property (nonatomic, copy) NSString* mtsHlsUriToken __deprecated;

@end

/**
 @brief 直播STS播放源类
 
 使用临时安全令牌进行身份验证后播放加密直播流。
 适用于需要权限控制和加密的直播场景。
 */
/****
 @brief Live STS playback source class.
 
 Plays encrypted live stream after authentication using temporary security token.
 Suitable for live streaming scenarios requiring access control and encryption.
 */
OBJC_EXPORT
@interface AVPLiveStsSource : AVPSource

/**
 @brief 使用URL和STS信息初始化直播播放源
 
 创建使用临时安全令牌的加密直播播放源。
 
 @param url 直播流URL
 @param accessKeyId STS临时访问密钥ID
 @param accessKeySecret STS临时访问密钥
 @param securityToken STS安全令牌
 @param region 直播流所在地域
 @param domain 直播域名
 @param app 直播应用名
 @param stream 直播流名
 @param encryptionType 加密类型
 @return 初始化后的AVPLiveStsSource实例
 */
/****
 @brief Initialize live playback source with URL and STS information.
 
 Creates an encrypted live playback source using temporary security token.
 
 @param url Live stream URL
 @param accessKeyId STS temporary AccessKey ID
 @param accessKeySecret STS temporary AccessKey Secret
 @param securityToken STS security token
 @param region Region where live stream is located
 @param domain Live domain name
 @param app Live application name
 @param stream Live stream name
 @param encryptionType Encryption type
 @return Initialized AVPLiveStsSource instance
 */
- (instancetype)initWithUrl:(NSString *)url
                accessKeyId:(NSString *)accessKeyId
            accessKeySecret:(NSString *)accessKeySecret
              securityToken:(NSString *)securityToken
                     region:(NSString *)region
                     domain:(NSString *)domain
                        app:(NSString *)app
                     stream:(NSString *)stream
             encryptionType:(ENCRYPTION_TYPE)encryptionType;

/**
 @brief 直播流URL
 
 直播流的播放地址。
 */
/****
 @brief Live Stream URL.
 
 Playback address of the live stream.
 */
@property (nonatomic, copy) NSString* url;

/**
 @brief 访问密钥ID
 
 STS临时访问密钥的ID。
 */
/****
 @brief AccessKey ID.
 
 ID of STS temporary AccessKey.
 */
@property (nonatomic, copy) NSString* accessKeyId;

/**
 @brief 访问密钥
 
 STS临时访问密钥。
 */
/****
 @brief AccessKey Secret.
 
 STS temporary AccessKey Secret.
 */@property (nonatomic, copy) NSString* accessKeySecret;

/**
 @brief 安全令牌
 
 STS安全令牌。
 */
/****
 @brief Security Token.
 
 STS security token.
 */
@property (nonatomic, copy) NSString* securityToken;

/**
 @brief 地域信息
 
 所在的地域标识，如"cn-shanghai"。
 */
/****
 @brief Region.
 
 Region identifier, such as "cn-shanghai".
 */
@property (nonatomic, copy) NSString* region;

/**
 @brief 直播域名
 
 用于直播的域名。
 */
/****
 @brief Live Domain.
 
 Domain name used for live streaming.
 */
@property (nonatomic, copy) NSString* domain;

/**
 @brief 直播应用名
 
 直播服务中的应用标识。
 */
/****
 @brief Live Application Name.
 
 Application identifier in live streaming service.
 */
@property (nonatomic, copy) NSString* app;

/**
 @brief 流标识
 */
/****
 @brief stream identifier
 */
@property (nonatomic, copy) NSString* stream;

/**
 @brief 加密类型
 
 直播流使用的加密方式。
 @see ENCRYPTION_TYPE
 */
/****
 @brief Encryption Type.
 
 Encryption method used for live stream.
 @see ENCRYPTION_TYPE
 */
@property(assign) ENCRYPTION_TYPE encryptionType;

@end

/**
@brief 缩略图URL类
*/
/****
@brief Thumbnail URL class.
*/
OBJC_EXPORT
@interface AVPThumbnailUrl : NSObject

@property (nonatomic, copy) NSString* url;

- (instancetype)initWithUrl:(NSString *)url;

@end

/**
@brief 播放信息类
*/
/****
@brief Play info class.
*/
OBJC_EXPORT
@interface AVPPlayInfoForVod : NSObject

@property (nonatomic, copy) NSString* format;
@property (nonatomic, copy) NSString* streamType;
@property (nonatomic, copy) NSString* preprocessStatus;
@property (nonatomic, copy) NSString* modificationTime;
@property (nonatomic, assign) int height;
@property (nonatomic, copy) NSString* playURL;
@property (nonatomic, copy) NSString* creationTime;
@property (nonatomic, copy) NSString* status;
@property (nonatomic, assign) float duration;
@property (nonatomic, copy) NSString* jobId;
@property (nonatomic, assign) int encrypt;
@property (nonatomic, copy) NSString* encryptType;
@property (nonatomic, assign) int width;
@property (nonatomic, assign) int fps;
@property (nonatomic, assign) double bitrate;
@property (nonatomic, assign) long long size;
@property (nonatomic, copy) NSString* definition;
@property (nonatomic, copy) NSString* codecName;
@property (nonatomic, copy) NSString* rand;
@property (nonatomic, copy) NSString* plaintext;
@property (nonatomic, copy) NSString* watermarkId;
@property (nonatomic, assign) int infoIndex;

@end

/**
@brief VodPlayInfo类
*/
/****
@brief VodPlayInfo class.
*/
OBJC_EXPORT
@interface AVPVodPlayInfo : NSObject

@property (nonatomic, copy) NSString* clientRand;
@property (nonatomic, copy) NSString* requestId;

// VideoBase properties
@property (nonatomic, copy) NSString* transcodeMode;
@property (nonatomic, copy) NSString* creationTime;
@property (nonatomic, copy) NSString* coverURL;
@property (nonatomic, copy) NSString* status;
@property (nonatomic, copy) NSString* mediaType;
@property (nonatomic, copy) NSString* videoId;
@property (nonatomic, assign) float duration;
@property (nonatomic, copy) NSString* outputType;
@property (nonatomic, copy) NSString* title;
@property (nonatomic, strong) NSArray<AVPThumbnailUrl *> *thumbnailUrls;

// PlayListInfo properties
@property (nonatomic, strong) NSArray<AVPPlayInfoForVod *> *playInfos;

- (instancetype)initWithJson:(NSString *)json;

@end

/**
@brief VodAsset播放源类

使用预加载的视频资产信息进行播放。
*/
/****
@brief VodAsset playback source class.

Plays media using pre-loaded video asset information.
*/
OBJC_EXPORT
@interface AVPVodAsset : AVPSource

/**
@brief 使用JSON字符串初始化播放源

从JSON字符串创建VodAsset对象，JSON格式应包含VideoBase和PlayInfoList信息。

@param jsonString 包含视频信息的JSON字符串
@return 初始化后的AVPVodAsset实例，如果解析失败则返回nil
*/
/****
@brief Initialize playback source with JSON string.

Creates a VodAsset object from a JSON string containing VideoBase and PlayInfoList information.

@param jsonString JSON string containing video information
@return Initialized AVPVodAsset instance, or nil if parsing fails
*/
- (instancetype)initWithJsonString:(NSString *)jsonString;

/**
@brief 使用视频ID、标题、封面URL、时长和播放信息初始化播放源

@param vid 视频ID
@param clientRand 客户端随机数
@param duration 视频时长
@param playInfos 播放信息列表
@return 初始化后的AVPVodAsset实例
*/
/****
@brief Initialize playback source with video ID, title, cover URL, duration and play info list.

@param vid Video ID
@param clientRand Client random number
@param duration Video duration
@param playInfos Play info list
@return Initialized AVPVodAsset instance
*/
- (instancetype)initWithVid:(NSString *)vid
                      clientRand:(NSString *)clientRand
                      duration:(double)duration
                     playInfos:(NSArray<AVPVodPlayInfo *> *)playInfos;

/**
@brief 视频ID
*/
/****
@brief Video ID.
*/
@property (nonatomic, copy) NSString* videoId;



/**
@brief 客户端随机数
*/
/****
@brief Client random number.
*/
@property (nonatomic, copy) NSString* clientRand;

/**
@brief 视频时长
*/
/****
@brief Video duration.
*/
@property (nonatomic, assign) double duration;

/**
@brief 是否启用多编码自适应
默认为YES
*/
/****
@brief Whether to enable adaptive codec.
Default is YES
*/
@property (nonatomic, assign) BOOL adaptiveCodecEnable;

/**
@brief 播放信息列表
*/
/****
@brief Play info list.
*/
@property (nonatomic, strong) NSArray<AVPVodPlayInfo *> *playInfos;

@end

#endif /* AVPSource_h */
