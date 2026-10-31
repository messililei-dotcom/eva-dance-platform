//
//  MPGerneralDefinition.h
//  CloudPushSDK
//
//  Created by junmo on 16/10/11.
//  Copyright © 2016年 aliyun.mobileService. All rights reserved.
//

#ifndef MPGerneralDefinition_h
#define MPGerneralDefinition_h

#import <Foundation/Foundation.h>
#import "CloudPushCallbackResult.h"

typedef void (^RetrierFailedCallback)();

typedef void (^CallbackHandler)(CloudPushCallbackResult * _Nonnull res);

// 保证回调存在且只求值一次；若当前为主线程，则异步切至全局队列避免阻塞 UI
#define safelyInvokeCallback(cb, arg) \
do { \
    __typeof__(cb) __mp_cb = (cb); \
    if (__mp_cb) { \
        __typeof__(arg) __mp_arg = (arg); \
        if ([NSThread isMainThread]) { \
            dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{ \
                __mp_cb(__mp_arg); \
            }); \
        } else { \
            __mp_cb(__mp_arg); \
        } \
    } \
} while (0)

typedef NS_ENUM(NSInteger, MPLogLevel) {
    MPLogLevelNone = 0,
    MPLogLevelError = 1,
    MPLogLevelWarn = 2,
    MPLogLevelInfo = 3,
    MPLogLevelDebug = 4
};

#endif /* MPGerneralDefinition_h */
