#ifndef AVPDrmDelegate_h
#define AVPDrmDelegate_h

#import <Foundation/Foundation.h>

@protocol AVPDrmDelegate <NSObject>

/**
 @brief 起播过程中请求Fairplay证书的回调方法。
 @param player 播放器player指针
 @return 证书数据，请参考Fairplay提供商文档实现证书数据的解析（如某些厂商会把证书内容包在json内）。
 */
/****
 @brief Callback method invoked during playback initialization to request the Fairplay certificate.
 @param player A pointer to the AliPlayer instance.
 @return The certificate data. Refer to the Fairplay provider's documentation for parsing the certificate content
         (e.g., some providers may encapsulate the certificate within a JSON object).
 */
- (NSData *)requestCert:(AliPlayer*)player;

/**
 @brief 起播过程中请求Fairplay密钥的回调方法。
 @param data: 请求Fairplay密钥的必要参数，请参考Fairplay提供商文档实现密钥的请求（如某些提供商会要求携带额外参数）。
 @return 该播放地址对应的解密密钥，请参考Fairplay提供商文档实现密钥的解析（如某些提供商会把密钥密钥内容包在json内）。
 */
/****
 @brief Callback method invoked during playback initialization to request the Fairplay content decryption key.
 @param player A pointer to the AliPlayer instance.
 @param data The necessary parameters for requesting the Fairplay key. Refer to the Fairplay provider's documentation for
             details on how to implement the key request (e.g., some providers may require additional parameters).
 @return The decryption key for the current playback URL. Refer to the Fairplay provider's documentation for parsing the
         key content (e.g., some providers may encapsulate the key within a JSON object).
 */
- (NSData *)requestKey:(AliPlayer*)player data:(NSData *)data;

@end

#endif /* AVPDrmDelegate_h */
