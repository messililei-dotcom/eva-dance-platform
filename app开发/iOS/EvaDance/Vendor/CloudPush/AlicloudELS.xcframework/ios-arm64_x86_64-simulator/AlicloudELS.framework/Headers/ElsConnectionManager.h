//
//  ElsConnectionManager.h
//  AlicloudELS
//
//  Created by 柳色 on 2024/9/5.
//

#ifndef ElsConnectionManager_h
#define ElsConnectionManager_h

#import <Foundation/Foundation.h>
#import <AlicloudELS/ElsConnection.h>

NS_ASSUME_NONNULL_BEGIN

@interface ElsConnectionManager : NSObject

@property (class, nonatomic, readonly) ElsConnectionManager *shared;

- (void)buildConnectionNamed:(NSString *)name
                  parameters:(ElsConnectionParameters *)parameters
              statusDelegate:(id<ElsConnectionStatusDelegate>)statusDelegate
             messageDelegate:(id<ElsMessageReceiverDelegate>)messageDelegate
                       error:(NSError **)error;

- (nullable ElsConnection *)getConnectionNamed:(NSString *)name;

- (void)closeConnectionNamed:(NSString *)name;

@end

NS_ASSUME_NONNULL_END

#endif
