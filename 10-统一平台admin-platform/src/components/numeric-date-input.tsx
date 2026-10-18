"use client";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { formatDateInputValue } from "@/lib/date-locale";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  showTime?: boolean;
  id?: string;
  disabled?: boolean;
};
export function NumericDateInput({
  value,
  onChange,
  showTime = false,
  ...props
}: Props) {
  const parsed = value ? dayjs(value) : null;
  return (
    <DatePicker
      {...props}
      style={{ width: "100%" }}
      value={parsed?.isValid() ? parsed : null}
      showTime={showTime ? { format: "HH:mm" } : undefined}
      format={showTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD"}
      onChange={(date) => onChange?.(formatDateInputValue(date, showTime))}
    />
  );
}
