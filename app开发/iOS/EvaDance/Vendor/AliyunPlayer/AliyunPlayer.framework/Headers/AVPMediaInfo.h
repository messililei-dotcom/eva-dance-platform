//
//  AVPMediaInfo.h
//  AliPlayerSDK
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef AVPMediaInfo_h
#define AVPMediaInfo_h

#import <Foundation/Foundation.h>

/**
 @brief 自动选择视频清晰度的特殊索引值
 
 当轨道索引设置为此值时，播放器启用自适应码率（ABR）模式，
 根据网络状况自动选择合适的清晰度进行播放。
 */
/****
 @brief Special index value for automatic video resolution selection.
 
 When the track index is set to this value, the player enables adaptive bitrate (ABR) mode
 and automatically selects appropriate resolution based on network conditions.
 */
const static int SELECT_AVPTRACK_TYPE_VIDEO_AUTO = -1;

/**
 @brief 媒体轨道类型枚举
 
 定义媒体中包含的不同轨道类型。每个媒体可能包含多个轨道，
 如视频、音频、字幕等，通过此枚举进行标识。
 */
/****
 @brief Media track type enumeration.
 
 Defines different track types contained in media. Each media may contain multiple tracks
 such as video, audio, subtitles, etc., identified through this enumeration.
 */
typedef enum AVPTrackType: NSUInteger {
    /**
     @brief 视频轨道。包含视频编码数据和相关信息。
     */
    /****
     @brief Video track. Contains video codec data and related information.
     */
    AVPTRACK_TYPE_VIDEO,
    /**
     @brief 音频轨道。包含音频编码数据和相关信息。
     */
    /****
     @brief Audio track. Contains audio codec data and related information.
     */
    AVPTRACK_TYPE_AUDIO,
    /**
     @brief 字幕轨道。包含字幕文本和相关信息。
     */
    /****
     @brief Subtitle track. Contains subtitle text and related information.
     */
    AVPTRACK_TYPE_SUBTITLE,
    /**
     @brief 点播流轨道。来自阿里云点播服务的轨道，包含完整的流信息。
     */
    /****
     @brief VOD stream track. Track from Alibaba Cloud VOD service containing complete stream information.
     */
    AVPTRACK_TYPE_SAAS_VOD,//track from vod
} AVPTrackType;

/**
 @brief 媒体轨道信息类
 
 包含单个媒体轨道的详细信息，包括编码格式、类型、清晰度、码率等。
 不同轨道类型的对象具有不同的有效属性。
 */
/****
 @brief Media track information class.
 
 Contains detailed information of a single media track, including codec format, type, resolution, bitrate, etc.
 Different track types have different valid properties.
 */
OBJC_EXPORT
@interface AVPTrackInfo : NSObject

/**
 @brief 编码格式名称
 
 表示该轨道使用的音视频编码格式名称，如"h264"、"aac"等。
 */
/****
 @brief Codec name.
 
 Represents the name of the audio/video codec format used by this track, such as "h264", "aac", etc.
 */
@property (nonatomic, copy) NSString* codecName;

/**
 @brief 轨道类型
 
 表示此轨道的类型（视频、音频、字幕或点播流）。
 @see AVPTrackType
 */
/****
 @brief Track type.
 
 Represents the type of this track (video, audio, subtitle, or VOD stream).
 @see AVPTrackType
 */
@property (nonatomic, assign) AVPTrackType trackType;

/**
 @brief 点播格式
 */
/****
 @brief VOD format.
 */
@property (nonatomic, copy) NSString* vodFormat;

/**
 @brief 轨道索引
 */
/****
 @brief Track index.
 */
@property (nonatomic, assign) int trackIndex;

/**
 @brief 轨道清晰度标识
 
 表示该视频轨道的清晰度或分辨率标识。仅当 trackType 为 AVPTRACK_TYPE_SAAS_VOD 时有效。
 */
/****
 @brief Track definition.
 
 Indicates the resolution or clarity identifier of this video track. Valid only when trackType is AVPTRACK_TYPE_SAAS_VOD.
 */
@property (nonatomic, copy) NSString* trackDefinition;

/**
 @brief 点播文件大小
 
 该点播流文件的大小，单位为字节。仅当 trackType 为 AVPTRACK_TYPE_SAAS_VOD 时有效。
 */
/****
 @brief VOD file size.
 
 The size of the VOD stream file in bytes. Valid only when trackType is AVPTRACK_TYPE_SAAS_VOD.
 */
@property (nonatomic, assign) int64_t vodFileSize;

/**
 @brief 点播播放URL
 
 该点播流的播放地址。仅当 trackType 为 AVPTRACK_TYPE_SAAS_VOD 时有效。
 */
/****
 @brief VOD play URL.
 
 The playback URL of the VOD stream. Valid only when trackType is AVPTRACK_TYPE_SAAS_VOD.
 */
@property (nonatomic, copy) NSString* vodPlayUrl;

/**
 @brief 水印URL
 
 该点播流关联的水印文件URL。仅当 trackType 为 AVPTRACK_TYPE_SAAS_VOD 时有效。
 */
/****
 @brief Watermark URL.
 
 The watermark file URL associated with this VOD stream. Valid only when trackType is AVPTRACK_TYPE_SAAS_VOD.
 */
@property (nonatomic, copy) NSString* waterMarkUrl;

/**
 @brief 视频宽度
 
 视频画面的宽度，单位为像素。仅当 trackType 为 AVPTRACK_TYPE_VIDEO 时有效。
 */
/****
 @brief Video width.
 
 Width of video frame in pixels. Valid only when trackType is AVPTRACK_TYPE_VIDEO.
 */
@property (nonatomic, assign) int videoWidth;

/**
 @brief 视频高度
 
 视频画面的高度，单位为像素。仅当 trackType 为 AVPTRACK_TYPE_VIDEO 时有效。
 */
/****
 @brief Video height.
 
 Height of video frame in pixels. Valid only when trackType is AVPTRACK_TYPE_VIDEO.
 */
@property (nonatomic, assign) int videoHeight;

/**
 @brief 轨道码率
 
 该轨道的比特率，单位为bps（比特每秒）。仅当 trackType 为 AVPTRACK_TYPE_VIDEO 时有效。
 */
/****
 @brief Track bitrate.
 
 Bitrate of this track in bps (bits per second). Valid only when trackType is AVPTRACK_TYPE_VIDEO.
 */
@property (nonatomic, assign) int trackBitrate;

/**
 @brief 音频声道数
 
 音频轨道的声道数量，如单声道（1）、立体声（2）等。仅当 trackType 为 AVPTRACK_TYPE_AUDIO 时有效。
 */
/****
 @brief Number of audio channels.
 
 Number of audio channels, such as mono (1), stereo (2), etc. Valid only when trackType is AVPTRACK_TYPE_AUDIO.
 */
@property (nonatomic, assign) int audioChannels;

/**
 @brief 音频采样率
 
 音频的采样频率，单位为Hz。常见值为44100、48000等。仅当 trackType 为 AVPTRACK_TYPE_AUDIO 时有效。
 */
/****
 @brief Audio sample rate.
 
 Audio sampling frequency in Hz. Common values are 44100, 48000, etc. Valid only when trackType is AVPTRACK_TYPE_AUDIO.
 */
@property (nonatomic, assign) int audioSamplerate;

/**
 @brief 音频采样格式
 
 音频的采样数据格式。仅当 trackType 为 AVPTRACK_TYPE_AUDIO 时有效。
 */
/****
 @brief Audio sample format.
 
 Audio sample data format. Valid only when trackType is AVPTRACK_TYPE_AUDIO.
 */
@property (nonatomic, assign) int audioSampleFormat;

/**
 @brief 音频语言
 
 音频轨道的语言标识，如"en"（英语）、"zh"（中文）等。仅当 trackType 为 AVPTRACK_TYPE_AUDIO 时有效。
 */
/****
 @brief Audio language.
 
 Language identifier of audio track, such as "en" (English), "zh" (Chinese), etc. Valid only when trackType is AVPTRACK_TYPE_AUDIO.
 */
@property (nonatomic, copy) NSString* audioLanguage;

/**
 @brief 字幕语言
 
 字幕轨道的语言标识，如"en"（英语）、"zh"（中文）等。仅当 trackType 为 AVPTRACK_TYPE_SUBTITLE 时有效。
 */
/****
 @brief Subtitle language.
 
 Language identifier of subtitle track, such as "en" (English), "zh" (Chinese), etc. Valid only when trackType is AVPTRACK_TYPE_SUBTITLE.
 */
@property (nonatomic, copy) NSString* subtitleLanguage;


@end

/**
 @brief 缩略图信息类
 
 包含单个缩略图的相关信息。缩略图用于在进度条等UI上显示视频预览。
 */
/****
 @brief Thumbnail information class.
 
 Contains information of a single thumbnail. Thumbnails are used to show video preview on progress bars and other UI.
 */
OBJC_EXPORT
@interface AVPThumbnailInfo : NSObject

/**
 @brief 缩略图URL
 
 缩略图图片的URL地址，可为本地文件路径或网络地址。
 */
/****
 @brief Thumbnail URL.
 
 URL address of the thumbnail image, can be local file path or network address.
 */
@property (nonatomic, copy) NSString* URL;

@end


/**
 @brief 媒体信息类
 
 包含媒体（视频、音频或组合）的完整信息，包括标题、时长、轨道列表等。
 此类的实例通过 @link AliPlayer::getMediaInfo @endlink 获取。
 */
/****
 @brief Media information class.
 
 Contains complete information of media (video, audio, or combined), including title, duration, track list, etc.
 Instances of this class are obtained via @link AliPlayer::getMediaInfo @endlink.
 */
OBJC_EXPORT
@interface AVPMediaInfo : NSObject

/**
 @brief 媒体标题
 
 媒体的名称或标题。
 */
/****
 @brief Media title.
 
 The name or title of the media.
 */
@property (nonatomic, copy) NSString* title;

/**
 @brief 媒体封面URL
 
 媒体的封面或海报图片的URL地址。
 */
/****
 @brief Media cover URL.
 
 URL address of the cover or poster image of the media.
 */
@property (nonatomic, copy) NSString* coverURL;

/**
 @brief 媒体类型

 */
/****
 @brief Media type.
 
 */
@property (nonatomic, copy) NSString* mediaType;

/**
 @brief 媒体状态
 */
/**
 @brief media status
 */
@property (nonatomic, copy) NSString* status;


/**
 @brief 媒体时长
 
 媒体的总时长，单位为毫秒。
 */
/****
 @brief Media duration.
 
 The total duration of the media in milliseconds.
 */
@property (nonatomic, assign) int64_t duration;

/**
 @brief 媒体码率
 
 媒体的总体比特率，单位为bps。对于点播和多码率流，此值可能为0，
 应使用 @link AVPTrackInfo::trackBitrate @endlink 获取具体轨道的码率。
 */
/****
 @brief Media bitrate.
 
 The overall bitrate of the media in bps. For VOD and multi-bitrate streams, this value may be 0;
 use @link AVPTrackInfo::trackBitrate @endlink to get bitrate of specific track.
 */
@property(nonatomic, assign) int64_t totalBitrate;

/**
 @brief 转码模式
 
 表示媒体的转码策略：
 - "FastTranscode"：媒体上传完成后立即转码，仅转码完成后才能播放
 - "NoTranscode"：媒体上传完成后不转码，上传完成后立即可以播放
 
 默认值为"FastTranscode"。
 */
/****
 @brief Media transcode mode.
 
 Indicates the transcoding strategy of the media:
 - "FastTranscode": Transcode immediately after upload; only transcoded content can be played
 - "NoTranscode": Do not transcode after upload; content can be played immediately after upload
 
 * Default is "FastTranscode".
 */
@property (nonatomic, copy) NSString* transcodeMode;

/**
 @brief 缩略图列表
 
 媒体关联的所有缩略图信息。用于在UI上显示视频预览。
 */
/****
 @brief Thumbnails.
 
 List of all thumbnail information associated with the media. Used for displaying video preview in UI.
 */
@property (nonatomic, strong) NSArray<AVPThumbnailInfo*>* thumbnails;

/**
 @brief 媒体轨道列表
 
 媒体包含的所有轨道信息（视频、音频、字幕等）。
 */
/****
 @brief Media tracks.
 
 List of all track information contained in the media (video, audio, subtitle, etc.).
 */
@property (nonatomic, strong) NSArray<AVPTrackInfo*>* tracks;

@end

#endif /* AVPMediaInfo_h */
