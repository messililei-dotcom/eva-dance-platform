//
//  AliPlayerPictureInPictureDelegate.h
//  AliyunPlayer
//
//  Created by alibaba on 2022/7/4.
//  Copyright © 2022 com.alibaba.AliyunPlayer. All rights reserved.

#ifndef AliPlayerPictureInPictureDelegate_h
#define AliPlayerPictureInPictureDelegate_h

#import <Foundation/Foundation.h>
#if TARGET_OS_IPHONE
#import <UIKit/UIKit.h>
#import <AVKit/AVKit.h>
#import <AVFoundation/AVFoundation.h>
#elif TARGET_OS_OSX
#import <AppKit/AppKit.h>
#endif

/**
 * 画中画（Picture in Picture）功能的代理协议。
 *
 * <p>该协议定义了播放器在画中画模式下各生命周期阶段和用户交互事件的回调方法。
 *
 * <p>所有方法均为可选实现（@optional）。
 */
/****
 * Delegate protocol for Picture in Picture (PiP) functionality.
 *
 * <p>This protocol defines callback methods for various lifecycle stages and user interaction events
 * when the player is in Picture in Picture mode.
 *
 * <p>All methods are optional (@optional).
 */
@protocol AliPlayerPictureInPictureDelegate <NSObject>

@optional

/**
 * 画中画即将启动时的回调。
 *
 * <p>此方法在系统尝试启动画中画模式之前调用。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 */
/****
 * Called when Picture in Picture is about to start.
 *
 * <p>This method is invoked before the system attempts to start Picture in Picture mode.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 */
- (void)pictureInPictureControllerWillStartPictureInPicture:(AVPictureInPictureController * _Nullable)pictureInPictureController;

/**
 * 画中画已成功启动时的回调。
 *
 * <p>此方法在画中画模式成功进入后调用。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 */
/****
 * Called when Picture in Picture has successfully started.
 *
 * <p>This method is invoked after Picture in Picture mode has been successfully entered.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 */
- (void)pictureInPictureControllerDidStartPictureInPicture:(AVPictureInPictureController * _Nullable)pictureInPictureController;

/**
 * 画中画即将停止时的回调。
 *
 * <p>此方法在系统准备退出画中画模式之前调用。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 */
/****
 * Called when Picture in Picture is about to stop.
 *
 * <p>This method is invoked before the system prepares to exit Picture in Picture mode.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 */
- (void)pictureInPictureControllerWillStopPictureInPicture:(AVPictureInPictureController * _Nullable)pictureInPictureController;

/**
 * 画中画已停止时的回调。
 *
 * <p>此方法在画中画模式完全退出后调用。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 */
/****
 * Called when Picture in Picture has stopped.
 *
 * <p>This method is invoked after Picture in Picture mode has been fully exited.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 */
- (void)pictureInPictureControllerDidStopPictureInPicture:(AVPictureInPictureController * _Nullable)pictureInPictureController;

/**
 * 画中画启动失败时的回调。
 *
 * <p>此方法在系统尝试启动画中画但失败时调用。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 * @param error 启动失败的错误信息，可能为 nil
 */
/****
 * Called when Picture in Picture fails to start.
 *
 * <p>This method is invoked when the system attempts to start Picture in Picture but fails.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 * @param error The error information for the failure, which may be nil
 */
- (void)pictureInPictureController:(AVPictureInPictureController * _Nullable)pictureInPictureController failedToStartPictureInPictureWithError:(NSError * _Nullable)error;

/**
 * 画中画停止前恢复用户界面的回调。
 *
 * <p>此方法在画中画即将停止时调用，用于通知代理恢复主播放器的用户界面。
 *
 * <p>必须调用 completionHandler 并传入 YES，以允许系统完成界面恢复。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 * @param completionHandler 完成回调，必须调用并传入 YES 以允许系统完成恢复
 */
/****
 * Called to restore the user interface before Picture in Picture stops.
 *
 * <p>This method is invoked when Picture in Picture is about to stop, notifying the delegate to restore the main player's user interface.
 *
 * <p>The completion handler must be called with YES to allow the system to complete the interface restoration.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 * @param completionHandler The completion handler that must be called with YES to allow the system to complete the restoration
 */
- (void)pictureInPictureController:(AVPictureInPictureController * _Nullable)pictureInPictureController restoreUserInterfaceForPictureInPictureStopWithCompletionHandler:(void (^_Nullable)(BOOL restored))completionHandler;

/**
 * 画中画窗口渲染尺寸变化时的回调。
 *
 * <p>此方法在画中画窗口的渲染尺寸发生变化时调用。
 *
 * @param pictureInPictureController 画中画控制器实例，非空
 * @param newRenderSize 新的渲染尺寸，类型为 CMVideoDimensions
 */
/****
 * Called when the Picture in Picture window's render size changes.
 *
 * <p>This method is invoked when the render size of the Picture in Picture window changes.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, non-null
 * @param newRenderSize The new render size, of type CMVideoDimensions
 */
- (void)pictureInPictureController:(nonnull AVPictureInPictureController *)pictureInPictureController didTransitionToRenderSize:(CMVideoDimensions)newRenderSize;

/**
 * 画中画暂停/播放按钮点击时的回调。
 *
 * <p>此方法在用户点击画中画窗口的暂停/播放按钮时调用。
 *
 * @param pictureInPictureController 画中画控制器实例，非空
 * @param playing 指示当前应处于播放（YES）还是暂停（NO）状态
 */
/****
 * Called when the user taps the play/pause button in the Picture in Picture window.
 *
 * <p>This method is invoked when the user taps the play/pause button in the Picture in Picture window.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, non-null
 * @param playing Indicates whether the player should be in playing (YES) or paused (NO) state
 */
- (void)pictureInPictureController:(nonnull AVPictureInPictureController *)pictureInPictureController setPlaying:(BOOL)playing;

/**
 * 画中画快进/快退按钮点击时的回调。
 *
 * <p>此方法在用户点击画中画窗口的快进或快退按钮时调用。
 *
 * <p>必须调用 completionHandler 以通知系统跳转操作已完成。
 *
 * @param pictureInPictureController 画中画控制器实例，非空
 * @param skipInterval 跳转的时间间隔，正数表示快进，负数表示快退
 * @param completionHandler 必须调用的完成回调，用于通知系统跳转操作已完成
 */
/****
 * Called when the user requests skipping forward or backward in the Picture in Picture window.
 *
 * <p>This method is invoked when the user taps the skip forward or backward button in the Picture in Picture window.
 *
 * <p>The completion handler must be called to notify the system that the skip operation has completed.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, non-null
 * @param skipInterval The time interval to skip; positive for forward, negative for backward
 * @param completionHandler The completion handler that must be called to notify the system that the skip operation has completed
 */
- (void)pictureInPictureController:(nonnull AVPictureInPictureController *)pictureInPictureController skipByInterval:(CMTime)skipInterval completionHandler:(nonnull void (^)(void))completionHandler;

/**
 * 查询当前播放状态以更新画中画 UI 的回调。
 *
 * <p>此方法用于让代理返回当前播放器的实际播放状态，以便画中画控制器正确显示播放/暂停按钮状态。
 *
 * @param pictureInPictureController 画中画控制器实例，非空
 * @return YES 表示当前处于暂停状态，NO 表示正在播放
 */
/****
 * Called to query the current playback state for updating the Picture in Picture UI.
 *
 * <p>This method allows the delegate to return the actual playback state of the player so that the Picture in Picture controller can correctly display the play/pause button state.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, non-null
 * @return YES if currently paused, NO if currently playing
 */
- (BOOL)pictureInPictureControllerIsPlaybackPaused:(nonnull AVPictureInPictureController *)pictureInPictureController;

/**
 * 提供当前可播放时间范围的回调。
 *
 * <p>此方法用于让代理告知画中画控制器当前媒体的可播放时间范围。
 *
 * @param pictureInPictureController 画中画控制器实例，非空
 * @param layerTime 当前图层时间
 * @return 当前媒体的可播放时间范围，类型为 CMTimeRange
 */
/****
 * Called to provide the current playable time range.
 *
 * <p>This method allows the delegate to inform the Picture in Picture controller of the current playable time range of the media.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, non-null
 * @param layerTime The current layer time
 * @return The current playable time range of the media, of type CMTimeRange
 */
- (CMTimeRange)pictureInPictureControllerTimeRangeForPlayback:(nonnull AVPictureInPictureController *)pictureInPictureController layerTime:(CMTime)layerTime;

/**
 * 画中画功能启用状态变化的回调。
 *
 * <p>此方法在画中画功能的启用状态发生变化时调用。
 *
 * @param pictureInPictureController 画中画控制器实例，可能为 nil
 * @param isEnable YES 表示画中画功能已启用，NO 表示已禁用
 */
/****
 * Called when the Picture in Picture feature's enable state changes.
 *
 * <p>This method is invoked when the enable state of the Picture in Picture feature changes.
 *
 * @param pictureInPictureController The Picture in Picture controller instance, which may be nil
 * @param isEnable YES if Picture in Picture is enabled, NO if disabled
 */
- (void)pictureInPictureControllerIsPictureInPictureEnable:(nullable AVPictureInPictureController *)pictureInPictureController isEnable:(BOOL)isEnable;

@end



#endif /* AliPlayerPictureInPictureDelegate_h */
