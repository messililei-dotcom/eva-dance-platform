#ifndef AVPErrorCode_h
#define AVPErrorCode_h

typedef enum AVPErrorCode: NSUInteger {
    /**@brief 服务器返回数据为空。*/
    /****@brief  The server returns no response.*/
    ERROR_SERVER_NO_RESPONSE                                  = 0x20010001,
    /**@brief 服务器返回数据不为json格式。*/
    /****@brief  The response returned by the server is not in JSON format.*/
    ERROR_SERVER_WRONG_JSON                                   = 0x20010002,
    /**@brief 没有找到匹配的清晰度。*/
    /****@brief  No resolution matching the request is available.*/
    ERROR_NO_MATCH_QUALITY                                    = 0x20010003,
    /**@brief PlayAuth解析错误。*/
    /****@brief  A playAuth parsing error has occurred.*/
    ERROR_PLAYAUTH_WRONG                                      = 0x20010004,
    /**@brief 请求失败。*/
    /****@brief  The request failed.*/
    ERROR_REQUEST_FAIL                                        = 0x20010005,
    /**@brief 服务端返回播放信息为空。*/
    /****@brief   The server returns no playback information. */
    ERROR_NO_PLAY_INFO                                        = 0x20010006,

    //------------------     POP  begin ------------------------
    /**@brief POP未知错误。*/
    /****@brief  An unknown POP error has occurred. */
    ERROR_SERVER_POP_UNKNOWN                                  = 0x20010100,
    /**@brief 缺少参数。*/
    /****@brief  A parameter is missing.*/
    ERROR_SERVER_POP_MISSING_PARAMETER                        = 0x20010101,
    /**@brief 参数无效。*/
    /****@brief  A parameter is invalid.*/
    ERROR_SERVER_POP_INVALID_PARAMETER                        = 0x20010102,
    /**@brief 账号未开通视频点播服务。*/
    /****@brief  ApsaraVideo for VOD has not been activated for your account.*/
    ERROR_SERVER_POP_OPERATION_DENIED                         = 0x20010103,
    /**@brief 账号已欠费，请充值。*/
    /****@brief  Your account has overdue payments. Recharge your account.*/
    ERROR_SERVER_POP_OPERATION_SUSPENED                       = 0x20010104,
    /**@brief 无权限执行该操作。*/
    /****@brief  You are not authorized to perform the operation.*/
    ERROR_SERVER_POP_FORBIDDEN                                = 0x20010105,
    /**@brief 后台发生未知错误。*/
    /****@brief  An unknown error has occurred in the background.*/
    ERROR_SERVER_POP_INTERNAL_ERROR                           = 0x20010106,
    /**@brief 服务不可用。*/
    /****@brief  The service is unavailable.*/
    ERROR_SERVER_POP_SERVICE_UNAVALIABLE                      = 0x20010107,
    /**@brief 签名已经被使用。*/
    /****@brief  The signature has been used.*/
    ERROR_SERVER_POP_SIGNATUREANONCE_USED                     = 0x20010108,
    /**@brief 安全token不对。*/
    /****@brief  The security token is incorrect.*/
    ERROR_SERVER_POP_SECURITYTOKEN_MAILFORMED                 = 0x20010109,
    /**@brief 安全token与Accesskey不匹配。*/
    /****@brief  The security token and AccessKey do not match.*/
    ERROR_SERVER_POP_SECURITYTOKEN_MISMATCH_ACCESSKEY         = 0x2001010A,
    /**@brief 签名校验不对。*/
    /****@brief  The signature is incorrect.*/
    ERROR_SERVER_POP_SIGNATURE_NOT_MATCH                      = 0x2001010B,
    /**@brief 没有找到AccessKeyId。*/
    /****@brief  The AccessKey ID does not exist.*/
    ERROR_SERVER_POP_ACCESSKEYID_NOT_FOUND                    = 0x2001010C,
    /**@brief Token过期。*/
    /****@brief  The token is expired.*/
    ERROR_SERVER_POP_TOKEN_EXPIRED                            = 0x2001010D,

    //------------------     VOD  begin ------------------------
    /**@brief VOD未知错误。*/
    /****@brief  An unknown VOD error has occurred.*/
    ERROR_SERVER_VOD_UNKNOWN                                  = 0x20010200,
    /**@brief 视频状态无效。*/
    /****@brief  The video status is invalid.*/
    ERROR_SERVER_VOD_FORBIDDEN_ILLEGALSTATUS                  = 0x20010201,
    /**@brief 视频不存在。*/
    /****@brief  The specified video does not exist.*/
    ERROR_SERVER_VOD_INVALIDVIDEO_NOTFOUND                    = 0x20010202,
    /**@brief 根据您的筛选条件找不到可以播放的转码输出流。*/
    /****@brief  No transcoded stream file available for playback is found based on the specified filter criteria.*/
    ERROR_SERVER_VOD_INVALIDVIDEO_NOSTREAM                    = 0x20010203,
    /**@brief 当前仅存在阿里云视频加密的转码输出流，必须使用阿里云播放器进行播放或者设置请求参数ResultType值为Multiple。*/
    /****@brief  Only transcoded stream files encrypted by the Alibaba Cloud video encryption service exist. You must use ApsaraVideo Player to play the files or set the ResultType parameter to Multiple.*/
    ERROR_SERVER_VOD_FORBIDDEN_ALIYUNVODENCRYPTION            = 0x20010204,
    /**@brief AuthInfo与vid不一致。*/
    /****@brief  The authentication information and the video ID (VID) do not match.*/
    ERROR_SERVER_VOD_INVALIDAUTH_MEDIAID                      = 0x20010205,
    /**@brief AuthInfo过期。*/
    /****@brief  The authentication information has expired.*/
    ERROR_SERVER_VOD_INVALIDAUTHINFO_EXPIRETIME               = 0x20010206,

    //------------------     MPS  begin ------------------------
    /**@brief MPS未知错误。*/
    /****@brief  An unknown ApsaraVideo for Media Processing (MPS) error has occurred.*/
    ERROR_SERVER_MPS_UNKNOWN                                  = 0x20010300,
    /**@brief MediaId无效。*/
    /****@brief  The media ID is invalid.*/
    ERROR_SERVER_MPS_INVALID_MEDIAID                          = 0x20010301,
    /**@brief AuthTimeout无效。*/
    /****@brief  The authentication expiration time is invalid.*/
    ERROR_SERVER_MPS_INVALID_AUTHTIMEOUT                      = 0x20010302,
    /**@brief Formats无效。*/
    /****@brief  The media format is invalid.*/
    ERROR_SERVER_MPS_INVALID_FORMATS                          = 0x20010303,
    /**@brief AuthInfo无效。*/
    /****@brief  The authentication information is invalid.*/
    ERROR_SERVER_MPS_INVALID_AUTHINFO                         = 0x20010304,
    /**@brief 签名校验失败。*/
    /****@brief  The signature failed verification.*/
    ERROR_SERVER_MPS_SIGNATURE_CHECK_FAILED                   = 0x20010305,
    /**@brief MediaId不存在。*/
    /****@brief  The media ID does not exist.*/
    ERROR_SERVER_MPS_MEDIAID_NOT_EXIST                        = 0x20010306,
    /**@brief 媒体资源不存在。*/
    /****@brief  The media resource does not exist.*/
    ERROR_SERVER_MPS_MEDIA_RESOURCE_NOT_EXIST                 = 0x20010307,
    /**@brief 媒体没有发布。*/
    /****@brief  The media is not published.*/
    ERROR_SERVER_MPS_MEDIA_NOT_PUBLISHED                      = 0x20010308,
    /**@brief 媒体没有加密。*/
    /****@brief  The media is not encrypted.*/
    ERROR_SERVER_MPS_MEDIA_NOT_ENCRYPTED                      = 0x20010309,
    /**@brief ciphertextblob无效。*/
    /****@brief  The ciphertextBlob string is invalid.*/
    ERROR_SERVER_MPS_INVALID_CIPHERTEXTBLOB                   = 0x2001030A,
    /**@brief CipherTextBlob不存在。*/
    /****@brief  The ciphertextBlob string does not exist.*/
    ERROR_SERVER_MPS_CIPHERBLOB_NOT_EXIST                     = 0x2001030B,
    /**@brief 服务器内部错误。*/
    /****@brief  An internal server error has occurred.*/
    ERROR_SERVER_MPS_INTERNAL_ERROR                           = 0x2001030C,
    /**@brief 请求标识不允许操作。*/
    /****@brief  You are not authorized to perform the operation.*/
    ERROR_SERVER_MPS_INVALID_IDENTITY_NOT_ORDER_VIDEO_SERVICE = 0x2001030D,
    /**@brief 更新主机配置失败。*/
    /****@brief  The host configuration failed to be updated.*/
    ERROR_SERVER_MPS_UPDATE_CDN_DOMAIN_CONFIGS_FAIL           = 0x2001030E,
    /**@brief auth密钥已经存在。*/
    /****@brief  The AccessKey secret for authentication has been used by another account.*/
    ERROR_SERVER_MPS_AUTH_KEY_EXIST                           = 0x2001030F,
    /**@brief auth密钥不存在。*/
    /****@brief  The AccessKey secret for authentication does not exist.*/
    ERROR_SERVER_MPS_AUTH_KEY_NOT_EXIST                       = 0x20010310,
    /**@brief 参数超出范围。*/
    /****@brief  The parameter value is out of the value range.*/
    ERROR_SERVER_MPS_INVALID_PARAMETER_OUT_OF_BOUND           = 0x20010311,
    /**@brief 参数无效。*/
    /****@brief  The parameter is invalid.*/
    ERROR_SERVER_MPS_INVALID_PARAMETER                        = 0x20010312,
    /**@brief 参数不能为null。*/
    /****@brief  The parameter value is null. You must specify the parameter.*/
    ERROR_SERVER_MPS_INVALID_PARAMETER_NULL_VALUE             = 0x20010313,
    /**@brief 参数不能为空。*/
    /****@brief  The parameter value is empty. You must specify a non-empty value for the parameter.*/
    ERROR_SERVER_MPS_INVALID_PARAMETER_EMPTY_VALUE            = 0x20010314,
    /**@brief 媒体资源不匹配。*/
    /****@brief  The media resource is not supported.*/
    ERROR_SERVER_MPS_MEDIA_RESOURCE_NOT_MATCH                 = 0x20010315,
    /**@brief 没有找到MediaId的密文资源。*/
    /****@brief  The ciphertext of the media ID is not found.*/
    ERROR_SERVER_MPS_MEDIA_NOT_FOUND_CIPHERTEXT               = 0x20010316,
    /**@brief 指定的参数Rand无效。*/
    /****@brief  The specified rand parameter is invalid.*/
    ERROR_SERVER_MPS_INVALID_PARAMETER_RAND                   = 0x20010317,
    /**@brief 缓存连接池为空。*/
    /****@brief  The Redis cache connection pool is empty.*/
    ERROR_SERVER_MPS_REDIS_POOL_IS_EMPTY                      = 0x20010318,
    /**@brief 媒体id不匹配。*/
    /****@brief  The signature and the media ID do not match.*/
    ERROR_SERVER_MPS_SIGNATURE_CHECK_MEDIA_FAILED             = 0x20010319,
    /**@brief 指定的到期时间值已过期。*/
    /****@brief  The specified timeout value has expired.*/
    ERROR_SERVER_MPS_SIGNATURE_CHECK_EXPIREDTIME_FAILED       = 0x2001031A,
    /**@brief 指定的参数SessionTime应该是>0。*/
    /****@brief  The value of the SessionTime parameter is not greater than 0. Set the parameter to a value greater than 0.*/
    ERROR_SERVER_MPS_INVALID_SESSION_TIME                     = 0x2001031B,
    /**@brief EndUserId长度不对。*/
    /****@brief  The length of the EndUserId parameter is incorrect.*/
    ERROR_SERVER_MPS_INVALID_END_USER_ID                      = 0x2001031C,
    /**@brief 指定的参数LicenseUrl格式不正确。*/
    /****@brief  The format of the LicenseUrl parameter is incorrect.*/
    ERROR_SERVER_MPS_INVALID_URL                              = 0x2001031D,
    /**@brief 请求失败。*/
    /****@brief  The request failed.*/
    ERROR_SERVER_MPS_HTTP_REQUEST_FAILED                      = 0x2001031E,
    /**@brief xml格式出错。*/
    /****@brief  The XML format is incorrect.*/
    ERROR_SERVER_MPS_XML_FORMAT_ERROR                         = 0x2001031F,
    /**@brief Session不存在。*/
    /****@brief  The session does not exist.*/
    ERROR_SERVER_MPS_SESSION_NOT_EXIST                        = 0x20010320,
    /**@brief API不支持。*/
    /****@brief  The API is not supported.*/
    ERROR_SERVER_MPS_REGION_NOT_SUPPORTED_API                 = 0x20010321,
    /**@brief 此区域未激活DRM，请联系我们。*/
    /****@brief  Digital rights management (DRM) is not authorized for this region. Contact ApsaraVideo for VOD technical support.*/
    ERROR_SERVER_MPS_DRM_NOT_ACTIVATED                        = 0x20010322,
    /**@brief DRM验证错误，请为此媒体添加授权。*/
    /****@brief  DRM verification failed. Authorize DRM for the media.*/
    ERROR_SERVER_MPS_DRM_AUTH_ERROR                           = 0x20010323,
    /**@brief oss域不存在cdn域配置。*/
    /****@brief  No Content Delivery Network (CDN) domain name is bound to your Object Storage Service (OSS) bucket.*/
    ERROR_SERVER_MPS_CDN_CONFIG_NOT_EXIST                     = 0x20010324,

    //------------------     LIVESHIFT  begin ------------------------
    /**@brief 时移未知错误。*/
    /****@brief  An unknown time shifting error has occurred.*/
    ERROR_SERVER_LIVESHIFT_UNKNOWN                            = 0x20010400,
    /**@brief 时移请求失败。*/
    /****@brief  The time shifting request failed.*/
    ERROR_SERVER_LIVESHIFT_REQUEST_ERROR                      = 0x20010401,
    /**@brief 时移数据解析失败。*/
    /****@brief  The time shifting data failed to be parsed.*/
    ERROR_SERVER_LIVESHIFT_DATA_PARSER_ERROR                  = 0x20010402,

    //------------------     KEYMANANGER  begin ------------------------
    ERROR_KEYMANAGER_UNKNOWN                                  = 0x20011000,

    //------------------     TBDRM  begin ------------------------
    /**@brief 私有加密未知错误。*/
    /****@brief  An unknown error has occurred.*/
    ERROR_TBDRM_UNKNOWN                                       = 0x20012000,
    /**@brief 私有加密解封装未实现。*/
    /****@brief  Transcoded streams encrypted by Alibaba Cloud video encryption cannot be decapsulated.*/
    ERROR_TBDRM_DEMUXER_UNIMPLEMENTED                         = 0x20012001,
    //------------------     UNKNOWN  begin ------------------------
    /**@brief 未知错误。*/
    /****@brief  An unknown error has occurred.*/
    ERROR_UNKNOWN_ERROR                                       = 0x20020000 - 1,

    /**@brief Demuxer错误起始码。*/
    /****@brief  Demuxer error codes.*/
    ERROR_DEMUXER_START                                       = 0x20030000,
    /**@brief 打开URL失败。*/
    /****@brief  The URL is unavailable.*/
    ERROR_DEMUXER_OPENURL                                     = 0x20030001,
    /**@brief 无效的流。*/
    /****@brief  The stream is invalid.*/
    ERROR_DEMUXER_NO_VALID_STREAM                             = 0x20030002,
    /**@brief 打开流失败。*/
    /****@brief  The stream is unavailable.*/
    ERROR_DEMUXER_OPENSTREAM                                  = 0x20030003,
    /**@brief 加载超时。*/
    /****@brief  The loading times out.*/
    ERROR_LOADING_TIMEOUT                                     = 0x20030004,
    /**@brief 数据源URL为空。*/
    /****@brief  The data source URL is not specified.*/
    ERROR_DATASOURCE_EMPTYURL                                 = 0x20030005,
    /**@brief 网络dns解析失败。*/
    /****@brief  network dns resolve failed.*/
    ERROR_DATASOURCE_RESOLVE                                  = 0x20030007,
    /**@brief 网络连接失败。*/
    /****@brief  network connect failed.*/
    ERROR_DATASOURCE_CONNECT                                  = 0x20030008,
    
    /**@brief 网络获取到脏数据,非音视频流。*/
    /****@brief  network get dirty data, neither audio or video stream.*/
    ERROR_DIRTY_DATA                                          = 0x20030009,
    
    /**
     * @brief 无网络访问。
     */
    /****
     * @brief No network access .
     */
    ERROR_NO_NETWORK_ACCESS                                   = 0x2003000A,

    /**
     * @brief 加载超时：数据传输速率过低。
     */
    /****
     * @brief Loading timeout due to extremely low data transfer rate.
     */
    ERROR_LOADING_TIMEOUT_LOW_TRANSFER                        = 0x2003000B,

    /**
     * @brief 加载超时：SSL/TLS 握手失败或耗时过长。
     */
    /****
     * @brief Loading timeout during SSL/TLS handshake.
     */
    ERROR_LOADING_TIMEOUT_SSL                                 = 0x2003000C,

    /**
     * @brief 加载超时：DNS 域名解析超时。
     */
    /****
     * @brief Loading timeout during DNS hostname resolution.
     */
    ERROR_LOADING_TIMEOUT_RESOLVE                             = 0x2003000D,

    /**
     * @brief 加载超时：TCP 连接建立超时。
     */
    /**
     * @brief Loading timeout during TCP connection establishment.
     */
    ERROR_LOADING_TIMEOUT_CONNECT                             = 0x2003000E,
    

    ERROR_DECODE_BASE                                         = 0x20040000,
    /**@brief 视频解码失败。*/
    /****@brief  The video decoding failed.*/
    ERROR_DECODE_VIDEO                                        = 0x20040001,
    /**@brief 音频解码失败。*/
    /****@brief  The audio decoding failed.*/
    ERROR_DECODE_AUDIO                                        = 0x20040002,


    /**@brief 未知的网络错误。*/
    /****@brief  An unknown network error has occurred.*/
    ERROR_NETWORK_UNKNOWN                                     = 0x20050000,
    /**@brief 协议不支持。*/
    /****@brief  The protocol is not supported.*/
    ERROR_NETWORK_UNSUPPORTED                                 = 0x20050001,
    /**@brief 不能解析域名。*/
    /****@brief  The domain name cannot be resolved.*/
    ERROR_NETWORK_RESOLVE                                     = 0x20050002,
    /**@brief 网络连接超时。*/
    /****@brief  The network connection times out.*/
    ERROR_NETWORK_CONNECT_TIMEOUT                             = 0x20050003,
    /**@brief 无法连接到服务器。*/
    /****@brief  The server is unavailable.*/
    ERROR_NETWORK_COULD_NOT_CONNECT                           = 0x20050004,
    /**@brief 403错误。*/
    /****@brief  An HTTP 403 error has occurred.*/
    ERROR_NETWORK_HTTP_403                                    = 0x20050005,
    /**@brief 404错误。*/
    /****@brief  An HTTP 404 error has occurred.*/
    ERROR_NETWORK_HTTP_404                                    = 0x20050006,
    /**@brief 其他的4XX错误。*/
    /****@brief  An HTTP 4xx error other than HTTP 403 or HTTP 404 has occurred.*/
    ERROR_NETWORK_HTTP_4XX                                    = 0x20050007,
    /**@brief 5XX的服务器错误。*/
    /****@brief  An HTTP 5xx error has occurred.*/
    ERROR_NETWORK_HTTP_5XX                                    = 0x20050008,
    /**@brief 不支持range请求。*/
    /****@brief  The HTTP range request is not supported.*/
    ERROR_NETWORK_HTTP_RANGE                                  = 0x20050009,
    /**@brief 400错误。*/
    /****@brief  An HTTP 400 error has occurred.*/
    ERROR_NETWORK_HTTP_400                                    = 0x2005000A,
    /**@brief 重定向到了一个不是媒体文件的URL。*/
    /****@brief  Redirect to a url that is not a media.*/
    ERROR_NETWORK_HTTP_REDIRECT_NONMEDIA                      = 0x2005000B,

    /**@brief 刷新URL失败。*/
    /****@brief  Failed to refresh the URL.*/
    ERROR_NETWORK_URL_REFRESH_FAILED                          = 0x2005000D,

    /**@brief 刷新URL重试超过最大次数。*/
    /****@brief  The number of retries to refresh the URL has exceeded the maximum.*/
    ERROR_NETWORK_URL_REFRESH_RETRY_EXCEEDED                  = 0x2005000E,

    /**@brief 未知的解码错误。*/
    /****@brief  An unknown decoding error has occurred.*/
    ERROR_CODEC_UNKNOWN                                       = 0x20060000,
    /**@brief 视频编码格式不支持。*/
    /****@brief  The video coding format is not supported.*/
    ERROR_CODEC_VIDEO_NOT_SUPPORT                             = 0x20060001,
    /**@brief 音频编码格式不支持。*/
    /****@brief  The audio coding format is not supported.*/
    ERROR_CODEC_AUDIO_NOT_SUPPORT                             = 0x20060002,

    /**@brief 未知的内部错误。*/
    /****@brief  An unknown internal error.*/
    ERROR_INERNAL_UNKNOWN                                     = 0x20070000,
    /**@brief 内部退出。*/
    /****@brief  Exit.*/
    ERROR_INERNAL_EXIT                                        = 0x20070001,

    /**@brief 标准错误。*/
    /****@brief  A standard error has occurred.*/
    ERROR_GENERAL_UNKNOWN                                     = 0x20080000,
    /**@brief 标准错误-1，操作不允许等。*/
    /****@brief  An EPERM error. The operation is not permitted.*/
    ERROR_GENERAL_EPERM                                       = 0x20080001,
    /**@brief 标准错误-2，文件不存在等。*/
    /****@brief  An ENOENT error. No such file or directory exists.*/
    ERROR_GENERAL_ENOENT                                      = 0x20080002,
    /**@brief 标准错误-5，IO错误等。*/
    /****@brief  An EIO error. An Input/Output (I/O) error has occurred.*/
    ERROR_GENERAL_EIO                                         = 0x20080005,
    
    /****@brief  An EPERM error. The seek operation is not permitted.*/
    ERROR_GENERAL_EPERM_SEEK                                  = 0x20080006,
    /****@brief  An EPERM error. The READ_PACKET operation is not permitted.*/
    ERROR_GENERAL_EPERM_READ_PACKET                           = 0x20080007,
    /****@brief  An EPERM error. The DEM operation is not permitted.*/
    ERROR_GENERAL_EPERM_DEM                                   = 0x20080008,
    
    /**@brief 未知渲染错误。*/
    /****@brief  Unknown render error.*/
    ERROR_RENDER_UNKNOWN                                      = 0x20090000,
    /**@brief 打开音频设备失败。*/
    /****@brief  Failed to open audio device.*/
    ERROR_RENDER_AUDIO_OPEN_DEVICE_FAILED                     = 0x20090001,

    /**@brief 未知格式错误。*/
    /****@brief  An unknown format error has occurred.*/
    ERROR_FORMAT_UNKNOWN                                      = 0x200A0000,
    /**@brief 该媒体格式不支持。*/
    /****@brief  The media format doesn't support.*/
    ERROR_FORMAT_NOT_SUPPORT                                  = 0x200A0001,
    /**@brief URL必须添加etavirp_nuyila=1才能播放私有加密的媒体。*/
    /****@brief  URL must append 'etavirp_nuyila=1' to play the encrypted media. */
    ERROR_FORMAT_URL_REQUIRE_ALIYUN_PRIVATE_TAG               = 0x200A0002,
    /**@brief 媒体meta中未找到key info 或 key info无效，如果有多个阿里云账号，请使用对应账号的license进行集成。*/
    /****@brief  Not found key info in meta or key info is invalid to decrypt, if you have multiple license accounts, please make sure integrate the correct license.*/
    ERROR_FORMAT_INVALID_TBDRM_MP4_KEY                        = 0x200A0003,
    /**@brief 媒体meta中未找到key info 或 key info无效，如果有多个阿里云账号，请使用对应账号的license进行集成。*/
    /****@brief  Not found key info in meta or key info is invalid to decrypt, if you have multiple license accounts, please make sure integrate the correct license.*/
    ERROR_FORMAT_INVALID_TBDRM_HLS_KEY                        = 0x200A0004,

    /**@brief 未知直播错误。*/
    /****@brief  An unknown live error has occurred.*/
    ERROR_LIVE_UNKNOWN                                        = 0x200B0000,
    /**@brief 直播流已断开。*/
    /****@brief  Live stream is stopped.*/
    ERROR_LIVE_STREAM_STOPPED                                 = 0x200B0001,
    
    ERROR_DRM_UNKNOWN                                         = 0x200C0000,
    ERROR_DRM_KEY_RESPONSE_INVALID                            = 0x200C0005,
    ERROR_DRM_CERT_RESPONSE_INVALID                           = 0x200C0009,
    ERROR_DRM_INVALID_API_USAGE                               = 0x200C000A,

    /**@brief DRM 证书 URL 未配置或为空。*/
    /****@brief DRM certificate URL is not configured or empty.*/
    ERROR_DRM_CERT_URL_EMPTY                                  = 0x200C000C,
    /**@brief DRM Key 请求网络失败（超时/连接失败）。*/
    /****@brief DRM key request failed due to network error.*/
    ERROR_DRM_KEY_REQUEST_NETWORK_FAIL                        = 0x200C000D,
    /**@brief DRM Key 服务器返回错误（HTTP 4xx/5xx）。*/
    /****@brief DRM key server returned an error.*/
    ERROR_DRM_KEY_SERVER_ERROR                                = 0x200C000E,
    /**@brief DRM Key 响应解析失败/格式错误。*/
    /****@brief DRM key server response is invalid or cannot be parsed.*/
    ERROR_DRM_KEY_RESPONSE_PARSE_FAIL                         = 0x200C000F,
    /**@brief DRM 内容 Key 已过期。*/
    /****@brief DRM content key has expired.*/
    ERROR_DRM_KEY_EXPIRED                                     = 0x200C0010,
    /**@brief 流中缺少加密 key。*/
    /****@brief Encryption key is missing in the media stream.*/
    ERROR_DRM_STREAM_KEY_MISSING                              = 0x200C0011,
    /**@brief 加密方案与流格式不匹配。*/
    /****@brief DRM scheme does not match the media encryption type.*/
    ERROR_DRM_SCHEME_MISMATCH                                 = 0x200C0012,
    /**@brief 多码率流加密 key 不一致。*/
    /****@brief Multi-bitrate stream has inconsistent encryption keys.*/
    ERROR_DRM_MULTI_BITRATE_KEY_INCONSISTENT                  = 0x200C0013,

    /**@brief 未知错误。*/
    /****@brief  .*/
    ERROR_PLAYER_UNKNOWN                                      = 0x30000000 - 1,


    /**@brief 没有选择下载项。*/
    /****@brief  No track is selected for download.*/
    DOWNLOADER_ERROR_NOT_SELECT_ITEM                          = 0x30010000,
    /**@brief 没有可用下载项。*/
    /****@brief  No track is available for download.*/
    DOWNLOADER_ERROR_NO_DOWNLOAD_ITEM                         = 0x30010001,
    /**@brief 没有设置Sts源。*/
    /****@brief  The source for STS-based playback is not specified.*/
    DOWNLOADER_ERROR_STS_SOURCE_NULL                          = 0x30010002,
    /**@brief 没有设置Auth源。*/
    /****@brief  The source for playAuth-based playback is not specified.*/
    DOWNLOADER_ERROR_AUTH_SOURCE_NULL                         = 0x30010003,
    /**@brief Auth格式不对。*/
    /****@brief  The authentication format is incorrect.*/
    DOWNLOADER_ERROR_AUTH_SOURCE_WRONG                        = 0x30010004,
    /**@brief 选中的下载项不对。*/
    /****@brief  The selected track for download is invalid.*/
    DOWNLOADER_ERROR_INVALID_ITEM                             = 0x30010005,
    /**@brief URL无法连接。*/
    /****@brief  The URL is unavailable.*/
    DOWNLOADER_ERROR_URL_CANNOT_REACH                         = 0x30010006,
    /**@brief 下载的格式不支持。*/
    /****@brief  The format of the file to be downloaded is not supported.*/
    DOWNLOADER_ERROR_NOT_SUPPORT_FORMAT                       = 0x30010007,
    /**@brief 加密校验文件不匹配。*/
    /****@brief  The authentication information in the security file does not match the application information.*/
    DOWNLOADER_ERROR_ENCRYPT_FILE_NOT_MATCH                   = 0x30010008,
    /**@brief 下载功能被关闭。*/
    /****@brief  The download feature is disabled.*/
    DOWNLOADER_ERROR_DOWNLOAD_SWITCH_OFF                      = 0x30010009,
    /**@brief 网络出错。*/
    /****@brief  A network error has occurred.*/
    DOWNLOADER_ERROR_NET_ERROR                                = 0x3001000A,
    /**@brief 没有设置下载路径。*/
    /****@brief  The download directory is not specified.*/
    DOWNLOADER_ERROR_NOT_SET_SAVE_DIR                         = 0x3001000B,
    /**@brief 无法创建下载目录。*/
    /****@brief  The download directory cannot be created.*/
    DOWNLOADER_ERROR_CANNOT_CREATE_SAVE_DIR                   = 0x3001000C,
    /**@brief 没有空间。*/
    /****@brief  No sufficient space is available.*/
    DOWNLOADER_ERROR_NO_SPACE                                 = 0x3001000D,
    /**@brief 写入文件出错。*/
    /****@brief  An error occurred while writing the data.*/
    DOWNLOADER_ERROR_WRITE_ERROR                              = 0x3001000E,
    /**@brief 解密失败。*/
    /****@brief  An error occurred while decrypting the data.*/
    DOWNLOADER_ERROR_ENCRYPT_ERROR                            = 0x3001000F,
    /**@brief 文件不存在。*/
    /****@brief  No such file exists.*/
    DOWNLOADER_ERROR_FILE_NOT_EXIST                           = 0x30010010,
    /**@brief 删除文件参数无效。*/
    /****@brief  The parameter that specifies the file to be deleted is invalid.*/
    DOWNLOADER_ERROR_CLEAN_INVALID_PARAM                      = 0x30010011,
    /**@brief 删除文件状态不对。*/
    /****@brief  The file status is incorrect. Only files in the stop status can be deleted.*/
    DOWNLOADER_ERROR_CLEAN_WRONG_STATUS                       = 0x30010012,
    /**@brief 获取AES秘钥失败。*/
    /****@brief  The AES key failed to be obtained.*/
    DOWNLOADER_ERROR_GET_AES_KEY_FAIL                         = 0x30010013,
    /**@brief 加密方式不支持。*/
    /****@brief  The encryption method is not supported.*/
    DOWNLOADER_ERROR_ENCRYPTION_NOT_SUPPORT                   = 0x30010014,

    /**@brief MediaLoader未知错误。*/
    /****@brief MEDIALOADER unknown error.*/
    MEDIALOADER_ERROR_UNKNOWN                = 0x40010000,
    /**@brief 同一个Url已经加载过。*/
    /****@brief The same URL has been loaded.*/
    MEDIALOADER_ERROR_ADDED                 = 0x40010001,
    /**@brief 本地缓存未开启，预加载失败。*/
    /****@brief Local cache is not enabled, preloading failed.*/
    MEDIALOADER_ERROR_NOT_ENABLE           = 0x40010002,
    /**@brief 不支持。*/
    /****@brief Not supported.*/
    MEDIALOADER_ERROR_NOT_SUPPORT         = 0x40010003,
    /**@brief 没有找到Track。*/
    /****@brief No track is found.*/
    MEDIALOADER_ERROR_NO_TRACK              = 0x40010004,


    /**@brief license 验证无效。*/
    /****@brief license verified invalid.*/
    LICENSE_ERROR_INVALID              =  0x50010000,


    /**@brief 专业版license验证无效。*/
    /****@brief premium license verified invalid.*/
    PREMIUM_LICENSE_ERROR_INVALID = 0x50020000,


    /**@brief 专业版license验证无效, 当前格式视频无法播放。*/
    /****@brief  premium license verified invalid, the current video format can not play.*/
    ERROR_FORMAT_PREMIUM_INVALID  = 0x50020001,

    /**@brief 专业版license验证无效, mediaLoader使用报错。*/
    /****@brief  premium license verified invalid, mediaLoader function not available.*/
    ERROR_MEDIALOADER_PREMIUM_INVALID  = 0x50020002,


    /**@brief 未知license错误*/
    /****@brief  unknown license error.*/
    LICENSE_ERROR_UNKNOWN  = 0x50020100,

} AVPErrorCode;

/**@brief 播放器事件类型，带描述字符串*/
/****@brief Player event type with a description string.*/
typedef enum AVPEventWithString: NSUInteger {
    /**@brief 设置了硬解，但是切换为软解。额外信息为描述信息。*/
    /****@brief Hardware decoding is switched to software decoding. Additional information: description.*/
    EVENT_SWITCH_TO_SOFTWARE_DECODER = 100,
    /**@brief 音频解码格式不支持。额外信息为描述信息。*/
    /****@brief Audio decoding does not support the specified format. Additional information: description.*/
    EVENT_AUDIO_CODEC_NOT_SUPPORT    = 101,
    /**@brief 音频解码器设备失败。额外信息为描述信息。*/
    /****@brief The audio decoder failed. Additional information: description.*/
    EVENT_AUDIO_DECODER_DEVICE_ERROR = 102,
    /**@brief 视频解码格式不支持。额外信息为描述信息。*/
    /****@brief Video decoding does not support the specified format. Additional information: description.*/
    EVENT_VIDEO_CODEC_NOT_SUPPORT    = 103,
    /**@brief 视频解码器设备失败。额外信息为描述信息。*/
    /****@brief The video decoder failed. Additional information: description.*/
    EVENT_VIDEO_DECODER_DEVICE_ERROR = 104,
    /**@brief 视频渲染设备初始化失败。额外信息为描述信息。*/
    /****@brief The video renderer failed. Additional information: description.*/
    EVENT_VIDEO_RENDER_INIT_ERROR    = 105,
    /**@brief 解复用器跟踪ID（用于ARTC）。每次播放RTS流时对应的全链路唯一traceID，建议记录该值，需要技术支持时可提供该信息方便排障。*/
    /****@brief Demuxer trace ID for ARTC. Suggest recording this value for support. Providing this information can help troubleshoot issues.*/
    EVENT_PLAYER_DEMUXER_TRACE_ID    = 106,
    /**@brief 网络失败，需要重试。无额外信息。*/
    /****@brief Network connection failed. Try again. No additional information is provided.*/
    EVENT_PLAYER_NETWORK_RETRY       = 108,
    /**@brief 内容缓存成功。不携带额外信息。
     * @deprecated 此事件已废弃，不再使用。
     */
    /****@brief Media content cached successfully. No additional information is provided.
     * @deprecated This event is deprecated and no longer used.
     */
    EVENT_PLAYER_CACHE_SUCCESS       = 109,
    
    /**@brief 缓存失败。额外信息为描述信息。
     * @deprecated 此事件已废弃，不再使用。
     */
    /****@brief Failed to cache the content. Additional information: description.
     * @deprecated This event is deprecated and no longer used.
     */
    EVENT_PLAYER_CACHE_ERROR         = 110,
    /**@brief 系统无可用内存来存放媒体数据。*/
    /****@brief The system does not have memory to store the media data.*/
    EVENT_PLAYER_LOW_MEMORY          = 111,
    /**@brief 网络重试成功。无额外信息。*/
    /****@brief Network retry successful. No additional information.*/
    EVENT_PLAYER_NETWORK_RETRY_SUCCESS = 113,
    /**@brief 字幕选择失败。额外信息为失败原因。*/
    /****@brief Subtitle selection failed. Additional information is the cause of failure.*/
    EVENT_PLAYER_SUBTITLE_SELECT_ERROR = 114,
    /**@brief 后台恢复时所需解码帧过多 */
    /****@brief  decoder recover size is too large for background recovery.*/
    EVENT_PLAYER_EVENT_DECODER_RECOVER_SIZE = 115,

    /**@brief 播放组件中透传输出的消息 */
    /****@brief The message passthrough the player component*/
    EVENT_PLAYER_DIRECT_COMPONENT_MSG = 116,

    /**@brief 音频设备打开失败。额外信息为失败原因描述。*/
    /****@brief Failed to open audio device. Additional information: description of the failure.*/
    EVENT_PLAYER_OPEN_AUDIO_DEVICE_FAILED = 117,

    /**@brief HTTP/3 降级通知。表示当前请求尝试使用 HTTP/3（QUIC）协议失败，播放器已自动降级到 HTTP/2 或 HTTP/1.1 继续传输。可利用此事件统计 HTTP/3 的命中率与各 CDN 的 HTTP/3 兼容性。额外信息为降级原因描述。*/
    /****@brief HTTP/3 downgrade notification. Indicates that the current request failed to use HTTP/3 (QUIC) protocol, and the player has automatically downgraded to HTTP/2 or HTTP/1.1. This event can be used to collect HTTP/3 hit rate and CDN HTTP/3 compatibility statistics. Additional information: description of the downgrade reason.*/
    EVENT_PLAYER_NETWORK_H3_DOWNGRADE = 118,

    /**@brief 解复用HLS流中的分片打开失败。比如m3u8文件中的某个ts文件访问403，播放器会直接跳转到下一个ts。*/
    /****@brief Opening a segment failed when demultiplexing HLS stream. For example, a ts file in the m3u8 file accesses 403, the player will directly jump to the next ts.*/
    EVENT_PLAYER_DEMUXER_SEGMENT_OPEN_FAILED = 119,

     /**@brief 长时间缓冲后停止。额外信息为缓冲原因及缓冲耗时 */
     /****@brief Long buffering stops. Additional information: buffer reason and buffer cost.*/
     EVENT_PLAYER_LONG_LOADING_STOP_MSG = 120,
    
    /**@brief H265自适应降级 */
    /****@brief H265 Adaptive degradation*/
    EVENT_PLAYER_H265ADAPTIVE_DEGRADE = 121,

    /**@brief 视频播放会话ID。此ID在每次调用播放器的prepare方法后更新，可用于播放问题的排查和诊断。额外信息为该播放会话的唯一ID字符串。*/
    /****@brief Video player session ID. This ID is updated every time the player's prepare method is called and can be used for troubleshooting and diagnosing playback issues. Additional information: the unique ID string of the playback session.*/
    EVENT_PLAYER_VPS_ID = 122,

    /**@brief 流量统计回调，在播放器进入终态（Completion / Stop / Error）时最多触发一次。
     *  描述字符串为数值字符串，表示本次播放真实网络流量消耗（单位 KB）。*/
    /****@brief Traffic statistics callback. Fired at most once when the player reaches a terminal state
     *  (Completion / Stop / Error). Description string is a numeric value representing real network
     *  traffic consumption in KB (cache hits excluded).*/
    EVENT_PLAYER_TRAFFIC_STATISTICS = 123,

    /**@brief 字幕流降级。表示HLS字幕轨道声明存在但加载失败（如分片不可达、m3u8无分片等），播放器已静默降级为无字幕播放，主音视频不受影响。额外信息为JSON格式，包含错误码 code 和描述 desc。*/
    /****@brief Subtitle stream degraded. Indicates that an HLS subtitle track is declared but failed to load (e.g. segment unreachable, empty m3u8). The player has silently degraded to no-subtitle playback without affecting main audio/video. Additional information: JSON containing error code and description.*/
    EVENT_PLAYER_SUBTITLE_DEGRADE = 124,

    /**@brief RTS 服务器可能断开连接。*/
    /****@brief RTS server maybe disconnect.*/
    EVENT_PLAYER_RTS_SERVER_MAYBE_DISCONNECT = 0x30010001,
    /**@brief RTS 服务器恢复连接。*/
    /****@brief RTS server recover.*/
    EVENT_PLAYER_RTS_SERVER_RECOVER          = 0x30010002,
} AVPEventWithString;

#endif

