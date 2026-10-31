//
// Created by SuperMan on 2021/12/1.
//

#import <Foundation/Foundation.h>

/**
 @brief 滤镜选项配置类
 
 用于设置单个滤镜的参数选项。通过此类可配置滤镜的各种功能参数。
 */
/****
 @brief Filter options configuration class.
 
 Used to set parameter options for individual filters.
 Various filter parameters can be configured through this class.
 */
@interface AVPFilterOptions : NSObject

/**
 @brief 设置滤镜参数
 
 为滤镜设置指定的参数值。支持多种数据类型的参数。
 
 @param key 参数名称
 @param value 参数值，可为字符串、数字等类型
 */
/****
 @brief Set filter option.
 
 Sets the specified parameter value for the filter. Supports parameters of various data types.
 
 @param key Parameter name
 @param value Parameter value; can be string, number, and other types
 */
- (void)setOptions:(NSString *)key value:(NSObject *)value;

/**
 @brief 转换为JSON字符串
 
 将当前配置的滤镜选项转换为JSON格式字符串。
 
 @return JSON格式的字符串表示
 */
/****
 @brief Convert to JSON string.
 
 Converts the currently configured filter options to JSON format string.
 
 @return JSON format string representation
 */
- (NSString *)toJSONStr;

@end


/**
 @brief 滤镜类
 
 表示单个视频滤镜。通过指定滤镜目标和配置选项来创建和配置滤镜效果。
 */
/****
 @brief Filter class.
 
 Represents a single video filter. Creates and configures filter effects
 by specifying filter target and configuration options.
 */
@interface AVPFilter : NSObject

/**
 @brief 使用指定目标初始化滤镜
 
 创建一个特定类型的滤镜实例。目标名称标识滤镜的类型和功能。
 
 @param target 滤镜目标名称，标识滤镜的具体类型
 @return 初始化后的AVPFilter实例
 */
/****
 @brief Initialize filter with target.
 
 Creates an instance of a specific type of filter.
 The target name identifies the type and functionality of the filter.
 
 @param target Filter target name identifying the specific filter type
 @return Initialized AVPFilter instance
 */
- (instancetype)initWithTarget:(NSString *)target;

/**
 @brief 设置滤镜选项
 
 为此滤镜配置参数选项。通过 @link AVPFilterOptions @endlink 设置各种滤镜参数。
 
 @param options 滤镜选项配置对象
 @see AVPFilterOptions
 */
/****
 @brief Set filter options.
 
 Configures parameter options for this filter.
 Sets various filter parameters through @link AVPFilterOptions @endlink.
 
 @param options Filter options configuration object
 @see AVPFilterOptions
 */
- (void)setOptions:(AVPFilterOptions *)options;

/**
 @brief 设置滤镜处理顺序
 
 值越小越先处理。可用于控制多个滤镜的执行顺序，目前仅支持音频filter。
 
 @param order 处理顺序，负数靠前，正数靠后，默认0
 */
/****
 @brief Set filter processing order.
 
 Smaller values are processed first. Used to control the execution order of multiple filters. Only audio filter is supported currently.
 
 @param order Processing order, negative = first, positive = last, default 0
 */
- (void)setOrder:(int)order;

@end


/**
 @brief 滤镜配置类
 
 用于管理多个滤镜的配置。可添加多个滤镜组成滤镜链，实现复杂的视频效果。
 滤镜配置应在调用 @link AliPlayer::prepare @endlink 前设置。
 */
/****
 @brief Filter configuration class.
 
 Used to manage configuration of multiple filters. Can add multiple filters to form a filter chain
 for complex video effects. Filter configuration should be set before calling @link AliPlayer::prepare @endlink.
 */
@interface AVPFilterConfig : NSObject

/**
 @brief 添加滤镜
 
 向滤镜配置中添加一个滤镜。可多次调用此方法添加多个滤镜，形成滤镜链。
 
 @param filter 要添加的滤镜实例
 @see AVPFilter
 */
/****
 @brief Add filter.
 
 Adds a filter to the filter configuration. Can be called multiple times to add multiple filters,
 forming a filter chain.
 
 @param filter Filter instance to be added
 @see AVPFilter
 */
- (void)addFilter:(AVPFilter *)filter;

/**
 @brief 转换为JSON字符串
 
 将当前配置的所有滤镜转换为JSON格式字符串。用于序列化或持久化滤镜配置。
 
 @return JSON格式的字符串表示，包含所有已添加滤镜的配置
 */
/****
 @brief Convert to JSON string.
 
 Converts all currently configured filters to JSON format string.
 Used for serializing or persisting filter configuration.
 
 @return JSON format string representation containing configuration of all added filters
 */
- (NSString *)toJSONStr;

@end
