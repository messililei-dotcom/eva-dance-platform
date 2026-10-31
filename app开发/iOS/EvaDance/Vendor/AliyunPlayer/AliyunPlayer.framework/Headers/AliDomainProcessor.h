#import "AVPDef.h"
#import <Foundation/Foundation.h>

/**
 * 域名处理工具类，用于管理 HTTP DNS 相关的域名解析配置。
 *
 * <p>该类提供单例接口，用于添加预解析域名和增强型 HTTP DNS 域名。
 */
/****
 * Domain processing utility class for managing HTTP DNS-related domain resolution configurations.
 *
 * <p>This class provides a singleton interface for adding pre-resolution domains and enhanced HTTP DNS domains.
 */
OBJC_EXPORT
@interface AliDomainProcessor : NSObject

/**
 * 获取 AliDomainProcessor 的单例实例。
 *
 * @return AliDomainProcessor 的共享实例
 */
/****
 * Gets the singleton instance of AliDomainProcessor.
 *
 * @return The shared instance of AliDomainProcessor
 */
+ (instancetype)shareInstance;

/**
 * 开始 HTTP DNS 预解析。
 *
 * <p>该方法用于提前解析指定域名，以加速后续的网络请求。
 *
 * @param domain 视频 URL 对应的域名，例如：URL 为 https://cn.aliyun.com 时，对应的域名为 cn.aliyun.com
 */
/****
 * Starts HTTP DNS pre-resolution.
 *
 * <p>This method is used to pre-resolve the specified domain to accelerate subsequent network requests.
 *
 * @param domain The domain corresponding to the video URL, e.g., for URL https://cn.aliyun.com, the domain is cn.aliyun.com
 */
- (void)addPreResolveDomain:(NSString *)domain;

/**
 * 添加增强型 HTTP DNS 域名。
 *
 * <p>该方法用于将指定域名加入增强型 HTTP DNS 解析列表。
 *
 * <p><strong>已弃用</strong>：此 API 已不再需要，SDK 默认对阿里云 CDN 域名使用 HTTP DNS 解析。
 *
 * @param domain 视频 URL 对应的域名，例如：URL 为 https://cn.aliyun.com 时，对应的域名为 cn.aliyun.com
 * @deprecated 此功能已移除，无需调用此方法
 * @see [AliPlayerGlobalSettings enableEnhancedHttpDns:]
 */
/****
 * Adds an enhanced HTTP DNS domain.
 *
 * <p>This method adds the specified domain to the enhanced HTTP DNS resolution list.
 *
 * <p><strong>Deprecated</strong>: This API is no longer needed; the SDK uses HTTP DNS resolution by default for Alibaba Cloud CDN domains.
 *
 * @param domain The domain corresponding to the video URL, e.g., for URL https://cn.aliyun.com, the domain is cn.aliyun.com
 * @deprecated This feature has been removed; do not call this method
 * @see [AliPlayerGlobalSettings enableEnhancedHttpDns:]
 */
- (void)addEnhancedHttpDnsDomain:(NSString *)domain DEPRECATED_MSG_ATTRIBUTE("don't need use this API, we use httpdns to resolve domain default if domain belong to ali cdn");

@end
