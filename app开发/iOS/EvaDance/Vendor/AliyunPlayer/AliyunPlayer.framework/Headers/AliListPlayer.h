//
//  AliListPlayer.h
//  AliListPlayer
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "AliPlayer.h"
#import "AVPPreloadConfig.h"
OBJC_EXPORT
@interface AliListPlayer : AliPlayer

/**
 @brief 初始化播放列表
 */
/****
 @brief Initialize the playlist.
 */
- (instancetype)init;

/**
 @brief 初始化播放器
 @param traceID 用于跟踪debug信息
 */
/****
 @brief Initialize the player.
 @param traceID The trace ID for debugging.
 */
- (instancetype)init:(NSString*)traceID;

- (void)stop;

- (void)setOption:(PlayerOption)key valueInt:(int)value;

/**
 @brief 同步销毁播放器
 */
/****
 @brief Sync delete the player.
 */
- (void)destroy;

/**
 @brief 异步销毁播放器。暂不支持AliListPlayer，内部会转调destroy接口。
 */
/****
 @brief Async delete the player. Not support for AliListPlayer, will call destroy interface instead.
 */
- (void)destroyAsync;
/**
 @brief 添加资源到播放列表中
 @param vid vid的播放方式
 @param uid 该资源的uid，代表在列表中的唯一标识
 */
/****
 @brief Add a resource to the playlist.
 @param vid Specify a resource by VID.
 @param uid The UID of the resource, which uniquely identifies a resource.
 */
- (void) addVidSource:(NSString*)vid uid:(NSString*)uid;

/**
 @brief 添加资源到播放列表中
 @param url url的播放方式
 @param uid 该资源的uid，代表在列表中的唯一标识
 */
/****
 @brief Add a resource to the playlist.
 @param url Specify a resource by URL.
 @param uid The UID of the resource, which uniquely identifies a resource.
 */
- (void) addUrlSource:(NSString*)url uid:(NSString*)uid;

/**
 @brief 添加资源到播放列表中
 @param url url的播放方式
 @param uid 该资源的uid，代表在列表中的唯一标识
 @param config 预加载配置
 */
/****
 @brief Add a resource to the playlist.
 @param url Specify a resource by URL.
 @param uid The UID of the resource, which uniquely identifies a resource.
 @param config preload config
 */
- (void) addUrlSource:(NSString*)urlSource uid:(NSString*)uid config:(AVPPreloadConfig*)config;

/**
 * @brief 更新预加载配置
 * @param config 预加载配置, 详情：{@link AVPPreloadConfig}
 */
/****
 * update preload config
 * @param config preload config, see {@link AVPPreloadConfig}
 */
- (void) updatePreloadConfiguid:(NSString*)uid config:(AVPPreloadConfig*)config;

/**
 * @brief 设置预加载场景。
 * @param type 场景类型, 详见：{@link AVPSceneType}
 */
/****
 * Set preload scene.
 * @param type scene type, see {@link AVPSceneType}
 */
- (void) setScene:(AVPSceneType)type;

/**
 * 启用预加载策略。
 * @param type 策略类型, 详见：{@link AVPStrategyType}
 * @param enable 是否启用
 */
/****
 * enable preload strategy.
 * @param type strategy type, see {@link AVPStrategyType}
 * @param enable enable strategy
 */
- (void) enableStrategy:(AVPStrategyType)type enable:(bool)enable;

/**
 * @brief 设置策略参数。
 * @param type 策略类型，详见：{@link AVPStrategyType}
 * @param strategyParam 策略参数，格式为json字符串
 *                      支持参数：algorithm, offset, scale
 *                      配置参数举例：
 *                      动态预加载时长递减策略
 *                      默认配置
 *                      {
 *                         "algorithm":"sub",
 *                         "offset":"500"
 *                      }
 *                      转换成字符串为 "{\"algorithm\": \"div\",\"scale\": \"0.75\"}"
 *                      或者
 *                      {
 *                          "algorithm":"div",
 *                          "scale":"0.75"
 *                      }
 */
/****
 * @brief set strategy parameter.
 * @param type strategy type, see {@link AVPStrategyType}
 * @param strategyParam strategy parameter, type is json string
 *                      support param: algorithm, offset, scale
 *                      for example:
 *                      dynamic preload duration decrease strategy
 *                      default strategy
 *                      {
 *                         "algorithm":"sub",
 *                         "offset":"500"
 *                      }
 *                      transfer to string: "{\"algorithm\": \"div\",\"scale\": \"0.75\"}"
 *                      or
 *                      {
 *                          "algorithm":"div",
 *                          "scale":"0.75"
 *                      }
 */
- (void) setStrategyParam:(AVPStrategyType)type strategyParam:(NSString*)strategyParam;

/**
 * 更新uid相关的预加载配置
 * @param uid 每个url都是不一样的uid
 * @param config 预加载配置，详见{@link AVPPreloadConfig}
 */
/****
 * update preload config related to uid
 * @param uid each URL is a unique UID
 * @param config preload config, see {@link AVPPreloadConfig}
 */
- (void) updatePreloadConfig:(AVPPreloadConfig*)config;

/**
 * 设置预加载数量
 * @param prevCount 之前的预加载数量
 * @param nextCount 后面的预加载数量
 */
/****
 * update set preload count
 * @param prevCount previous preload count
 * @param nextCount next preload count
 */
- (void) setPreloadCount:(int)prevCount nextCount:(int)nextCount;

/**
 @brief 从播放列表中删除指定资源
 @param uid 该资源的uid，代表在列表中的唯一标识
 */
/****
 @brief Remove a resource from the playlist.
 @param uid The UID of the resource, which uniquely identifies a resource.
 */
- (void) removeSource:(NSString*)uid;

/**
 @brief 清除播放列表
 */
/****
 @brief Clear the playlist.
 */
- (void) clear;

/**
 @brief 获取当前播放资源的uid
 */
/****
 @brief Query the UID of the resource that is being played.
 */
- (NSString*) currentUid;

/**
 @brief 获取预渲染的播放器实例。listPlayer在播放当前视频时，会去预渲染下一个视频，用户可以用该预渲染的实例去提前播放下一个视频
 @deprecated
 */
- (AliPlayer*) getPreRenderPlayer
__attribute__((deprecated("PreRender related method are deprecated")));

/**
 @brief 获取当前的播放器实例。
 */
- (AliPlayer*) getCurrentPlayer;

/**
 @brief 当前位置移动到下一个进行准备播放,url播放方式
 @return 当前操作是否成功
 */
/****
 @brief Seek to the next resource and prepare for playback. Only playback by URL is supported.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToNext;

/**
 @brief 当前位置移动到下一个进行准备播放,url播放方式.该接口只在使用了预渲染的player（getPreRenderPlayer返回的player）去播放的时候去调用，listPlayer内部不再去播放
 @return 当前操作是否成功
 */
/****
 @brief Seek to the next resource and prepare for playback. Only playback by URL is supported.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToNextWithPrerendered
__attribute__((deprecated("PreRender related method are deprecated")));

/**
 @brief 当前位置移动到上一个进行准备播放,url播放方式
 @return 当前操作是否成功
 */
/****
 @brief Seek to the previous resource and prepare for playback. Only playback by URL is supported.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToPre;

/**
 @brief 移动到指定位置开始准备播放,url播放方式
 @param uid 指定资源的uid，代表在列表中的唯一标识
 @return 当前操作是否成功
 */
/****
 @brief Seek to the specified position and prepare for playback. Only playback by URL is supported.
 @param uid The UID of the specified resource, which uniquely identifies a resource.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveTo:(NSString*)uid;

/**
 @brief 当前位置移动到下一个进行准备播放，sts播放方式，需要更新sts信息
 @param accId vid sts播放方式的accessKeyID
 @param accKey vid sts播放方式的accessKeySecret
 @param token vid sts播放方式的securtiToken
 @param region vid sts播放方式的region 默认cn-shanghai
 @return 当前操作是否成功
 */
/****
 @brief Seek to the next resource and prepare for playback. Only playback by STS is supported. You must update the STS information.
 @param accId vid The AccessKey ID.
 @param accKey vid The AccessKey Secret.
 @param token vid The STS token.
 @param region vid The specified region. Default: cn-shanghai.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToNext:(NSString*)accId accKey:(NSString*)accKey token:(NSString*)token region:(NSString*)region;

/**
 @brief 当前位置移动到下一个进行准备播放，playauth播放方式，需要更新playauth信息
 @param playAuth vid playauth播放方式的playAuth
 @return 当前操作是否成功
 */
/****
 @brief Seek to the next resource and prepare for playback. Only playback by playauth is supported. You must update the playauth information.
 @param playAuth vid The playAuth ID.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToNext:(NSString*)playAuth;

/**
 @brief 当前位置移动到下一个进行准备播放，sts播放方式，需要更新sts信息.该接口只在使用了预渲染的player（getPreRenderPlayer返回的player）去播放的时候去调用，listPlayer内部不再去播放
 @param accId vid sts播放方式的accessKeyID
 @param accKey vid sts播放方式的accessKeySecret
 @param token vid sts播放方式的securtiToken
 @param region vid sts播放方式的region 默认cn-shanghai
 @param preRendered 是否使用了预渲染的player去播放，如果为true，则listPlayer内部不再去播放
 @return 当前操作是否成功
 */
/****
 @brief Seek to the next resource and prepare for playback. Only playback by STS is supported. You must update the STS information.
 @param accId vid The AccessKey ID.
 @param accKey vid The AccessKey Secret.
 @param token vid The STS token.
 @param region vid The specified region. Default: cn-shanghai.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToNextWithPrerendered:(NSString*)accId accKey:(NSString*)accKey token:(NSString*)token region:(NSString*)region
__attribute__((deprecated("PreRender related method are deprecated")));

/**
 @brief 当前位置移动到下一个进行准备播放，playauth播放方式，需要更新playauth信息.该接口只在使用了预渲染的player（getPreRenderPlayer返回的player）去播放的时候去调用，listPlayer内部不再去播放
 @param playAuth vid playauth播放方式的playAuth
 @return 当前操作是否成功
 */
/****
 @brief Seek to the next resource and prepare for playback. Only playback by playauth is supported. You must update the playauth information.
 @param playAuth vid The playAuth ID.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToNextWithPrerendered:(NSString*)playAuth
__attribute__((deprecated("PreRender related method are deprecated")));

/**
 @brief 当前位置移动到上一个进行准备播放，sts播放方式，需要更新sts信息
 @param accId vid sts播放方式的accessKeyID
 @param accKey vid sts播放方式的accessKeySecret
 @param token vid sts播放方式的securtiToken
 @param region vid sts播放方式的region 默认cn-shanghai
 @return 当前操作是否成功
 */
/****
 @brief Seek to the previous resource and prepare for playback. Only playback by STS is supported. You must update the STS information.
 @param accId vid The AccessKey ID.
 @param accKey vid The AccessKey Secret.
 @param token vid The STS token.
 @param region vid The specified region. Default: cn-shanghai.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToPre:(NSString*)accId accKey:(NSString*)accKey token:(NSString*)token region:(NSString*)region;

/**
 @brief 当前位置移动到上一个进行准备播放，playauth播放方式，需要更新playauth信息
 @param playAuth vid playauth播放方式的playAuth
 @return 当前操作是否成功
 */
/****
 @brief Seek to the previous resource and prepare for playback. Only playback by playauth is supported. You must update the playauth information.
 @param playAuth vid The playAuth ID.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveToPre:(NSString*)playAuth;
/**
 @brief 移动到指定位置开始准备播放，sts播放方式，需要更新sts信息
 @param uid 指定资源的uid，代表在列表中的唯一标识
 @param accId vid sts播放方式的accessKeyID
 @param accKey vid sts播放方式的accessKeySecret
 @param token vid sts播放方式的securtiToken
 @param region vid sts播放方式的region 默认cn-shanghai
 @return 当前操作是否成功
 */
/****
 @brief Seek to the specified resource and prepare for playback. Only playback by STS is supported. You must update the STS information.
 @param uid The UID of the specified resource, which uniquely identifies a resource.
 @param accId vid The AccessKey ID.
 @param accKey vid The AccessKey Secret.
 @param token vid The STS token.
 @param region vid The specified region. Default: cn-shanghai.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveTo:(NSString*)uid accId:(NSString*)accId accKey:(NSString*)accKey token:(NSString*)token region:(NSString*)region;

/**
 @brief 移动到指定位置开始准备播放，playauth播放方式，需要更新playauth信息
 @param uid 指定资源的uid，代表在列表中的唯一标识
 @param playAuth vid playauth播放方式的playAuth
 @return 当前操作是否成功
 @return Indicates whether the current operation succeeded.
 */
/****
 @brief Seek to the specified resource and prepare for playback. Only playback by playauth is supported. You must update the playauth information.
 @param uid The UID of the specified resource, which uniquely identifies a resource.
 @param playAuth vid The playAuth ID.
 @return Indicates whether the current operation succeeded.
 */
- (BOOL) moveTo:(NSString*)uid playAuth:(NSString*)playAuth;


/**
 @brief 设置多码率HLS流预加载模式
 @param mode为设置的预加载模式
 */
/****
 @brief SetMultiBitrate preload mode
 @param mode The MultiBitrate preload mode
 */
- (void) SetMultiBitratesMode:(AVPMultiBitratesMode)mode;

/**
 @brief 获取当前多码率HLS流预加载模式
 */
/****
 @brief Get current MultiBitrate preload mode
 */
- (AVPMultiBitratesMode) GetMultiBiratesMode;
/**
 @brief 设置最大的预缓存的内存大小，默认100M，最小20M
 */
/****
 @brief Set the maximum preloading cache size. Default: 100 MB. Minimum: 20 MB.
 */
@property (nonatomic, assign) int maxPreloadMemorySizeMB;


/**
 @brief 获取/设置预加载的个数，当前位置的前preloadCount和后preloadCount，默认preloadCount = 2
 */
/****
 @brief Query or set the number of preloaded resources. The number of resources before preloading and the number of resources after preloading are returned. Default: 2.
 */
@property (nonatomic, assign) int preloadCount;

/**
 @brief 获取/设置列表播放的sts播放方式，指定默认的清晰度，如"LD、HD"等，moveTo之前调用，一旦预加载后不能更改
 */
/****
 @brief Query or set the definition for playback by STS, such as LD or HD. Call this method before moveTo. After the resources are preloaded, you cannot change the definition.
 */
@property (nonatomic, copy) NSString* stsPreloadDefinition;

@property (nonatomic, copy) NSString* playAuthPreloadDefinition;

@end

