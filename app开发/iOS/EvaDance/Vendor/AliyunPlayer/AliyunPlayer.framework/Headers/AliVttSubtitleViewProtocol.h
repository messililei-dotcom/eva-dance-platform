//
//  AliSubtitleViewProtocol.h
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * 字幕视图协议
 * 定义字幕视图必须实现的基本接口
 */
@protocol AliVttSubtitleViewProtocol <NSObject>

@required

/**
 * 设置显示视图
 * @param view 显示视图指针，可以是 CALayer 或 UIView，传入 NULL 表示清理
 */
- (void)setView:(void * _Nullable)view;

/**
 * 清理所有字幕
 */
- (void)clearAll;

@end

NS_ASSUME_NONNULL_END
