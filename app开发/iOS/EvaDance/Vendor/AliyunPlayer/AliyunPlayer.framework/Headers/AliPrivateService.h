//
//  AliPrivateService.h
//  AliPrivateService
//
//  Created by shiping.csp on 2018/11/16.
//  Copyright © 2018 com.alibaba.AliyunPlayer. All rights reserved.
//

#import <Foundation/Foundation.h>

OBJC_EXPORT
@interface AliPrivateService : NSObject

/**
 @brief 初始化下载秘钥信息
 @param datFile 秘钥文件的路径
 */
/****
 @brief Initialize the credential for downloading resources.
 @param datFile The path of the credential file.
 */
+ (void)initKey:(NSString*)datFile;

/**
 @brief 初始化下载秘钥信息
 @param data 秘钥文件的内容
 */
/****
 @brief Initialize the credential for downloading resources.
 @param data The data of the credential file.
 */
+ (void)initKeyWithData:(NSData*)data;

/**
 @brief  初始化证书服务
 @param key 用户拥有的licenseKey信息
 @param licensePath 本地证书路径
 @param storageDir  下载证书文件夹路径
 */
/****
 @brief Initialize the license service.
 @param key license key that user have
 @param licensePath local license file path
 @param storageDir  download license file folder path
 */
+ (void)initLicenseService;


/**
 * AVPPremiumBizType 枚举类型：定义高级功能类型。
 * @discussion 此枚举包含了不同的业务类型，用于识别高级功能模块。
 */
typedef enum AVPPremiumBizType: NSUInteger {
    /**
     * 未知业务类型
     */
    /****
     * Unknown business type
     */
    BizType_UNKNOW = 0,
    
    /**
     * 媒体加载器功能
     */
    /****
     * Media loader feature
     */
    MediaLoader = 1,
    
    /**
     * 预渲染选项功能
     */
    /****
     * Pre-render option feature
     */
    PreRenderOption = 102,
    
    /**
     * 专业版自适应码率策略
     */
    /****
     * Premium adaptive bitrate strategy
     */
    PremiumAbrStrategy = 103,
    
    /**
     * H.265自适应功能
     */
    /****
     * H.265 adaptive feature
     */
    H265Adaptive = 104,
    
    /**
     * DASH协议支持
     */
    /****
     * DASH protocol support
     */
    DashSupport = 105,
    
    /**
     * 扩展字幕功能
     */
    /****
     * Extended subtitle feature
     */
    EXTSubtitle = 108,
    
    /**
     * H.266编解码支持
     * @deprecated 此校验已弃用
     * H266功能推荐使用插件方式实现，参考文档：<a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features-1#22ac7377ebae9">H.266解码插件</a>
     * @see AliPlayerGlobalSettings::enableCodecPlugin
     */
    /****
     * H.266 codec support
     * @deprecated This check is deprecated
     * H266 feature recommend using plugin way, refer to document: <a href="https://help.aliyun.com/zh/vod/developer-reference/advanced-features-1#22ac7377ebae9">H.266 decode plugin</a>
     * @see AliPlayerGlobalSettings::enableCodecPlugin
     */
    H266Support = 109,
} AVPPremiumBizType;

/**
 * OnPremiumLicenseVerifyCallback 函数指针类型：高级功能验证回调。
 * @param type 高级功能类型
 * @param isValid 是否验证通过
 * @param errorMsg 错误信息（验证失败时返回）
 * @discussion 此回调用于验证指定的高级功能是否可用，并返回验证状态和错误信息。
 */
/****
 * OnPremiumLicenseVerifyCallback Function Pointer Type: Premium feature verification callback.
 * @param type Premium feature type.
 * @param isValid Whether the verification passed.
 * @param errorMsg Error message (returned when verification fails).
 * @discussion This callback verifies whether a specific premium feature is accessible and returns the status and error message.
 */
typedef void (*OnPremiumLicenseVerifyCallback)(AVPPremiumBizType type, bool isValid, NSString *errorMsg);


/**
 @brief  设置获取专业版License鉴权回调
 */
/****
 @brief Sets the callback to get the Premium license verification
 */
+ (void)setOnPremiumLicenseVerifyCallback:(OnPremiumLicenseVerifyCallback)callback;




@end

