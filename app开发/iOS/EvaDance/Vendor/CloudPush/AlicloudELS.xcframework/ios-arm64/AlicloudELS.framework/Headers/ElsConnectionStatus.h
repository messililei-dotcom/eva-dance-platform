//
//  ElsConnectionStatus.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsConnectionStatus_h
#define ElsConnectionStatus_h

#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, ElsConnectionStatus) {
    ElsConnectionStatusConnected,
    ElsConnectionStatusClosed,
    ElsConnectionStatusConnecting,
    ElsConnectionStatusDisconnected
};

#endif /* ElsConnectionStatus_h */
