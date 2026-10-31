//
//  AliMediaDownloader.h
//  AliMediaDownloader
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#import <Foundation/Foundation.h>
#if __has_include (<AliyunPlayer/AliyunPlayer.h>)
#import <AliyunPlayer/AliyunPlayer.h>
#else
#import "AMDDelegate.h"
#import "AVPDef.h"
#endif
#import "AVDConfig.h"

@class AVPVidStsSource;
@class AVPVidAuthSource;


/**
 * @interface AliMediaDownloader
 * @brief 媒体文件下载器类。
 *
 * 该类提供了媒体文件的下载功能，包括准备、开始、停止、更新凭证和删除等操作。
 * 下载过程中的状态通过 @link AMDDelegate @endlink 协议进行回调。
 */
/****
 * @interface AliMediaDownloader
 * @brief Media file downloader class.
 *
 * This class provides functionalities for downloading media files, including preparing, starting, stopping, updating credentials, and deleting.
 * The status during the download process is reported via the @link AMDDelegate @endlink protocol.
 */
OBJC_EXPORT
@interface AliMediaDownloader : NSObject

/**
 * @brief 删除一个已下载的文件（类方法）。
 * @param saveDir 文件保存的目录路径。
 * @param vid 媒体文件的 VID。
 * @param format 媒体文件的格式。
 * @param index 对应 VID 的下载索引。
 * @return 返回一个整型值，表示操作的结果。
 */
/****
 * @brief Deletes a downloaded file (class method).
 * @param saveDir The directory path where the file is saved.
 * @param vid     The VID of the media file.
 * @param format  The format of the media file.
 * @param index   The download index corresponding to the VID.
 * @return Returns an integer value indicating the result of the operation.
 */
+(int) deleteFile:(NSString *)saveDir vid:(NSString *)vid format:(NSString *)format index:(int)index;

/**
 * @brief 初始化下载器实例。
 * @return 一个已初始化的 `AliMediaDownloader` 实例。
 */
/****
 * @brief Initializes a downloader instance.
 * @return An initialized `AliMediaDownloader` instance.
 */
- (instancetype)init;

/**
 * @brief 销毁下载器实例。
 *
 * 调用此方法以释放下载器占用的资源。
 */
/****
 * @brief Destroys the downloader instance.
 *
 * Call this method to release resources held by the downloader.
 */
- (void)destroy;

/**
 * @brief 使用 VidStsSource 准备下载。
 *
 * 这是一个异步操作。准备成功后，会触发 @link -[AMDDelegate onPrepared:mediaInfo:] @endlink 回调。
 *
 * @param source @link AVPVidStsSource @endlink 对象，包含了下载所需的 VID 和 STS 凭证信息。
 * @see @link -[AMDDelegate onPrepared:mediaInfo:] @endlink
 * @see @link -[AMDDelegate onError:errorModel:] @endlink
 */
/****
 * @brief Prepares for download using AVPVidStsSource.
 *
 * This is an asynchronous operation. Upon successful preparation, the @link -[AMDDelegate onPrepared:mediaInfo:] @endlink callback will be triggered.
 *
 * @param source The @link AVPVidStsSource @endlink object, containing the VID and STS credential information required for download.
 * @see @link -[AMDDelegate onPrepared:mediaInfo:] @endlink
 * @see @link -[AMDDelegate onError:errorModel:] @endlink
 */
- (void) prepareWithVid:(AVPVidStsSource*)source;

/**
 * @brief 更新 VidStsSource 信息。
 *
 * 当 STS 凭证过期时，调用此方法以更新凭证信息。
 *
 * @param source 新的 @link AVPVidStsSource @endlink 对象，包含了更新后的 STS 凭证。
 */
/****
 * @brief Updates the VidStsSource information.
 *
 * When the STS credential expires, call this method to update the credential information.
 *
 * @param source A new @link AVPVidStsSource @endlink object containing the updated STS credentials.
 */
- (void) updateWithVid:(AVPVidStsSource*)source;

/**
 * @brief 使用 VidAuthSource 准备下载。
 *
 * 这是一个异步操作。准备成功后，会触发 @link -[AMDDelegate onPrepared:mediaInfo:] @endlink 回调。
 *
 * @param source @link AVPVidAuthSource @endlink 对象，包含了下载所需的 VID 和 PlayAuth 凭证信息。
 * @see @link -[AMDDelegate onPrepared:mediaInfo:] @endlink
 * @see @link -[AMDDelegate onError:errorModel:] @endlink
 */
/****
 * @brief Prepares for download using AVPVidAuthSource.
 *
 * This is an asynchronous operation. Upon successful preparation, the @link -[AMDDelegate onPrepared:mediaInfo:] @endlink callback will be triggered.
 *
 * @param source The @link AVPVidAuthSource @endlink object, containing the VID and PlayAuth credential information required for download.
 * @see @link -[AMDDelegate onPrepared:mediaInfo:] @endlink
 * @see @link -[AMDDelegate onError:errorModel:] @endlink
 */
- (void) prepareWithPlayAuth:(AVPVidAuthSource*)source;

/**
 * @brief 更新 VidAuthSource 信息。
 *
 * 当 PlayAuth 凭证过期时，调用此方法以更新凭证信息。
 *
 * @param source 新的 @link AVPVidAuthSource @endlink 对象，包含了更新后的 PlayAuth 凭证。
 */
/****
 * @brief Updates the VidAuthSource information.
 *
 * When the PlayAuth credential expires, call this method to update the credential information.
 *
 * @param source A new @link AVPVidAuthSource @endlink object containing the updated PlayAuth credential.
 */
- (void) updateWithPlayAuth:(AVPVidAuthSource*)source;

/**
 * @brief 设置下载文件的保存目录。
 * @param dir 用于保存下载文件的文件夹路径。
 */
/****
 * @brief Sets the save directory for downloaded files.
 * @param dir The folder path to save the downloaded files.
 */
- (void) setSaveDirectory:(NSString*)dir;

/**
 * @brief 开始下载。
 * @see @link -[AMDDelegate onDownloadingProgress:percentage:] @endlink
 * @see @link -[AMDDelegate onCompletion:] @endlink
 */
/****
 * @brief Start downloading.
 * @see @link -[AMDDelegate onDownloadingProgress:percentage:] @endlink
 * @see @link -[AMDDelegate onCompletion:] @endlink
 */
- (void) start;

/**
 * @brief 停止下载。
 * @see @link -[AliMediaDownloader start] @endlink
 */
/****
 * @brief Stop downloading.
 * @see @link -[AliMediaDownloader start] @endlink
 */
- (void) stop;

/**
 * @brief 删除与当前下载器实例关联的已下载文件。
 */
/****
 * @brief Deletes the downloaded file associated with the current downloader instance.
 */
- (void)deleteFile;

/**
 * @brief 获取当前的下载配置。
 * @return 当前的 @link AVDConfig @endlink 配置对象。
 * @see @link -[AliMediaDownloader setConfig:] @endlink
 */
/****
 * @brief Gets the current download configuration.
 * @return The current @link AVDConfig @endlink configuration object.
 * @see @link -[AliMediaDownloader setConfig:] @endlink
 */
- (AVDConfig*) getConfig;

/**
 * @brief 设置下载配置。
 * @param config 一个 @link AVDConfig @endlink 对象，包含了下载的相关配置。
 * @see @link -[AliMediaDownloader getConfig] @endlink
 */
/****
 * @brief Sets the download configuration.
 * @param config An @link AVDConfig @endlink object containing download-related configurations.
 * @see @link -[AliMediaDownloader getConfig] @endlink
 */
- (void) setConfig:(AVDConfig*)config;

/**
 * @brief 选择要下载的媒体轨道。
 *
 * @note 可用的轨道索引（trackIndex）可以在 @link -[AMDDelegate onPrepared:mediaInfo:] @endlink 回调的 `AVPMediaInfo` 对象中获取。
 * @param trackIndex 要下载的轨道的索引。
 */
/****
 * @brief Selects the media track to be downloaded.
 *
 * @note Available track indexes can be obtained from the `AVPMediaInfo` object in the @link -[AMDDelegate onPrepared:mediaInfo:] @endlink callback.
 * @param trackIndex The index of the track to be downloaded.
 */
- (void) selectTrack:(int)trackIndex;

/**
 * @brief 设置一个用于转换播放 URL 的回调函数。
 *
 * @note 此回调通常用于 P2P 场景下的 URL 地址转换。
 * @param callback 一个回调函数指针。其具体签名（参数和返回值）未在此文件中定义，请参考其定义源。
 */
/****
 * @brief Sets a callback function for converting playback URLs.
 *
 * @note This callback is typically used for URL address conversion in P2P scenarios.
 * @param callback A callback function pointer. Its specific signature (parameters and return value) is not defined in this file; please refer to its source definition.
 */
- (void) setPlayUrlConvertCallback:(PlayURLConverCallback)callback;

/**
 * @property delegate
 * @brief 设置下载事件的代理。
 *
 * @see @link AMDDelegate @endlink
 */
/****
 * @property delegate
 * @brief Sets the delegate for download events.
 *
 * @see @link AMDDelegate @endlink
 */
@property (nonatomic, weak) id<AMDDelegate> delegate;

/**
 * @brief 获取 SDK 版本号。
 * @return 包含 SDK 版本信息的字符串。
 */
/****
 * @brief Gets the SDK version number.
 * @return A string containing the SDK version information.
 */
+ (NSString*) getSDKVersion;

/**
 * @property downloadedFilePath
 * @brief 获取已下载文件的路径。
 *
 * @note 该属性在下载完成（即 @link -[AMDDelegate onCompletion:] @endlink 回调触发）后才会有有效值。
 * @return 一个表示已下载文件本地路径的字符串。如果下载未完成，可能为 nil 或空。
 */
/****
 * @property downloadedFilePath
 * @brief Gets the path of the downloaded file.
 *
 * @note This property will have a valid value only after the download is complete (i.e., when the @link -[AMDDelegate onCompletion:] @endlink callback is triggered).
 * @return A string representing the local path of the downloaded file. It may be nil or empty if the download is not complete.
 */
@property (nonatomic, readonly) NSString* downloadedFilePath;

@end
