//
//  ElsConnectionStatusDelegate.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsConnectionStatusDelegate_h
#define ElsConnectionStatusDelegate_h

#import <Foundation/Foundation.h>

@protocol ElsConnectionStatusDelegate <NSObject>

- (void)onConnected;
- (void)onClosed:(NSString *)reason;
- (void)onDisconnected:(NSString *)reason;
- (void)onConnecting;

@end

#endif /* ElsConnectionStatusDelegate_h */
