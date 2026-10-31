#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "UTDID.h"
#import "UTDevice.h"
#import "AidProtocol.h"

FOUNDATION_EXPORT double UTDIDVersionNumber;
FOUNDATION_EXPORT const unsigned char UTDIDVersionString[];

