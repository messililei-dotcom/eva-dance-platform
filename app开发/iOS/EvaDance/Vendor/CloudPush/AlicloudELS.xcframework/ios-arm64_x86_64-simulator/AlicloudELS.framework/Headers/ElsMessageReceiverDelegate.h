//
//  ElsMessageReceiverDelegate.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsMessageReceiverDelegate_h
#define ElsMessageReceiverDelegate_h

#import <Foundation/Foundation.h>
@class ElsMessage;

@protocol ElsMessageReceiverDelegate <NSObject>

/**
 Called when a message is received via the connection. This method can be asynchronous and
 may optionally return a response message. If a response message is returned, the connection
 will handle sending the response back to the sender.

 @param message The received `ElsMessage` instance.
 @return An optional `NSData` instance that will be sent as a response if not nil.
 */
- (nullable NSData *)onMessageReceived:(ElsMessage *_Nonnull)message;

@end

#endif /* ElsMessageReceiverDelegate_h */
