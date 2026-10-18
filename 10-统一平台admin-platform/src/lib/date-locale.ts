import dayjs from "dayjs";
import chineseDayjs from "dayjs/locale/zh-cn";
import zhCN from "antd/locale/zh_CN";

export const numericMonths = Array.from(
  { length: 12 },
  (_, index) => `${index + 1}月`,
);
dayjs.locale(
  { ...chineseDayjs, months: numericMonths, monthsShort: numericMonths },
  undefined,
  true,
);
dayjs.locale("zh-cn");

const lang = {
  ...zhCN.DatePicker!.lang,
  shortMonths: numericMonths,
  shortWeekDays: ["日", "一", "二", "三", "四", "五", "六"],
  monthFormat: "M月",
  yearFormat: "YYYY年",
  monthBeforeYear: false,
  fieldDateFormat: "YYYY-MM-DD",
  fieldDateTimeFormat: "YYYY-MM-DD HH:mm:ss",
  fieldMonthFormat: "YYYY-MM",
  fieldYearFormat: "YYYY",
  fieldWeekFormat: "gggg年第w周",
  fieldQuarterFormat: "YYYY年第Q季度",
  previousMonth: "上个月",
  nextMonth: "下个月",
  previousYear: "上一年",
  nextYear: "下一年",
};
export const numericDateLocale = {
  ...zhCN,
  DatePicker: { ...zhCN.DatePicker!, lang },
  Calendar: { ...zhCN.Calendar!, lang },
};

// Native input replacements retain the stored string and local wall time.
export function formatDateInputValue(
  value: dayjs.Dayjs | null,
  showTime = false,
) {
  return value?.isValid()
    ? value.format(showTime ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD")
    : "";
}
