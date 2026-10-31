//
//  VidPlayerConfigGen.h
//  AliPlayerSDK
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#ifndef VidPlayerConfigGen_h
#define VidPlayerConfigGen_h

#import <Foundation/Foundation.h>

/**
 * @brief 用于生成点播播放时用到的playConfig参数，用于生成vid播放地址时，自定义播放参数，被用于{@link VidBaseSource::setPlayConfig}。详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 */
/****
 * @brief Used to generate playConfig parameters when generating vid play url. Be used in {@link VidBaseSource::setPlayConfig}. For details, see <a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 */
OBJC_EXPORT
@interface VidPlayerConfigGenerator : NSObject

/**
 @brief 设置预览时间
 @param previewTime 预览时间，单位为秒
 */
/****
 @brief Set the preview duration.
 @param previewTime The specified preview duration in seconds.
 */
-(void) setPreviewTime:(int)previewTime;

/**
 @brief HLS标准加密设置UriToken
 @param MtsHlsUriToken 字符串
 */
/****
 @brief Set a UriToken for HLS standard encryption.
 @param MtsHlsUriToken The UriToken.
 */
-(void) setHlsUriToken:(NSString*)MtsHlsUriToken;

/**
 @brief
 * 可用于添加其他config配置，透传至open api，详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 * 常见config已封装成api，如{@link VidPlayerConfigGenerator::setPreviewTime}、{@link VidPlayerConfigGenerator::setHlsUriToken}等
 * @param key: 对应playerConfig中的参数名字，更多参数详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 * @param value: 对应key参数的字符串值，更多参数详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 */
/****
 * @brief Add other config parameters to pass through to open api.
 * Common configs are already encapsulated as APIs, such as {@link #setPreviewTime}, {@link #setEncryptType}, {@link #setMtsHlsUriToken}, etc.
 *
 * @param key   Key，more info see <a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 * @param value String value，more info see <a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 */
-(void) addVidPlayerConfigByStringValue:(NSString*)key value:(NSString*)value;

/**
 @brief
 * 可用于添加其他config配置，透传至open api，详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 * 常见config已封装成api，如{@link VidPlayerConfigGenerator::setPreviewTime}、{@link VidPlayerConfigGenerator::setHlsUriToken}等
 * @param key: 对应playerConfig中的参数名字，更多参数详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 * @param value: 对应key参数的整数值，更多参数详见：<a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 */
/****
 * @brief Add other config parameters to pass through to open api.
 * Common configs are already encapsulated as APIs, such as {@link #setPreviewTime}, {@link #setEncryptType}, {@link #setMtsHlsUriToken}, etc.
 *
 * @param key   Key，more info see <a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 * @param value Int value，more info see <a href="https://help.aliyun.com/vod/developer-reference/api-vod-2017-03-21-getplayinfo">doc</a>
 */
-(void) addVidPlayerConfigByIntValue:(NSString*)key value:(int)value;


/**
 @brief 生成playerConfig，可用于后续{@link VidBaseSource::setPlayConfig}使用。
 @return JSON 字符串。
 */
/****
 @brief Generate playerConfig, can be used in  {@link VidBaseSource::setPlayConfig}.
 @return JSON string.
 */
-(NSString*) generatePlayerConfig;

@end

#endif /* VidPlayerConfigGen_h */
