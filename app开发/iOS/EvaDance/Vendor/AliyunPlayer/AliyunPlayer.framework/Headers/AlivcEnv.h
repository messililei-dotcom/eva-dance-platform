//
// Created by Geeker Aven on 2024/4/15.
//
#import <Foundation/Foundation.h>


OBJC_EXPORT
@interface AlivcEnv : NSObject

/**
 * @brief 环境定义
 *  ENV_DEFAULT 全球环境，基于上海
 *  ENV_CN 中国大陆
 *  ENV_SEA 海外环境，基于新加坡
 *  ENV_GLOBAL_OVERSEA (废弃)，同ENV_SEA
 *  Env_GLOBAL_DEFAULT (废弃)，同ENV_DEFAULT
 */
/**
 * Env define
 * ENV_DEFAULT : Global environment, base on Shanghai
 * ENV_CN : Chinese mainland.
 * ENV_SEA : Global environment, base on Singapo
 * ENV_GLOBAL_OVERSEA: （deprecated), replace with ENV_SEA
 * Env_GLOBAL_DEFAULT（deprecated), replace with ENV_DEFAULT
 */
typedef NS_ENUM(NSInteger, AlivcGlobalEnv) {
    AlivcGlobalEnv_DEFAULT = 0,
    AlivcGlobalEnv_CN __attribute__((deprecated)),
    AlivcGlobalEnv_SEA,
    AlivcGlobalEnv_GLOBAL_OVERSEA __attribute__((deprecated)),
    AlivcGlobalEnv_GLOBAL_DEFAULT __attribute__((deprecated))
};

/**
     * @brief 设置特定功能选项
     * @param key 选项key
     * @param value 选项的值
     * @return true:成功 false：失败
     */
    /****
     * @brief Set specific option
     * @param key key option
     * @param value value of key
     * @return true false
     */
- (BOOL) setOption:(NSString *)key value:(NSString *)value;

/**
 * 全球环境
 */
/****
 * GlobalEnv
 */
- (BOOL) setGlobalEnvironment:(AlivcGlobalEnv)env;

/**
 * 设置全球环境，同一进程中途不能修改，修改会发生错误
 * @param env 环境类型
 * @param error 错误信息
 * @return 设置成功，返回true，否则返回false；
 */
- (BOOL) setGlobalEnvironment:(AlivcGlobalEnv)env error:(NSError**)error;

- (AlivcGlobalEnv) globalEnvironment;

+ (instancetype)getInstance;

@end
