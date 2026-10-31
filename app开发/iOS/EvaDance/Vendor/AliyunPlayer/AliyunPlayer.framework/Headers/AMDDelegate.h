//
//  AMDDelegate.h
//  AliMediaDownloader
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef AMDDelegate_h
#define AMDDelegate_h
@class AVPMediaInfo;
@class AVPErrorModel;

@class AliMediaDownloader;

#import <Foundation/Foundation.h>

/**
 * @protocol AMDDelegate
 * @brief 下载器的代理（delegate）协议。
 *
 * 该协议定义了用于接收下载器在下载过程中的关键事件回调，包括准备完成、进度更新、处理进度、完成和错误等。
 */
/****
 * @protocol AMDDelegate
 * @brief The delegate protocol for the downloader.
 *
 * This protocol defines callbacks for receiving key events from the downloader during the download process, including preparation completion, progress updates, processing progress, completion, and errors.
 */
@protocol AMDDelegate <NSObject>
@optional

/**
 * @brief 下载准备完成事件回调。
 *
 * 当下载器完成对媒体资源的准备工作后，此方法将被调用。此时可以获取到媒体的相关信息。
 *
 * @param downloader 触发回调的 @link AliMediaDownloader @endlink 实例。
 * @param info 媒体信息对象。@see @link AVPMediaInfo @endlink
 */
/****
 * @brief Callback for when download preparation is complete.
 *
 * This method is called after the downloader has finished preparing the media resource. At this point, media-related information can be retrieved.
 *
 * @param downloader The @link AliMediaDownloader @endlink instance that triggered the callback.
 * @param info The media information object. @see @link AVPMediaInfo @endlink
 */
-(void)onPrepared:(AliMediaDownloader*)downloader mediaInfo:(AVPMediaInfo*)info;

/**
 * @brief 错误事件回调。
 *
 * 在下载过程中的任何阶段发生错误时，此方法将被调用。
 *
 * @param downloader 触发回调的 @link AliMediaDownloader @endlink 实例。
 * @param errorModel 错误描述模型，包含了详细的错误码和错误信息。@see @link AVPErrorModel @endlink
 */
/****
 * @brief Callback for error events.
 *
 * This method is called when an error occurs at any stage of the download process.
 *
 * @param downloader The @link AliMediaDownloader @endlink instance that triggered the callback.
 * @param errorModel An error description model containing a detailed error code and message. @see @link AVPErrorModel @endlink
 */
- (void)onError:(AliMediaDownloader*)downloader errorModel:(AVPErrorModel *)errorModel;

/**
 * @brief 下载进度回调。
 *
 * 在文件下载过程中，此方法会定时被调用，用于更新下载进度。
 *
 * @param downloader 触发回调的 @link AliMediaDownloader @endlink 实例。
 * @param percent 当前的下载进度百分比，取值范围为 0-100。
 */
/****
 * @brief Callback for download progress.
 *
 * During the file download process, this method is called periodically to update the download progress.
 *
 * @param downloader The @link AliMediaDownloader @endlink instance that triggered the callback.
 * @param percent The current download progress percentage, with a value range of 0-100.
 */
- (void)onDownloadingProgress:(AliMediaDownloader*)downloader percentage:(int)percent;

/**
 * @brief 下载文件处理进度回调。
 *
 * 此方法用于回调处理过程的进度。
 *
 * @param downloader 触发回调的 @link AliMediaDownloader @endlink 实例。
 * @param percent 当前的文件处理进度百分比，取值范围为 0-100。
 */
/****
 * @brief Callback for downloaded file processing progress.
 *
 * This method is used to report the progress of processing.
 *
 * @param downloader The @link AliMediaDownloader @endlink instance that triggered the callback.
 * @param percent The current file processing progress percentage, with a value range of 0-100.
 */
- (void)onProcessingProgress:(AliMediaDownloader*)downloader percentage:(int)percent;

/**
 * @brief 下载完成回调。
 *
 * 当整个下载及后续处理流程全部成功完成时，此方法被调用。
 *
 * @param downloader 触发回调的 @link AliMediaDownloader @endlink 实例。
 */
/****
 * @brief Callback for download completion.
 *
 * This method is called when the entire download and any subsequent processing are successfully completed.
 *
 * @param downloader The @link AliMediaDownloader @endlink instance that triggered the callback.
 */
- (void)onCompletion:(AliMediaDownloader*)downloader;

@end

#endif /* AMDDelegate_h */
