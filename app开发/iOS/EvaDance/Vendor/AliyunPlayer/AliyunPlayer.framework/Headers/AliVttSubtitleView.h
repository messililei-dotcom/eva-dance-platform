//
//  AliVttSubtitleView.h
//  AliVttSubtitleView.mm
//
//  Created by liaoyixiao on 2025/10/15
//  Copyright © 2025 com.alibaba.AliyunPlayer. All rights reserved.
//



#import <Foundation/Foundation.h>

#if __has_include (<AliyunPlayer/AliyunPlayer.h>)
#import <AliyunPlayer/AliyunPlayer.h>
#else
#import "AVPDef.h"
#endif
#import "AVPConfig.h"

#import "AliVttSubtitleViewProtocol.h"

#pragma mark - VttShadow
/// 单层文本阴影（对应 CSS text-shadow 的一层）
OBJC_EXPORT
@interface AliVttShadow : NSObject
/// 水平偏移，px
@property (nonatomic, assign) int offsetX;
/// 垂直偏移，px（CSS 正值向下）
@property (nonatomic, assign) int offsetY;
/// 模糊半径，px
@property (nonatomic, assign) int blurRadius;
/// 颜色，ARGB 格式（高字节为 alpha）
@property (nonatomic, assign) int color;
@end

#pragma mark - VttCssStyle
OBJC_EXPORT
@interface AliVttCssStyle : NSObject

/// 样式唯一 ID
@property (nonatomic, copy) NSString *styleId;
/// 属性标志位（bitmask，见上面的常量）
@property (nonatomic, assign) int styleFlags;
/// 字体名称
@property (nonatomic, copy) NSString *fontName;
/// 模拟字体名称
@property (nonatomic, copy) NSString *moniFontName;
/// 字体大小百分比（与视频高度百分比相关）
@property (nonatomic, assign) double fontSizePercent;
/// 字体大小像素
@property (nonatomic, assign) int fontSizePx;
/// 字体大小 em 单位
@property (nonatomic, assign) double fontSizeEm;
/// 字体颜色（ARGB/XRGB int）
@property (nonatomic, assign) int fontColor;
/// 字体透明度
@property (nonatomic, assign) int fontAlpha;
/// 字距
@property (nonatomic, assign) int spacing;


/// 是否粗体
@property (nonatomic, assign) BOOL mBold;
/// 是否斜体
@property (nonatomic, assign) BOOL mItalic;
/// 描边颜色
@property (nonatomic, assign) int outlineColor;
/// 描边透明度
@property (nonatomic, assign) int outlineAlpha;
/// 描边宽度（px）
@property (nonatomic, assign) int outlineWidth;
/// 阴影颜色（镜像 shadows.firstObject，兼容单层旧逻辑）
@property (nonatomic, assign) int shadowColor;
/// 阴影透明度
@property (nonatomic, assign) int shadowAlpha;
/// 阴影宽度（px，镜像 shadows.firstObject.blurRadius）
@property (nonatomic, assign) int shadowWidth;
/// 多层阴影列表，按 CSS 声明顺序（首层绘制在最上）
@property (nonatomic, strong) NSArray<AliVttShadow *> *shadows;
/// 背景颜色
@property (nonatomic, assign) int backgroundColor;
/// 背景透明度
@property (nonatomic, assign) int backgroundAlpha;

// MARK: 换行枚举
typedef NS_ENUM(NSInteger, VttWrapStyle) {
    VttWrapStyleDefault = 0,    // 自动按单词或字符换行
    VttWrapStyleChar    = 1,    // 仅按字符换行
    VttWrapStyleNone    = 2,    // 不自动换行，只有显式换行
};
/// 换行方式
@property (nonatomic, assign) VttWrapStyle wrapInfo;
// MARK: 选择器相关
/// Style 选择器的 tagName
@property (nonatomic, copy) NSString *selectorTagName;
/// Style 选择器的 class 类名数组
@property (nonatomic, strong) NSArray<NSString *> *selectorClasses;
/// Style 选择器的属性字典
@property (nonatomic, strong) NSDictionary<NSString *, NSString *> *selectorAttributes;
/// Style 选择器的伪元素
@property (nonatomic, copy) NSString *selectorPseudoElement;
/// Style 选择器的伪类数组
@property (nonatomic, strong) NSArray<NSString *> *selectorPseudoClasses;
/// 选择器是否有效
@property (nonatomic, assign) BOOL selectorValid;
@end


#pragma mark - VttRegion
OBJC_EXPORT
@interface AliVttRegion : NSObject
/// 区域唯一标识
@property (nonatomic, copy) NSString *regionId;
/// 区域宽度百分比（如 62.5 表示 62.5%）
@property (nonatomic, assign) double width;
/// 行数（如 36）
@property (nonatomic, assign) NSInteger lines;
/// 最大滚动行数
@property (nonatomic, assign) NSInteger lineMaxScroll;
/// 区域锚点横向百分比（0~100）
@property (nonatomic, assign) double regionAnchorX;
/// 区域锚点纵向百分比（0~100）
@property (nonatomic, assign) double regionAnchorY;
/// 视窗锚点横向百分比（0~100）
@property (nonatomic, assign) double viewportAnchorX;
/// 视窗锚点纵向百分比（0~100）
@property (nonatomic, assign) double viewportAnchorY;
/// 滚动类型（如 @"up"）
@property (nonatomic, copy) NSString *scroll;
@end

#pragma mark - WebVttHeader
OBJC_EXPORT
@interface AliWebVttHeader : NSObject

/// 默认样式
@property (nonatomic, strong) AliVttCssStyle *defaultStyle;
/// 样式 Map（styleId -> VttCssStyle）
@property (nonatomic, strong) NSDictionary<NSString *, AliVttCssStyle *> *styleMap;
/// 区域 Map（regionId -> VttRegion）
@property (nonatomic, strong) NSDictionary<NSString *, AliVttRegion *> *regionMap;

@end




#pragma mark - AliAliVttDialogueObj
/**
 @brief 字幕对话框对象，封装单个字幕条目的显示信息
 
 该类管理单个字幕条目的显示层和索引信息，用于字幕的渲染和管理。
 */
/****
 @brief Subtitle dialogue object that encapsulates display information for a single subtitle entry
 
 This class manages the display layer and index information of a single subtitle entry for subtitle rendering and management.
 */
OBJC_EXPORT
@interface AliVttDialogueObj : NSObject

/// 字幕字符串数据
/// Subtitle data
@property (nonatomic, copy) NSString *data;

/// 字幕条目的唯一索引标识
/// Unique index identifier for the subtitle entry
@property(nonatomic, assign) NSInteger index;

/// 用于渲染字幕文本的CATextLayer图层
/// CATextLayer for rendering subtitle text
@property(nonatomic,strong) CATextLayer *layer;


/**
 @brief 获取当前对话框对象的渲染图层
 @return 返回用于显示字幕的CATextLayer对象
 */
/****
 @brief Get the rendering layer of the current dialogue object
 @return Returns CATextLayer object for subtitle display
 */
- (CATextLayer*) getLayer;
@end


#pragma mark - VttContentAttribute
/**
 @brief VTT字幕内容属性类，封装字幕文本的样式和显示属性
 
 该类包含了字幕文本的所有样式信息，包括字体、颜色、大小、装饰效果等。
 支持WebVTT标准的各种样式属性。
 */
/****
 @brief VTT subtitle content attribute class that encapsulates style and display properties of subtitle text
 
 This class contains all style information for subtitle text, including font, color, size, decoration effects, etc.
 Supports various style attributes of the WebVTT standard.
 */
OBJC_EXPORT
@interface VttContentAttribute : NSObject
/// 字幕显示的文本内容
/// Text content for subtitle display
@property (nonatomic, copy) NSString *text;
/// 应用于该文本的样式ID数组，对应WebVTT中的CSS样式类
/// Array of style IDs applied to this text, corresponding to CSS style classes in WebVTT
@property (nonatomic, strong) NSMutableArray<NSString *> *styleIds;
/// 样式标志位，用于标识哪些样式属性已被设置（位掩码）
/// Style flags to identify which style attributes have been set (bitmask)
@property (nonatomic, assign) int styleFlags;
/// 字体名称，如 "Arial", "Helvetica" 等
/// Font name, such as "Arial", "Helvetica", etc.
@property (nonatomic, copy) NSString *fontName;
/// 备用字体名称，当主字体不可用时使用
/// Fallback font name when the main font is unavailable
@property (nonatomic, copy) NSString *moniFontName;
/// 字体大小，单位为像素(px)
/// Font size in pixels (px)
@property (nonatomic, assign) double fontSizePx;
/// 主要文本颜色，ARGB格式的32位整数 (如 0xFFFFFFFF 表示白色)
/// Primary text color, 32-bit integer in ARGB format (e.g., 0xFFFFFFFF for white)
@property (nonatomic, assign) int mPrimaryColour;
/// 辅助颜色，较少使用，保留用于特殊效果
/// Secondary color, rarely used, reserved for special effects
@property (nonatomic, assign) int mSecondaryColour;
/// 是否应用粗体样式
/// Whether to apply bold style
@property (nonatomic, assign) BOOL mBold;
/// 是否应用斜体样式
/// Whether to apply italic style
@property (nonatomic, assign) BOOL mItalic;
/// 是否显示下划线
/// Whether to show underline
@property (nonatomic, assign) BOOL mUnderline;
/// 文本描边颜色，ARGB格式
/// Text outline color in ARGB format
@property (nonatomic, assign) int mOutlineColour;
/// 文本描边宽度，单位为像素(px)
/// Text outline width in pixels (px)
@property (nonatomic, assign) int mOutlineWidthPx;
/// 文本阴影颜色，ARGB格式
/// Text shadow color in ARGB format
@property (nonatomic, assign) int mShadowColor;
/// 文本阴影宽度，单位为像素(px)。镜像 mShadows.firstObject.blurRadius
/// Text shadow width in pixels (px)
@property (nonatomic, assign) int mShadowWidthPx;
/// 多层阴影列表，按 CSS 声明顺序（首层绘制在最上）
/// Multi-layer text shadows, in CSS declaration order (first paints on top)
@property (nonatomic, strong) NSArray<AliVttShadow *> *mShadows;
/// 文本背景颜色，ARGB格式
/// Text background color in ARGB format
@property (nonatomic, assign) int mBackColour;
/// 是否显示删除线（中划线）
/// Whether to show strikethrough (line-through)
@property (nonatomic, assign) BOOL mStrikeOut;
/// 边框样式类型（保留属性，用于未来扩展）
/// Border style type (reserved property for future extension)
@property (nonatomic, assign) int mBorderStyle;
@end


#pragma mark - AliVttSubtitleConst

/**
 @brief 字幕渲染全局常量配置类
 
 提供字幕渲染的默认配置参数，支持自定义扩展。
 客户端可以继承此类并重写相应方法来自定义字幕显示效果。
 */
/****
 @brief Global constant configuration class for subtitle rendering
 
 Provides default configuration parameters for subtitle rendering with support for custom extensions.
 Clients can inherit this class and override corresponding methods to customize subtitle display effects
 Supports various style attributes of the WebVTT standard.
 */
@interface AliVttSubtitleConst : NSObject
/**
 @brief 默认字体大小
 @return 字体大小，单位为像素，默认值为20
 @note 该值影响字幕文本的基础显示尺寸
 */
/****
 @brief Default font size
 @return Font size in pixels, default value is 20
 @note This value affects the basic display size of subtitle text
 */
@property (class, nonatomic, readonly) NSInteger defaultFontSize;
/**
 @brief 默认行高占视频高度的比例
 @return 行高比例，默认值为0.0533（约5.33%）
 @note 用于计算字幕行间距和垂直布局
 */
/****
 @brief Default line height ratio to video height
 @return Line height ratio, default value is 0.0533 (approximately 5.33%)
 @note Used for calculating subtitle line spacing and vertical layout
 */
@property (class, nonatomic, readonly) CGFloat defaultLineHeightVH;
/**
 @brief 默认最大显示行数
 @return 最大行数，默认值为18
 @note 防止字幕内容溢出显示区域
 */
/****
 @brief Default maximum number of display lines
 @return Maximum number of lines, default value is 18
 @note Prevents subtitle content from overflowing the display area
 */
@property (class, nonatomic, readonly) NSInteger defaultLineCount;
/**
 @brief 字幕最大宽度占视频宽度的比例
 @return 宽度比例，默认值为0.7（70%）
 @note 用于控制字幕文本的换行和水平布局约束
 */
/****
 @brief Maximum subtitle width ratio to video width
 @return Width ratio, default value is 0.7 (70%)
 @note Used to control subtitle text wrapping and horizontal layout constraints
 */
@property (class, nonatomic, readonly) CGFloat defaultMaxShowingWidthFactor;
/**
 @brief 文本内边距大小
 @return 内边距，单位为像素，默认值为2.0
 @note 防止文本在边界处被截断
 */
/****
 @brief Text padding size
 @return Padding in pixels, default value is 2.0
 @note Prevents text from being truncated at boundaries
 */
@property (class, nonatomic, readonly) CGFloat defaultWidthPaddingSize;
/**
 @brief 复杂字符额外高度系数
 @return 高度系数，默认值为0.3（30%）
 @note 用于泰文、中文等复杂字符的显示，防止上下标被截断
 */
/****
 @brief Extra height coefficient for complex characters
 @return Height coefficient, default value is 0.3 (30%)
 @note Used for displaying complex characters like Thai and Chinese, preventing superscripts and subscripts from being truncated
 */
@property (class, nonatomic, readonly) CGFloat defaultExtraHeightFactor;
/**
 @brief 默认字体颜色
 @return ARGB格式颜色值，默认为0xFFFFFFFF（白色）
 */
/****
 @brief Default font color
 @return Color value in ARGB format, default is 0xFFFFFFFF (white)
 */
@property (class, nonatomic, readonly) NSInteger defaultFontColor;
/**
 @brief 默认字体名称
 @return 字体名称，默认为"Arial"
 @note 当CSS样式中未指定字体时使用此默认值
 */
/****
 @brief Default font name
 @return Font name, default is "Arial"
 @note Used as default when no font is specified in CSS styles
 */
@property (class, nonatomic, readonly) NSString *defaultFontName;
/**
 @brief 斜体伪类标识符
 @return 伪类字符串，默认为"i"
 @note 用于WebVTT样式解析中的斜体标记
 */
/****
 @brief Italic pseudo-class identifier
 @return Pseudo-class string, default is "i"
 @note Used for italic markup in WebVTT style parsing
 */
@property (class, nonatomic, readonly) NSString *pseudoClassItalic;
/**
 @brief 粗体伪类标识符
 @return 伪类字符串，默认为"b"
 @note 用于WebVTT样式解析中的粗体标记
 */
/****
 @brief Bold pseudo-class identifier
 @return Pseudo-class string, default is "b"
 @note Used for bold markup in WebVTT style parsing
 */
@property (class, nonatomic, readonly) NSString *pseudoClassBold;
@end


#pragma mark - VttLocationAttribute
// MARK: 对齐枚举
/// 文本对齐方式，取值与 native `webvtt_align_e` 完全一致
/// Text alignment, values identical to native `webvtt_align_e`
typedef NS_ENUM(NSInteger, AVPVttAlign) {
    AVPVttAlignInvalid  = -1,   // 未设置
    AVPVttAlignAuto     = 0,    // auto
    AVPVttAlignLeft     = 1,    // left
    AVPVttAlignCenter   = 2,    // center
    AVPVttAlignRight    = 3,    // right
    AVPVttAlignStart    = 4,    // start
    AVPVttAlignEnd      = 5,    // end
    AVPVttAlignToCenter = 6,    // 越界回退居中
};
/**
 @brief VTT字幕位置属性类
 
 封装字幕在屏幕上的位置、对齐方式、边距和变换信息。
 支持WebVTT标准的位置控制功能。
 */
/****
 @brief VTT subtitle location attribute class
 
 Encapsulates position, alignment, margin, and transformation information of subtitles on screen.
 Supports position control features of the WebVTT standard.
 */
OBJC_EXPORT
@interface VttLocationAttribute : NSObject
/// X坐标位置，单位为像素
/// X coordinate position in pixels
@property (nonatomic, assign) double posX;
/// Y坐标位置，单位为像素
/// Y coordinate position in pixels
@property (nonatomic, assign) double posY;
/// 已废弃：请改用 align（AVPVttAlign）。此字段为 int，取值不保证与 native 一致，保留仅为兼容旧接入方。
/// Deprecated: use `align` (AVPVttAlign) instead. This int field is not guaranteed to match native values; kept only for backward compatibility.
@property (nonatomic, assign) int mAlignment DEPRECATED_MSG_ATTRIBUTE("Use align (AVPVttAlign)");
/// 文本对齐方式（native 忠实值），取值见 AVPVttAlign（与 native webvtt_align_e 一致）；业务方请优先读此字段
/// Text alignment (native-faithful), see AVPVttAlign (identical to native webvtt_align_e); prefer this over mAlignment
@property (nonatomic, assign) AVPVttAlign align;
/// 左边距，单位为像素
/// Left margin in pixels
@property (nonatomic, assign) int marginL;
/// 右边距，单位为像素
/// Right margin in pixels
@property (nonatomic, assign) int marginR;
/// 垂直边距，单位为像素
/// Vertical margin in pixels
@property (nonatomic, assign) int marginV;
/// 水平缩放比例，1.0为原始大小
/// Horizontal scale ratio, 1.0 is original size
@property (nonatomic, assign) double mScaleX;
/// 垂直缩放比例，1.0为原始大小
/// Vertical scale ratio, 1.0 is original size
@property (nonatomic, assign) double mScaleY;
/// 旋转角度，单位为度
/// Rotation angle in degrees
@property (nonatomic, assign) double mAngle;
/// cue `size` 的数值（如 size:18% 则为 18）。仅透传解析结果，SDK 渲染不使用；未设置时为 0
/// Numeric value of cue `size` (e.g. 18 for size:18%). Pass-through only, not used by rendering; 0 when unset
@property (nonatomic, assign) double mSizeValue;
/// cue `size` 数值的类型：-1=未设置, 0=百分比, 1=px, 2=行号（对应 webvtt_value_type_e）
/// Type of cue `size` value: -1=invalid, 0=percentage, 1=px, 2=line number (webvtt_value_type_e)
@property (nonatomic, assign) int mSizeType;
/// 已废弃：返回值(1/2/3)与 mAlignment 实际存储值不一致，请改用 AVPVttAlign 枚举。
/// Deprecated: return values (1/2/3) do not match what mAlignment actually stores. Use AVPVttAlign.
+ (int)ALIGN_START DEPRECATED_MSG_ATTRIBUTE("Use AVPVttAlignStart");
+ (int)ALIGN_CENTER DEPRECATED_MSG_ATTRIBUTE("Use AVPVttAlignCenter");
+ (int)ALIGN_END DEPRECATED_MSG_ATTRIBUTE("Use AVPVttAlignEnd");
@end


#pragma mark - RenderContext
/**
 @brief 字幕渲染上下文
 
 封装字幕渲染过程中需要的各种尺寸和位置信息，用于在渲染管线中传递计算结果。
 */
/****
 @brief Subtitle rendering context
 
 Encapsulates various size and position information needed during subtitle rendering, used to pass calculation results in the rendering pipeline.
 */
@interface RenderContext : NSObject
/// 父视图的尺寸（容器大小）
/// Parent view size (container size)
@property (nonatomic, assign) CGSize parentSize;
/// 视频内容的显示尺寸
/// Display size of video content
@property (nonatomic, assign) CGSize videoDisplaySize;
/// 字幕文本的显示尺寸
/// Display size of subtitle text
@property (nonatomic, assign) CGSize textDisplaySize;
/// 字幕文本的最大允许宽度
/// Maximum allowed width of subtitle text
@property (nonatomic, assign) CGFloat maxTextWidth;
/// 字幕文本的X坐标位置
/// X coordinate position of subtitle text
@property (nonatomic, assign) CGFloat textX;
/// 字幕文本的Y坐标位置
/// Y coordinate position of subtitle text
@property (nonatomic, assign) CGFloat textY;
/// 视频显示区域相对于父视图的X偏移
/// X offset of video display area relative to parent view
@property (nonatomic, assign) CGFloat videoOffsetX;
/// 视频显示区域相对于父视图的Y偏移
/// Y offset of video display area relative to parent view
@property (nonatomic, assign) CGFloat videoOffsetY;
/// 内容缩放比例（像素到点的转换比例）
/// Content scale ratio (pixel to point conversion ratio)
@property (nonatomic, assign) CGFloat contentsScale;
/// 多层阴影渲染所需的边距（点）。为容纳阴影的偏移与模糊，图层需在文本尺寸基础上四周扩展。
/// Padding (points) needed to fit multi-layer shadows (offset + blur) around the text.
@property (nonatomic, assign) UIEdgeInsets shadowPadding;
@end




#pragma mark - AliVttRenderImpl

/**
 @brief VTT字幕渲染实现类
 
 核心渲染引擎，负责字幕的解析、样式应用、布局计算和显示。
 支持WebVTT标准的各种特性，包括样式、位置、区域等。
 @note 该类可以被继承以实现自定义的渲染逻辑
 */
/****
 @brief VTT subtitle rendering implementation class
 
 Core rendering engine responsible for subtitle parsing, style application, layout calculation, and display.
 Supports various features of the WebVTT standard, including styles, positions, regions, etc.
 @note This class can be inherited to implement custom rendering logic
 */
OBJC_EXPORT
@interface AliVttRenderImpl : NSObject

/// 管理的字幕对话框对象数组
/// Array of managed subtitle dialogue objects
@property(nonatomic,strong)  NSMutableArray *dialogueArr;

/// 字幕渲染的父图层
/// Parent layer for subtitle rendering
@property(nonatomic, strong) CALayer *mLayer;

/// 视频显示区域宽度，单位为点(point)
/// Video display area width in points
@property(nonatomic, assign) float mVideoDisPlayWidthPoint;

/// 视频显示区域高度，单位为点(point)
/// Video display area height in points
@property(nonatomic, assign) float mVideoDisPlayHeightPoint;

/// 内容缩放比例 (pixels / contentsScale = points)
/// Content scale ratio (pixels / contentsScale = points)
@property(nonatomic, assign) float mContentsScale;

/// 全局常量类，所有实例共享
/// Global constant class shared by all instances
@property (nonatomic, class) Class constClass;


/**
 @brief 初始化渲染器，设置父图层
 @param view 用于显示字幕的CALayer对象
 @note 该方法会自动切换到主线程执行，确保UI操作的线程安全
 */
/****
 @brief Initialize renderer and set parent layer
 @param view CALayer object for displaying subtitles
 @note This method automatically switches to main thread for UI operation thread safety
 */
- (void) setup:(CALayer *)view;



/**
 @brief 清除所有字幕显示内容
 @note 移除所有图层并清空对话框数组
 */
/****
 @brief Clear all subtitle display content
 @note Remove all layers and clear dialogue array
 */
- (void) clear;


/**
 @brief 获取VTT头部信息
 @return AliWebVttHeader对象，如果未设置则返回nil
 */
/****
 @brief Get VTT header information
 @return AliWebVttHeader object, returns nil if not set
 */
- (nullable AliWebVttHeader *)getVttHeader;


/**
 @brief 设置VTT头部信息
 @param header VTT头部字符串，包含样式和区域定义
 */
/****
 @brief Set VTT header information
 @param header VTT header string containing style and region definitions
 */
- (void) setVttHeader:(NSString*)header;

/**
 @brief 显示指定索引的字幕
 @param data 字幕数据字符串
 @param index 字幕索引
 */
/****
 @brief Show subtitle at specified index
 @param data Subtitle data string
 @param index Subtitle index
 */
- (void) showDialogue:(NSString*)data atIndex:(int)index;


/**
 @brief 隐藏指定索引的字幕
 @param data 字幕数据字符串
 @param index 字幕索引
 */
/****
 @brief Hide subtitle at specified index
 @param data Subtitle data string
 @param index Subtitle index
 */
- (void) hideDialogue:(NSString*)data atIndex:(int)index;


/**
 @brief 更新视频显示信息
 @param videoWidth 视频宽度，单位为像素
 @param videoHeight 视频高度，单位为像素
 @param mode 视频缩放模式
 */
/****
 @brief Update video display information
 @param videoWidth Video width in pixels
 @param videoHeight Video height in pixels
 @param mode Video scaling mode
 */
- (void) updateVideoDisPlay:(int)videoWidth height:(int)videoHeight scaleMode:(AVPScalingMode)mode;


/**
 @brief 初始化字幕对话框对象
 @param obj 字幕对话框对象的双重指针，用于返回创建或复用的对象
 @param index 字幕索引
 @note 如果传入的对象为空，会创建新对象；否则复用现有对象
 */
/****
 @brief Initialize subtitle dialogue object
 @param obj Double pointer to dialogue object for returning created or reused object
 @param index Subtitle index
 @note Creates new object if passed object is nil; otherwise reuses existing object
 */
- (void)initialDialogueObj:(AliVttDialogueObj**)obj index:(NSUInteger) index;


#pragma mark - Rendering Pipeline
/**
 @brief 渲染字幕内容的主要方法
 @param dialogueObj 字幕对话框对象
 @param contentAttributes 内容属性数组
 @param locationAttribute 位置属性
 @note 这是渲染管线的入口方法，协调各个渲染步骤
 */
/****
 @brief Main method for rendering subtitle content
 @param dialogueObj Subtitle dialogue object
 @param contentAttributes Content attributes array
 @param locationAttribute Location attribute
 @note This is the entry method of rendering pipeline, coordinating various rendering steps
 */
- (void)renderSubtitleContent:(AliVttDialogueObj *)dialogueObj
             contentAttributes:(NSArray<VttContentAttribute *> *)contentAttributes
             locationAttribute:(VttLocationAttribute *)locationAttribute;



/**
 @brief 准备渲染上下文
 @return 初始化的渲染上下文对象
 @note 计算父视图、视频显示区域等基础信息
 */
/****
 @brief Prepare rendering context
 @return Initialized rendering context object
 @note Calculates basic information like parent view, video display area, etc.
 */
- (RenderContext *)prepareRenderContext;


/**
 @brief 创建样式化的富文本
 @param contentAttributes 内容属性数组
 @param dialogueObj 字幕对话框对象
 @param context 渲染上下文的双重指针
 @return 创建的NSAttributedString对象
 @note 同时会设置背景颜色和计算文本尺寸
 */
/****
 @brief Create styled attributed text
 @param contentAttributes Content attributes array
 @param dialogueObj Subtitle dialogue object
 @param context Double pointer to rendering context
 @return Created NSAttributedString object
 @note Also sets background color and calculates text size
 */
- (NSAttributedString *)createStyledText:(NSArray<VttContentAttribute *> *)contentAttributes dialogueObj:(AliVttDialogueObj *)dialogueObj withContext:(RenderContext**) context;


/**
 @brief 计算实际文本尺寸
 @param styleStr 样式化的文本字符串
 @param dialogueObj 字幕对话框对象
 @param context 渲染上下文
 */
/****
 @brief Calculate actual text size
 @param styleStr Styled text string
 @param dialogueObj Subtitle dialogue object
 @param context Rendering context
 */
- (void) getActualTextSize:(NSAttributedString *)styleStr dialogue:(AliVttDialogueObj *)dialogueObj withContext:(RenderContext *)context;


/**
 @brief 计算字幕显示位置
 @param locationAttribute 位置属性
 @param context 渲染上下文
 @note 根据位置属性和默认规则计算最终的x,y坐标
 */
/****
 @brief Calculate subtitle display position
 @param locationAttribute Location attribute
 @param context Rendering context
 @note Calculates final x,y coordinates based on location attributes and default rules
 */
- (void) getActualTextPositions:(VttLocationAttribute*) locationAttribute withContext:(RenderContext *)context;



/**
 @brief 应用图层设置
 @param dialogueObj 字幕对话框对象
 @param styleStr 样式化文本
 @note 设置对齐方式、换行等CATextLayer属性
 */
/****
 @brief Apply layer settings
 @param dialogueObj Subtitle dialogue object
 @param styleStr Styled text
 @note Sets alignment, wrapping and other CATextLayer properties
 */
- (void) applyLayerSetting:(AliVttDialogueObj*) dialogueObj styleStr:(NSAttributedString *)styleStr shadowImage:(UIImage *)shadowImage;

/**
 @brief 实际显示字幕
 @param dialogueObj 字幕对话框对象
 @param context 渲染上下文
 @note 设置最终的frame并显示图层
 */
/****
 @brief Actually display subtitle
 @param dialogueObj Subtitle dialogue object
 @param context Rendering context
 @note Sets final frame and displays layer
 */
- (void) actualShow:(AliVttDialogueObj*) dialogueObj withContext:(RenderContext *)context;



#pragma mark - Text Styling Methods


/**
 @brief 创建单个文本段的样式化字符串
 @param contentAttribute 内容属性
 @param context 渲染上下文的双重指针
 @return 样式化的文本段
 */
/****
 @brief Create styled string for single text segment
 @param contentAttribute Content attribute
 @param context Double pointer to rendering context
 @return Styled text segment
 */
- (NSAttributedString *)createStyledTextSegment:(VttContentAttribute *)contentAttribute
                                        context:(RenderContext **)context;

/**
 @brief 应用文本颜色样式
 @param attrs 属性字典
 @param contentAttribute 内容属性
 */
/****
 @brief Apply text color style
 @param attrs Attributes dictionary
 @param contentAttribute Content attribute
 */
- (void)applyColorStyle:(NSMutableDictionary *)attrs contentAttribute:(VttContentAttribute *)contentAttribute;


/**
 @brief 应用背景颜色样式
 @param dialogueObj 字幕对话框对象
 @param contentAttribute 内容属性
 */
/****
 @brief Apply background color style
 @param dialogueObj Subtitle dialogue object
 @param contentAttribute Content attribute
 */
- (void)applyBackgroundColorStyle:(AliVttDialogueObj*)dialogueObj contentAttribute:(VttContentAttribute *)contentAttribute;

/**
 @brief 应用文本装饰样式（下划线、删除线等）
 @param attrs 属性字典
 @param contentAttribute 内容属性
 */
/****
 @brief Apply text decoration styles (underline, strikethrough, etc.)
 @param attrs Attributes dictionary
 @param contentAttribute Content attribute
 */
- (void)applyDecorationStyle:(NSMutableDictionary *)attrs contentAttribute:(VttContentAttribute *)contentAttribute;

/**
 @brief 应用描边和阴影效果
 @param attrs 属性字典
 @param contentAttribute 内容属性
 @param context 渲染上下文
 */
/****
 @brief Apply stroke and shadow effects
 @param attrs Attributes dictionary
 @param contentAttribute Content attribute
 @param context Rendering context
 */
- (void)applyStrokeAndShadow:(NSMutableDictionary *)attrs contentAttribute:(VttContentAttribute *)contentAttribute context:(RenderContext *)context;

/**
 @brief 应用字体样式
 @param attrs 属性字典
 @param contentAttribute 内容属性
 @param context 渲染上下文
 */
/****
 @brief Apply font style
 @param attrs Attributes dictionary
 @param contentAttribute Content attribute
 @param context Rendering context
 */
- (void)applyFontStyle:(NSMutableDictionary *)attrs contentAttribute:(VttContentAttribute *)contentAttribute context:(RenderContext *)context;


/**
 @brief 生成指定样式的字体
 @param fontName 字体名称
 @param fontSize 字体大小
 @param isBold 是否粗体
 @param isItalic 是否斜体
 @return 生成的UIFont对象
 */
/****
 @brief Generate font with specified style
 @param fontName Font name
 @param fontSize Font size
 @param isBold Whether bold
 @param isItalic Whether italic
 @return Generated UIFont object
 */
- (UIFont *)generateFontWithName:(NSString *)fontName fontSize:(CGFloat)fontSize isBold:(BOOL)isBold isItalic:(BOOL)isItalic;

/**
 @brief 更新渲染上下文
 @param context 渲染上下文
 @param subAttributedString 子文本字符串
 @return 更新后的渲染上下文
 */
/****
 @brief Update rendering context
 @param context Rendering context
 @param subAttributedString Sub attributed string
 @return Updated rendering context
 */
- (RenderContext *)updateRenderContext:(RenderContext *)context withSubStr:(NSAttributedString *)subAttributedString;


#pragma mark - Position Calculation Methods


/**
 @brief 处理位置属性，计算基础坐标
 @param locationAttribute 位置属性
 @param context 渲染上下文
 @return 计算得到的坐标点
 */
/****
 @brief Process location attributes and calculate base coordinates
 @param locationAttribute Location attribute
 @param context Rendering context
 @return Calculated coordinate point
 */
- (CGPoint)processAttributePosition:(VttLocationAttribute *)locationAttribute withContext:(RenderContext *)context;


/**
 @brief 处理X方向位置
 @param locationAttribute 位置属性
 @param context 渲染上下文
 @return X坐标值
 */
/****
 @brief Process X direction position
 @param locationAttribute Location attribute
 @param context Rendering context
 @return X coordinate value
 */
- (CGFloat)processXPositon:(VttLocationAttribute *)locationAttribute withContext:(RenderContext *)context;


/**
 @brief 处理Y方向位置
 @param locationAttribute 位置属性
 @param context 渲染上下文
 @return Y坐标值
 */
/****
 @brief Process Y direction position
 @param locationAttribute Location attribute
 @param context Rendering context
 @return Y coordinate value
 */
- (CGFloat)processYPosition:(VttLocationAttribute *)locationAttribute withContext:(RenderContext *)context;


/**
 @brief 应用默认位置规则
 @param locationPoint 位置属性计算的坐标点
 @param context 渲染上下文
 @return 应用默认规则后的最终坐标点
 */
/****
 @brief Apply default position rules
 @param locationPoint Coordinate point calculated from location attributes
 @param context Rendering context
 @return Final coordinate point after applying default rules
 */
- (CGPoint)maybeApplyDefaultPosition:(CGPoint)locationPoint withContext:(RenderContext *)context;

/**
 @brief 强制居中对齐（当位置超出范围时）
 @param x X坐标
 @param context 渲染上下文
 @return 调整后的X坐标
 */
/****
 @brief Force center alignment (when position is out of range)
 @param x X coordinate
 @param context Rendering context
 @return Adjusted X coordinate
 */
- (CGFloat)maybeForcebeCenter:(CGFloat)x withContext:(RenderContext *)context;

/**
 @brief 确保位置在基准线之上
 @param y Y坐标
 @param context 渲染上下文
 @return 调整后的Y坐标
 */
/****
 @brief Ensure position is above baseline
 @param y Y coordinate
 @param context Rendering context
 @return Adjusted Y coordinate
 */
- (CGFloat)maybeUpperThanBase:(CGFloat)y withContext:(RenderContext *)context;




#pragma mark - Customization Methods

/**
 @brief 自定义内容属性及位置信息（供子类重写）
 @param contentAttributes 内容属性数组
 @param locationAttribute 位置属性对象
 @note 默认实现为空，子类可重写以实现特殊的属性处理逻辑，例如批量设置文本样式、处理丰富文本的行为等
 */
/****
 @brief Customize content attributes and location information (for subclass override)
 @param contentAttributes Array of content attribute objects
 @param locationAttribute Location attribute object
 @note Default implementation is empty, subclasses can override to implement special attribute processing logic, such as batch setting text styles or handling rich text behaviors
 */
- (void)customizeAttribuets:(NSMutableArray<VttContentAttribute *> *)contentAttributes locationAttribute:(VttLocationAttribute *)locationAttribute;

/**
 @brief 自定义段落样式（供子类重写）
 @param paragraphStyle 段落样式对象
 @param font 字体对象
 @param text 文本内容
 @note 默认实现为空，子类可重写以自定义行间距等属性
 */
/****
 @brief Customize paragraph style (for subclass override)
 @param paragraphStyle Paragraph style object
 @param font Font object
 @param text Text content
 @note Default implementation is empty, subclasses can override to customize line spacing and other properties
 */
- (void)customizeParagraphStyle:(NSMutableParagraphStyle *)paragraphStyle withFont:(UIFont *)font contentText:(NSString *)text;

/**
 @brief 自定义字体（供子类重写）
 @param originalFont 原始字体
 @param contentAttribute 内容属性
 @param text 文本内容
 @return 自定义后的字体，默认返回原始字体
 @note 子类可重写以应用特殊的字体处理逻辑
 */
/****
 @brief Customize font (for subclass override)
 @param originalFont Original font
 @param contentAttribute Content attribute
 @param text Text content
 @return Customized font, default returns original font
 @note Subclasses can override to apply special font processing logic
 */
- (UIFont *)customizeFont:(UIFont *)originalFont contentAttribute:(VttContentAttribute *)contentAttribute contentText:(NSString *)text;



#pragma mark - Utility Methods

/**
 @brief 根据索引查找字幕对话框对象
 @param index 字幕索引
 @return 找到的对话框对象，未找到返回nil
 */
/****
 @brief Find subtitle dialogue object by index
 @param index Subtitle index
 @return Found dialogue object, returns nil if not found
 */
- (AliVttDialogueObj *)findDialogueObjByIdx:(NSInteger)index;

/**
 @brief 查找空闲的字幕对话框对象
 @return 空闲的对话框对象，未找到返回nil
 @note 空闲是指图层处于隐藏状态的对象
 */
/****
 @brief Find idle subtitle dialogue object
 @return Idle dialogue object, returns nil if not found
 @note Idle means the object whose layer is in hidden state
 */
- (AliVttDialogueObj *) findIdleDialogueObj;


/**
 @brief 安全移除观察者
 @note 在dealloc时调用，避免观察者相关的崩溃
 */
/****
 @brief Safely remove observer
 @note Called during dealloc to avoid observer-related crashes
 */
- (void)safelyRemoveObserverIfNeeded;


/**
 @brief 从整数值创建UIColor对象
 @param value ARGB格式的颜色值
 @return 对应的UIColor对象
 */
/****
 @brief Create UIColor object from integer value
 @param value Color value in ARGB format
 @return Corresponding UIColor object
 */
- (UIColor *)getColorFromValue:(NSInteger)value;


/**
 @brief 计算富文本的显示尺寸
 @param attrStr 富文本字符串
 @param maxTextWidth 最大文本宽度
 @return 计算得到的文本尺寸
 */
/****
 @brief Calculate display size of attributed text
 @param attrStr Attributed text string
 @param maxTextWidth Maximum text width
 @return Calculated text size
 */
- (CGSize)getSizeFromStr:(NSMutableAttributedString *)attrStr withMaxtextWidth:(CGFloat)maxTextWidth;

/**
 @brief 计算最大文本宽度
 @return 最大文本宽度值
 */
/****
 @brief Calculate maximum text width
 @return Maximum text width value
 */
- (CGFloat) calculateMaxTextWidth;

/**
 @brief 检测字符串是否包含全宽字符
 @param string 待检测的字符串
 @return 包含全宽字符返回YES，否则返回NO
 @note 全宽字符包括中文、日文、韩文等
 */
/****
 @brief Detect if string contains full-width characters
 @param string String to be detected
 @return Returns YES if contains full-width characters, otherwise NO
 @note Full-width characters include Chinese, Japanese, Korean, etc.
 */
- (BOOL) containsFullWidthCharacters:(NSString *)string;

/**
 @brief 检测字符串是否包含上标字符
 @param string 待检测的字符串
 @return 包含上标字符返回YES，否则返回NO
 @note 主要检测泰文等具有上下标的复杂字符
 */
/****
 @brief Detect if string contains superscript characters
 @param string String to be detected
 @return Returns YES if contains superscript characters, otherwise NO
 @note Mainly detects complex characters with superscripts and subscripts like Thai
 */
- (BOOL) containsUpperGlyphCharacters:(NSString *)string;


/**
 @brief 获取父视图尺寸
 @param w 宽度指针，用于返回宽度值
 @param h 高度指针，用于返回高度值
 */
/****
 @brief Get parent view size
 @param w Width pointer for returning width value
 @param h Height pointer for returning height value
 */
- (void) getParentViewSize:(CGFloat*)w h:(CGFloat*)h;

@end


#pragma mark - AliVttRender
/**
 @brief VTT字幕渲染器包装类
 
 对AliVttRenderImpl的封装，提供更简洁的接口。
 支持依赖注入，允许使用自定义的渲染实现。
 */
/****
 @brief VTT subtitle renderer wrapper class
 
 Wrapper for AliVttRenderImpl, providing a more concise interface.
 Supports dependency injection, allowing custom rendering implementations.
 */
OBJC_EXPORT
@interface AliVttRender : NSObject

/// 实际的渲染实现对象
/// Actual rendering implementation object
@property (nonatomic, strong) AliVttRenderImpl* renderHandle;

/**
 @brief 使用自定义渲染实现初始化
 @param renderImpl 自定义的渲染实现对象
 @return 初始化的渲染器对象
 */
/****
 @brief Initialize with custom rendering implementation
 @param renderImpl Custom rendering implementation object
 @return Initialized renderer object
 */
- (instancetype) initWithRenderImpl:(AliVttRenderImpl *)renderImpl;

/**
 @brief 获取VTT头部信息
 @return AliWebVttHeader对象，如果未设置则返回nil
 */
/****
 @brief Get VTT header information
 @return AliWebVttHeader object, returns nil if not set
 */
- (nullable AliWebVttHeader *) getVttHeader;


/**
 @brief 设置渲染视图
 @param view CALayer对象的void指针
 */
/****
 @brief Set rendering view
 @param view Void pointer to CALayer object
 */
- (void) setView:(void *)view;


/**
 @brief 清除所有字幕内容
 */
/****
 @brief Clear all subtitle content
 */
- (void) clear;

/**
 @brief 显示字幕
 @param index 字幕索引
 @param data 字幕数据
 */
/****
 @brief Show subtitle
 @param index Subtitle index
 @param data Subtitle data
 */
- (void) show:(int)index data:(NSString *)data;

/**
 @brief 隐藏字幕
 @param index 字幕索引
 @param data 字幕数据
 */
/****
 @brief Hide subtitle
 @param index Subtitle index
 @param data Subtitle data
 */
- (void) hide:(int)index data:(NSString *)data;

/**
 @brief 初始化VTT头部
 @param header VTT头部字符串
 */
/****
 @brief Initialize VTT header
 @param header VTT header string
 */
- (void) initHeader:(NSString*) header;


/**
 @brief 设置视频信息
 @param videoWidth 视频宽度
 @param videoHeight 视频高度
 @param mode 缩放模式
 */
/****
 @brief Set video information
 @param videoWidth Video width
 @param videoHeight Video height
 @param mode Scaling mode
 */
- (void) setVideoInfo:(int)videoWidth videoHeight:(int)videoHeight mode:(AVPScalingMode)mode;

@end




#pragma mark - Factory Block
/**
 @brief 自定义渲染实现工厂块
 @return 创建的AliVttRenderImpl实例
 @note 客户端可以通过此工厂块提供自定义的渲染实现
 */
/****
 @brief Custom rendering implementation factory block
 @return Created AliVttRenderImpl instance
 @note Clients can provide custom rendering implementations through this factory block
 */
typedef AliVttRenderImpl* (^AliVttRenderImplFactoryBlock)(void);



#pragma mark - AliVttSubtitleView
/**
 @brief VTT字幕视图主类
 
 字幕系统的入口类，管理多轨道字幕的渲染。
 实现AliVttSubtitleViewProtocol协议，与播放器集成。
 
 @code
 // 基本使用示例
 AliVttSubtitleView *subtitleView = [[AliVttSubtitleView alloc] init];
 [player setExternalSubtitleView:subtitleView];
 
 // 自定义渲染实现
 [subtitleView setRenderImplFactory:^AliVttRenderImpl*() {
     return [[CustomVttRenderImpl alloc] init];
 }];
 
 // 自定义常量配置
 [AliVttSubtitleView setConstClass:[MySubtitleConst class]];
 @endcode
 */
/****
 @brief VTT subtitle view main class
 
 Entry class for subtitle system, managing multi-track subtitle rendering.
 Implements AliVttSubtitleViewProtocol for player integration.
 
 @code
 // Basic usage example
 AliVttSubtitleView *subtitleView = [[AliVttSubtitleView alloc] init];
 [player setExternalSubtitleView:subtitleView];
 
 // Custom rendering implementation
 [subtitleView setRenderImplFactory:^AliVttRenderImpl*() {
     return [[CustomVttRenderImpl alloc] init];
 }];
 
 // Custom constant configuration
 [AliVttSubtitleView setConstClass:[MySubtitleConst class]];
 @endcode
 */
OBJC_EXPORT
@interface AliVttSubtitleView : NSObject <AliVttSubtitleViewProtocol>


/// 轨道索引到渲染器的映射表
/// Mapping table from track index to renderer
@property (nonatomic, strong) NSMutableDictionary<NSNumber *, AliVttRender *> *renderMap;


/// 客户自定义渲染实现工厂
/// Client custom rendering implementation factory
@property (nonatomic, copy) AliVttRenderImplFactoryBlock renderFactory;

/// 是否启用字幕渲染
/// Whether subtitle rendering is enabled
@property (atomic, assign) BOOL isEnableSubtitleRender;


/**
 @brief 设置全局常量类
 @param constClass 常量类的Class对象
 @note 静态方法，影响所有实例的默认配置
 */
/****
 @brief Set global constant class
 @param constClass Class object of constant class
 @note Static method that affects default configuration of all instances
 */
+ (void)setConstClass:(Class)constClass;


/**
 @brief 初始化字幕视图
 @return 初始化的字幕视图实例
 */
/****
 @brief Initialize subtitle view
 @return Initialized subtitle view instance
 */
- (instancetype)init;


/**
 @brief 设置自定义渲染实现工厂
 @param factory 渲染实现工厂块
 @note 允许客户端提供自定义的渲染逻辑
 */
/****
 @brief Set custom rendering implementation factory
 @param factory Rendering implementation factory block
 @note Allows clients to provide custom rendering logic
 */
- (void)setRenderImplFactory:(AliVttRenderImplFactoryBlock)factory;

/**
 @brief 销毁字幕视图，清理所有资源
 */
/****
 @brief Destroy subtitle view and clean up all resources
 */
- (void)destroy;


/**
 @brief 获取指定轨道的VTT头部信息
 @param trackIndex 轨道索引
 @return WebVttHeader对象，如果未找到或未初始化则返回nil
 @note 该方法返回解析后的WebVTT头部信息，包含样式和区域定义
 */
/****
 @brief Get VTT header information for specified track
 @param trackIndex Track index
 @return WebVttHeader object, returns nil if not found or not initialized
 @note This method returns parsed WebVTT header information, including style and region definitions
 */
- (nullable AliWebVttHeader *)getVttHeader:(int)trackIndex;


/**
 @brief 设置VTT头部信息
 @param player 播放器对象
 @param trackIndex 轨道索引
 @param header VTT头部字符串
 */
/****
 @brief Set VTT header information
 @param player Player object
 @param trackIndex Track index
 @param header VTT header string
 */
- (void)setVttHeader:(AliPlayer *)player trackIndex:(int)trackIndex Header:(NSString *)header;


/**
 @brief 显示字幕
 @param player 播放器对象
 @param trackIndex 轨道索引
 @param subtitleID 字幕ID
 @param subtitle 字幕内容
 */
/****
 @brief Show subtitle
 @param player Player object
 @param trackIndex Track index
 @param subtitleID Subtitle ID
 @param subtitle Subtitle content
 */
- (void)show:(AliPlayer*)player trackIndex:(int)trackIndex subtitleID:(long)subtitleID subtitle:(NSString *)subtitle;

/**
 @brief 隐藏字幕
 @param player 播放器对象
 @param trackIndex 轨道索引
 @param subtitleID 字幕ID
 */
/****
 @brief Hide subtitle
 @param player Player object
 @param trackIndex Track index
 @param subtitleID Subtitle ID
 */
- (void)hide:(AliPlayer *)player trackIndex:(int)trackIndex subtitleID:(long)subtitleID;

@end











