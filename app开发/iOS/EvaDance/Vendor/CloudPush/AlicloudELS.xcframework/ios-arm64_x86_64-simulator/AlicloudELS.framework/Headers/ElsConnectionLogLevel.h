//
//  ElsConnectionLogLevel.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsConnectionLogLevel_h
#define ElsConnectionLogLevel_h

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, ElsConnectionLogLevel) {
    ElsConnectionLogLevelDebug = 0,
    ElsConnectionLogLevelInfo,
    ElsConnectionLogLevelWarn,
    ElsConnectionLogLevelError,
    ElsConnectionLogLevelNone
};

#endif /* ElsConnectionLogLevel_h */
