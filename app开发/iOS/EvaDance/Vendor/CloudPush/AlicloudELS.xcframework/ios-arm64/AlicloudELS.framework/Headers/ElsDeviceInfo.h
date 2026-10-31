//
//  ElsDeviceInfo.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsDeviceInfo_h
#define ElsDeviceInfo_h

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ElsDeviceInfo : NSObject

@property (nonatomic, copy, readonly) NSString *osVersion;
@property (nonatomic, copy, readonly) NSString *brand;
@property (nonatomic, copy, readonly) NSString *model;
@property (nonatomic, copy, readonly) NSString *networkType;

- (instancetype)initWithOsVersion:(NSString *)osVersion
                            brand:(NSString *)brand
                            model:(NSString *)model
                      networkType:(NSString *)networkType;

@end

NS_ASSUME_NONNULL_END

#endif
