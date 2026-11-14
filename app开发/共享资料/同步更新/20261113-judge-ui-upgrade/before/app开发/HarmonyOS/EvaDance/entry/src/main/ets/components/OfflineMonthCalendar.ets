import { Row as CourseRow } from '../services/Models';
import { CalendarDay, CalendarSegment, CalendarWeek, calendarWeeks } from '../services/OfflineCalendar';
import { SwodTheme } from '../services/SwodTheme';

@Component
export struct OfflineMonthCalendar {
  @Prop @Watch('refresh') courses: CourseRow[] = [];
  onCourse: (row: CourseRow) => void = () => {};
  @State private monthTime: number = Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1);
  @State private weeks: CalendarWeek[] = [];
  private weekdays: string[] = ['一', '二', '三', '四', '五', '六', '日'];
  aboutToAppear(): void { this.refresh(); }
  private refresh(): void { this.weeks = calendarWeeks(this.courses, this.monthTime); }
  private move(offset: number): void { const date = new Date(this.monthTime); this.monthTime = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1); this.refresh(); }
  private current(): void { const date = new Date(); this.monthTime = Date.UTC(date.getFullYear(), date.getMonth(), 1); this.refresh(); }
  private title(): string { const date = new Date(this.monthTime); return date.getUTCFullYear() + '年' + (date.getUTCMonth()+1) + '月'; }
  private hasCourses(): boolean { return this.weeks.some((week: CalendarWeek) => week.segments.length>0); }
  build() {
    Column({space:0}) {
      Row({space:0}) {
        Column({space:4}) { Text(this.title()).fontSize(18).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink); Text('左右滑动切月 · 点击色块查看详情').fontSize(10).fontColor(SwodTheme.muted) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Button('‹').width(40).height(44).fontSize(22).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).onClick(() => this.move(-1)).accessibilityText('上个月')
        Button('本月').width(44).height(44).fontSize(13).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).onClick(() => this.current())
        Button('›').width(40).height(44).fontSize(22).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).onClick(() => this.move(1)).accessibilityText('下个月')
      }.width('100%').padding(8)
      Column({space:0}) {
        Row({space:0}) { ForEach(this.weekdays, (day: string) => { Text('周'+day).fontSize(11).fontColor(SwodTheme.muted).height(40).textAlign(TextAlign.Center).layoutWeight(1) }, (day: string) => day) }.width('100%').backgroundColor(SwodTheme.field)
        ForEach(this.weeks, (week: CalendarWeek) => {
          Stack({alignContent:Alignment.TopStart}) {
            Row({space:0}) {
              ForEach(week.days, (day: CalendarDay) => {
                Column() { Text(String(day.day)).fontSize(14).fontColor(day.today ? SwodTheme.onPrimary : SwodTheme.ink).width(32).height(32).textAlign(TextAlign.Center).borderRadius(16).backgroundColor(day.today ? SwodTheme.primary : Color.Transparent).margin({top:8}).accessibilityText(day.key+(day.today?' 今天':'')) }.height('100%').layoutWeight(1).backgroundColor(day.outside ? SwodTheme.field : SwodTheme.surface).border({width:{right:0.5},color:'#e2e5ea'})
              }, (day: CalendarDay) => day.key)
            }.width('100%').height('100%')
            ForEach(week.segments, (segment: CalendarSegment) => {
              Text(segment.row.name || '线下课程').fontSize(12).fontColor(segment.foreground).maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis}).padding({left:5,right:5}).height(32).width('calc('+segment.width+'% - 4vp)').borderRadius(4).backgroundColor(segment.background).position({x:'calc('+segment.left+'% + 2vp)',y:segment.top}).onClick(() => this.onCourse(segment.row)).accessibilityLevel('yes').accessibilityText((segment.row.name || '线下课程')+'，'+segment.row.start_date+'至'+(segment.row.end_date || segment.row.start_date)+'，查看详情')
            }, (segment: CalendarSegment) => String(segment.key))
          }.width('100%').height(week.height).border({width:{bottom:0.5},color:'#e2e5ea'})
        }, (week: CalendarWeek) => String(week.key))
        if (!this.hasCourses()) { Text('本月暂无课程安排，请切换月份查看。').fontSize(12).fontColor(SwodTheme.muted).padding(16) }
      }.width('100%').gesture(PanGesture({direction:PanDirection.Horizontal,distance:48}).onActionEnd((event: GestureEvent) => { if (Math.abs(event.offsetX)>=48 && Math.abs(event.offsetX)>Math.abs(event.offsetY)*1.5) this.move(event.offsetX<0?1:-1); }))
    }.width('100%').backgroundColor(SwodTheme.surface).borderRadius(12).border({width:1,color:'#e2e5ea'}).clip(true)
  }
}
