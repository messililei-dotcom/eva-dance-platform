"use client";
import { ConfigProvider, type ConfigProviderProps } from "antd";
import { numericDateLocale } from "@/lib/date-locale";

export function NumericDateProvider(props: ConfigProviderProps) {
  return <ConfigProvider {...props} locale={numericDateLocale} />;
}
