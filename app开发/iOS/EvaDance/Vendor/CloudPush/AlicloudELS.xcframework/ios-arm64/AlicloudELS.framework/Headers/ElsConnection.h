//
//  ElsConnection.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsConnection_h
#define ElsConnection_h

#import <Foundation/Foundation.h>
#import <AlicloudELS/ElsConnectionLogLevel.h>
#import <AlicloudELS/ElsConnectionStatus.h>
#import <AlicloudELS/ElsAppEventType.h>
#import <AlicloudELS/ElsDeviceInfo.h>
#import <AlicloudELS/ElsMessage.h>
#import <AlicloudELS/ElsConnectionParameters.h>
#import <AlicloudELS/ElsConnectionStatusDelegate.h>
#import <AlicloudELS/ElsMessageReceiverDelegate.h>

NS_ASSUME_NONNULL_BEGIN

@interface ElsConnection : NSObject

@property (nonatomic, strong, readonly) ElsDeviceInfo *deviceInfo;

- (instancetype)initWithName:(NSString *)name
                  parameters:(ElsConnectionParameters *)parameters
              statusDelegate:(id<ElsConnectionStatusDelegate>)statusDelegate
             messageDelegate:(id<ElsMessageReceiverDelegate>)messageDelegate
                       error:(NSError **)error;

- (ElsMessage *)buildMessageWithBizId:(UInt8)bizId
                         data:(NSData *)data;

- (NSData *)sendBizMessageAndWaitForReplyWithMessage:(ElsMessage *)message
                                        writeTimeout:(UInt32)writeTimeout
                                         readTimeout:(UInt32)readTimeout
                                               error:(NSError **)error;

- (void)sendBizMessageAndWaitForAckWithMessage:(ElsMessage *)message
                                  writeTimeout:(UInt32)writeTimeout
                                   readTimeout:(UInt32)readTimeout
                                         error:(NSError **)error;

- (void)sendBizMessageWithoutResponseWithMessage:(ElsMessage *)message
                                    writeTimeout:(UInt32)writeTimeout
                                           error:(NSError **)error;

- (void)reportAppEventWithAppEvent:(ElsAppEventType)appEvent
                      writeTimeout:(UInt32)writeTimeout
                             error:(NSError **)error;

- (void)sendPingWithWriteTimeout:(UInt32)writeTimeout
                     readTimeout:(UInt32)readTimeout
                           error:(NSError **)error;

- (ElsConnectionStatus)getConnectionStatus;

- (void)shutdown;

@end

NS_ASSUME_NONNULL_END

#endif
