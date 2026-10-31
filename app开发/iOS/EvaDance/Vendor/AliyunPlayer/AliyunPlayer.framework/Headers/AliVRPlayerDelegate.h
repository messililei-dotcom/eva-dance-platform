//
// Created by yiliang on 2023/4/12.
//

#ifndef SOURCE_ALIVRPLAYERDELEGATE_H
#define SOURCE_ALIVRPLAYERDELEGATE_H

/**
 * VR 播放器的代理协议。
 *
 * <p>该协议定义了 VR 播放器在交互过程中角度变化的回调方法。
 *
 * <p>所有方法均为可选实现（@optional）。
 */
/****
 * Delegate protocol for VR player.
 *
 * <p>This protocol defines callback methods for angle changes during VR player interaction.
 *
 * <p>All methods are optional (@optional).
 */
@protocol AliVRPlayerDelegate <NSObject>

@optional

/**
 * 运动传感器角度发生变化时的回调。
 *
 * <p>当设备的运动传感器（如陀螺仪）检测到水平角度变化时调用此方法。
 *
 * @param sensorAngleX 传感器检测到的水平角度值
 */
/****
 * Called when the motion sensor angle changes.
 *
 * <p>This method is invoked when the device's motion sensor (e.g., gyroscope) detects a change in horizontal angle.
 *
 * @param sensorAngleX The horizontal angle value detected by the sensor
 */
- (void)motionSensorAngleChanged:(CGFloat)sensorAngleX;

/**
 * 手势控制角度发生变化时的回调。
 *
 * <p>当用户通过手势（如滑动）控制 VR 视角时，水平角度发生变化会调用此方法。
 *
 * @param gestureAngleX 手势控制的水平角度值
 */
/****
 * Called when the gesture-controlled angle changes.
 *
 * <p>This method is invoked when the user controls the VR viewing angle via gestures (e.g., panning),
 * and the horizontal angle changes.
 *
 * @param gestureAngleX The horizontal angle value controlled by gestures
 */
- (void)gestureAngleChanged:(CGFloat)gestureAngleX;

@end

#endif //SOURCE_ALIVRPLAYERDELEGATE_H
