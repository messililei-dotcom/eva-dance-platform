//
//  ElsConnectionParameters.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsConnectionParameters_h
#define ElsConnectionParameters_h

#import <Foundation/Foundation.h>
#import <AlicloudELS/ElsConnectionLogLevel.h>

NS_ASSUME_NONNULL_BEGIN

@interface ElsConnectionParameters : NSObject

@property (nonatomic, readonly) NSString *host;
@property (nonatomic, readonly) int64_t appKey;
@property (nonatomic, readonly) NSString *appVersion;
@property (nonatomic, readonly) NSString *appSecret;
@property (nonatomic, readonly) NSString *bundleId;
@property (nonatomic, readonly) NSString *deviceId;
@property (nonatomic, readonly) ElsConnectionLogLevel logLevel;
@property (nonatomic, readonly) uint32_t connectTimeout;

- (instancetype)initWithHost:(NSString *)host
                      appKey:(int64_t)appKey
                  appVersion:(NSString *)appVersion
                   appSecret:(NSString *)appSecret
                    bundleId:(NSString *)bundleId
                    deviceId:(NSString *)deviceId
                    logLevel:(ElsConnectionLogLevel)logLevel
              connectTimeout:(uint32_t)connectTimeout;

@end

NS_ASSUME_NONNULL_END

#endif
