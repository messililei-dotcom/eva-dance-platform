//
//  AliVRPlayer.h
//  AliyunPlayer
//
//  Created by tony on 2022/5/31.
//

#import "AliPlayer.h"
#import "AliVRPlayerDelegate.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * VR 播放器视图的显示模式。
 */
/****
 * Display modes for VR player view.
 */
typedef NS_ENUM(NSUInteger, AliVRPlayerViewDisplayMode)
{
    AliVRPlayerViewDisplayMode360,    ///< 360 度全景显示模式
    AliVRPlayerViewDisplayModeGlass   ///< VR 眼镜分屏显示模式
};

/**
 * VR 播放器的交互选项。
 *
 * <p>各项交互功能默认状态：
 * <ul>
 *   <li>{@link AliVRPlayerInteractiveOptionsPinch}：默认关闭</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsHorizontal}：默认关闭</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsVerticalEnabled}：默认关闭</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsDeviceMotion}：默认开启</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsCustomGesture}：默认关闭</li>
 * </ul>
 */
/****
 * Interactive options for VR player.
 *
 * <p>Default states for each interaction feature:
 * <ul>
 *   <li>{@link AliVRPlayerInteractiveOptionsPinch}: disabled by default</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsHorizontal}: disabled by default</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsVerticalEnabled}: disabled by default</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsDeviceMotion}: enabled by default</li>
 *   <li>{@link AliVRPlayerInteractiveOptionsCustomGesture}: disabled by default</li>
 * </ul>
 */
typedef NS_OPTIONS(NSUInteger, AliVRPlayerInteractiveOptions)
{
    AliVRPlayerInteractiveOptionsPinch              = 1 << 0,     // Pinch手势，            默认关闭
    AliVRPlayerInteractiveOptionsHorizontal         = 1 << 1,     // 水平方向的滑动，         默认关闭
    AliVRPlayerInteractiveOptionsVerticalEnabled    = 1 << 2,     // 竖直方向的滑动，         默认关闭
    AliVRPlayerInteractiveOptionsDeviceMotion       = 1 << 3,     // 通过手机陀螺仪进行体验，   默认开启
    AliVRPlayerInteractiveOptionsCustomGesture      = 1 << 4,
};

/**
 * VR 播放器视图的方向。
 */
/****
 * Orientation modes for VR player view.
 */
typedef NS_ENUM(NSInteger, AliVRPlayerViewOrientation) {
    AliVRPlayerViewOrientationPortrait,
    AliVRPlayerViewOrientationUpsideDown,
    AliVRPlayerViewOrientationLandscapeLeft,
    AliVRPlayerViewOrientationLandscapeRight,
};

/**
 * VR 播放器的渲染类型。
 */
/****
 * Rendering types for VR player.
 */
typedef NS_ENUM(NSInteger, AliVRPlayerType) {
    AliVRPlayerTypeSCN,
    AliVRPlayerTypeOpenGL,
};

/**
 * VR 播放器类，继承自基础播放器 {@link AliPlayer}。
 *
 * <p>提供 360 度全景视频和 VR 眼镜模式的播放能力，支持多种交互方式和显示配置。
 */
/****
 * VR player class, inheriting from the base player {@link AliPlayer}.
 *
 * <p>Provides 360-degree panoramic video and VR glasses mode playback capabilities,
 * with support for multiple interaction methods and display configurations.
 */
OBJC_EXPORT
@interface AliVRPlayer : AliPlayer

/**
 * 初始化 VR 播放器实例。
 *
 * @return 初始化后的 VR 播放器实例
 */
/****
 * Initializes a VR player instance.
 *
 * @return The initialized VR player instance
 */
- (instancetype)init;

/**
 * 使用指定跟踪 ID 初始化 VR 播放器实例。
 *
 * <p>跟踪 ID 用于日志分析和问题追踪。
 *
 * <p>设置为 "DisableAnalytics" 可禁用日志分析系统（不推荐）。
 *
 * @param traceID 用于调试的跟踪 ID；设为 "DisableAnalytics" 可禁用分析数据上报（不推荐）
 * @return 初始化后的 VR 播放器实例
 */
/****
 * Initializes a VR player instance with a specified trace ID.
 *
 * <p>The trace ID is used for log analysis and issue tracking.
 *
 * <p>Setting it to "DisableAnalytics" disables the log analytics system (not recommended).
 *
 * @param traceID A trace ID for debugging; set to "DisableAnalytics" to disable analytics data reporting (not recommended)
 * @return The initialized VR player instance
 */
- (instancetype)init:(NSString*)traceID;

/**
 * 设置 VR 播放器的交互选项开启或关闭状态。
 *
 * <p>可单独控制各项交互功能的启用状态。
 *
 * <p>默认状态：仅 {@link AliVRPlayerInteractiveOptionsDeviceMotion} 开启，其余关闭。
 *
 * @param option 要设置的交互选项，可为 {@link AliVRPlayerInteractiveOptionsPinch}、
 *               {@link AliVRPlayerInteractiveOptionsHorizontal}、
 *               {@link AliVRPlayerInteractiveOptionsVerticalEnabled} 或
 *               {@link AliVRPlayerInteractiveOptionsDeviceMotion}
 * @param enable YES 表示开启该交互选项，NO 表示关闭
 */
/****
 * Sets the enabled state of VR player interaction options.
 *
 * <p>Individual interaction features can be controlled separately.
 *
 * <p>Default state: only {@link AliVRPlayerInteractiveOptionsDeviceMotion} is enabled; others are disabled.
 *
 * @param option The interaction option to configure, which can be
 *               {@link AliVRPlayerInteractiveOptionsPinch},
 *               {@link AliVRPlayerInteractiveOptionsHorizontal},
 *               {@link AliVRPlayerInteractiveOptionsVerticalEnabled}, or
 *               {@link AliVRPlayerInteractiveOptionsDeviceMotion}
 * @param enable YES to enable the interaction option, NO to disable it
 */
- (void)setInteractionOptions:(AliVRPlayerInteractiveOptions)option enabled:(BOOL)enable;

/**
 * 设置 VR 播放器的显示模式。
 *
 * <p>默认值为 {@link AliVRPlayerViewDisplayMode360}。
 *
 * @param displayMode 显示模式，可选 {@link AliVRPlayerViewDisplayMode360} 或 {@link AliVRPlayerViewDisplayModeGlass}
 */
/****
 * Sets the display mode of the VR player.
 *
 * <p>Default value is {@link AliVRPlayerViewDisplayMode360}.
 *
 * @param displayMode Display mode, either {@link AliVRPlayerViewDisplayMode360} or {@link AliVRPlayerViewDisplayModeGlass}
 */
- (void)setDisplayMode:(AliVRPlayerViewDisplayMode)displayMode;

/**
 * 设置 VR 播放器场景的缩放比例。
 *
 * @param scale 缩放比例值
 */
/****
 * Sets the scale of the VR player scene.
 *
 * @param scale The scale factor
 */
- (void)setVRSceneScale:(CGFloat)scale;

/**
 * 设置 VR 播放器场景的整体旋转角度。
 *
 * @param rotate 旋转角度，单位为弧度
 */
/****
 * Sets the overall rotation of the VR player scene.
 *
 * @param rotate Rotation angle in radians
 */
- (void)setVRSceneRotate:(CGFloat)rotate;

/**
 * 设置 VR 播放器场景在 X 轴和 Y 轴上的旋转角度。
 *
 * @param x X 轴旋转角度，单位为弧度
 * @param y Y 轴旋转角度，单位为弧度
 */
/****
 * Sets the rotation of the VR player scene around the X and Y axes.
 *
 * @param x Rotation angle around the X axis in radians
 * @param y Rotation angle around the Y axis in radians
 */
- (void)rotateVRSceneWithX:(CGFloat)x andY:(CGFloat)y;

/**
 * 处理滑动手势以控制 VR 播放器的视角。
 *
 * @param paramSender 滑动手势识别器实例
 */
/****
 * Handles pan gestures to control the VR player's viewing angle.
 *
 * @param paramSender The pan gesture recognizer instance
 */
- (void)handlePanGesture:(UIPanGestureRecognizer *)paramSender;

/**
 * 设置 VR 播放器显示静态全景图像。
 *
 * @param image 要显示的 360 度全景图像
 */
/****
 * Sets the VR player to display a static 360-degree panoramic image.
 *
 * @param image The 360-degree panoramic image to display
 */
- (void)setVRDisplayContentsWithImage:(UIImage *)image;

/**
 * 设置 VR 播放器的渲染处理器类型。
 *
 * @param vrType VR 渲染处理器类型，可选 {@link AliVRPlayerTypeSCN} 或 {@link AliVRPlayerTypeOpenGL}
 */
/****
 * Sets the VR rendering processor type.
 *
 * @param vrType VR rendering processor type, either {@link AliVRPlayerTypeSCN} or {@link AliVRPlayerTypeOpenGL}
 */
- (void)setVRPlayerType:(AliVRPlayerType)vrType;

/**
 * 设置 VR 播放器的代理对象。
 *
 * <p>代理用于接收 VR 相关的回调事件或执行代理操作。
 *
 * @param delegate 实现 {@link AliVRPlayerDelegate} 协议的代理对象
 */
/****
 * Sets the delegate for the VR player.
 *
 * <p>The delegate receives VR-related callback events or performs delegated operations.
 *
 * @param delegate An object implementing the {@link AliVRPlayerDelegate} protocol
 */
- (void)setVRDelegate:(id<AliVRPlayerDelegate>)delegate;

/**
 * 重置 VR 播放器的手势控制角度。
 *
 * <p>将通过手势控制的视角角度重置为初始状态。
 */
/****
 * Resets the gesture-controlled viewing angle of the VR player.
 *
 * <p>Restores the viewing angle controlled by gestures to its initial state.
 */
- (void)resetGestureAngle;

/**
 * 设置 VR 视频的背景颜色。
 *
 * <p>当视频内容未完全覆盖视图区域时，背景颜色将可见。
 *
 * @param color 背景颜色
 */
/****
 * Sets the background color for VR video.
 *
 * <p>The background color is visible when the video content does not fully cover the view area.
 *
 * @param color The background color
 */
- (void)setVideoBackgroundColor:(UIColor *)color;

/**
 * 设置 VR 播放器的视野角度（FOV）。
 *
 * @param degrees 视野角度，单位为度
 */
/****
 * Sets the field of view (FOV) for the VR player.
 *
 * @param degrees Field of view angle in degrees
 */
- (void)setFovDegrees:(CGFloat)degrees;

@end

NS_ASSUME_NONNULL_END
