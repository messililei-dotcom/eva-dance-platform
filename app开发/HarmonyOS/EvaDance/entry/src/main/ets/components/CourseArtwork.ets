import { bundledArtwork } from '../services/BundledArtwork';

// Bundled public cover appears immediately; remote source still refreshes over it.
@Component
export struct CourseArtwork {
  @Prop @Watch('reset') url: string = '';
  @State private remoteReady: boolean = false;
  private reset(): void { this.remoteReady = false; }
  build() {
    Stack() {
      if (bundledArtwork(this.url)) {
        Image(bundledArtwork(this.url)).width('100%').height('100%').objectFit(ImageFit.Cover)
      }
      Image(this.url).width('100%').height('100%').objectFit(ImageFit.Cover)
        .opacity(this.remoteReady || !bundledArtwork(this.url) ? 1 : 0)
        .onComplete(() => { this.remoteReady = true; }).onError(() => { this.remoteReady = false; })
    }.width('100%').height('100%').clip(true).accessibilityLevel('no')
  }
}
