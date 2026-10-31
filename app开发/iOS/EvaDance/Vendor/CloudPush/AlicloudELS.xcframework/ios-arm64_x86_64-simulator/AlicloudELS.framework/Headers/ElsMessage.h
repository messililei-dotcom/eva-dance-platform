//
//  ElsMessage.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsMessage_h
#define ElsMessage_h

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ElsMessage : NSObject

@property (nonatomic, readonly) UInt8 bizId;
@property (nonatomic, readonly) UInt32 msgId;
@property (nonatomic, strong, readonly) NSData *data;

- (instancetype)initWithBizId:(UInt8)bizId msgId:(UInt32)msgId data:(NSData *)data;

@end

NS_ASSUME_NONNULL_END

#endif
