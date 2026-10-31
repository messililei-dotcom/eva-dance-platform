import XCTest
import SwiftUI
import UIKit
@testable import EvaDance

final class ArtworkPreviewTests: XCTestCase {
 @MainActor func testOriginalImagesInFixedFrames() async throws {
  let course = URL(string: "https://admin.swod.com.cn/api/course/series/cover/%E5%85%A8%E5%8A%9B%E5%87%BA%E8%82%8C%C2%B7%E8%88%9E%E8%B9%88%E6%A0%B8%E5%BF%83%E9%A3%8E%E6%9A%B4-1792289355493.jpg")!, product = URL(string: "https://www.swod.com.cn/api/shop/images/product-1792571114180-cade2d/942e247abc9e")!
  for url in [course, product] { let (data, _) = try await URLSession.shared.data(from: url); XCTAssertNotNil(UIImage(data: data)) }
  let old: (URL, CGFloat, CGFloat) -> AnyView = { url,w,h in AnyView(ZStack { EvaBrand.softAccent; AsyncImage(url:url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() } }.frame(width:w,height:h).clipShape(RoundedRectangle(cornerRadius:8))) }
  let host = UIHostingController(rootView: VStack(alignment:.leading,spacing:20) {
   Text("公开原图 · 固定图片框对比").font(.headline)
   HStack { Text("调整前：留白底框").frame(width:160); Text("调整后：等比铺满").frame(width:160) }.font(.subheadline)
   HStack(spacing:24) { old(course,160,140); ArtworkImage(url:course,ratio:nil).frame(width:160,height:140) }
   HStack(spacing:24) { old(product,160,160); ArtworkImage(url:product,ratio:1).frame(width:160,height:160) }
   Text("不拉伸、不重复贴图；仅裁切超出固定框的部分。").font(.footnote).foregroundStyle(.secondary)
   Spacer()
  }.padding(16).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading).background(Color.white).padding(.top,60))
  guard let scene=UIApplication.shared.connectedScenes.first as? UIWindowScene else {return XCTFail("No scene")}
  let oldKey=scene.windows.first{$0.isKeyWindow};let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:393,height:852);window.rootViewController=host;window.makeKeyAndVisible()
  defer{window.isHidden=true;oldKey?.makeKeyAndVisible()}
  try await Task.sleep(nanoseconds:3_000_000_000)
  let attachment=XCTAttachment(image:UIGraphicsImageRenderer(bounds:host.view.bounds).image{_ in host.view.drawHierarchy(in:host.view.bounds,afterScreenUpdates:true)})
  attachment.name="fixed-frame-original-images-before-after";attachment.lifetime = .keepAlways;add(attachment)
 }
}
